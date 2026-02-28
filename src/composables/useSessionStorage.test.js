import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStorage } from './useSessionStorage'

vi.mock('../services/SessionManager', () => ({
  sessionManager: {
    getStorageUsage: vi.fn(),
    getFileCacheSize: vi.fn(),
    clearFileCache: vi.fn()
  }
}))

import { sessionManager } from '../services/SessionManager'

function withSetup(fn) {
  let result
  const app = createApp({
    setup() {
      result = fn()
      return () => {}
    }
  })
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  app.mount(document.createElement('div'))
  return [result, app]
}

describe('useSessionStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionManager.getStorageUsage.mockResolvedValue({
      sessionsUsed: 0,
      sessionsCount: 0,
      totalUsed: 0
    })
    sessionManager.getFileCacheSize.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('storageUsage is null before mount', () => {
      // Test without mounting to check pre-mount state
      const storage = useSessionStorage()
      // Pre-mount, storageUsage starts as null
      expect(storage.storageUsage.value).toBeNull()
    })

    it('fileCacheSize starts at 0', () => {
      const storage = useSessionStorage()
      expect(storage.fileCacheSize.value).toBe(0)
    })

    it('isClearingCache starts false', () => {
      const storage = useSessionStorage()
      expect(storage.isClearingCache.value).toBe(false)
    })

    it('cacheMessage starts empty', () => {
      const storage = useSessionStorage()
      expect(storage.cacheMessage.value).toBe('')
    })

    it('cacheMessageType starts empty', () => {
      const storage = useSessionStorage()
      expect(storage.cacheMessageType.value).toBe('')
    })
  })

  describe('updateStorageUsage', () => {
    it('fetches storage usage from sessionManager', async () => {
      const usage = { sessionsUsed: 1024, sessionsCount: 3, totalUsed: 2048 }
      sessionManager.getStorageUsage.mockResolvedValue(usage)
      sessionManager.getFileCacheSize.mockResolvedValue(512)

      const storage = useSessionStorage()
      await storage.updateStorageUsage()

      expect(sessionManager.getStorageUsage).toHaveBeenCalled()
      expect(sessionManager.getFileCacheSize).toHaveBeenCalled()
      expect(storage.storageUsage.value).toEqual(usage)
      expect(storage.fileCacheSize.value).toBe(512)
    })

    it('updates values on subsequent calls', async () => {
      sessionManager.getStorageUsage.mockResolvedValueOnce({
        sessionsUsed: 100,
        sessionsCount: 1,
        totalUsed: 100
      })
      sessionManager.getFileCacheSize.mockResolvedValueOnce(50)

      const storage = useSessionStorage()
      await storage.updateStorageUsage()

      expect(storage.storageUsage.value.sessionsUsed).toBe(100)
      expect(storage.fileCacheSize.value).toBe(50)

      sessionManager.getStorageUsage.mockResolvedValueOnce({
        sessionsUsed: 200,
        sessionsCount: 2,
        totalUsed: 200
      })
      sessionManager.getFileCacheSize.mockResolvedValueOnce(75)

      await storage.updateStorageUsage()

      expect(storage.storageUsage.value.sessionsUsed).toBe(200)
      expect(storage.fileCacheSize.value).toBe(75)
    })
  })

  describe('onMounted', () => {
    it('calls updateStorageUsage on mount', async () => {
      const usage = { sessionsUsed: 500, sessionsCount: 2, totalUsed: 1000 }
      sessionManager.getStorageUsage.mockResolvedValue(usage)
      sessionManager.getFileCacheSize.mockResolvedValue(256)

      const [result, app] = withSetup(() => useSessionStorage())

      // Wait for onMounted async to fully complete
      await vi.waitFor(() => {
        expect(result.fileCacheSize.value).toBe(256)
      })

      expect(sessionManager.getStorageUsage).toHaveBeenCalled()
      expect(sessionManager.getFileCacheSize).toHaveBeenCalled()
      expect(result.storageUsage.value).toEqual(usage)
      app.unmount()
    })
  })

  describe('clearFileCache', () => {
    it('clears cache successfully with cleared=true', async () => {
      vi.useFakeTimers()
      sessionManager.clearFileCache.mockResolvedValue({ cleared: true, message: 'Cache cleared' })
      sessionManager.getStorageUsage.mockResolvedValue({
        sessionsUsed: 0,
        sessionsCount: 0,
        totalUsed: 0
      })
      sessionManager.getFileCacheSize.mockResolvedValue(0)

      const storage = useSessionStorage()
      await storage.clearFileCache()

      expect(sessionManager.clearFileCache).toHaveBeenCalled()
      expect(storage.cacheMessage.value).toBe('Cache cleared')
      expect(storage.cacheMessageType.value).toBe('success')
      expect(storage.isClearingCache.value).toBe(false)

      // Message should clear after 3 seconds
      vi.advanceTimersByTime(3000)
      expect(storage.cacheMessage.value).toBe('')

      vi.useRealTimers()
    })

    it('sets info type when cleared=false', async () => {
      vi.useFakeTimers()
      sessionManager.clearFileCache.mockResolvedValue({
        cleared: false,
        message: 'Nothing to clear'
      })
      sessionManager.getStorageUsage.mockResolvedValue({
        sessionsUsed: 0,
        sessionsCount: 0,
        totalUsed: 0
      })
      sessionManager.getFileCacheSize.mockResolvedValue(0)

      const storage = useSessionStorage()
      await storage.clearFileCache()

      expect(storage.cacheMessage.value).toBe('Nothing to clear')
      expect(storage.cacheMessageType.value).toBe('info')

      vi.useRealTimers()
    })

    it('refreshes storage usage after clearing', async () => {
      sessionManager.clearFileCache.mockResolvedValue({ cleared: true, message: 'Done' })
      sessionManager.getStorageUsage.mockResolvedValue({
        sessionsUsed: 0,
        sessionsCount: 0,
        totalUsed: 0
      })
      sessionManager.getFileCacheSize.mockResolvedValue(0)

      const storage = useSessionStorage()
      await storage.clearFileCache()

      // getStorageUsage is called during clearFileCache (via updateStorageUsage)
      expect(sessionManager.getStorageUsage).toHaveBeenCalled()
      expect(sessionManager.getFileCacheSize).toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      sessionManager.clearFileCache.mockRejectedValue(new Error('DB error'))

      const storage = useSessionStorage()
      await storage.clearFileCache()

      expect(storage.cacheMessage.value).toBe('Failed to clear cache: DB error')
      expect(storage.cacheMessageType.value).toBe('error')
      expect(storage.isClearingCache.value).toBe(false)
    })

    it('prevents concurrent clearing', async () => {
      let resolveFirst
      sessionManager.clearFileCache.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      sessionManager.getStorageUsage.mockResolvedValue({
        sessionsUsed: 0,
        sessionsCount: 0,
        totalUsed: 0
      })
      sessionManager.getFileCacheSize.mockResolvedValue(0)

      const storage = useSessionStorage()
      const firstCall = storage.clearFileCache()

      expect(storage.isClearingCache.value).toBe(true)

      // Second call should be a no-op
      await storage.clearFileCache()
      expect(sessionManager.clearFileCache).toHaveBeenCalledTimes(1)

      resolveFirst({ cleared: true, message: 'Done' })
      await firstCall
    })

    it('resets cacheMessage before clearing', async () => {
      sessionManager.clearFileCache.mockResolvedValue({ cleared: true, message: 'New message' })
      sessionManager.getStorageUsage.mockResolvedValue({
        sessionsUsed: 0,
        sessionsCount: 0,
        totalUsed: 0
      })
      sessionManager.getFileCacheSize.mockResolvedValue(0)

      const storage = useSessionStorage()
      storage.cacheMessage.value = 'Old message'

      await storage.clearFileCache()

      expect(storage.cacheMessage.value).toBe('New message')
    })
  })

  describe('return shape', () => {
    it('returns all expected properties', () => {
      const storage = useSessionStorage()

      expect(storage).toHaveProperty('storageUsage')
      expect(storage).toHaveProperty('fileCacheSize')
      expect(storage).toHaveProperty('isClearingCache')
      expect(storage).toHaveProperty('cacheMessage')
      expect(storage).toHaveProperty('cacheMessageType')
      expect(storage).toHaveProperty('updateStorageUsage')
      expect(storage).toHaveProperty('clearFileCache')
      expect(typeof storage.updateStorageUsage).toBe('function')
      expect(typeof storage.clearFileCache).toBe('function')
    })
  })
})
