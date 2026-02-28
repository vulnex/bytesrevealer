import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useHexExport } from './useHexExport'

function mockByteEvent(byteIndex, button = 0) {
  const element = byteIndex !== null ? { dataset: { byteIndex: String(byteIndex) } } : null
  return {
    button,
    preventDefault: vi.fn(),
    clientX: 100,
    clientY: 200,
    target: { closest: vi.fn((sel) => (sel === '[data-byte-index]' ? element : null)) }
  }
}

function setup(opts = {}) {
  const bytes = opts.fileBytes || new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe])
  const props = { fileBytes: bytes }
  const baseOffset = ref(opts.baseOffset ?? 0)
  const selectionStart = ref(opts.selectionStart ?? null)
  const selectionEnd = ref(opts.selectionEnd ?? null)
  const emit = vi.fn()
  const result = useHexExport(props, { baseOffset, selectionStart, selectionEnd, emit })
  return { ...result, emit, baseOffset, selectionStart, selectionEnd, props }
}

describe('useHexExport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('contextMenu is hidden with empty bytes', () => {
      const { contextMenu } = setup()
      expect(contextMenu.value.visible).toBe(false)
      expect(contextMenu.value.selectedBytes.length).toBe(0)
    })

    it('toast is hidden', () => {
      const { toast } = setup()
      expect(toast.value.show).toBe(false)
    })

    it('exportDialog is hidden', () => {
      const { exportDialog } = setup()
      expect(exportDialog.value.visible).toBe(false)
    })

    it('exportRangeDialog is hidden', () => {
      const { exportRangeDialog } = setup()
      expect(exportRangeDialog.value.visible).toBe(false)
    })

    it('totalSize equals fileBytes.length', () => {
      const { totalSize } = setup()
      expect(totalSize.value).toBe(6)
    })
  })

  describe('closeContextMenu', () => {
    it('sets visible to false', () => {
      const { contextMenu, closeContextMenu } = setup()
      contextMenu.value.visible = true
      closeContextMenu()
      expect(contextMenu.value.visible).toBe(false)
    })
  })

  describe('handleAddBookmark', () => {
    it('emits add-bookmark and shows toast', () => {
      const { emit, toast, handleAddBookmark } = setup()
      handleAddBookmark(0x10)
      expect(emit).toHaveBeenCalledWith('add-bookmark', 0x10)
      expect(toast.value.show).toBe(true)
      expect(toast.value.type).toBe('success')
      expect(toast.value.message).toContain('Bookmark')
    })

    it('toast auto-hides after timeout', () => {
      const { toast, handleAddBookmark } = setup()
      handleAddBookmark(0x10)
      expect(toast.value.show).toBe(true)
      vi.advanceTimersByTime(100)
      expect(toast.value.show).toBe(false)
    })
  })

  describe('handleAddAnnotation', () => {
    it('emits add-annotation and shows toast', () => {
      const { emit, toast, handleAddAnnotation } = setup()
      handleAddAnnotation({ startOffset: 0, endOffset: 5 })
      expect(emit).toHaveBeenCalledWith('add-annotation', { startOffset: 0, endOffset: 5 })
      expect(toast.value.show).toBe(true)
      expect(toast.value.message).toContain('Annotation')
    })
  })

  describe('handleCopyResult', () => {
    it('shows success toast', () => {
      const { toast, handleCopyResult } = setup()
      handleCopyResult({ success: true, bytesCount: 4, format: 'hex' })
      expect(toast.value.show).toBe(true)
      expect(toast.value.type).toBe('success')
      expect(toast.value.message).toContain('4')
      expect(toast.value.message).toContain('hex')
    })

    it('shows failure toast', () => {
      const { toast, handleCopyResult } = setup()
      handleCopyResult({ success: false, error: 'Copy failed' })
      expect(toast.value.show).toBe(true)
      expect(toast.value.type).toBe('error')
      expect(toast.value.message).toBe('Copy failed')
    })

    it('shows default error message when no error provided', () => {
      const { toast, handleCopyResult } = setup()
      handleCopyResult({ success: false })
      expect(toast.value.message).toBe('Failed to copy bytes')
    })

    it('pluralizes correctly for 1 byte', () => {
      const { toast, handleCopyResult } = setup()
      handleCopyResult({ success: true, bytesCount: 1, format: 'hex' })
      expect(toast.value.message).toContain('1 byte ')
      expect(toast.value.message).not.toContain('bytes')
    })
  })

  describe('openExportDialog / closeExportDialog', () => {
    it('populates from contextMenu.selectedBytes', () => {
      const { contextMenu, exportDialog, openExportDialog } = setup()
      const testBytes = new Uint8Array([1, 2, 3])
      contextMenu.value.selectedBytes = testBytes
      openExportDialog()
      expect(exportDialog.value.visible).toBe(true)
      expect(exportDialog.value.selectedBytes).toBe(testBytes)
    })

    it('closeExportDialog hides dialog', () => {
      const { exportDialog, openExportDialog, closeExportDialog } = setup()
      openExportDialog()
      closeExportDialog()
      expect(exportDialog.value.visible).toBe(false)
    })
  })

  describe('openExportRangeDialog', () => {
    it('uses selection range if present', () => {
      const s = setup({ selectionStart: 2, selectionEnd: 4, baseOffset: 0 })
      s.openExportRangeDialog()
      expect(s.exportRangeDialog.value.visible).toBe(true)
      expect(s.exportRangeDialog.value.initialStart).toBe(2)
      expect(s.exportRangeDialog.value.initialEnd).toBe(4)
    })

    it('uses full file range when no selection', () => {
      const s = setup()
      s.openExportRangeDialog()
      expect(s.exportRangeDialog.value.initialStart).toBe(0)
      expect(s.exportRangeDialog.value.initialEnd).toBe(5) // length - 1
    })

    it('closeExportRangeDialog hides dialog', () => {
      const s = setup()
      s.openExportRangeDialog()
      s.closeExportRangeDialog()
      expect(s.exportRangeDialog.value.visible).toBe(false)
    })
  })

  describe('handleExportSave', () => {
    it('shows success toast', () => {
      const { toast, handleExportSave } = setup()
      handleExportSave({ success: true, bytesCount: 10, filename: 'out.bin' })
      expect(toast.value.type).toBe('success')
      expect(toast.value.message).toContain('out.bin')
    })

    it('shows error toast on failure', () => {
      const { toast, handleExportSave } = setup()
      handleExportSave({ success: false, error: 'Disk full' })
      expect(toast.value.type).toBe('error')
      expect(toast.value.message).toBe('Disk full')
    })
  })

  describe('handleExportRangeSave', () => {
    it('shows success toast', () => {
      const { toast, handleExportRangeSave } = setup()
      handleExportRangeSave({ success: true, bytesCount: 10, filename: 'range.bin' })
      expect(toast.value.type).toBe('success')
      expect(toast.value.message).toContain('range.bin')
    })

    it('shows error toast on failure', () => {
      const { toast, handleExportRangeSave } = setup()
      handleExportRangeSave({ success: false })
      expect(toast.value.type).toBe('error')
      expect(toast.value.message).toBe('Failed to save file')
    })
  })

  describe('handleContextMenu', () => {
    it('extracts bytes from selection', () => {
      const s = setup({ selectionStart: 1, selectionEnd: 3, baseOffset: 0 })
      const event = mockByteEvent(2)
      s.handleContextMenu(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(s.contextMenu.value.visible).toBe(true)
      expect(s.contextMenu.value.selectedBytes.length).toBe(3) // bytes 1,2,3
      expect(s.contextMenu.value.position).toEqual({ x: 100, y: 200 })
    })

    it('finds single byte at click target when no selection', () => {
      const s = setup({ baseOffset: 0 })
      s.handleContextMenu(mockByteEvent(2))
      expect(s.contextMenu.value.selectedBytes.length).toBe(1)
      expect(s.contextMenu.value.selectedBytes[0]).toBe(0xbe)
    })

    it('sets clickedOffset from target element', () => {
      const s = setup({ baseOffset: 0 })
      s.handleContextMenu(mockByteEvent(3))
      expect(s.contextMenu.value.clickedOffset).toBe(3)
    })

    it('calls preventDefault', () => {
      const s = setup()
      const event = mockByteEvent(0)
      s.handleContextMenu(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('normalizes selection order', () => {
      const s = setup({ selectionStart: 4, selectionEnd: 1, baseOffset: 0 })
      s.handleContextMenu(mockByteEvent(2))
      expect(s.contextMenu.value.selectedBytes.length).toBe(4) // bytes 1,2,3,4
    })
  })
})
