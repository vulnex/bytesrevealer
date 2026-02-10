import { ref, computed } from 'vue'
import { createLogger } from '../utils/logger'

const logger = createLogger('HexExport')

/**
 * Composable for context menu, export dialogs, and toast notifications.
 */
export function useHexExport(props, { baseOffset, selectionStart, selectionEnd, emit }) {
  // Context menu state
  const contextMenu = ref({
    visible: false,
    position: { x: 0, y: 0 },
    selectedBytes: new Uint8Array()
  })

  // Toast notification state
  const toast = ref({
    show: false,
    message: '',
    type: 'success'
  })

  // Export dialog state
  const exportDialog = ref({
    visible: false,
    selectedBytes: new Uint8Array()
  })

  // Export range dialog state
  const exportRangeDialog = ref({
    visible: false,
    initialStart: 0,
    initialEnd: 0
  })

  const totalSize = computed(() => props.fileBytes ? props.fileBytes.length : 0)
  const fileData = computed(() => props.fileBytes)

  const handleContextMenu = (event) => {
    event.preventDefault()

    logger.debug(`Context menu opened. Selection: start=${selectionStart.value}, end=${selectionEnd.value}`)

    let selectedBytes = new Uint8Array()

    if (selectionStart.value !== null && selectionEnd.value !== null) {
      const start = Math.min(selectionStart.value, selectionEnd.value) - baseOffset.value
      const end = Math.max(selectionStart.value, selectionEnd.value) - baseOffset.value + 1

      if (start >= 0 && end <= props.fileBytes.length) {
        selectedBytes = props.fileBytes.slice(start, end)
        logger.info(`Context menu: selected ${end - start} bytes from offset ${start} to ${end}`)
      } else {
        logger.warn(`Invalid selection range: ${start} to ${end}`)
      }
    } else {
      const element = event.target.closest('[data-byte-index]')
      if (element) {
        const displayOffset = parseInt(element.dataset.byteIndex)
        const actualOffset = displayOffset - baseOffset.value

        if (actualOffset >= 0 && actualOffset < props.fileBytes.length) {
          selectedBytes = props.fileBytes.slice(actualOffset, actualOffset + 1)
          logger.debug(`Context menu: selected single byte at offset ${actualOffset}`)
        }
      }
    }

    let clickedOffset = null
    const clickedElement = event.target.closest('[data-byte-index]')
    if (clickedElement) {
      clickedOffset = parseInt(clickedElement.dataset.byteIndex) - baseOffset.value
    }

    logger.info(`Opening context menu with ${selectedBytes.length} bytes selected`)
    contextMenu.value = {
      visible: true,
      position: { x: event.clientX, y: event.clientY },
      selectedBytes,
      clickedOffset
    }
  }

  const closeContextMenu = () => {
    contextMenu.value.visible = false
  }

  const showToast = (message, type = 'success') => {
    toast.value = { show: true, message, type }
    setTimeout(() => { toast.value.show = false }, 100)
  }

  const handleAddBookmark = (offset) => {
    emit('add-bookmark', offset)
    showToast(`Bookmark added at offset 0x${offset.toString(16).toUpperCase()}`)
  }

  const handleAddAnnotation = ({ startOffset, endOffset }) => {
    emit('add-annotation', { startOffset, endOffset })
    showToast(`Annotation added for range 0x${startOffset.toString(16).toUpperCase()}-0x${endOffset.toString(16).toUpperCase()}`)
  }

  const handleCopyResult = (result) => {
    if (result.success) {
      logger.info(`Copied ${result.bytesCount} bytes as ${result.format}`)
      showToast(`Copied ${result.bytesCount} byte${result.bytesCount !== 1 ? 's' : ''} as ${result.format}`)
    } else {
      logger.error(`Failed to copy: ${result.error}`)
      showToast(result.error || 'Failed to copy bytes', 'error')
    }
  }

  // Export dialog methods
  const openExportDialog = () => {
    exportDialog.value = {
      visible: true,
      selectedBytes: contextMenu.value.selectedBytes
    }
  }

  const closeExportDialog = () => {
    exportDialog.value.visible = false
  }

  const handleExportSave = (result) => {
    if (result.success) {
      showToast(`Saved ${result.bytesCount} bytes to ${result.filename}`)
    } else {
      showToast(result.error || 'Failed to save file', 'error')
    }
  }

  const handleExportCopy = (result) => {
    handleCopyResult(result)
  }

  const openExportRangeDialog = () => {
    let initialStart = 0
    let initialEnd = totalSize.value - 1

    if (selectionStart.value !== null && selectionEnd.value !== null) {
      const start = Math.min(selectionStart.value, selectionEnd.value)
      const end = Math.max(selectionStart.value, selectionEnd.value)
      initialStart = start - baseOffset.value
      initialEnd = end - baseOffset.value
    }

    exportRangeDialog.value = {
      visible: true,
      initialStart,
      initialEnd
    }
  }

  const closeExportRangeDialog = () => {
    exportRangeDialog.value.visible = false
  }

  const handleExportRangeSave = (result) => {
    if (result.success) {
      showToast(`Saved ${result.bytesCount} bytes to ${result.filename}`)
    } else {
      showToast(result.error || 'Failed to save file', 'error')
    }
  }

  const handleExportRangeCopy = (result) => {
    handleCopyResult(result)
  }

  return {
    contextMenu,
    toast,
    exportDialog,
    exportRangeDialog,
    totalSize,
    fileData,
    handleContextMenu,
    closeContextMenu,
    handleAddBookmark,
    handleAddAnnotation,
    handleCopyResult,
    openExportDialog,
    closeExportDialog,
    handleExportSave,
    handleExportCopy,
    openExportRangeDialog,
    closeExportRangeDialog,
    handleExportRangeSave,
    handleExportRangeCopy
  }
}
