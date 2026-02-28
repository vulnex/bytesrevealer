import { ref, watch } from 'vue'
import { useSessionStore } from '../stores/session'

/**
 * Composable for bookmarks, annotations, colored bytes, notes, and tags.
 */
export function useAnnotations() {
  const bookmarks = ref([])
  const annotations = ref([])
  const coloredBytes = ref([])
  const notes = ref('')
  const tags = ref([])

  function addBookmark(offset) {
    bookmarks.value.push({
      id: `bm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      offset,
      label: `Bookmark @ 0x${offset.toString(16).toUpperCase()}`,
      color: '#4fc3f7',
      created: new Date().toISOString()
    })
  }

  function updateBookmark(updated) {
    const idx = bookmarks.value.findIndex(b => b.id === updated.id)
    if (idx !== -1) bookmarks.value.splice(idx, 1, updated)
  }

  function removeBookmark(id) {
    bookmarks.value = bookmarks.value.filter(b => b.id !== id)
  }

  function addAnnotation({ startOffset, endOffset }) {
    annotations.value.push({
      id: `an_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      startOffset,
      endOffset,
      label: `Annotation @ 0x${startOffset.toString(16).toUpperCase()}-0x${endOffset.toString(16).toUpperCase()}`,
      note: '',
      color: '#81c784',
      created: new Date().toISOString()
    })
  }

  function updateAnnotation(updated) {
    const idx = annotations.value.findIndex(a => a.id === updated.id)
    if (idx !== -1) annotations.value.splice(idx, 1, updated)
  }

  function removeAnnotation(id) {
    annotations.value = annotations.value.filter(a => a.id !== id)
  }

  function handleByteSelection({ start, end, color }) {
    if (color === '#ffffff') {
      coloredBytes.value = coloredBytes.value.filter(range =>
        !(range.start >= start && range.end <= end)
      )
    } else {
      coloredBytes.value.push({ start, end, color })
    }
  }

  function resetAnnotations() {
    bookmarks.value = []
    annotations.value = []
    coloredBytes.value = []
    notes.value = ''
    tags.value = []
  }

  // Mark session dirty when annotation data changes
  function markDirtyIfNeeded() {
    const sessionStore = useSessionStore()
    if (sessionStore.hasCurrentSession) {
      sessionStore.markDirty()
    }
  }

  watch(coloredBytes, markDirtyIfNeeded, { deep: true })
  watch(notes, markDirtyIfNeeded)
  watch(bookmarks, markDirtyIfNeeded, { deep: true })
  watch(annotations, markDirtyIfNeeded, { deep: true })

  return {
    bookmarks,
    annotations,
    coloredBytes,
    notes,
    tags,
    addBookmark,
    updateBookmark,
    removeBookmark,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    handleByteSelection,
    resetAnnotations
  }
}
