import { ref, computed } from 'vue'

/**
 * Composable for byte formatting, classification, styling, and display toggles.
 */
export function useHexDisplay(
  props,
  { baseOffset, structureHighlight, selectionStart, selectionEnd, hoveredByte, selectedColor }
) {
  const useUppercase = ref(true)
  const useColors = ref(true)

  // O(1) highlight lookup
  const highlightSet = computed(() => {
    if (!props.highlightedBytes || props.highlightedBytes.length === 0) {
      return new Set()
    }
    return new Set(props.highlightedBytes)
  })

  // O(1) bookmark lookup by offset
  const bookmarkMap = computed(() => {
    const map = new Map()
    for (const b of props.bookmarks) {
      map.set(b.offset, b)
    }
    return map
  })

  function formatOffset(offset) {
    const hex = offset.toString(16).padStart(8, '0')
    return useUppercase.value ? hex.toUpperCase() : hex.toLowerCase()
  }

  function formatByte(byte) {
    const hex = byte.toString(16).padStart(2, '0')
    return useUppercase.value ? hex.toUpperCase() : hex.toLowerCase()
  }

  function getByteClass(byte) {
    if (byte === 0x00) return 'byte-null'
    if (!useColors.value) return 'byte-white'
    if (byte >= 0x20 && byte <= 0x7e) return 'byte-printable'
    if (byte === 0xff) return 'byte-ff'
    if (byte >= 0x01 && byte <= 0x1f) return 'byte-control'
    if (byte >= 0x7f && byte <= 0xfe) return 'byte-extended'
    return 'byte-default'
  }

  function byteToAscii(byte) {
    return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
  }

  function isHighlighted(displayOffset) {
    const actualOffset = displayOffset - baseOffset.value

    if (highlightSet.value.size > 0 && !window._highlightDebugLogged) {
      window._highlightDebugLogged = true
    }

    if (structureHighlight.value) {
      const { start, end } = structureHighlight.value
      if (actualOffset >= start && actualOffset < end) {
        return true
      }
    }

    return highlightSet.value.has(actualOffset)
  }

  function isSelected(displayOffset) {
    const actualOffset = displayOffset - baseOffset.value
    if (selectionStart.value === null || selectionStart.value === undefined) return false
    const start = Math.min(selectionStart.value, selectionEnd.value || selectionStart.value)
    const end = Math.max(selectionStart.value, selectionEnd.value || selectionStart.value)
    return actualOffset >= start && actualOffset <= end
  }

  function handleColorSelected(color) {
    selectedColor.value = color
  }

  function getByteStyles(displayOffset) {
    const actualOffset = displayOffset - baseOffset.value

    if (isHighlighted(displayOffset) || hoveredByte.value === actualOffset) {
      return {}
    }

    const styles = {}

    const annotation = props.annotations.find(
      (a) => actualOffset >= a.startOffset && actualOffset <= a.endOffset
    )
    if (annotation) {
      styles.backgroundColor = annotation.color + '40'
      styles.borderBottom = `2px solid ${annotation.color}`
    }

    const colorRange = props.coloredBytes.find(
      (range) => actualOffset >= range.start && actualOffset <= range.end
    )
    if (colorRange) {
      styles.backgroundColor = colorRange.color
    }

    const bookmark = bookmarkMap.value.get(actualOffset)
    if (bookmark) {
      styles.borderTop = `2px solid ${bookmark.color}`
    }

    return styles
  }

  function getDisplayOffset(actualOffset) {
    return actualOffset + baseOffset.value
  }

  function toggleCapitalization() {
    useUppercase.value = !useUppercase.value
  }

  function toggleColors() {
    useColors.value = !useColors.value
  }

  return {
    useUppercase,
    useColors,
    highlightSet,
    bookmarkMap,
    formatOffset,
    formatByte,
    getByteClass,
    byteToAscii,
    isHighlighted,
    isSelected,
    handleColorSelected,
    getByteStyles,
    getDisplayOffset,
    toggleCapitalization,
    toggleColors
  }
}
