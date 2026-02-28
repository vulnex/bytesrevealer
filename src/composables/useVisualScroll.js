import { ref, computed, onMounted, onUnmounted } from 'vue'

export function useVisualScroll(props, baseOffset) {
  // Virtual scrolling constants
  const ROW_HEIGHT = 24 // pixels
  const BYTES_PER_ROW = 32
  const BUFFER_ROWS = 30 // Increased to show more rows for better experience

  // Refs for DOM elements and scrolling state
  const containerRef = ref(null)
  const visibleRows = ref(0)
  const scrollTop = ref(0)

  // Computed properties for virtual scrolling
  const totalRows = computed(() =>
    Math.ceil((props.fileBytes.length - baseOffset.value) / BYTES_PER_ROW)
  )

  const totalHeight = computed(() => totalRows.value * ROW_HEIGHT)

  const visibleRange = computed(() => {
    const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER_ROWS)
    const end = Math.min(
      totalRows.value,
      Math.ceil((scrollTop.value + visibleRows.value * ROW_HEIGHT) / ROW_HEIGHT) + BUFFER_ROWS
    )
    return { start, end }
  })

  const startOffset = computed(() => visibleRange.value.start * ROW_HEIGHT)

  // Update visibleData computed to correctly handle base offset and progressive loading
  const visibleData = computed(() => {
    const { start, end } = visibleRange.value
    const rows = []

    for (let i = start; i < end; i++) {
      const actualOffset = i * BYTES_PER_ROW // Actual position in file
      const displayOffset = actualOffset + baseOffset.value // Display offset

      if (actualOffset >= props.fileBytes.length) break

      // Handle progressive loading
      let bytes = []
      if (props.fileBytes.isProgressive && props.chunkManager) {
        // For progressive arrays, handle chunk loading
        const endOffset = Math.min(actualOffset + BYTES_PER_ROW, props.fileBytes.length)

        // Get data from progressive array (will trigger loading)
        for (let j = actualOffset; j < endOffset; j++) {
          bytes.push(props.fileBytes[j] || 0)
        }

        // Trigger async load if chunks not loaded
        const startChunkIndex = Math.floor(actualOffset / props.chunkManager.CHUNK_SIZE)
        if (props.fileBytes.loadedChunks && !props.fileBytes.loadedChunks.has(startChunkIndex)) {
          props.chunkManager.getRange(actualOffset, endOffset).then((_data) => {
            // This will update the view when loaded
          })
        }
      } else {
        // Standard mode - use slice
        bytes = Array.from(
          props.fileBytes.slice(
            actualOffset,
            Math.min(actualOffset + BYTES_PER_ROW, props.fileBytes.length)
          )
        )
      }

      rows.push({
        offset: displayOffset, // For display purposes only
        actualOffset, // Actual position in file
        bytes: bytes
      })
    }

    return rows
  })

  // Optimized scroll handler using requestAnimationFrame
  let scrollTimeout
  const handleScroll = () => {
    if (scrollTimeout) {
      window.cancelAnimationFrame(scrollTimeout)
    }

    scrollTimeout = window.requestAnimationFrame(() => {
      if (containerRef.value) {
        scrollTop.value = containerRef.value.scrollTop
      }
    })
  }

  // Update visible rows calculation
  const updateVisibleRows = () => {
    if (containerRef.value) {
      visibleRows.value = Math.ceil(containerRef.value.clientHeight / ROW_HEIGHT)
    }
  }

  // Lifecycle
  onMounted(() => {
    updateVisibleRows()
    containerRef.value?.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', updateVisibleRows)
  })

  onUnmounted(() => {
    containerRef.value?.removeEventListener('scroll', handleScroll)
    window.removeEventListener('resize', updateVisibleRows)
    if (scrollTimeout) {
      window.cancelAnimationFrame(scrollTimeout)
    }
  })

  return {
    // Constants
    ROW_HEIGHT,
    BYTES_PER_ROW,
    // State
    containerRef,
    visibleRows,
    scrollTop,
    // Computed
    totalRows,
    totalHeight,
    visibleRange,
    startOffset,
    visibleData,
    // Methods
    handleScroll,
    updateVisibleRows
  }
}
