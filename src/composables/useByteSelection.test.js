import { describe, it, expect, vi } from 'vitest'
import { useByteSelection } from './useByteSelection'

function mockByteEvent(byteIndex, button = 0) {
  const element = byteIndex !== null
    ? { dataset: { byteIndex: String(byteIndex) } }
    : null
  return {
    button,
    preventDefault: vi.fn(),
    clientX: 100,
    clientY: 200,
    target: { closest: vi.fn(sel => sel === '[data-byte-index]' ? element : null) }
  }
}

describe('useByteSelection', () => {
  describe('initial state', () => {
    it('all values are null/false', () => {
      const { isSelecting, selectionStart, selectionEnd, selectedColor } = useByteSelection()
      expect(isSelecting.value).toBe(false)
      expect(selectionStart.value).toBe(null)
      expect(selectionEnd.value).toBe(null)
      expect(selectedColor.value).toBe(null)
    })
  })

  describe('startSelection', () => {
    it('sets selecting state and start/end from byte element', () => {
      const { isSelecting, selectionStart, selectionEnd, startSelection } = useByteSelection()
      const emit = vi.fn()
      startSelection(mockByteEvent(42), emit)
      expect(isSelecting.value).toBe(true)
      expect(selectionStart.value).toBe(42)
      expect(selectionEnd.value).toBe(42)
    })

    it('ignores right-click (button 2)', () => {
      const { isSelecting, startSelection } = useByteSelection()
      const emit = vi.fn()
      startSelection(mockByteEvent(42, 2), emit)
      expect(isSelecting.value).toBe(false)
    })

    it('clears selection when clicking outside bytes', () => {
      const { selectionStart, selectionEnd, startSelection } = useByteSelection()
      const emit = vi.fn()
      // First select a byte
      startSelection(mockByteEvent(10), emit)
      expect(selectionStart.value).toBe(10)
      // Then click outside
      startSelection(mockByteEvent(null), emit)
      expect(selectionStart.value).toBe(null)
      expect(selectionEnd.value).toBe(null)
    })
  })

  describe('updateSelection', () => {
    it('updates end during drag', () => {
      const { selectionEnd, startSelection, updateSelection } = useByteSelection()
      const emit = vi.fn()
      startSelection(mockByteEvent(10), emit)
      updateSelection(mockByteEvent(20))
      expect(selectionEnd.value).toBe(20)
    })

    it('no-op when not selecting', () => {
      const { selectionEnd, updateSelection } = useByteSelection()
      updateSelection(mockByteEvent(20))
      expect(selectionEnd.value).toBe(null)
    })

    it('no-op when target is not a byte element', () => {
      const { selectionEnd, startSelection, updateSelection } = useByteSelection()
      const emit = vi.fn()
      startSelection(mockByteEvent(10), emit)
      updateSelection(mockByteEvent(null))
      expect(selectionEnd.value).toBe(10)
    })
  })

  describe('endSelection', () => {
    it('with selectedColor emits byte-selection and clears', () => {
      const { selectedColor, selectionStart, selectionEnd, startSelection, updateSelection, endSelection } = useByteSelection()
      const emit = vi.fn()
      selectedColor.value = '#ff0000'
      startSelection(mockByteEvent(5), emit)
      updateSelection(mockByteEvent(15))
      endSelection(mockByteEvent(15), emit)
      expect(emit).toHaveBeenCalledWith('byte-selection', { start: 5, end: 15, color: '#ff0000' })
      expect(selectionStart.value).toBe(null)
      expect(selectionEnd.value).toBe(null)
    })

    it('normalizes start/end order when end < start', () => {
      const { selectedColor, startSelection, updateSelection, endSelection } = useByteSelection()
      const emit = vi.fn()
      selectedColor.value = '#ff0000'
      startSelection(mockByteEvent(20), emit)
      updateSelection(mockByteEvent(5))
      endSelection(mockByteEvent(5), emit)
      expect(emit).toHaveBeenCalledWith('byte-selection', { start: 5, end: 20, color: '#ff0000' })
    })

    it('without color keeps selection for context menu', () => {
      const { selectionStart, selectionEnd, startSelection, updateSelection, endSelection } = useByteSelection()
      const emit = vi.fn()
      startSelection(mockByteEvent(5), emit)
      updateSelection(mockByteEvent(15))
      endSelection(mockByteEvent(15), emit)
      expect(emit).not.toHaveBeenCalled()
      expect(selectionStart.value).toBe(5)
      expect(selectionEnd.value).toBe(15)
    })

    it('ignores right-click (button 2)', () => {
      const { isSelecting, startSelection, endSelection } = useByteSelection()
      const emit = vi.fn()
      startSelection(mockByteEvent(5), emit)
      endSelection(mockByteEvent(5, 2), emit)
      expect(isSelecting.value).toBe(true)
    })

    it('no-op when not selecting', () => {
      const { endSelection } = useByteSelection()
      const emit = vi.fn()
      endSelection(mockByteEvent(5), emit)
      expect(emit).not.toHaveBeenCalled()
    })
  })
})
