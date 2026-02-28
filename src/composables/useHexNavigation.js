import { ref, onMounted, onUnmounted, nextTick } from 'vue'

/**
 * Composable for jump-to-offset UI logic, scroll navigation, and window event listener.
 */
export function useHexNavigation(
  props,
  {
    containerRef,
    ROW_HEIGHT,
    BYTES_PER_ROW,
    totalRows,
    scrollTop,
    forceViewRow,
    useVirtualNavigation,
    virtualOffset,
    navigationInProgress,
    handleScroll,
    hoveredByte,
    baseOffset
  }
) {
  const jumpOffset = ref('')

  function handleJump() {
    const input = jumpOffset.value.trim()
    let offset

    if (input.startsWith('0x')) {
      offset = parseInt(input.substring(2), 16)
    } else {
      offset = /^\d+$/.test(input) ? parseInt(input, 10) : parseInt(input, 16)
    }

    if (isNaN(offset) || offset < 0 || offset >= props.fileBytes.length) {
      alert('Invalid offset. Please enter a valid offset within file bounds.')
      return
    }

    const row = Math.floor(offset / BYTES_PER_ROW)
    if (containerRef.value) {
      containerRef.value.scrollTop = row * ROW_HEIGHT
    }

    const actualOffset = offset - baseOffset.value
    hoveredByte.value = actualOffset
    setTimeout(() => {
      if (hoveredByte.value === actualOffset) {
        hoveredByte.value = null
      }
    }, 1500)

    jumpOffset.value = ''
  }

  async function navigateToOffset(offset) {
    if (navigationInProgress.value) {
      return false
    }

    navigationInProgress.value = true

    try {
      window._highlightDebugLogged = false

      await nextTick()

      const targetRow = Math.floor(offset / BYTES_PER_ROW)

      if (props.fileBytes.isProgressive && props.chunkManager) {
        const CHUNK_SIZE = props.chunkManager.CHUNK_SIZE
        const targetChunkIndex = Math.floor(offset / CHUNK_SIZE)

        const startChunk = Math.max(0, targetChunkIndex - 1)
        const endChunk = Math.min(props.chunkManager.totalChunks - 1, targetChunkIndex + 1)

        const loadPromises = []
        for (let i = startChunk; i <= endChunk; i++) {
          const chunkStart = i * CHUNK_SIZE
          const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, props.fileBytes.length)
          loadPromises.push(props.chunkManager.getRange(chunkStart, chunkEnd))
        }

        try {
          await Promise.all(loadPromises)
          await nextTick()
          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (_error) {
          // chunk loading failed
        }
      }

      const container = containerRef.value

      if (!container) {
        return false
      }

      const containerHeight = container.clientHeight || 600
      const viewportRows = Math.floor(containerHeight / ROW_HEIGHT)
      const centeredRow = Math.max(0, targetRow - Math.floor(viewportRows / 2))
      const expectedScrollTop = centeredRow * ROW_HEIGHT

      scrollTop.value = expectedScrollTop

      const result = await scrollContainerToOffset(container, offset)
      return result
    } finally {
      navigationInProgress.value = false
    }
  }

  async function scrollContainerToOffset(container, offset) {
    const rowIndex = Math.floor(offset / BYTES_PER_ROW)

    const MAX_SAFE_SCROLL = 30000000
    const totalHeight = totalRows.value * ROW_HEIGHT

    if (totalHeight > MAX_SAFE_SCROLL) {
      forceViewRow.value = rowIndex
      useVirtualNavigation.value = true
      virtualOffset.value = offset

      container.scrollTop = 0
      scrollTop.value = 0

      if (props.fileBytes.isProgressive) {
        const CHUNK_SIZE = props.chunkManager.CHUNK_SIZE
        const chunkIndex = Math.floor(offset / CHUNK_SIZE)

        try {
          const chunkStart = chunkIndex * CHUNK_SIZE
          const chunkEnd = Math.min((chunkIndex + 1) * CHUNK_SIZE, props.fileBytes.length)
          await props.chunkManager.getRange(chunkStart, chunkEnd)

          if (chunkIndex > 0) {
            const prevStart = (chunkIndex - 1) * CHUNK_SIZE
            const prevEnd = chunkIndex * CHUNK_SIZE
            props.chunkManager.getRange(prevStart, prevEnd)
          }
          if (chunkIndex < props.chunkManager.totalChunks - 1) {
            const nextStart = (chunkIndex + 1) * CHUNK_SIZE
            const nextEnd = Math.min((chunkIndex + 2) * CHUNK_SIZE, props.fileBytes.length)
            props.chunkManager.getRange(nextStart, nextEnd)
          }
        } catch (_error) {
          // chunk loading failed
        }
      }

      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 100))

      return true
    }

    forceViewRow.value = null
    useVirtualNavigation.value = false
    virtualOffset.value = 0

    const containerHeight = container.clientHeight || 600
    const viewportRows = Math.floor(containerHeight / ROW_HEIGHT)
    const centeredRow = Math.max(0, rowIndex - Math.floor(viewportRows / 2))
    const centeredScrollTop = centeredRow * ROW_HEIGHT

    scrollTop.value = centeredScrollTop
    container.scrollTop = centeredScrollTop
    handleScroll(true)

    await nextTick()

    return true
  }

  async function scrollToOffset(offset, _length = 1) {
    await navigateToOffset(offset)
  }

  // Lifecycle: listen for scrollToOffset CustomEvent
  let handleScrollToOffsetEvent = null

  onMounted(() => {
    handleScrollToOffsetEvent = (event) => {
      if (event.detail && typeof event.detail.offset === 'number') {
        const length = event.detail.length || 1
        scrollToOffset(event.detail.offset, length)
      }
    }
    window.addEventListener('scrollToOffset', handleScrollToOffsetEvent)
  })

  onUnmounted(() => {
    if (handleScrollToOffsetEvent) {
      window.removeEventListener('scrollToOffset', handleScrollToOffsetEvent)
    }
  })

  return {
    jumpOffset,
    handleJump,
    navigateToOffset,
    scrollToOffset
  }
}
