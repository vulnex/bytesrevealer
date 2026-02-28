import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { createApp } from 'vue'
import { useVisualInteraction } from './useVisualInteraction'

function withSetup(fn) {
  let result
  const app = createApp({ setup() { result = fn(); return () => {} } })
  app.mount(document.createElement('div'))
  return [result, app]
}

function makeProps(overrides = {}) {
  return {
    fileBytes: new Uint8Array(1024),
    highlightedBytes: [],
    coloredBytes: [],
    bookmarks: [],
    annotations: [],
    chunkManager: null,
    ...overrides
  }
}

function makeDeps(overrides = {}) {
  return {
    baseOffset: ref(0),
    containerRef: ref(null),
    ROW_HEIGHT: 24,
    BYTES_PER_ROW: 32,
    ...overrides
  }
}

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

function mockGlobalClickEvent(targetSelector = null) {
  return {
    target: {
      closest: vi.fn(sel => sel === targetSelector ? {} : null)
    }
  }
}

describe('useVisualInteraction', () => {
  let originalAlert

  beforeEach(() => {
    originalAlert = window.alert
    window.alert = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    window.alert = originalAlert
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('hoveredByte is null', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.hoveredByte.value).toBe(null)
      app.unmount()
    })

    it('inspectorLocked is false', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.inspectorLocked.value).toBe(false)
      app.unmount()
    })

    it('lockedByte is null', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.lockedByte.value).toBe(null)
      app.unmount()
    })

    it('tooltipX and tooltipY are 0', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.tooltipX.value).toBe(0)
      expect(result.tooltipY.value).toBe(0)
      app.unmount()
    })

    it('selectedColor is null', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.selectedColor.value).toBe(null)
      app.unmount()
    })

    it('isSelecting is false', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.isSelecting.value).toBe(false)
      app.unmount()
    })

    it('selectionStart and selectionEnd are null', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.selectionStart.value).toBe(null)
      expect(result.selectionEnd.value).toBe(null)
      app.unmount()
    })

    it('showJumpInput is false', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.showJumpInput.value).toBe(false)
      app.unmount()
    })

    it('jumpOffset is empty string', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.jumpOffset.value).toBe('')
      app.unmount()
    })

    it('useHexColors is false', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.useHexColors.value).toBe(false)
      app.unmount()
    })
  })

  describe('display helpers', () => {
    it('formatOffset pads to 8 hex chars uppercase', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.formatOffset(0)).toBe('00000000')
      expect(result.formatOffset(255)).toBe('000000FF')
      expect(result.formatOffset(0x1234ABCD)).toBe('1234ABCD')
      app.unmount()
    })

    it('isAsciiByte returns true for printable ASCII (32-126)', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.isAsciiByte(32)).toBe(true)  // space
      expect(result.isAsciiByte(65)).toBe(true)  // A
      expect(result.isAsciiByte(126)).toBe(true) // ~
      expect(result.isAsciiByte(31)).toBe(false) // control
      expect(result.isAsciiByte(127)).toBe(false) // DEL
      expect(result.isAsciiByte(0)).toBe(false)
      app.unmount()
    })

    it('byteToAscii returns char for printable, dot otherwise', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.byteToAscii(65)).toBe('A')
      expect(result.byteToAscii(32)).toBe(' ')
      expect(result.byteToAscii(0)).toBe('.')
      expect(result.byteToAscii(127)).toBe('.')
      expect(result.byteToAscii(255)).toBe('.')
      app.unmount()
    })

    it('getDisplayOffset adds baseOffset', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ baseOffset: ref(0x100) }))
      )
      expect(result.getDisplayOffset(0)).toBe(0x100)
      expect(result.getDisplayOffset(16)).toBe(0x110)
      app.unmount()
    })

    it('getDisplayOffset with zero baseOffset', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.getDisplayOffset(42)).toBe(42)
      app.unmount()
    })
  })

  describe('bookmarkMap', () => {
    it('builds a Map from bookmarks array', () => {
      const emit = vi.fn()
      const bookmarks = [
        { offset: 0, color: '#ff0000' },
        { offset: 16, color: '#00ff00' }
      ]
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps({ bookmarks }), emit, makeDeps())
      )
      expect(result.bookmarkMap.value.size).toBe(2)
      expect(result.bookmarkMap.value.get(0)).toEqual({ offset: 0, color: '#ff0000' })
      expect(result.bookmarkMap.value.get(16)).toEqual({ offset: 16, color: '#00ff00' })
      app.unmount()
    })

    it('returns empty Map when no bookmarks', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.bookmarkMap.value.size).toBe(0)
      app.unmount()
    })
  })

  describe('isHighlighted', () => {
    it('returns true when actual offset is in highlightedBytes', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps({ highlightedBytes: [10, 20, 30] }), emit, makeDeps())
      )
      expect(result.isHighlighted(10)).toBe(true)
      expect(result.isHighlighted(20)).toBe(true)
      app.unmount()
    })

    it('returns false when actual offset is not in highlightedBytes', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps({ highlightedBytes: [10, 20] }), emit, makeDeps())
      )
      expect(result.isHighlighted(5)).toBe(false)
      app.unmount()
    })

    it('returns false when highlightedBytes is empty', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps({ highlightedBytes: [] }), emit, makeDeps())
      )
      expect(result.isHighlighted(0)).toBe(false)
      app.unmount()
    })

    it('accounts for baseOffset', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(
          makeProps({ highlightedBytes: [10] }),
          emit,
          makeDeps({ baseOffset: ref(100) })
        )
      )
      // displayOffset=110 => actualOffset=10, which is in highlightedBytes
      expect(result.isHighlighted(110)).toBe(true)
      // displayOffset=10 => actualOffset=-90, not in highlightedBytes
      expect(result.isHighlighted(10)).toBe(false)
      app.unmount()
    })
  })

  describe('isSelected', () => {
    it('returns false when not selecting', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.isSelected(5)).toBe(false)
      app.unmount()
    })

    it('returns true for offsets within selection range', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.isSelecting.value = true
      result.selectionStart.value = 10
      result.selectionEnd.value = 20
      expect(result.isSelected(10)).toBe(true)
      expect(result.isSelected(15)).toBe(true)
      expect(result.isSelected(20)).toBe(true)
      app.unmount()
    })

    it('returns false for offsets outside selection range', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.isSelecting.value = true
      result.selectionStart.value = 10
      result.selectionEnd.value = 20
      expect(result.isSelected(9)).toBe(false)
      expect(result.isSelected(21)).toBe(false)
      app.unmount()
    })

    it('handles reversed selection (end < start)', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.isSelecting.value = true
      result.selectionStart.value = 20
      result.selectionEnd.value = 10
      expect(result.isSelected(15)).toBe(true)
      expect(result.isSelected(10)).toBe(true)
      expect(result.isSelected(20)).toBe(true)
      app.unmount()
    })

    it('returns false when selectionStart is null', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.isSelecting.value = true
      result.selectionStart.value = null
      result.selectionEnd.value = 10
      expect(result.isSelected(5)).toBe(false)
      app.unmount()
    })
  })

  describe('getByteStyles', () => {
    it('returns empty object when no decorations', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.getByteStyles(0)).toEqual({})
      app.unmount()
    })

    it('applies annotation styles', () => {
      const emit = vi.fn()
      const annotations = [{ startOffset: 0, endOffset: 10, color: '#ff0000' }]
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps({ annotations }), emit, makeDeps())
      )
      const styles = result.getByteStyles(5)
      expect(styles.backgroundColor).toBe('#ff000040')
      expect(styles.borderBottom).toBe('2px solid #ff0000')
      app.unmount()
    })

    it('applies coloredBytes styles (overrides annotation bg)', () => {
      const emit = vi.fn()
      const annotations = [{ startOffset: 0, endOffset: 10, color: '#ff0000' }]
      const coloredBytes = [{ start: 5, end: 8, color: '#00ff00' }]
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps({ annotations, coloredBytes }), emit, makeDeps())
      )
      const styles = result.getByteStyles(5)
      expect(styles.backgroundColor).toBe('#00ff00') // coloredBytes overrides
      expect(styles.borderBottom).toBe('2px solid #ff0000') // annotation border kept
      app.unmount()
    })

    it('applies bookmark top border', () => {
      const emit = vi.fn()
      const bookmarks = [{ offset: 10, color: '#0000ff' }]
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps({ bookmarks }), emit, makeDeps())
      )
      const styles = result.getByteStyles(10)
      expect(styles.borderTop).toBe('2px solid #0000ff')
      app.unmount()
    })

    it('combines all three decorations', () => {
      const emit = vi.fn()
      const annotations = [{ startOffset: 10, endOffset: 20, color: '#ff0000' }]
      const coloredBytes = [{ start: 10, end: 15, color: '#00ff00' }]
      const bookmarks = [{ offset: 10, color: '#0000ff' }]
      const [result, app] = withSetup(() =>
        useVisualInteraction(
          makeProps({ annotations, coloredBytes, bookmarks }),
          emit,
          makeDeps()
        )
      )
      const styles = result.getByteStyles(10)
      expect(styles.backgroundColor).toBe('#00ff00')
      expect(styles.borderBottom).toBe('2px solid #ff0000')
      expect(styles.borderTop).toBe('2px solid #0000ff')
      app.unmount()
    })

    it('accounts for baseOffset', () => {
      const emit = vi.fn()
      const annotations = [{ startOffset: 10, endOffset: 20, color: '#ff0000' }]
      const [result, app] = withSetup(() =>
        useVisualInteraction(
          makeProps({ annotations }),
          emit,
          makeDeps({ baseOffset: ref(100) })
        )
      )
      // displayOffset=110 => actualOffset=10, which is in annotation range
      const styles = result.getByteStyles(110)
      expect(styles.backgroundColor).toBe('#ff000040')
      app.unmount()
    })

    it('returns empty for offsets outside all decorations', () => {
      const emit = vi.fn()
      const annotations = [{ startOffset: 10, endOffset: 20, color: '#ff0000' }]
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps({ annotations }), emit, makeDeps())
      )
      expect(result.getByteStyles(5)).toEqual({})
      expect(result.getByteStyles(25)).toEqual({})
      app.unmount()
    })
  })

  describe('color scheme', () => {
    it('toggleColorScheme toggles useHexColors', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(result.useHexColors.value).toBe(false)
      result.toggleColorScheme()
      expect(result.useHexColors.value).toBe(true)
      result.toggleColorScheme()
      expect(result.useHexColors.value).toBe(false)
      app.unmount()
    })
  })

  describe('selection handlers', () => {
    it('handleColorSelected sets selectedColor', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.handleColorSelected('#ff0000')
      expect(result.selectedColor.value).toBe('#ff0000')
      app.unmount()
    })

    it('startSelection does nothing without selectedColor', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      const event = mockByteEvent(5)
      result.startSelection(event)
      expect(result.isSelecting.value).toBe(false)
      app.unmount()
    })

    it('startSelection sets selecting state when color is set', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.selectedColor.value = '#ff0000'
      const event = mockByteEvent(10)
      result.startSelection(event)
      expect(result.isSelecting.value).toBe(true)
      expect(result.selectionStart.value).toBe(10)
      expect(result.selectionEnd.value).toBe(10)
      app.unmount()
    })

    it('startSelection does nothing when no byte element found', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.selectedColor.value = '#ff0000'
      const event = { target: { closest: vi.fn(() => null) } }
      result.startSelection(event)
      expect(result.isSelecting.value).toBe(false)
      app.unmount()
    })

    it('updateSelection updates selectionEnd', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.selectedColor.value = '#ff0000'
      result.startSelection(mockByteEvent(10))
      result.updateSelection(mockByteEvent(20))
      expect(result.selectionEnd.value).toBe(20)
      app.unmount()
    })

    it('updateSelection does nothing when not selecting', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.updateSelection(mockByteEvent(20))
      expect(result.selectionEnd.value).toBe(null)
      app.unmount()
    })

    it('updateSelection ignores when no byte element found', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.selectedColor.value = '#ff0000'
      result.startSelection(mockByteEvent(10))
      const noByteEvent = { target: { closest: vi.fn(() => null) } }
      result.updateSelection(noByteEvent)
      expect(result.selectionEnd.value).toBe(10) // unchanged
      app.unmount()
    })

    it('endSelection emits byte-selection and resets state', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.selectedColor.value = '#ff0000'
      result.startSelection(mockByteEvent(10))
      result.updateSelection(mockByteEvent(20))
      result.endSelection()
      expect(emit).toHaveBeenCalledWith('byte-selection', { start: 10, end: 20, color: '#ff0000' })
      expect(result.isSelecting.value).toBe(false)
      expect(result.selectionStart.value).toBe(null)
      expect(result.selectionEnd.value).toBe(null)
      app.unmount()
    })

    it('endSelection normalizes reversed selection', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.selectedColor.value = '#ff0000'
      result.startSelection(mockByteEvent(20))
      result.updateSelection(mockByteEvent(10))
      result.endSelection()
      expect(emit).toHaveBeenCalledWith('byte-selection', { start: 10, end: 20, color: '#ff0000' })
      app.unmount()
    })

    it('endSelection does nothing when not selecting', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.endSelection()
      expect(emit).not.toHaveBeenCalled()
      app.unmount()
    })
  })

  describe('hover and inspector', () => {
    it('onByteHover sets hoveredByte when not locked', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.onByteHover(5, { clientX: 100, clientY: 200 })
      expect(result.hoveredByte.value).toBe(5)
      app.unmount()
    })

    it('onByteHover does not set hoveredByte when locked', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.inspectorLocked.value = true
      result.lockedByte.value = 10
      result.onByteHover(5, { clientX: 100, clientY: 200 })
      expect(result.hoveredByte.value).toBe(null) // unchanged
      app.unmount()
    })

    it('onByteHover updates tooltip position', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.onByteHover(5, { clientX: 300, clientY: 400 })
      expect(result.tooltipX.value).toBe(300)
      expect(result.tooltipY.value).toBe(400)
      app.unmount()
    })

    it('onByteHover handles null event gracefully', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.onByteHover(5, null)
      expect(result.hoveredByte.value).toBe(5)
      expect(result.tooltipX.value).toBe(0) // unchanged
      app.unmount()
    })

    it('onByteHover updates selectionEnd when selecting', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.isSelecting.value = true
      result.selectionStart.value = 10
      result.onByteHover(15, { clientX: 100, clientY: 200 })
      expect(result.selectionEnd.value).toBe(15)
      app.unmount()
    })

    it('onByteHover accounts for baseOffset', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ baseOffset: ref(100) }))
      )
      result.onByteHover(110, { clientX: 100, clientY: 200 })
      expect(result.hoveredByte.value).toBe(10) // 110 - 100
      app.unmount()
    })

    it('onByteLeave clears hoveredByte', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.hoveredByte.value = 5
      result.onByteLeave()
      expect(result.hoveredByte.value).toBe(null)
      app.unmount()
    })

    it('lockInspector locks on the actual offset', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ baseOffset: ref(100) }))
      )
      result.lockInspector(110)
      expect(result.inspectorLocked.value).toBe(true)
      expect(result.lockedByte.value).toBe(10) // 110 - 100
      app.unmount()
    })

    it('handleGlobalClick unlocks when clicking outside', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.inspectorLocked.value = true
      result.lockedByte.value = 5
      result.handleGlobalClick(mockGlobalClickEvent(null))
      expect(result.inspectorLocked.value).toBe(false)
      expect(result.lockedByte.value).toBe(null)
      app.unmount()
    })

    it('handleGlobalClick does not unlock when clicking .byte-square', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.inspectorLocked.value = true
      result.lockedByte.value = 5
      result.handleGlobalClick(mockGlobalClickEvent('.byte-square'))
      expect(result.inspectorLocked.value).toBe(true)
      app.unmount()
    })

    it('handleGlobalClick does not unlock when clicking .data-inspector', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.inspectorLocked.value = true
      result.lockedByte.value = 5
      result.handleGlobalClick(mockGlobalClickEvent('.data-inspector'))
      expect(result.inspectorLocked.value).toBe(true)
      app.unmount()
    })

    it('handleGlobalClick does nothing when not locked', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.handleGlobalClick(mockGlobalClickEvent(null))
      expect(result.inspectorLocked.value).toBe(false) // stays false
      app.unmount()
    })
  })

  describe('keyboard (handleKeyDown)', () => {
    it('pressing L locks inspector when hovering a byte', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.hoveredByte.value = 42
      result.handleKeyDown({ key: 'l' })
      expect(result.inspectorLocked.value).toBe(true)
      expect(result.lockedByte.value).toBe(42)
      app.unmount()
    })

    it('pressing L unlocks when already locked', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.inspectorLocked.value = true
      result.lockedByte.value = 42
      result.handleKeyDown({ key: 'l' })
      expect(result.inspectorLocked.value).toBe(false)
      expect(result.lockedByte.value).toBe(null)
      app.unmount()
    })

    it('pressing L does nothing when not hovering (hoveredByte is null)', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.handleKeyDown({ key: 'l' })
      // Not locked because hoveredByte is null and not already locked
      expect(result.inspectorLocked.value).toBe(false)
      app.unmount()
    })

    it('pressing uppercase L also works', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.hoveredByte.value = 10
      result.handleKeyDown({ key: 'L' })
      expect(result.inspectorLocked.value).toBe(true)
      app.unmount()
    })

    it('other keys are ignored', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.hoveredByte.value = 10
      result.handleKeyDown({ key: 'a' })
      expect(result.inspectorLocked.value).toBe(false)
      app.unmount()
    })
  })

  describe('jump', () => {
    it('showJumpDialog sets showJumpInput to true', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.showJumpDialog()
      expect(result.showJumpInput.value).toBe(true)
      app.unmount()
    })

    it('cancelJump resets state', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.showJumpInput.value = true
      result.jumpOffset.value = '0xFF'
      result.cancelJump()
      expect(result.showJumpInput.value).toBe(false)
      expect(result.jumpOffset.value).toBe('')
      app.unmount()
    })

    it('handleJump parses hex with 0x prefix', () => {
      const emit = vi.fn()
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ containerRef }))
      )
      result.jumpOffset.value = '0x10'
      result.handleJump()
      expect(result.hoveredByte.value).toBe(16)
      expect(containerRef.value.scrollTop).toBe(Math.floor(16 / 32) * 24)
      expect(result.jumpOffset.value).toBe('')
      app.unmount()
    })

    it('handleJump parses decimal input', () => {
      const emit = vi.fn()
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ containerRef }))
      )
      result.jumpOffset.value = '100'
      result.handleJump()
      expect(result.hoveredByte.value).toBe(100)
      app.unmount()
    })

    it('handleJump parses hex without 0x prefix', () => {
      const emit = vi.fn()
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ containerRef }))
      )
      result.jumpOffset.value = 'ff'
      result.handleJump()
      expect(result.hoveredByte.value).toBe(255)
      app.unmount()
    })

    it('handleJump alerts on invalid offset (NaN)', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.jumpOffset.value = 'xyz'
      result.handleJump()
      expect(window.alert).toHaveBeenCalledWith(
        'Invalid offset. Please enter a valid offset within file bounds.'
      )
      app.unmount()
    })

    it('handleJump alerts on negative offset', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      result.jumpOffset.value = '-1'
      result.handleJump()
      expect(window.alert).toHaveBeenCalled()
      app.unmount()
    })

    it('handleJump alerts when offset exceeds file bounds', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(
          makeProps({ fileBytes: new Uint8Array(100) }),
          emit,
          makeDeps()
        )
      )
      result.jumpOffset.value = '100'
      result.handleJump()
      expect(window.alert).toHaveBeenCalled()
      app.unmount()
    })

    it('handleJump does not scroll when containerRef is null', () => {
      const emit = vi.fn()
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ containerRef: ref(null) }))
      )
      result.jumpOffset.value = '0x10'
      result.handleJump()
      expect(result.hoveredByte.value).toBe(16)
      app.unmount()
    })

    it('handleJump accounts for baseOffset when setting hoveredByte', () => {
      const emit = vi.fn()
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ containerRef, baseOffset: ref(100) }))
      )
      result.jumpOffset.value = '0x10'
      result.handleJump()
      expect(result.hoveredByte.value).toBe(16 - 100)
      app.unmount()
    })

    it('handleJump clears hoveredByte after 1500ms', () => {
      const emit = vi.fn()
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ containerRef }))
      )
      result.jumpOffset.value = '0x10'
      result.handleJump()
      expect(result.hoveredByte.value).toBe(16)
      vi.advanceTimersByTime(1500)
      expect(result.hoveredByte.value).toBe(null)
      app.unmount()
    })

    it('handleJump does not clear hoveredByte if it changed before timeout', () => {
      const emit = vi.fn()
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ containerRef }))
      )
      result.jumpOffset.value = '0x10'
      result.handleJump()
      expect(result.hoveredByte.value).toBe(16)
      result.hoveredByte.value = 42
      vi.advanceTimersByTime(1500)
      expect(result.hoveredByte.value).toBe(42)
      app.unmount()
    })

    it('handleJump clears jumpOffset and showJumpInput after successful jump', () => {
      const emit = vi.fn()
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useVisualInteraction(makeProps(), emit, makeDeps({ containerRef }))
      )
      result.showJumpInput.value = true
      result.jumpOffset.value = '0x10'
      result.handleJump()
      expect(result.jumpOffset.value).toBe('')
      expect(result.showJumpInput.value).toBe(false)
      app.unmount()
    })
  })

  describe('lifecycle', () => {
    it('registers keydown listener on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      addSpy.mockRestore()
      app.unmount()
    })

    it('removes keydown listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const emit = vi.fn()
      const [result, app] = withSetup(() => useVisualInteraction(makeProps(), emit, makeDeps()))
      app.unmount()
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      removeSpy.mockRestore()
    })
  })
})
