import { ref, onMounted } from 'vue'
import { sessionManager } from '../services/SessionManager'

export function useSessionStorage() {
  const storageUsage = ref(null)
  const fileCacheSize = ref(0)
  const isClearingCache = ref(false)
  const cacheMessage = ref('')
  const cacheMessageType = ref('')

  const updateStorageUsage = async () => {
    storageUsage.value = await sessionManager.getStorageUsage()
    fileCacheSize.value = await sessionManager.getFileCacheSize()
  }

  const clearFileCache = async () => {
    if (isClearingCache.value) return

    try {
      isClearingCache.value = true
      cacheMessage.value = ''

      const result = await sessionManager.clearFileCache()

      cacheMessage.value = result.message
      cacheMessageType.value = result.cleared ? 'success' : 'info'

      // Refresh storage usage
      await updateStorageUsage()

      // Clear message after 3 seconds
      setTimeout(() => {
        cacheMessage.value = ''
      }, 3000)
    } catch (error) {
      cacheMessage.value = `Failed to clear cache: ${error.message}`
      cacheMessageType.value = 'error'
    } finally {
      isClearingCache.value = false
    }
  }

  onMounted(async () => {
    await updateStorageUsage()
  })

  return {
    storageUsage,
    fileCacheSize,
    isClearingCache,
    cacheMessage,
    cacheMessageType,
    updateStorageUsage,
    clearFileCache
  }
}
