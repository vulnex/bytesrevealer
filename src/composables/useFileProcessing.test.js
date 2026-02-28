import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useFormatStore } from '../stores/format'
import { useYaraStore } from '../stores/yara'

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('../utils/fileHandler', () => ({
  processFileInChunks: vi.fn(),
  analyzeFileInChunks: vi.fn().mockResolvedValue({ entropy: 5.5 }),
  validateFileSize: vi.fn().mockReturnValue(false),
  formatFileSize: vi.fn((size) => `${size} bytes`),
  calculateFileHashes: vi.fn().mockResolvedValue({ md5: 'abc', sha1: 'def', sha256: 'ghi' }),
  detectFileType: vi
    .fn()
    .mockResolvedValue({ ext: 'bin', mime: 'application/octet-stream', description: 'Binary' }),
  FILE_LIMITS: { ANALYSIS_SIZE_LIMIT: 50 * 1024 * 1024 }
}))

vi.mock('../utils/fileSignatures', () => ({
  FILE_SIGNATURES: [],
  detectFileTypes: vi.fn().mockReturnValue([]),
  isFileType: vi.fn().mockReturnValue(false)
}))

vi.mock('../utils/advancedFileDetection', () => ({
  findPEHeaderOffset: vi.fn(),
  analyzePEStructure: vi.fn(),
  detectSpecificFileType: vi.fn().mockResolvedValue([]),
  detectNestedFiles: vi.fn().mockResolvedValue([])
}))

vi.mock('../utils/FileChunkManager', () => ({
  default: {
    initialize: vi.fn().mockResolvedValue(new Uint8Array()),
    clear: vi.fn().mockResolvedValue()
  }
}))

vi.mock('../utils/entropyOptimized', () => ({
  calculateOptimizedEntropy: vi.fn().mockReturnValue({
    globalEntropy: 7.2,
    processedBytes: 1000,
    totalBytes: 10000
  })
}))

function withSetup(fn) {
  let result
  const app = createApp({
    setup() {
      result = fn()
      return () => {}
    }
  })
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  app.mount(document.createElement('div'))
  return [result, app]
}

describe('useFileProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  async function loadComposable() {
    const { useFileProcessing } = await import('./useFileProcessing')
    return withSetup(() => useFileProcessing())
  }

  describe('initial state', () => {
    it('fileBytes is empty Uint8Array', async () => {
      const [result, app] = await loadComposable()
      expect(result.fileBytes.value).toBeInstanceOf(Uint8Array)
      expect(result.fileBytes.value.length).toBe(0)
      app.unmount()
    })

    it('fileName is null', async () => {
      const [result, app] = await loadComposable()
      expect(result.fileName.value).toBeNull()
      app.unmount()
    })

    it('entropy is 0', async () => {
      const [result, app] = await loadComposable()
      expect(result.entropy.value).toBe(0)
      app.unmount()
    })

    it('hashes are empty strings', async () => {
      const [result, app] = await loadComposable()
      expect(result.hashes.value).toEqual({ md5: '', sha1: '', sha256: '' })
      app.unmount()
    })

    it('fileSignatures is empty', async () => {
      const [result, app] = await loadComposable()
      expect(result.fileSignatures.value).toEqual([])
      app.unmount()
    })

    it('detectedFileType is null', async () => {
      const [result, app] = await loadComposable()
      expect(result.detectedFileType.value).toBeNull()
      app.unmount()
    })

    it('error is null', async () => {
      const [result, app] = await loadComposable()
      expect(result.error.value).toBeNull()
      app.unmount()
    })

    it('progress is 0', async () => {
      const [result, app] = await loadComposable()
      expect(result.progress.value).toBe(0)
      app.unmount()
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes', async () => {
      const [result, app] = await loadComposable()
      expect(result.formatFileSize(500)).toBe('500.0 B')
      app.unmount()
    })

    it('formats kilobytes', async () => {
      const [result, app] = await loadComposable()
      expect(result.formatFileSize(2048)).toBe('2.0 KB')
      app.unmount()
    })

    it('formats megabytes', async () => {
      const [result, app] = await loadComposable()
      expect(result.formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
      app.unmount()
    })

    it('formats gigabytes', async () => {
      const [result, app] = await loadComposable()
      expect(result.formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB')
      app.unmount()
    })
  })

  describe('calculateEntropy', () => {
    it('returns 0 for empty input', async () => {
      const [result, app] = await loadComposable()
      expect(result.calculateEntropy(new Uint8Array())).toBe(0)
      expect(result.calculateEntropy(null)).toBe(0)
      app.unmount()
    })

    it('returns 0 for uniform bytes', async () => {
      const [result, app] = await loadComposable()
      const uniform = new Uint8Array(100).fill(0)
      expect(result.calculateEntropy(uniform)).toBe(0)
      app.unmount()
    })

    it('returns positive entropy for varied bytes', async () => {
      const [result, app] = await loadComposable()
      const varied = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])
      const ent = result.calculateEntropy(varied)
      expect(ent).toBeGreaterThan(0)
      expect(ent).toBe(3) // 8 equally likely values = log2(8) = 3
      app.unmount()
    })
  })

  describe('showSizeWarning', () => {
    it('calls window.confirm with formatted message', async () => {
      const confirmMock = vi.fn().mockReturnValue(true)
      vi.stubGlobal('confirm', confirmMock)
      const [result, app] = await loadComposable()
      const proceed = await result.showSizeWarning(1024)
      expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining('1024 bytes'))
      expect(proceed).toBe(true)
      vi.unstubAllGlobals()
      app.unmount()
    })

    it('returns false when user cancels', async () => {
      const confirmMock = vi.fn().mockReturnValue(false)
      vi.stubGlobal('confirm', confirmMock)
      const [result, app] = await loadComposable()
      const proceed = await result.showSizeWarning(1024)
      expect(proceed).toBe(false)
      vi.unstubAllGlobals()
      app.unmount()
    })
  })

  describe('isSpecificFileType', () => {
    it('delegates to isFileType', async () => {
      const { isFileType } = await import('../utils/fileSignatures')
      const [result, app] = await loadComposable()
      result.isSpecificFileType('pe')
      expect(isFileType).toHaveBeenCalled()
      app.unmount()
    })
  })

  describe('resetFile', () => {
    it('clears all state and calls external resets', async () => {
      const [result, app] = await loadComposable()
      result.fileBytes.value = new Uint8Array([1, 2, 3])
      result.fileName.value = 'test.bin'
      result.entropy.value = 5.5
      result.error.value = 'some error'

      const fileInputRef = ref({ value: 'test.bin' })
      const resetSearch = vi.fn()
      const resetAnnotations = vi.fn()
      const resetFeatures = vi.fn()

      await result.resetFile(fileInputRef, { resetSearch, resetAnnotations, resetFeatures })

      expect(result.fileBytes.value.length).toBe(0)
      expect(result.fileName.value).toBeNull()
      expect(result.entropy.value).toBe(0)
      expect(result.error.value).toBeNull()
      expect(result.hashes.value).toEqual({ md5: '', sha1: '', sha256: '' })
      expect(result.fileSignatures.value).toEqual([])
      expect(result.detectedFileType.value).toBeNull()
      expect(resetSearch).toHaveBeenCalled()
      expect(resetAnnotations).toHaveBeenCalled()
      expect(resetFeatures).toHaveBeenCalled()
      app.unmount()
    })

    it('resets YARA store', async () => {
      const [result, app] = await loadComposable()
      const yaraStore = useYaraStore()
      const spy = vi.spyOn(yaraStore, 'reset')

      await result.resetFile(ref(null), {
        resetSearch: vi.fn(),
        resetAnnotations: vi.fn(),
        resetFeatures: vi.fn()
      })

      expect(spy).toHaveBeenCalled()
      app.unmount()
    })

    it('resets format store', async () => {
      const [result, app] = await loadComposable()
      const formatStore = useFormatStore()
      const spy = vi.spyOn(formatStore, 'resetForFile')

      await result.resetFile(ref(null), {
        resetSearch: vi.fn(),
        resetAnnotations: vi.fn(),
        resetFeatures: vi.fn()
      })

      expect(spy).toHaveBeenCalled()
      app.unmount()
    })

    it('clears file input ref', async () => {
      const [result, app] = await loadComposable()
      const inputEl = { value: 'test.bin' }
      const fileInputRef = ref(inputEl)

      await result.resetFile(fileInputRef, {
        resetSearch: vi.fn(),
        resetAnnotations: vi.fn(),
        resetFeatures: vi.fn()
      })

      expect(inputEl.value).toBe('')
      app.unmount()
    })
  })

  describe('handleFileUpload', () => {
    function makeFileEvent(name = 'test.bin', size = 100, content = [1, 2, 3]) {
      const buffer = new Uint8Array(content).buffer
      const file = new File([buffer], name, { type: 'application/octet-stream' })
      Object.defineProperty(file, 'size', { value: size })
      return { target: { files: [file] } }
    }

    it('loads a small file successfully', async () => {
      const [result, app] = await loadComposable()
      const event = makeFileEvent('small.bin', 100, [1, 2, 3])
      const opts = {
        features: { fileAnalysis: false },
        hasSessionData: ref(false),
        pendingSessionFile: ref(null),
        coloredBytes: ref([]),
        activeTab: ref('info'),
        onSessionClear: vi.fn()
      }

      await result.handleFileUpload(event, opts)

      expect(result.fileName.value).toBe('small.bin')
      expect(result.fileBytes.value.length).toBeGreaterThan(0)
      expect(opts.activeTab.value).toBe('visual')
      app.unmount()
    })

    it('does nothing when no file selected', async () => {
      const [result, app] = await loadComposable()
      const event = { target: { files: [] } }
      await result.handleFileUpload(event, {})
      expect(result.fileName.value).toBeNull()
      app.unmount()
    })

    it('sets error when file validation fails and user cancels', async () => {
      const { validateFileSize } = await import('../utils/fileHandler')
      validateFileSize.mockReturnValue(true) // triggers size warning
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))

      const [result, app] = await loadComposable()
      const event = makeFileEvent('big.bin', 200 * 1024 * 1024)
      const opts = {
        features: { fileAnalysis: false },
        hasSessionData: ref(false),
        pendingSessionFile: ref(null),
        coloredBytes: ref([]),
        activeTab: ref('info'),
        onSessionClear: vi.fn()
      }

      await result.handleFileUpload(event, opts)

      expect(result.error.value).toBe('File loading cancelled')
      vi.unstubAllGlobals()
      app.unmount()
    })
  })

  describe('detectFileSignatures', () => {
    it('handles errors gracefully', async () => {
      const { detectSpecificFileType } = await import('../utils/advancedFileDetection')
      detectSpecificFileType.mockRejectedValueOnce(new Error('detection failed'))

      const [result, app] = await loadComposable()
      result.fileBytes.value = new Uint8Array([1, 2, 3])

      await result.detectFileSignatures()

      expect(result.error.value).toContain('detection failed')
      expect(result.fileSignatures.value).toEqual([])
      app.unmount()
    })

    it('skips when no file bytes', async () => {
      const [result, app] = await loadComposable()
      await result.detectFileSignatures()
      expect(result.fileSignatures.value).toEqual([])
      app.unmount()
    })
  })
})
