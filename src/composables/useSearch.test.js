import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../stores/session'

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

const mockPostMessage = vi.fn()
const mockTerminate = vi.fn()
let workerOnMessage = null

class MockWorker {
  constructor() {
    this.postMessage = mockPostMessage
    this.terminate = mockTerminate
  }
  set onmessage(handler) { workerOnMessage = handler }
  get onmessage() { return workerOnMessage }
  set onerror(_handler) {}
}

vi.stubGlobal('Worker', MockWorker)

function withSetup(fn) {
  let result
  const app = createApp({ setup() { result = fn(); return () => {} } })
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  app.mount(document.createElement('div'))
  return [result, app]
}

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workerOnMessage = null
    vi.resetModules()
  })

  async function loadComposable(fileBytes) {
    const { useSearch } = await import('./useSearch')
    return withSetup(() => useSearch(fileBytes || ref(new Uint8Array([1, 2, 3]))))
  }

  describe('initial state', () => {
    it('searchPattern is empty', async () => {
      const [result, app] = await loadComposable()
      expect(result.searchPattern.value).toBe('')
      app.unmount()
    })

    it('searchResults is empty', async () => {
      const [result, app] = await loadComposable()
      expect(result.searchResults.value).toEqual([])
      app.unmount()
    })

    it('isSearching is false', async () => {
      const [result, app] = await loadComposable()
      expect(result.isSearching.value).toBe(false)
      app.unmount()
    })

    it('highlightedBytes is empty', async () => {
      const [result, app] = await loadComposable()
      expect(result.highlightedBytes.value).toEqual([])
      app.unmount()
    })

    it('searchProgress is 0', async () => {
      const [result, app] = await loadComposable()
      expect(result.searchProgress.value).toBe(0)
      app.unmount()
    })

    it('loadingSearch is false', async () => {
      const [result, app] = await loadComposable()
      expect(result.loadingSearch.value).toBe(false)
      app.unmount()
    })
  })

  describe('search', () => {
    it('posts message to worker and resolves on searchComplete', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = 'FF'

      const searchPromise = result.search()

      // Simulate worker response
      workerOnMessage({ data: { type: 'searchComplete', highlightedBytes: [0, 1], results: [{ offset: 0 }], matchCount: 1 } })

      await searchPromise

      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'search' }))
      expect(result.searchResults.value).toEqual([{ offset: 0 }])
      expect(result.highlightedBytes.value).toEqual([0, 1])
      app.unmount()
    })

    it('updates progress from worker messages', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = 'FF'

      const searchPromise = result.search()

      workerOnMessage({ data: { type: 'progress', progress: 50 } })
      expect(result.searchProgress.value).toBe(50)

      workerOnMessage({ data: { type: 'searchComplete', highlightedBytes: [], results: [], matchCount: 0 } })
      await searchPromise
      app.unmount()
    })

    it('handles worker error messages', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = 'FF'

      const searchPromise = result.search()

      workerOnMessage({ data: { type: 'error', error: 'bad pattern' } })

      await expect(searchPromise).rejects.toThrow('bad pattern')
      app.unmount()
    })

    it('does not search when pattern is empty', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = ''
      await result.search()
      expect(mockPostMessage).not.toHaveBeenCalled()
      app.unmount()
    })

    it('does not search when already searching', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = 'FF'

      // Start first search
      const p = result.search()
      // Try second search while first is in progress
      await result.search()
      // Only one postMessage call
      expect(mockPostMessage).toHaveBeenCalledTimes(1)

      workerOnMessage({ data: { type: 'searchComplete', highlightedBytes: [], results: [], matchCount: 0 } })
      await p
      app.unmount()
    })
  })

  describe('cancelSearch', () => {
    it('posts cancel message to worker and resets isSearching', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = 'FF'

      // Start a search to create a worker
      const p = result.search()
      result.cancelSearch()

      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'cancel' })
      expect(result.isSearching.value).toBe(false)

      // Resolve the search promise
      workerOnMessage({ data: { type: 'searchCancelled' } })
      await p
      app.unmount()
    })
  })

  describe('clearSearch', () => {
    it('resets all search state', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = 'FF'
      result.highlightedBytes.value = [0, 1]
      result.searchResults.value = [{ offset: 0 }]

      result.clearSearch()

      expect(result.searchPattern.value).toBe('')
      expect(result.highlightedBytes.value).toEqual([])
      expect(result.searchResults.value).toEqual([])
      expect(result.searchProgress.value).toBe(0)
      app.unmount()
    })
  })

  describe('resetSearch', () => {
    it('resets state without terminating worker', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = 'FF'
      result.highlightedBytes.value = [0]
      result.searchResults.value = [{ offset: 0 }]
      result.isSearching.value = true

      result.resetSearch()

      expect(result.searchPattern.value).toBe('')
      expect(result.highlightedBytes.value).toEqual([])
      expect(result.searchResults.value).toEqual([])
      expect(result.isSearching.value).toBe(false)
      expect(mockTerminate).not.toHaveBeenCalled()
      app.unmount()
    })
  })

  describe('navigateToMatch', () => {
    it('sets activeTab to hex and dispatches scrollToOffset event', async () => {
      const [result, app] = await loadComposable()
      const activeTab = ref('file')
      const eventSpy = vi.fn()
      window.addEventListener('scrollToOffset', eventSpy)

      result.navigateToMatch({ offset: 42, length: 4 }, activeTab)
      expect(activeTab.value).toBe('hex')

      await nextTick()
      expect(eventSpy).toHaveBeenCalled()
      expect(eventSpy.mock.calls[0][0].detail).toEqual({ offset: 42, length: 4 })

      window.removeEventListener('scrollToOffset', eventSpy)
      app.unmount()
    })

    it('no-op when match is invalid', async () => {
      const [result, app] = await loadComposable()
      const activeTab = ref('file')
      result.navigateToMatch(null, activeTab)
      expect(activeTab.value).toBe('file')
      app.unmount()
    })
  })

  describe('navigateToYaraMatch', () => {
    it('sets activeTab to hex and dispatches scrollToOffset event', async () => {
      const [result, app] = await loadComposable()
      const activeTab = ref('info')
      const eventSpy = vi.fn()
      window.addEventListener('scrollToOffset', eventSpy)

      result.navigateToYaraMatch({ offset: 100, length: 8 }, activeTab)
      expect(activeTab.value).toBe('hex')

      await nextTick()
      expect(eventSpy).toHaveBeenCalled()
      expect(eventSpy.mock.calls[0][0].detail).toEqual({ offset: 100, length: 8 })

      window.removeEventListener('scrollToOffset', eventSpy)
      app.unmount()
    })
  })

  describe('cleanup', () => {
    it('terminates the worker', async () => {
      const [result, app] = await loadComposable()
      result.searchPattern.value = 'FF'

      // Create worker by starting a search
      const p = result.search()
      workerOnMessage({ data: { type: 'searchComplete', highlightedBytes: [], results: [], matchCount: 0 } })
      await p

      result.cleanup()
      expect(mockTerminate).toHaveBeenCalled()
      app.unmount()
    })
  })

  describe('dirty tracking', () => {
    it('calls markDirty when searchPattern changes and session is active', async () => {
      const [result, app] = await loadComposable()
      const sessionStore = useSessionStore()
      sessionStore.setCurrentSession('test-id', 'Test')
      const spy = vi.spyOn(sessionStore, 'markDirty')

      result.searchPattern.value = 'new pattern'
      await nextTick()
      expect(spy).toHaveBeenCalled()
      app.unmount()
    })
  })
})
