import { ref, computed, onMounted } from 'vue'
import { useSessionStore } from '../stores/session'
import { sessionManager, SESSION_FILE_EXTENSION } from '../services/SessionManager'
import { createLogger } from '../utils/logger'

const logger = createLogger('SessionControls')

export function useSessionActions(props, emit, { updateStorageUsage }) {
  const sessionStore = useSessionStore()

  // State
  const newSessionName = ref('')
  const sessionToDelete = ref(null)
  const verificationWarning = ref(null)
  const pendingSession = ref(null)
  const sessionFileExtension = SESSION_FILE_EXTENSION

  // Computed
  const isBusy = computed(() => sessionStore.isLoading || sessionStore.isSaving)

  const canSave = computed(() => {
    return props.hasFileLoaded &&
           newSessionName.value.trim().length > 0 &&
           !isBusy.value
  })

  // Display helpers
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    let size = bytes
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024
      i++
    }
    return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  // Session operations
  const refreshSessions = async () => {
    try {
      sessionStore.setLoading(true)
      const sessions = await sessionManager.listSessions()
      sessionStore.setSessions(sessions)
    } catch (error) {
      sessionStore.setError(`Failed to load sessions: ${error.message}`)
    } finally {
      sessionStore.setLoading(false)
    }
  }

  const saveNewSession = async () => {
    if (!canSave.value) return

    try {
      sessionStore.setSaving(true)
      sessionStore.clearError()

      const session = await sessionManager.saveSession(
        newSessionName.value.trim(),
        props.appState
      )

      sessionStore.addSession(sessionManager.extractMetadata(session))
      sessionStore.setCurrentSession(session.id, session.name)

      newSessionName.value = ''
      emit('session-saved', session)

      logger.info('Session saved successfully:', session.name)
    } catch (error) {
      sessionStore.setError(`Failed to save session: ${error.message}`)
      emit('error', error)
    } finally {
      sessionStore.setSaving(false)
    }
  }

  const saveCurrentSession = async () => {
    if (!sessionStore.hasCurrentSession) return

    try {
      sessionStore.setSaving(true)
      sessionStore.clearError()

      const session = await sessionManager.updateSession(
        sessionStore.currentSessionId,
        props.appState
      )

      sessionStore.updateSessionMetadata(session.id, sessionManager.extractMetadata(session))
      sessionStore.isDirty = false

      emit('session-saved', session)
      logger.info('Session updated successfully:', session.name)
    } catch (error) {
      sessionStore.setError(`Failed to update session: ${error.message}`)
      emit('error', error)
    } finally {
      sessionStore.setSaving(false)
    }
  }

  const loadSession = async (session) => {
    try {
      sessionStore.setLoading(true)
      sessionStore.clearError()

      const fullSession = await sessionManager.loadSession(session.id)

      // Emit the loaded session for the parent to apply
      emit('session-loaded', fullSession)

      sessionStore.setCurrentSession(fullSession.id, fullSession.name)

      logger.info('Session loaded successfully:', fullSession.name)
    } catch (error) {
      sessionStore.setError(`Failed to load session: ${error.message}`)
      emit('error', error)
    } finally {
      sessionStore.setLoading(false)
    }
  }

  const closeSession = () => {
    if (sessionStore.isDirty) {
      if (!confirm('You have unsaved changes. Are you sure you want to close this session?')) {
        return
      }
    }
    sessionStore.clearCurrentSession()
  }

  // Import/export
  const exportSession = async (session) => {
    try {
      const { blob, filename } = await sessionManager.exportSession(session.id)

      // Trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      logger.info('Session exported:', filename)
    } catch (error) {
      sessionStore.setError(`Failed to export session: ${error.message}`)
      emit('error', error)
    }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      sessionStore.setLoading(true)
      sessionStore.clearError()

      const session = await sessionManager.importSession(file)
      sessionStore.addSession(sessionManager.extractMetadata(session))

      logger.info('Session imported:', session.name)

      // Reset file input
      event.target.value = ''
    } catch (error) {
      sessionStore.setError(`Failed to import session: ${error.message}`)
      emit('error', error)
    } finally {
      sessionStore.setLoading(false)
    }
  }

  // Delete
  const confirmDelete = (session) => {
    sessionToDelete.value = session
  }

  const deleteSession = async (session) => {
    try {
      await sessionManager.deleteSession(session.id)
      sessionStore.removeSession(session.id)
      sessionToDelete.value = null

      // Refresh storage usage after deletion
      await updateStorageUsage()

      logger.info('Session deleted:', session.name)
    } catch (error) {
      sessionStore.setError(`Failed to delete session: ${error.message}`)
      emit('error', error)
    }
  }

  // Verification
  const proceedWithLoad = () => {
    if (pendingSession.value) {
      loadSession(pendingSession.value)
    }
    verificationWarning.value = null
    pendingSession.value = null
  }

  const cancelLoad = () => {
    verificationWarning.value = null
    pendingSession.value = null
  }

  // Lifecycle
  onMounted(async () => {
    await refreshSessions()
  })

  return {
    newSessionName,
    sessionToDelete,
    verificationWarning,
    pendingSession,
    sessionFileExtension,
    isBusy,
    canSave,
    formatFileSize,
    formatDate,
    refreshSessions,
    saveNewSession,
    saveCurrentSession,
    loadSession,
    closeSession,
    exportSession,
    handleImport,
    confirmDelete,
    deleteSession,
    proceedWithLoad,
    cancelLoad
  }
}
