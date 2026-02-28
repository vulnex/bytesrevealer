import { ref, computed, onMounted, onUnmounted } from 'vue'

export function useVisualInteraction(
  props,
  emit,
  { baseOffset, containerRef, ROW_HEIGHT, BYTES_PER_ROW }
) {
  // Hover / Inspector state
  const hoveredByte = ref(null)
  const inspectorLocked = ref(false)
  const lockedByte = ref(null)

  // Tooltip position state
  const tooltipX = ref(0)
  const tooltipY = ref(0)

  // Selection state
  const selectedColor = ref(null)
  const isSelecting = ref(false)
  const selectionStart = ref(null)
  const selectionEnd = ref(null)

  // Jump state
  const showJumpInput = ref(false)
  const jumpOffset = ref('')

  // Color scheme toggle state
  const useHexColors = ref(false)

  // --- Computed ---

  const bookmarkMap = computed(() => {
    const map = new Map()
    for (const b of props.bookmarks) {
      map.set(b.offset, b)
    }
    return map
  })

  // --- Display helpers ---

  const formatOffset = (offset) => {
    return offset.toString(16).padStart(8, '0').toUpperCase()
  }

  const isAsciiByte = (byte) => {
    return byte >= 32 && byte <= 126
  }

  const byteToAscii = (byte) => {
    return isAsciiByte(byte) ? String.fromCharCode(byte) : '.'
  }

  const getDisplayOffset = (actualOffset) => {
    return actualOffset + baseOffset.value
  }

  // --- Styling / checks ---

  const isHighlighted = (displayOffset) => {
    const actualOffset = displayOffset - baseOffset.value
    // highlightedBytes contains absolute offsets from the search
    if (props.highlightedBytes && props.highlightedBytes.length > 0) {
      return props.highlightedBytes.includes(actualOffset)
    }
    return false
  }

  const isSelected = (displayOffset) => {
    const actualOffset = displayOffset - baseOffset.value
    if (!isSelecting.value || !selectionStart.value) return false
    const start = Math.min(selectionStart.value, selectionEnd.value || selectionStart.value)
    const end = Math.max(selectionStart.value, selectionEnd.value || selectionStart.value)
    return actualOffset >= start && actualOffset <= end
  }

  const getByteStyles = (displayOffset) => {
    const actualOffset = displayOffset - baseOffset.value
    const styles = {}

    // 1. Annotation: translucent background + bottom border
    const annotation = props.annotations.find(
      (a) => actualOffset >= a.startOffset && actualOffset <= a.endOffset
    )
    if (annotation) {
      styles.backgroundColor = annotation.color + '40'
      styles.borderBottom = `2px solid ${annotation.color}`
    }

    // 2. ColoredBytes: solid background (overrides annotation bg)
    const colorRange = props.coloredBytes.find(
      (range) => actualOffset >= range.start && actualOffset <= range.end
    )
    if (colorRange) {
      styles.backgroundColor = colorRange.color
    }

    // 3. Bookmark: top border indicator
    const bookmark = bookmarkMap.value.get(actualOffset)
    if (bookmark) {
      styles.borderTop = `2px solid ${bookmark.color}`
    }

    return styles
  }

  // --- Color scheme ---

  const toggleColorScheme = () => {
    useHexColors.value = !useHexColors.value
  }

  // --- Selection handlers ---

  const handleColorSelected = (color) => {
    selectedColor.value = color
  }

  const startSelection = (event) => {
    if (!selectedColor.value) return
    const element = event.target.closest('[data-byte-index]')
    if (element) {
      const byteIndex = parseInt(element.dataset.byteIndex)
      isSelecting.value = true
      selectionStart.value = byteIndex
      selectionEnd.value = byteIndex
    }
  }

  const updateSelection = (event) => {
    if (!isSelecting.value) return
    const element = event.target.closest('[data-byte-index]')
    if (element) {
      selectionEnd.value = parseInt(element.dataset.byteIndex)
    }
  }

  const endSelection = () => {
    if (!isSelecting.value) return
    isSelecting.value = false
    const start = Math.min(selectionStart.value, selectionEnd.value)
    const end = Math.max(selectionStart.value, selectionEnd.value)
    emit('byte-selection', { start, end, color: selectedColor.value })
    selectionStart.value = null
    selectionEnd.value = null
  }

  // --- Hover / Inspector handlers ---

  const onByteHover = (displayOffset, event) => {
    const actualOffset = displayOffset - baseOffset.value
    if (!inspectorLocked.value) {
      hoveredByte.value = actualOffset
    }
    if (event) {
      tooltipX.value = event.clientX
      tooltipY.value = event.clientY
    }
    if (isSelecting.value) {
      selectionEnd.value = actualOffset
    }
  }

  const onByteLeave = () => {
    hoveredByte.value = null
  }

  const lockInspector = (displayOffset) => {
    const actualOffset = displayOffset - baseOffset.value
    inspectorLocked.value = true
    lockedByte.value = actualOffset
  }

  const handleGlobalClick = (event) => {
    // Only unlock if clicking outside of a byte element
    if (
      inspectorLocked.value &&
      !event.target.closest('.byte-square') &&
      !event.target.closest('.ascii-group span') &&
      !event.target.closest('.data-inspector')
    ) {
      inspectorLocked.value = false
      lockedByte.value = null
    }
  }

  // --- Keyboard ---

  const handleKeyDown = (event) => {
    if (event.key.toLowerCase() === 'l') {
      if (!inspectorLocked.value && hoveredByte.value !== null) {
        inspectorLocked.value = true
        lockedByte.value = hoveredByte.value
      } else {
        inspectorLocked.value = false
        lockedByte.value = null
      }
    }
  }

  // --- Jump ---

  const showJumpDialog = () => {
    showJumpInput.value = true
  }

  const cancelJump = () => {
    showJumpInput.value = false
    jumpOffset.value = ''
  }

  const handleJump = () => {
    const input = jumpOffset.value.trim()
    let offset

    // Handle hex input
    if (input.startsWith('0x')) {
      offset = parseInt(input.substring(2), 16)
    } else {
      // Try parsing as decimal, then as hex
      offset = /^\d+$/.test(input) ? parseInt(input, 10) : parseInt(input, 16)
    }

    if (isNaN(offset) || offset < 0 || offset >= props.fileBytes.length) {
      alert('Invalid offset. Please enter a valid offset within file bounds.')
      return
    }

    // Calculate row and scroll
    const row = Math.floor(offset / BYTES_PER_ROW)
    if (containerRef.value) {
      containerRef.value.scrollTop = row * ROW_HEIGHT
    }

    // Highlight the byte briefly
    const actualOffset = offset - baseOffset.value
    hoveredByte.value = actualOffset
    setTimeout(() => {
      if (hoveredByte.value === actualOffset) {
        hoveredByte.value = null
      }
    }, 1500)

    showJumpInput.value = false
    jumpOffset.value = ''
  }

  // Lifecycle: keyboard listener
  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    // Hover / Inspector
    hoveredByte,
    inspectorLocked,
    lockedByte,
    handleKeyDown,
    // Tooltip
    tooltipX,
    tooltipY,
    // Selection
    selectedColor,
    isSelecting,
    selectionStart,
    selectionEnd,
    handleColorSelected,
    startSelection,
    updateSelection,
    endSelection,
    // Jump
    showJumpInput,
    jumpOffset,
    showJumpDialog,
    cancelJump,
    handleJump,
    // Color scheme
    useHexColors,
    toggleColorScheme,
    // Display helpers
    formatOffset,
    isAsciiByte,
    byteToAscii,
    getDisplayOffset,
    bookmarkMap,
    // Styling / checks
    getByteStyles,
    isHighlighted,
    isSelected,
    // Handlers
    onByteHover,
    onByteLeave,
    lockInspector,
    handleGlobalClick
  }
}
