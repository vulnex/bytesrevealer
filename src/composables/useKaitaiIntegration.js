import { ref, computed, watch } from 'vue'
import { useFormatStore } from '../stores/format'
import { createLogger } from '../utils/logger'

const logger = createLogger('KaitaiIntegration')

/**
 * Composable for Kaitai struct parsing, format detection, and structure navigation.
 */
export function useKaitaiIntegration(props, { hoveredByte, visibleRange, containerRef }) {
  const formatStore = useFormatStore()

  const kaitaiRuntime = ref(null)
  const activeTab = ref('inspector')
  const kaitaiSupported = ref(false)
  const kaitaiLoading = ref(false)
  const kaitaiError = ref(null)
  const structureHighlight = ref(null)

  const BYTES_PER_ROW = 16
  const ROW_HEIGHT = 24

  const kaitaiStructures = computed(() => formatStore.kaitaiStructures)
  const detectedFormat = computed(() => formatStore.formatName)
  const hasKsyFormat = computed(() => {
    return kaitaiStructures.value && kaitaiStructures.value.length > 0
  })

  const initializeKaitai = async () => {
    try {
      const { getKaitaiRuntime } = await import('../kaitai/runtime/KaitaiRuntime')
      kaitaiRuntime.value = getKaitaiRuntime()

      if (!kaitaiRuntime.value || !kaitaiRuntime.value.formatRegistry) {
        throw new Error('KaitaiRuntime not properly initialized')
      }

      await kaitaiRuntime.value.formatRegistry.initialize()

      const MAX_KAITAI_SIZE = 500 * 1024 * 1024
      if (props.fileBytes && props.fileBytes.length > MAX_KAITAI_SIZE) {
        logger.warn('File too large for Kaitai structure parsing (>500MB)')
        kaitaiSupported.value = false
        kaitaiError.value = 'File too large for structure parsing (>500MB)'
        return
      }

      formatStore.clearFormat()
      kaitaiSupported.value = true
    } catch (error) {
      logger.error('Failed to initialize Kaitai:', error)
      kaitaiError.value = 'Failed to initialize structure parser'
      kaitaiSupported.value = false
    }
  }

  const parseViewport = async (formatId = null) => {
    if (!kaitaiRuntime.value) {
      logger.warn('No Kaitai runtime available')
      return
    }

    const COMPLEX_FORMAT_SIZE_LIMIT = 100 * 1024 * 1024
    const complexFormats = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']
    const currentFormat = formatId || detectedFormat.value

    if (props.fileBytes &&
        props.fileBytes.length > COMPLEX_FORMAT_SIZE_LIMIT &&
        currentFormat &&
        complexFormats.some(f => currentFormat.toLowerCase().includes(f))) {
      logger.warn(`Large ${currentFormat} file (>${COMPLEX_FORMAT_SIZE_LIMIT / 1024 / 1024}MB) - parsing may be slow`)
    }

    try {
      kaitaiLoading.value = true
      kaitaiError.value = null

      logger.debug('parseViewport called with formatId:', formatId)

      const MAX_VIEWPORT_SIZE = 1024 * 1024
      const startByte = 0
      const visibleStart = visibleRange.value.start * BYTES_PER_ROW
      const requestedEndByte = visibleRange.value.end * BYTES_PER_ROW

      const maxEndByte = Math.max(visibleStart + MAX_VIEWPORT_SIZE, MAX_VIEWPORT_SIZE)
      const endByte = Math.min(
        Math.max(requestedEndByte, MAX_VIEWPORT_SIZE),
        maxEndByte,
        props.fileBytes.length
      )

      logger.debug(`Parsing bytes ${startByte} to ${endByte} (max viewport: ${MAX_VIEWPORT_SIZE / 1024}KB) with format: ${formatId}`)

      const fields = await kaitaiRuntime.value.parseViewport(
        props.fileBytes,
        startByte,
        endByte,
        formatId
      )

      if (Array.isArray(fields)) {
        const structures = fields.map(field => {
          const structure = {
            name: field.name,
            value: field.value,
            offset: field.offset,
            size: field.size,
            fields: field.fields || []
          }
          logger.debug(`Creating structure for ${field.name}: offset=${structure.offset}, size=${structure.size}`)
          return structure
        })
        formatStore.setStructures(structures)
        logger.debug('kaitaiStructures set to:', structures)
      } else {
        formatStore.setStructures([])
      }
    } catch (error) {
      logger.error('Parse error:', error)
      kaitaiError.value = 'Failed to parse file structure'
    } finally {
      kaitaiLoading.value = false
    }
  }

  const handleStructureHover = (structure) => {
    logger.debug('handleStructureHover called with:', structure)
    if (structure && structure.offset !== undefined && structure.size !== undefined) {
      const range = {
        start: structure.offset,
        end: structure.offset + (structure.size || 1)
      }
      logger.debug('Setting highlight range:', range)
      structureHighlight.value = range
      hoveredByte.value = structure.offset
    } else {
      logger.debug('Clearing highlight')
      structureHighlight.value = null
    }
  }

  const handleStructureSelect = (structure) => {
    if (structure && structure.offset !== undefined) {
      const row = Math.floor(structure.offset / BYTES_PER_ROW)
      if (containerRef.value) {
        containerRef.value.scrollTop = row * ROW_HEIGHT
      }
      hoveredByte.value = structure.offset
    }
  }

  const handleStructureHighlight = (range) => {
    structureHighlight.value = range
  }

  const handleFormatChanged = async (event) => {
    try {
      kaitaiLoading.value = true
      kaitaiError.value = null

      if (event.cleared || !event.format) {
        formatStore.clearFormat()
        logger.debug('Format cleared - structure view reset')
        return
      }

      const format = event.format
      formatStore.setFormat({ ...format })
      logger.debug(`Format changed to: ${formatStore.formatName}`, format)

      if (!kaitaiRuntime.value) {
        logger.debug('Initializing Kaitai runtime...')
        await initializeKaitai()
      }

      let formatId = format.id
      let registerId = format.id

      if (formatId && formatId.startsWith('ksy_')) {
        formatId = formatId.substring(4)
        registerId = formatId
      }

      if (format.parser && kaitaiRuntime.value) {
        logger.debug('Registering parser with ID:', registerId)
        await kaitaiRuntime.value.formatRegistry.registerFormat({
          id: registerId,
          name: format.name,
          parser: format.parser,
          metadata: format.metadata || {}
        })
      } else if (kaitaiRuntime.value) {
        logger.debug('Registering format metadata with ID:', registerId)
        await kaitaiRuntime.value.formatRegistry.registerFormat({
          id: registerId,
          name: format.name,
          parser: null,
          metadata: format.metadata || {}
        })
      }

      logger.debug('Parsing viewport with format ID:', formatId)
      await parseViewport(formatId)
    } catch (error) {
      logger.error('Format change error:', error)
      kaitaiError.value = `Failed to apply format: ${error.message}`
    } finally {
      kaitaiLoading.value = false
    }
  }

  // Watch for file changes
  watch(() => props.fileBytes, async () => {
    if (kaitaiRuntime.value) {
      await initializeKaitai()
    }
  })

  return {
    kaitaiRuntime,
    activeTab,
    hasKsyFormat,
    kaitaiSupported,
    kaitaiStructures,
    kaitaiLoading,
    kaitaiError,
    detectedFormat,
    structureHighlight,
    initializeKaitai,
    parseViewport,
    handleStructureHover,
    handleStructureSelect,
    handleStructureHighlight,
    handleFormatChanged
  }
}
