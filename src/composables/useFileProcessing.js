import { ref, reactive, watch } from 'vue'
import {
  analyzeBytes,
  validateFileSize,
  formatFileSize as formatFileSizeUtil,
  calculateFileHashes,
  detectFileType,
  FILE_LIMITS
} from '../utils/fileHandler'
import { isFileType } from '../utils/fileSignatures'
import { detectSpecificFileType, detectNestedFiles } from '../utils/advancedFileDetection'
import { useFormatStore } from '../stores/format'
import { useYaraStore } from '../stores/yara'
import { useSettingsStore } from '../stores/settings'
import { createLogger } from '../utils/logger'
import fileChunkManager from '../utils/FileChunkManager'
import { calculateOptimizedEntropy } from '../utils/entropyOptimized'
import { applyOverlayBounds } from '../utils/embeddedExecutableExtents'

const logger = createLogger('FileProcessing')

/**
 * Composable for file upload, loading, analysis (entropy, hashes, signatures), and chunk management.
 */
export function useFileProcessing() {
  const fileBytes = ref(new Uint8Array())
  const fileName = ref(null)
  const entropy = ref(0)
  const fileSignatures = ref([])
  const hashes = ref({
    md5: '',
    sha1: '',
    sha256: ''
  })
  const detectedFileType = ref(null)
  const loading = reactive({
    file: false,
    analysis: false,
    search: false
  })
  const progress = ref(0)
  const error = ref(null)
  const chunkManager = ref(null)
  const embeddedExecutables = ref([])
  const embeddedScan = reactive({
    inProgress: false,
    scanned: 0,
    total: 0,
    cancelled: false,
    truncated: false,
    hasRun: false
  })

  // Worker handle and a per-scan token so stale messages from a terminated
  // worker can't mutate state for a subsequent scan.
  let embeddedScanWorker = null
  let embeddedScanToken = 0

  // Cancel any in-flight scan if the user disables the feature mid-scan.
  const settingsStore = useSettingsStore()
  watch(
    () => settingsStore.enableEmbeddedExecutableScan,
    (enabled) => {
      if (!enabled && embeddedScan.inProgress) {
        cancelEmbeddedScan()
      }
    }
  )

  function resetProgress() {
    progress.value = 0
  }

  function showSizeWarning(fileSize) {
    return new Promise((resolve) => {
      const size = formatFileSizeUtil(fileSize)
      const message = `The file is ${size}. Processing large files may cause performance issues. Continue?`
      resolve(window.confirm(message))
    })
  }

  function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  function calculateEntropy(bytes) {
    if (!bytes || bytes.length === 0) return 0

    const frequencies = new Array(256).fill(0)
    for (const byte of bytes) {
      frequencies[byte]++
    }

    let ent = 0
    const len = bytes.length

    for (let i = 0; i < 256; i++) {
      if (frequencies[i] > 0) {
        const probability = frequencies[i] / len
        ent -= probability * Math.log2(probability)
      }
    }

    return ent
  }

  function isSpecificFileType(format) {
    return isFileType(fileBytes.value, format)
  }

  function teardownEmbeddedScanWorker() {
    if (embeddedScanWorker) {
      embeddedScanWorker.onmessage = null
      embeddedScanWorker.onerror = null
      embeddedScanWorker.terminate()
      embeddedScanWorker = null
    }
  }

  function resetEmbeddedScanState() {
    embeddedExecutables.value = []
    embeddedScan.inProgress = false
    embeddedScan.scanned = 0
    embeddedScan.total = 0
    embeddedScan.cancelled = false
    embeddedScan.truncated = false
    embeddedScan.hasRun = false
  }

  function cancelEmbeddedScan() {
    if (!embeddedScan.inProgress) return
    if (embeddedScanWorker) embeddedScanWorker.postMessage({ type: 'cancel' })
    embeddedScan.cancelled = true
  }

  async function runEmbeddedExecutableScan() {
    teardownEmbeddedScanWorker()
    embeddedScanToken++
    const token = embeddedScanToken

    embeddedExecutables.value = []
    embeddedScan.scanned = 0
    embeddedScan.total = fileBytes.value.length
    embeddedScan.cancelled = false
    embeddedScan.truncated = false
    embeddedScan.hasRun = false

    const settingsStore = useSettingsStore()
    if (!settingsStore.enableEmbeddedExecutableScan) {
      embeddedScan.inProgress = false
      embeddedScan.hasRun = false
      return
    }

    if (!fileBytes.value || fileBytes.value.length < 64) {
      embeddedScan.inProgress = false
      embeddedScan.hasRun = true
      return
    }

    embeddedScan.inProgress = true

    let worker
    try {
      worker = new Worker(new URL('../workers/EmbeddedScanWorker.js', import.meta.url), {
        type: 'module'
      })
    } catch (err) {
      logger.error('Failed to spawn embedded-scan worker:', err)
      embeddedScan.inProgress = false
      embeddedScan.hasRun = true
      return
    }
    embeddedScanWorker = worker

    worker.onmessage = (event) => {
      if (token !== embeddedScanToken) return
      const msg = event.data
      switch (msg.type) {
        case 'finding': {
          const { type: _type, ...finding } = msg
          embeddedExecutables.value.push(finding)
          break
        }
        case 'progress':
          embeddedScan.scanned = msg.scanned
          if (typeof msg.total === 'number') embeddedScan.total = msg.total
          break
        case 'done':
          applyOverlayBounds(embeddedExecutables.value, fileBytes.value?.length ?? 0)
          embeddedScan.cancelled = !!msg.cancelled
          embeddedScan.truncated = !!msg.truncated
          embeddedScan.inProgress = false
          embeddedScan.hasRun = true
          teardownEmbeddedScanWorker()
          break
        case 'error':
          logger.error('Embedded-scan worker error:', msg.message)
          embeddedScan.inProgress = false
          embeddedScan.hasRun = true
          teardownEmbeddedScanWorker()
          break
      }
    }
    worker.onerror = (event) => {
      if (token !== embeddedScanToken) return
      logger.error('Embedded-scan worker crash:', event.message || event)
      embeddedScan.inProgress = false
      embeddedScan.hasRun = true
      teardownEmbeddedScanWorker()
    }

    worker.postMessage({ type: 'scan', totalSize: fileBytes.value.length })

    const CHUNK = 10 * 1024 * 1024
    const total = fileBytes.value.length
    for (let start = 0; start < total; start += CHUNK) {
      if (token !== embeddedScanToken) return
      if (embeddedScan.cancelled) break
      const end = Math.min(start + CHUNK, total)
      const slice = fileBytes.value.slice(start, end)
      worker.postMessage({ type: 'chunk', start, bytes: slice, isFinal: end === total }, [
        slice.buffer
      ])
      if (((start / CHUNK) | 0) % 4 === 3) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
  }

  async function detectFileSignaturesFromBytes() {
    if (!fileBytes.value || !fileBytes.value.length) {
      logger.warn('No file bytes available for signature detection')
      return
    }

    try {
      const enhancedTypes = await detectSpecificFileType(fileBytes.value)
      const nestedFiles = await detectNestedFiles(fileBytes.value)

      fileSignatures.value = enhancedTypes.map((type) => ({
        ...type,
        nestedFiles: nestedFiles.filter(
          (nested) =>
            nested.offset >= type.offset &&
            nested.offset < type.offset + (type.size || fileBytes.value.length)
        )
      }))

      if (fileSignatures.value.length > 0) {
        logger.debug('Detected signatures:', fileSignatures.value)
      } else {
        logger.debug('No known file signatures detected')
      }
    } catch (err) {
      logger.error('Error detecting file signatures:', err)
      error.value = `Failed to detect file signatures: ${err.message}`
      fileSignatures.value = []
    }
  }

  async function handleFileUpload(
    event,
    { features, hasSessionData, pendingSessionFile, coloredBytes, activeTab, onSessionClear }
  ) {
    const file = event.target.files[0]
    if (!file) return

    try {
      loading.file = true
      error.value = null
      resetProgress()

      const isSessionFileReload =
        hasSessionData.value && pendingSessionFile.value?.name === file.name

      if (!isSessionFileReload) {
        coloredBytes.value = []
      }

      fileName.value = file.name

      try {
        const showWarning = validateFileSize(file)
        if (showWarning) {
          const proceed = await showSizeWarning(file.size)
          if (!proceed) {
            loading.file = false
            error.value = 'File loading cancelled'
            return
          }
        }
      } catch (err) {
        loading.file = false
        error.value = err.message
        return
      }

      // Clear session pending state
      onSessionClear()

      // Reset format store for new file
      const formatStore = useFormatStore()
      formatStore.resetForFile()

      // Clear any previous chunk data
      if (chunkManager.value) {
        await fileChunkManager.clear()
        chunkManager.value = null
      }

      // Cancel any in-flight embedded-executable scan from a previous file.
      teardownEmbeddedScanWorker()
      resetEmbeddedScanState()

      logger.info(`Loading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

      if (file.size > 100 * 1024 * 1024) {
        error.value = `Loading large file (${(file.size / 1024 / 1024).toFixed(0)}MB). This may take a moment...`
      }

      await new Promise((resolve) => setTimeout(resolve, 10))

      if (file.size > 50 * 1024 * 1024) {
        logger.info('Using chunk manager for large file')

        fileBytes.value = await fileChunkManager.initialize(file)

        if (fileBytes.value.isChunked) {
          logger.info('File loaded with chunking enabled')
          chunkManager.value = fileChunkManager
        }
      } else {
        const buffer = await file.arrayBuffer()
        fileBytes.value = new Uint8Array(buffer)
        chunkManager.value = null
      }

      logger.info(`File loaded: ${fileBytes.value.length} bytes`)

      if (file.size > 100 * 1024 * 1024) {
        error.value = null
      }

      const isLargeFile = file.size > FILE_LIMITS.ANALYSIS_SIZE_LIMIT

      // Detect file type
      try {
        detectedFileType.value = await detectFileType(file)

        if (
          detectedFileType.value &&
          detectedFileType.value.ext === 'zip' &&
          file.name.toLowerCase().endsWith('.app.zip')
        ) {
          detectedFileType.value.description = 'macOS Application Bundle (ZIP)'
        }
      } catch (err) {
        logger.warn('File type detection from File object failed, trying from loaded bytes:', err)

        if (fileBytes.value && fileBytes.value.length > 0) {
          try {
            const firstBytes = fileBytes.value.isProgressive
              ? await fileBytes.value.slice(0, Math.min(1024 * 1024, fileBytes.value.length))
              : fileBytes.value

            detectedFileType.value = await detectFileType(firstBytes)
          } catch (err2) {
            logger.error('File type detection from bytes also failed:', err2)
            detectedFileType.value = {
              detected: false,
              ext: 'unknown',
              mime: 'application/octet-stream',
              description: 'Unable to detect file type',
              confidence: 'none'
            }
          }
        }
      }

      if (isLargeFile) {
        error.value = `File size exceeds 50MB. Using optimized analysis mode.`
      }

      // Set active tab based on features
      if (features.fileAnalysis) {
        activeTab.value = 'file'
      } else {
        activeTab.value = 'visual'
      }

      // Perform file analysis if selected
      if (features.fileAnalysis) {
        loading.analysis = true
        try {
          await detectFileSignaturesFromBytes()
          progress.value = 20
          // Kick off embedded-executable scan in a worker; do not await — it
          // populates embeddedExecutables reactively as findings stream in.
          runEmbeddedExecutableScan().catch((err) =>
            logger.error('runEmbeddedExecutableScan failed:', err)
          )

          if (isLargeFile) {
            hashes.value = {
              md5: 'N/A (file > 50MB)',
              sha1: 'N/A (file > 50MB)',
              sha256: 'N/A (file > 50MB)'
            }

            const entropyResult = calculateOptimizedEntropy(fileBytes.value, {
              blockSize: 256,
              maxBlocks: 1000,
              sampleRate: 0.1
            })
            entropy.value = entropyResult.globalEntropy
            logger.info(`Calculated entropy using optimized sampling: ${entropy.value.toFixed(4)}`)
            logger.info(
              `Processed ${formatFileSize(entropyResult.processedBytes)} of ${formatFileSize(entropyResult.totalBytes)}`
            )

            progress.value = 100
          } else {
            const hashResult = await calculateFileHashes(file, (prog) => {
              progress.value = 20 + prog * 0.4
            })
            hashes.value = hashResult

            detectedFileType.value = await detectFileType(file)

            // Compute byte-frequency + entropy synchronously from the bytes
            // we already loaded above. The legacy `analyzeFileInChunks(file)`
            // path re-read the file via FileReader in 128 KB chunks with a
            // setTimeout(0) yield per chunk — 15-30 s of redundant overhead
            // since `fileBytes.value` already holds the same bytes in memory.
            const results = analyzeBytes(fileBytes.value, { fileAnalysis: true })
            entropy.value = results.entropy

            progress.value = 100
          }

          activeTab.value = 'file'
        } catch (err) {
          logger.error('Analysis error:', err)
          error.value = `Analysis error: ${err.message}`
          entropy.value = 0
          fileSignatures.value = []
          hashes.value = { md5: '', sha1: '', sha256: '' }

          activeTab.value = 'visual'
        } finally {
          loading.analysis = false
        }
      } else {
        activeTab.value = 'visual'
      }
    } catch (err) {
      logger.error('File processing error:', err)
      error.value = err.message
    } finally {
      loading.file = false
      loading.analysis = false
      resetProgress()
    }
  }

  async function resetFile(fileInputRef, { resetSearch, resetAnnotations, resetFeatures }) {
    fileBytes.value = new Uint8Array()
    fileName.value = null
    entropy.value = 0
    fileSignatures.value = []
    hashes.value = { md5: '', sha1: '', sha256: '' }
    detectedFileType.value = null
    error.value = null
    progress.value = 0

    // Clear chunk manager
    if (chunkManager.value) {
      fileChunkManager.clear()
      chunkManager.value = null
    }

    // Cancel and clear embedded-executable scan
    teardownEmbeddedScanWorker()
    resetEmbeddedScanState()

    // Reset file input
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }

    // Reset loading states
    loading.file = false
    loading.analysis = false
    loading.search = false

    // Reset YARA store
    useYaraStore().reset()

    // Reset format store
    const formatStore = useFormatStore()
    formatStore.resetForFile()

    // Call external resets
    resetSearch()
    resetAnnotations()
    resetFeatures()

    logger.info('File and analysis data cleared, all features enabled')
  }

  return {
    fileBytes,
    fileName,
    entropy,
    fileSignatures,
    hashes,
    detectedFileType,
    loading,
    progress,
    error,
    chunkManager,
    embeddedExecutables,
    embeddedScan,
    FILE_LIMITS,
    handleFileUpload,
    detectFileSignatures: detectFileSignaturesFromBytes,
    cancelEmbeddedScan,
    resetFile,
    showSizeWarning,
    resetProgress,
    formatFileSize,
    calculateEntropy,
    isSpecificFileType
  }
}
