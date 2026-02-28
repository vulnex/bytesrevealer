import { ref, watch, onUnmounted, nextTick } from 'vue'
import { useSessionStore } from '../stores/session'
import { createLogger } from '../utils/logger'

const logger = createLogger('Search')

/**
 * Composable for search functionality using a Web Worker.
 * @param {import('vue').Ref<Uint8Array>} fileBytes - reactive file bytes ref
 */
export function useSearch(fileBytes) {
  const searchPattern = ref('')
  const searchType = ref('hex')
  const highlightedBytes = ref([])
  const searchProgress = ref(0)
  const isSearching = ref(false)
  const searchResults = ref([])
  const loadingSearch = ref(false)

  let searchWorker = null

  function ensureWorker() {
    if (!searchWorker) {
      searchWorker = new Worker(new URL('../workers/SearchWorker.js', import.meta.url), {
        type: 'module'
      })
    }
    return searchWorker
  }

  async function search() {
    if (!searchPattern.value) return
    if (isSearching.value) return

    try {
      loadingSearch.value = true
      isSearching.value = true
      highlightedBytes.value = []
      searchResults.value = []
      searchProgress.value = 0

      const worker = ensureWorker()

      const searchPromise = new Promise((resolve, reject) => {
        worker.onmessage = (event) => {
          const { type, ...data } = event.data

          switch (type) {
            case 'searchStarted':
              logger.debug('Search started, total bytes:', data.totalBytes)
              break
            case 'progress':
              searchProgress.value = data.progress
              break
            case 'searchComplete':
              highlightedBytes.value = data.highlightedBytes
              searchResults.value = data.results
              searchProgress.value = 100
              logger.info(`Search complete: ${data.matchCount} matches found`)
              resolve()
              break
            case 'searchCancelled':
              logger.info('Search cancelled')
              resolve()
              break
            case 'error':
              reject(new Error(data.error))
              break
          }
        }

        worker.onerror = (error) => {
          reject(error)
        }
      })

      worker.postMessage({
        type: 'search',
        data: {
          fileData: fileBytes.value,
          searchType: searchType.value,
          pattern: searchPattern.value,
          options: {
            caseInsensitive: false,
            regexFlags: 'g'
          }
        }
      })

      await searchPromise
    } catch (error) {
      logger.error('Search error:', error)
      throw error
    } finally {
      loadingSearch.value = false
      isSearching.value = false
      searchProgress.value = 0
    }
  }

  function clearSearch() {
    searchPattern.value = ''
    highlightedBytes.value = []
    searchResults.value = []
    searchProgress.value = 0
    cancelSearch()
  }

  function cancelSearch() {
    if (searchWorker && isSearching.value) {
      searchWorker.postMessage({ type: 'cancel' })
      isSearching.value = false
      searchProgress.value = 0
    }
  }

  function navigateToMatch(match, activeTab) {
    if (!match || typeof match.offset !== 'number') return

    if (activeTab.value !== 'hex') {
      activeTab.value = 'hex'
    }

    nextTick(() => {
      const hexViewEvent = new CustomEvent('scrollToOffset', {
        detail: {
          offset: match.offset,
          length: match.length
        }
      })
      window.dispatchEvent(hexViewEvent)
    })
  }

  function navigateToYaraMatch(payload, activeTab) {
    const { offset, length } = payload
    if (typeof offset !== 'number') return

    if (activeTab.value !== 'hex') {
      activeTab.value = 'hex'
    }

    nextTick(() => {
      const hexViewEvent = new CustomEvent('scrollToOffset', {
        detail: { offset, length }
      })
      window.dispatchEvent(hexViewEvent)
    })
  }

  function resetSearch() {
    highlightedBytes.value = []
    searchResults.value = []
    searchPattern.value = ''
    searchProgress.value = 0
    isSearching.value = false
    loadingSearch.value = false
  }

  function cleanup() {
    if (searchWorker) {
      searchWorker.terminate()
      searchWorker = null
    }
  }

  // Mark session dirty when search pattern changes
  watch(searchPattern, () => {
    const sessionStore = useSessionStore()
    if (sessionStore.hasCurrentSession) {
      sessionStore.markDirty()
    }
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    searchPattern,
    searchType,
    highlightedBytes,
    searchProgress,
    isSearching,
    searchResults,
    loadingSearch,
    search,
    clearSearch,
    cancelSearch,
    navigateToMatch,
    navigateToYaraMatch,
    resetSearch,
    cleanup
  }
}
