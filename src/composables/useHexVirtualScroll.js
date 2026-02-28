import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * Composable for virtual scrolling, visible rows, and scroll handling.
 */
export function useHexVirtualScroll(props, baseOffset) {
  const ROW_HEIGHT = 24
  const BYTES_PER_ROW = 16
  const BUFFER_ROWS = 200

  const containerRef = ref(null)
  const visibleRows = ref(0)
  const scrollTop = ref(0)

  // Virtual navigation state for very large files
  const virtualOffset = ref(0)
  const useVirtualNavigation = ref(false)
  const navigationInProgress = ref(false)
  const forceViewRow = ref(null)

  const totalRows = computed(() =>
    Math.ceil((props.fileBytes.length - baseOffset.value) / BYTES_PER_ROW)
  )

  const totalHeight = computed(() => {
    if (useVirtualNavigation.value) {
      return 600
    }
    return totalRows.value * ROW_HEIGHT
  })

  const visibleRange = computed(() => {
    if (forceViewRow.value !== null) {
      const targetRow = forceViewRow.value
      const start = Math.max(0, targetRow - 15)
      const end = Math.min(totalRows.value, targetRow + 15)
      return { start, end }
    }

    if (useVirtualNavigation.value && virtualOffset.value !== null) {
      const targetRow = Math.floor(virtualOffset.value / BYTES_PER_ROW)
      const start = Math.max(0, targetRow - 15)
      const end = Math.min(totalRows.value, targetRow + 15)
      return { start, end }
    }

    const currentRow = Math.floor(scrollTop.value / ROW_HEIGHT)
    const visibleRowCount = Math.ceil((visibleRows.value * ROW_HEIGHT) / ROW_HEIGHT)

    const start = Math.max(0, currentRow - BUFFER_ROWS)
    const end = Math.min(totalRows.value, currentRow + visibleRowCount + BUFFER_ROWS)

    return { start, end }
  })

  const startOffset = computed(() => {
    if (useVirtualNavigation.value) {
      return 0
    }
    return visibleRange.value.start * ROW_HEIGHT
  })

  const visibleData = computed(() => {
    const { start, end } = visibleRange.value
    const rows = []

    for (let i = start; i < end; i++) {
      const actualOffset = i * BYTES_PER_ROW
      const displayOffset = actualOffset + baseOffset.value

      if (actualOffset >= props.fileBytes.length) break

      const bytes = Array.from(
        props.fileBytes.slice(
          actualOffset,
          Math.min(actualOffset + BYTES_PER_ROW, props.fileBytes.length)
        )
      )

      rows.push({
        offset: displayOffset,
        actualOffset,
        bytes
      })
    }

    return rows
  })

  // Optimized scroll handler using requestAnimationFrame
  let scrollTimeout
  const handleScroll = (immediate = false) => {
    if (useVirtualNavigation.value) return

    if (immediate) {
      if (containerRef.value) {
        scrollTop.value = containerRef.value.scrollTop
      }
    } else {
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout)
      }
      scrollTimeout = window.requestAnimationFrame(() => {
        if (containerRef.value) {
          scrollTop.value = containerRef.value.scrollTop
        }
      })
    }
  }

  const updateVisibleRows = () => {
    if (containerRef.value) {
      visibleRows.value = Math.ceil(containerRef.value.clientHeight / ROW_HEIGHT)
    }
  }

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
    containerRef,
    visibleRows,
    scrollTop,
    virtualOffset,
    useVirtualNavigation,
    navigationInProgress,
    forceViewRow,
    totalRows,
    totalHeight,
    visibleRange,
    startOffset,
    visibleData,
    handleScroll,
    updateVisibleRows,
    ROW_HEIGHT,
    BYTES_PER_ROW
  }
}
