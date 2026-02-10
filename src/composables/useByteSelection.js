import { ref } from 'vue'

/**
 * Composable for mouse-drag byte selection state.
 */
export function useByteSelection() {
  const isSelecting = ref(false)
  const selectionStart = ref(null)
  const selectionEnd = ref(null)
  const selectedColor = ref(null)

  const startSelection = (event, emit) => {
    // Ignore right-click (button 2) to preserve selection for context menu
    if (event.button === 2) return

    const element = event.target.closest('[data-byte-index]')
    if (element) {
      const byteIndex = parseInt(element.dataset.byteIndex)
      isSelecting.value = true
      selectionStart.value = byteIndex
      selectionEnd.value = byteIndex
    } else {
      // Clear selection when clicking outside of bytes
      selectionStart.value = null
      selectionEnd.value = null
    }
  }

  const updateSelection = (event) => {
    if (!isSelecting.value) return
    const element = event.target.closest('[data-byte-index]')
    if (element) {
      selectionEnd.value = parseInt(element.dataset.byteIndex)
    }
  }

  const endSelection = (event, emit) => {
    // Ignore right-click (button 2) to preserve selection for context menu
    if (event && event.button === 2) return

    if (!isSelecting.value) return
    isSelecting.value = false

    // Only emit color event if a color is selected
    if (selectedColor.value) {
      const start = Math.min(selectionStart.value, selectionEnd.value)
      const end = Math.max(selectionStart.value, selectionEnd.value)
      emit('byte-selection', { start, end, color: selectedColor.value })

      // Clear selection after coloring
      selectionStart.value = null
      selectionEnd.value = null
    }
    // Otherwise keep the selection for context menu use
  }

  return {
    isSelecting,
    selectionStart,
    selectionEnd,
    selectedColor,
    startSelection,
    updateSelection,
    endSelection
  }
}
