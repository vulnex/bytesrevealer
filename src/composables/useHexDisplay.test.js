import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useHexDisplay } from './useHexDisplay'

function makeProps(overrides = {}) {
  return {
    highlightedBytes: [],
    bookmarks: [],
    annotations: [],
    coloredBytes: [],
    ...overrides
  }
}

function makeDeps(overrides = {}) {
  return {
    baseOffset: ref(0),
    structureHighlight: ref(null),
    selectionStart: ref(null),
    selectionEnd: ref(null),
    hoveredByte: ref(null),
    selectedColor: ref(null),
    ...overrides
  }
}

describe('useHexDisplay', () => {
  describe('initial state', () => {
    it('useUppercase defaults to true', () => {
      const { useUppercase } = useHexDisplay(makeProps(), makeDeps())
      expect(useUppercase.value).toBe(true)
    })

    it('useColors defaults to true', () => {
      const { useColors } = useHexDisplay(makeProps(), makeDeps())
      expect(useColors.value).toBe(true)
    })
  })

  describe('toggleCapitalization', () => {
    it('flips useUppercase from true to false', () => {
      const { useUppercase, toggleCapitalization } = useHexDisplay(makeProps(), makeDeps())
      expect(useUppercase.value).toBe(true)
      toggleCapitalization()
      expect(useUppercase.value).toBe(false)
    })

    it('flips useUppercase from false back to true', () => {
      const { useUppercase, toggleCapitalization } = useHexDisplay(makeProps(), makeDeps())
      toggleCapitalization()
      toggleCapitalization()
      expect(useUppercase.value).toBe(true)
    })
  })

  describe('toggleColors', () => {
    it('flips useColors from true to false', () => {
      const { useColors, toggleColors } = useHexDisplay(makeProps(), makeDeps())
      expect(useColors.value).toBe(true)
      toggleColors()
      expect(useColors.value).toBe(false)
    })

    it('flips useColors from false back to true', () => {
      const { useColors, toggleColors } = useHexDisplay(makeProps(), makeDeps())
      toggleColors()
      toggleColors()
      expect(useColors.value).toBe(true)
    })
  })

  describe('formatOffset', () => {
    it('formats offset as 8-char uppercase hex by default', () => {
      const { formatOffset } = useHexDisplay(makeProps(), makeDeps())
      expect(formatOffset(0)).toBe('00000000')
      expect(formatOffset(255)).toBe('000000FF')
      expect(formatOffset(0x1A2B3C)).toBe('001A2B3C')
    })

    it('formats as lowercase when useUppercase is false', () => {
      const { formatOffset, toggleCapitalization } = useHexDisplay(makeProps(), makeDeps())
      toggleCapitalization()
      expect(formatOffset(255)).toBe('000000ff')
      expect(formatOffset(0x1A2B3C)).toBe('001a2b3c')
    })
  })

  describe('formatByte', () => {
    it('formats byte as 2-char uppercase hex by default', () => {
      const { formatByte } = useHexDisplay(makeProps(), makeDeps())
      expect(formatByte(0)).toBe('00')
      expect(formatByte(255)).toBe('FF')
      expect(formatByte(0x0A)).toBe('0A')
    })

    it('formats as lowercase when useUppercase is false', () => {
      const { formatByte, toggleCapitalization } = useHexDisplay(makeProps(), makeDeps())
      toggleCapitalization()
      expect(formatByte(255)).toBe('ff')
      expect(formatByte(0x0A)).toBe('0a')
    })
  })

  describe('getByteClass', () => {
    it('returns byte-null for 0x00', () => {
      const { getByteClass } = useHexDisplay(makeProps(), makeDeps())
      expect(getByteClass(0x00)).toBe('byte-null')
    })

    it('returns byte-printable for printable ASCII (0x20-0x7E)', () => {
      const { getByteClass } = useHexDisplay(makeProps(), makeDeps())
      expect(getByteClass(0x20)).toBe('byte-printable')
      expect(getByteClass(0x41)).toBe('byte-printable') // 'A'
      expect(getByteClass(0x7E)).toBe('byte-printable')
    })

    it('returns byte-ff for 0xFF', () => {
      const { getByteClass } = useHexDisplay(makeProps(), makeDeps())
      expect(getByteClass(0xFF)).toBe('byte-ff')
    })

    it('returns byte-control for control characters (0x01-0x1F)', () => {
      const { getByteClass } = useHexDisplay(makeProps(), makeDeps())
      expect(getByteClass(0x01)).toBe('byte-control')
      expect(getByteClass(0x1F)).toBe('byte-control')
    })

    it('returns byte-extended for extended ASCII (0x7F-0xFE)', () => {
      const { getByteClass } = useHexDisplay(makeProps(), makeDeps())
      expect(getByteClass(0x7F)).toBe('byte-extended')
      expect(getByteClass(0x80)).toBe('byte-extended')
      expect(getByteClass(0xFE)).toBe('byte-extended')
    })

    it('returns byte-null for 0x00 even when colors disabled', () => {
      const { getByteClass, toggleColors } = useHexDisplay(makeProps(), makeDeps())
      toggleColors()
      expect(getByteClass(0x00)).toBe('byte-null')
    })

    it('returns byte-white for all non-null bytes when colors disabled', () => {
      const { getByteClass, toggleColors } = useHexDisplay(makeProps(), makeDeps())
      toggleColors()
      expect(getByteClass(0x41)).toBe('byte-white')
      expect(getByteClass(0xFF)).toBe('byte-white')
      expect(getByteClass(0x01)).toBe('byte-white')
      expect(getByteClass(0x80)).toBe('byte-white')
    })
  })

  describe('byteToAscii', () => {
    it('returns printable character for printable bytes', () => {
      const { byteToAscii } = useHexDisplay(makeProps(), makeDeps())
      expect(byteToAscii(0x41)).toBe('A')
      expect(byteToAscii(0x20)).toBe(' ')
      expect(byteToAscii(0x7E)).toBe('~')
    })

    it('returns dot for non-printable bytes', () => {
      const { byteToAscii } = useHexDisplay(makeProps(), makeDeps())
      expect(byteToAscii(0x00)).toBe('.')
      expect(byteToAscii(0x1F)).toBe('.')
      expect(byteToAscii(0x7F)).toBe('.')
      expect(byteToAscii(0xFF)).toBe('.')
    })
  })

  describe('highlightSet', () => {
    it('returns empty Set when no highlighted bytes', () => {
      const { highlightSet } = useHexDisplay(makeProps(), makeDeps())
      expect(highlightSet.value.size).toBe(0)
    })

    it('builds Set from highlighted bytes', () => {
      const { highlightSet } = useHexDisplay(
        makeProps({ highlightedBytes: [0, 5, 10] }),
        makeDeps()
      )
      expect(highlightSet.value.size).toBe(3)
      expect(highlightSet.value.has(0)).toBe(true)
      expect(highlightSet.value.has(5)).toBe(true)
      expect(highlightSet.value.has(10)).toBe(true)
      expect(highlightSet.value.has(1)).toBe(false)
    })
  })

  describe('bookmarkMap', () => {
    it('returns empty Map when no bookmarks', () => {
      const { bookmarkMap } = useHexDisplay(makeProps(), makeDeps())
      expect(bookmarkMap.value.size).toBe(0)
    })

    it('builds Map keyed by offset', () => {
      const bookmarks = [
        { offset: 0, color: '#ff0000', label: 'start' },
        { offset: 100, color: '#00ff00', label: 'mid' }
      ]
      const { bookmarkMap } = useHexDisplay(makeProps({ bookmarks }), makeDeps())
      expect(bookmarkMap.value.size).toBe(2)
      expect(bookmarkMap.value.get(0).label).toBe('start')
      expect(bookmarkMap.value.get(100).label).toBe('mid')
      expect(bookmarkMap.value.get(50)).toBeUndefined()
    })
  })

  describe('isHighlighted', () => {
    it('returns false when no highlights or structure highlight', () => {
      const { isHighlighted } = useHexDisplay(makeProps(), makeDeps())
      expect(isHighlighted(0)).toBe(false)
    })

    it('returns true for offsets in highlightSet', () => {
      const { isHighlighted } = useHexDisplay(
        makeProps({ highlightedBytes: [5, 10] }),
        makeDeps()
      )
      expect(isHighlighted(5)).toBe(true)
      expect(isHighlighted(10)).toBe(true)
      expect(isHighlighted(6)).toBe(false)
    })

    it('accounts for baseOffset when checking', () => {
      const { isHighlighted } = useHexDisplay(
        makeProps({ highlightedBytes: [5] }),
        makeDeps({ baseOffset: ref(100) })
      )
      // displayOffset 105 - baseOffset 100 = actualOffset 5
      expect(isHighlighted(105)).toBe(true)
      expect(isHighlighted(5)).toBe(false)
    })

    it('returns true for offsets within structureHighlight range', () => {
      const { isHighlighted } = useHexDisplay(
        makeProps(),
        makeDeps({ structureHighlight: ref({ start: 10, end: 20 }) })
      )
      expect(isHighlighted(10)).toBe(true)
      expect(isHighlighted(15)).toBe(true)
      expect(isHighlighted(19)).toBe(true)
      expect(isHighlighted(20)).toBe(false) // end is exclusive
    })

    it('structureHighlight takes precedence over highlightSet', () => {
      const { isHighlighted } = useHexDisplay(
        makeProps({ highlightedBytes: [] }),
        makeDeps({ structureHighlight: ref({ start: 0, end: 5 }) })
      )
      expect(isHighlighted(3)).toBe(true)
    })
  })

  describe('isSelected', () => {
    it('returns false when selectionStart is null', () => {
      const { isSelected } = useHexDisplay(makeProps(), makeDeps())
      expect(isSelected(0)).toBe(false)
    })

    it('returns true for offset within selection range', () => {
      const { isSelected } = useHexDisplay(
        makeProps(),
        makeDeps({ selectionStart: ref(5), selectionEnd: ref(10) })
      )
      expect(isSelected(5)).toBe(true)
      expect(isSelected(7)).toBe(true)
      expect(isSelected(10)).toBe(true)
    })

    it('returns false for offset outside selection range', () => {
      const { isSelected } = useHexDisplay(
        makeProps(),
        makeDeps({ selectionStart: ref(5), selectionEnd: ref(10) })
      )
      expect(isSelected(4)).toBe(false)
      expect(isSelected(11)).toBe(false)
    })

    it('handles reversed selection (end < start)', () => {
      const { isSelected } = useHexDisplay(
        makeProps(),
        makeDeps({ selectionStart: ref(10), selectionEnd: ref(5) })
      )
      expect(isSelected(5)).toBe(true)
      expect(isSelected(7)).toBe(true)
      expect(isSelected(10)).toBe(true)
      expect(isSelected(4)).toBe(false)
    })

    it('accounts for baseOffset', () => {
      const { isSelected } = useHexDisplay(
        makeProps(),
        makeDeps({ baseOffset: ref(100), selectionStart: ref(5), selectionEnd: ref(10) })
      )
      // displayOffset 105 - baseOffset 100 = actualOffset 5
      expect(isSelected(105)).toBe(true)
      expect(isSelected(110)).toBe(true)
      expect(isSelected(104)).toBe(false)
    })
  })

  describe('handleColorSelected', () => {
    it('sets selectedColor ref', () => {
      const selectedColor = ref(null)
      const { handleColorSelected } = useHexDisplay(makeProps(), makeDeps({ selectedColor }))
      handleColorSelected('#ff0000')
      expect(selectedColor.value).toBe('#ff0000')
    })
  })

  describe('getDisplayOffset', () => {
    it('adds baseOffset to actual offset', () => {
      const { getDisplayOffset } = useHexDisplay(makeProps(), makeDeps({ baseOffset: ref(0x1000) }))
      expect(getDisplayOffset(0)).toBe(0x1000)
      expect(getDisplayOffset(0x10)).toBe(0x1010)
    })

    it('returns actual offset when baseOffset is 0', () => {
      const { getDisplayOffset } = useHexDisplay(makeProps(), makeDeps())
      expect(getDisplayOffset(42)).toBe(42)
    })
  })

  describe('getByteStyles', () => {
    it('returns empty object when byte is highlighted', () => {
      const { getByteStyles } = useHexDisplay(
        makeProps({ highlightedBytes: [5] }),
        makeDeps()
      )
      expect(getByteStyles(5)).toEqual({})
    })

    it('returns empty object when byte is hovered', () => {
      const { getByteStyles } = useHexDisplay(
        makeProps(),
        makeDeps({ hoveredByte: ref(5) })
      )
      expect(getByteStyles(5)).toEqual({})
    })

    it('returns annotation styles for annotated bytes', () => {
      const annotations = [{ startOffset: 0, endOffset: 10, color: '#ff0000' }]
      const { getByteStyles } = useHexDisplay(
        makeProps({ annotations }),
        makeDeps()
      )
      const styles = getByteStyles(5)
      expect(styles.backgroundColor).toBe('#ff000040')
      expect(styles.borderBottom).toBe('2px solid #ff0000')
    })

    it('returns color range styles for colored bytes', () => {
      const coloredBytes = [{ start: 0, end: 10, color: '#00ff00' }]
      const { getByteStyles } = useHexDisplay(
        makeProps({ coloredBytes }),
        makeDeps()
      )
      const styles = getByteStyles(5)
      expect(styles.backgroundColor).toBe('#00ff00')
    })

    it('returns bookmark border style for bookmarked bytes', () => {
      const bookmarks = [{ offset: 5, color: '#0000ff' }]
      const { getByteStyles } = useHexDisplay(
        makeProps({ bookmarks }),
        makeDeps()
      )
      const styles = getByteStyles(5)
      expect(styles.borderTop).toBe('2px solid #0000ff')
    })

    it('merges annotation, color range, and bookmark styles', () => {
      const annotations = [{ startOffset: 0, endOffset: 10, color: '#ff0000' }]
      const coloredBytes = [{ start: 0, end: 10, color: '#00ff00' }]
      const bookmarks = [{ offset: 5, color: '#0000ff' }]
      const { getByteStyles } = useHexDisplay(
        makeProps({ annotations, coloredBytes, bookmarks }),
        makeDeps()
      )
      const styles = getByteStyles(5)
      // colorRange overrides annotation backgroundColor
      expect(styles.backgroundColor).toBe('#00ff00')
      expect(styles.borderBottom).toBe('2px solid #ff0000')
      expect(styles.borderTop).toBe('2px solid #0000ff')
    })

    it('returns empty object for unannotated, uncolored, unbookmarked bytes', () => {
      const { getByteStyles } = useHexDisplay(makeProps(), makeDeps())
      expect(getByteStyles(5)).toEqual({})
    })

    it('accounts for baseOffset in style lookups', () => {
      const annotations = [{ startOffset: 5, endOffset: 10, color: '#ff0000' }]
      const { getByteStyles } = useHexDisplay(
        makeProps({ annotations }),
        makeDeps({ baseOffset: ref(100) })
      )
      // displayOffset 105 - baseOffset 100 = actualOffset 5
      const styles = getByteStyles(105)
      expect(styles.backgroundColor).toBe('#ff000040')
    })
  })
})
