import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive } from 'vue'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../stores/session'
import { useSessionActions } from './useSessionActions'

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('../services/SessionManager', () => ({
  sessionManager: {
    listSessions: vi.fn(),
    saveSession: vi.fn(),
    updateSession: vi.fn(),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    exportSession: vi.fn(),
    importSession: vi.fn(),
    extractMetadata: vi.fn(),
    getStorageUsage: vi.fn(),
    getFileCacheSize: vi.fn()
  },
  SESSION_FILE_EXTENSION: '.brsession'
}))

import { sessionManager } from '../services/SessionManager'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function withSetup(fn) {
  let result
  const app = createApp({ setup() { result = fn(); return () => {} } })
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  app.mount(document.createElement('div'))
  return [result, app]
}

function makeProps(overrides = {}) {
  return reactive({
    hasFileLoaded: overrides.hasFileLoaded ?? false,
    appState: overrides.appState ?? {}
  })
}

function makeEmit() {
  return vi.fn()
}

function makeCallbacks(overrides = {}) {
  return {
    updateStorageUsage: overrides.updateStorageUsage ?? vi.fn()
  }
}

describe('useSessionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionManager.listSessions.mockResolvedValue([])
    sessionManager.extractMetadata.mockImplementation(s => ({ id: s.id, name: s.name, modified: s.modified }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('newSessionName starts empty', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.newSessionName.value).toBe('')
      app.unmount()
    })

    it('sessionToDelete starts null', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.sessionToDelete.value).toBeNull()
      app.unmount()
    })

    it('verificationWarning starts null', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.verificationWarning.value).toBeNull()
      app.unmount()
    })

    it('pendingSession starts null', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.pendingSession.value).toBeNull()
      app.unmount()
    })

    it('sessionFileExtension is .brsession', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.sessionFileExtension).toBe('.brsession')
      app.unmount()
    })
  })

  describe('computed: isBusy', () => {
    it('is false when not loading or saving', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.isBusy.value).toBe(false)
      app.unmount()
    })

    it('is true when loading', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const store = useSessionStore()
      store.isLoading = true
      expect(result.isBusy.value).toBe(true)
      app.unmount()
    })

    it('is true when saving', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const store = useSessionStore()
      store.isSaving = true
      expect(result.isBusy.value).toBe(true)
      app.unmount()
    })
  })

  describe('computed: canSave', () => {
    it('is false when no file loaded', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: false }), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      result.newSessionName.value = 'My Session'
      expect(result.canSave.value).toBe(false)
      app.unmount()
    })

    it('is false when name is empty', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: true }), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      result.newSessionName.value = ''
      expect(result.canSave.value).toBe(false)
      app.unmount()
    })

    it('is false when name is whitespace only', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: true }), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      result.newSessionName.value = '   '
      expect(result.canSave.value).toBe(false)
      app.unmount()
    })

    it('is true when file loaded and name provided', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: true }), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      result.newSessionName.value = 'My Session'
      expect(result.canSave.value).toBe(true)
      app.unmount()
    })

    it('is false when busy', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: true }), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      result.newSessionName.value = 'My Session'
      const store = useSessionStore()
      store.isLoading = true
      expect(result.canSave.value).toBe(false)
      app.unmount()
    })
  })

  describe('formatFileSize', () => {
    it('returns "0 B" for falsy values', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.formatFileSize(0)).toBe('0 B')
      expect(result.formatFileSize(null)).toBe('0 B')
      expect(result.formatFileSize(undefined)).toBe('0 B')
      app.unmount()
    })

    it('formats bytes correctly', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.formatFileSize(500)).toBe('500 B')
      app.unmount()
    })

    it('formats kilobytes', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.formatFileSize(1024)).toBe('1.0 KB')
      expect(result.formatFileSize(1536)).toBe('1.5 KB')
      app.unmount()
    })

    it('formats megabytes', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.formatFileSize(1048576)).toBe('1.0 MB')
      app.unmount()
    })

    it('formats gigabytes', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.formatFileSize(1073741824)).toBe('1.0 GB')
      app.unmount()
    })
  })

  describe('formatDate', () => {
    it('returns empty string for falsy values', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      expect(result.formatDate(null)).toBe('')
      expect(result.formatDate(undefined)).toBe('')
      expect(result.formatDate('')).toBe('')
      app.unmount()
    })

    it('returns "Just now" for very recent dates', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const now = new Date().toISOString()
      expect(result.formatDate(now)).toBe('Just now')
      app.unmount()
    })

    it('returns minutes ago for recent dates', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString()
      expect(result.formatDate(fiveMinAgo)).toBe('5m ago')
      app.unmount()
    })

    it('returns hours ago for same-day dates', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString()
      expect(result.formatDate(threeHoursAgo)).toBe('3h ago')
      app.unmount()
    })

    it('returns days ago for recent past', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()
      expect(result.formatDate(twoDaysAgo)).toBe('2d ago')
      app.unmount()
    })

    it('returns locale date for older dates', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const oldDate = new Date(Date.now() - 30 * 86400000).toISOString()
      const formatted = result.formatDate(oldDate)
      expect(formatted).not.toContain('ago')
      expect(formatted).not.toBe('Just now')
      app.unmount()
    })
  })

  describe('refreshSessions', () => {
    it('loads sessions from manager into store', async () => {
      const sessions = [
        { id: 's1', name: 'Session 1', modified: '2025-01-01' },
        { id: 's2', name: 'Session 2', modified: '2025-01-02' }
      ]
      sessionManager.listSessions.mockResolvedValue(sessions)

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const store = useSessionStore()

      await result.refreshSessions()

      expect(sessionManager.listSessions).toHaveBeenCalled()
      expect(store.sessions).toEqual(sessions)
      expect(store.isLoading).toBe(false)
      app.unmount()
    })

    it('sets error on failure', async () => {
      sessionManager.listSessions.mockRejectedValue(new Error('Network error'))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()
      const store = useSessionStore()

      await result.refreshSessions()

      expect(store.error).toBe('Failed to load sessions: Network error')
      expect(store.isLoading).toBe(false)
      app.unmount()
    })

    it('sets loading true during operation', async () => {
      let loadingDuringCall = false
      sessionManager.listSessions.mockImplementation(async () => {
        const store = useSessionStore()
        loadingDuringCall = store.isLoading
        return []
      })

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      loadingDuringCall = false
      await result.refreshSessions()

      expect(loadingDuringCall).toBe(true)
      app.unmount()
    })
  })

  describe('saveNewSession', () => {
    it('does nothing when canSave is false', async () => {
      const emit = makeEmit()
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: false }), emit, makeCallbacks())
      )
      await flushPromises()

      await result.saveNewSession()

      expect(sessionManager.saveSession).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalled()
      app.unmount()
    })

    it('saves session successfully', async () => {
      const emit = makeEmit()
      const savedSession = { id: 's1', name: 'Test', modified: '2025-01-01' }
      sessionManager.saveSession.mockResolvedValue(savedSession)
      sessionManager.extractMetadata.mockReturnValue({ id: 's1', name: 'Test', modified: '2025-01-01' })

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: true, appState: { data: 'test' } }), emit, makeCallbacks())
      )
      await flushPromises()

      result.newSessionName.value = 'Test'
      await result.saveNewSession()

      expect(sessionManager.saveSession).toHaveBeenCalledWith('Test', { data: 'test' })
      expect(emit).toHaveBeenCalledWith('session-saved', savedSession)
      expect(result.newSessionName.value).toBe('')

      const store = useSessionStore()
      expect(store.currentSessionId).toBe('s1')
      expect(store.currentSessionName).toBe('Test')
      app.unmount()
    })

    it('trims session name', async () => {
      const emit = makeEmit()
      sessionManager.saveSession.mockResolvedValue({ id: 's1', name: 'Trimmed', modified: '2025-01-01' })
      sessionManager.extractMetadata.mockReturnValue({ id: 's1', name: 'Trimmed' })

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: true }), emit, makeCallbacks())
      )
      await flushPromises()

      result.newSessionName.value = '  Trimmed  '
      await result.saveNewSession()

      expect(sessionManager.saveSession).toHaveBeenCalledWith('Trimmed', {})
      app.unmount()
    })

    it('handles save error', async () => {
      const emit = makeEmit()
      sessionManager.saveSession.mockRejectedValue(new Error('Save failed'))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: true }), emit, makeCallbacks())
      )
      await flushPromises()

      result.newSessionName.value = 'Test'
      await result.saveNewSession()

      const store = useSessionStore()
      expect(store.error).toBe('Failed to save session: Save failed')
      expect(emit).toHaveBeenCalledWith('error', expect.any(Error))
      expect(store.isSaving).toBe(false)
      app.unmount()
    })

    it('sets saving flag during operation', async () => {
      let savingDuringCall = false
      sessionManager.saveSession.mockImplementation(async () => {
        const store = useSessionStore()
        savingDuringCall = store.isSaving
        return { id: 's1', name: 'Test' }
      })
      sessionManager.extractMetadata.mockReturnValue({ id: 's1', name: 'Test' })

      const emit = makeEmit()
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ hasFileLoaded: true }), emit, makeCallbacks())
      )
      await flushPromises()

      result.newSessionName.value = 'Test'
      await result.saveNewSession()

      expect(savingDuringCall).toBe(true)
      const store = useSessionStore()
      expect(store.isSaving).toBe(false)
      app.unmount()
    })
  })

  describe('saveCurrentSession', () => {
    it('does nothing when no current session', async () => {
      const emit = makeEmit()
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      await result.saveCurrentSession()

      expect(sessionManager.updateSession).not.toHaveBeenCalled()
      app.unmount()
    })

    it('updates current session successfully', async () => {
      const emit = makeEmit()
      const updatedSession = { id: 's1', name: 'Updated', modified: '2025-01-02' }
      sessionManager.updateSession.mockResolvedValue(updatedSession)
      sessionManager.extractMetadata.mockReturnValue({ id: 's1', name: 'Updated', modified: '2025-01-02' })

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps({ appState: { data: 'updated' } }), emit, makeCallbacks())
      )
      await flushPromises()

      const store = useSessionStore()
      store.setCurrentSession('s1', 'Updated')
      store.isDirty = true

      await result.saveCurrentSession()

      expect(sessionManager.updateSession).toHaveBeenCalledWith('s1', { data: 'updated' })
      expect(emit).toHaveBeenCalledWith('session-saved', updatedSession)
      expect(store.isDirty).toBe(false)
      app.unmount()
    })

    it('handles update error', async () => {
      const emit = makeEmit()
      sessionManager.updateSession.mockRejectedValue(new Error('Update failed'))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      const store = useSessionStore()
      store.setCurrentSession('s1', 'Test')

      await result.saveCurrentSession()

      expect(store.error).toBe('Failed to update session: Update failed')
      expect(emit).toHaveBeenCalledWith('error', expect.any(Error))
      expect(store.isSaving).toBe(false)
      app.unmount()
    })
  })

  describe('loadSession', () => {
    it('loads session and emits event', async () => {
      const emit = makeEmit()
      const fullSession = { id: 's1', name: 'Loaded', state: { data: 'loaded' } }
      sessionManager.loadSession.mockResolvedValue(fullSession)

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      await result.loadSession({ id: 's1' })

      expect(sessionManager.loadSession).toHaveBeenCalledWith('s1')
      expect(emit).toHaveBeenCalledWith('session-loaded', fullSession)

      const store = useSessionStore()
      expect(store.currentSessionId).toBe('s1')
      expect(store.currentSessionName).toBe('Loaded')
      expect(store.isLoading).toBe(false)
      app.unmount()
    })

    it('handles load error', async () => {
      const emit = makeEmit()
      sessionManager.loadSession.mockRejectedValue(new Error('Load failed'))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      await result.loadSession({ id: 's1' })

      const store = useSessionStore()
      expect(store.error).toBe('Failed to load session: Load failed')
      expect(emit).toHaveBeenCalledWith('error', expect.any(Error))
      expect(store.isLoading).toBe(false)
      app.unmount()
    })

    it('sets loading flag during operation', async () => {
      let loadingDuringCall = false
      sessionManager.loadSession.mockImplementation(async () => {
        const store = useSessionStore()
        loadingDuringCall = store.isLoading
        return { id: 's1', name: 'Test' }
      })

      const emit = makeEmit()
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      await result.loadSession({ id: 's1' })

      expect(loadingDuringCall).toBe(true)
      app.unmount()
    })
  })

  describe('closeSession', () => {
    it('clears current session when not dirty', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      const store = useSessionStore()
      store.setCurrentSession('s1', 'Test')

      result.closeSession()

      expect(store.currentSessionId).toBeNull()
      expect(store.currentSessionName).toBeNull()
      app.unmount()
    })

    it('confirms before closing dirty session', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      const store = useSessionStore()
      store.setCurrentSession('s1', 'Test')
      store.isDirty = true

      result.closeSession()

      expect(globalThis.confirm).toHaveBeenCalled()
      expect(store.currentSessionId).toBeNull()
      vi.unstubAllGlobals()
      app.unmount()
    })

    it('does not close when user cancels confirm', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      const store = useSessionStore()
      store.setCurrentSession('s1', 'Test')
      store.isDirty = true

      result.closeSession()

      expect(store.currentSessionId).toBe('s1')
      vi.unstubAllGlobals()
      app.unmount()
    })
  })

  describe('exportSession', () => {
    it('calls exportSession on the manager', async () => {
      const blob = new Blob(['data'], { type: 'application/json' })
      sessionManager.exportSession.mockResolvedValue({ blob, filename: 'test.brsession' })

      const originalCreateObjectURL = globalThis.URL.createObjectURL
      const originalRevokeObjectURL = globalThis.URL.revokeObjectURL
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:url')
      globalThis.URL.revokeObjectURL = vi.fn()

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      await result.exportSession({ id: 's1' })

      expect(sessionManager.exportSession).toHaveBeenCalledWith('s1')
      expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(blob)
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url')

      globalThis.URL.createObjectURL = originalCreateObjectURL
      globalThis.URL.revokeObjectURL = originalRevokeObjectURL
      app.unmount()
    })

    it('handles export error', async () => {
      const emit = makeEmit()
      sessionManager.exportSession.mockRejectedValue(new Error('Export failed'))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      await result.exportSession({ id: 's1' })

      const store = useSessionStore()
      expect(store.error).toBe('Failed to export session: Export failed')
      expect(emit).toHaveBeenCalledWith('error', expect.any(Error))
      app.unmount()
    })
  })

  describe('handleImport', () => {
    it('imports session from file', async () => {
      const importedSession = { id: 's2', name: 'Imported' }
      sessionManager.importSession.mockResolvedValue(importedSession)
      sessionManager.extractMetadata.mockReturnValue({ id: 's2', name: 'Imported' })

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      const event = {
        target: {
          files: [new File(['{}'], 'session.brsession')],
          value: 'session.brsession'
        }
      }

      await result.handleImport(event)

      expect(sessionManager.importSession).toHaveBeenCalledWith(event.target.files[0])
      expect(event.target.value).toBe('')

      const store = useSessionStore()
      expect(store.isLoading).toBe(false)
      app.unmount()
    })

    it('does nothing when no file selected', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      await result.handleImport({ target: { files: [] } })

      expect(sessionManager.importSession).not.toHaveBeenCalled()
      app.unmount()
    })

    it('does nothing with null files', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      await result.handleImport({ target: { files: null } })

      expect(sessionManager.importSession).not.toHaveBeenCalled()
      app.unmount()
    })

    it('handles import error', async () => {
      const emit = makeEmit()
      sessionManager.importSession.mockRejectedValue(new Error('Invalid format'))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      const event = {
        target: {
          files: [new File(['bad'], 'bad.brsession')],
          value: 'bad.brsession'
        }
      }

      await result.handleImport(event)

      const store = useSessionStore()
      expect(store.error).toBe('Failed to import session: Invalid format')
      expect(emit).toHaveBeenCalledWith('error', expect.any(Error))
      expect(store.isLoading).toBe(false)
      app.unmount()
    })
  })

  describe('confirmDelete', () => {
    it('sets sessionToDelete', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      const session = { id: 's1', name: 'To Delete' }
      result.confirmDelete(session)

      expect(result.sessionToDelete.value).toEqual(session)
      app.unmount()
    })
  })

  describe('deleteSession', () => {
    it('deletes session and clears sessionToDelete', async () => {
      const updateStorageUsage = vi.fn()
      sessionManager.deleteSession.mockResolvedValue()

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks({ updateStorageUsage }))
      )
      await flushPromises()

      const store = useSessionStore()
      store.sessions = [{ id: 's1', name: 'Session 1' }]
      result.sessionToDelete.value = { id: 's1', name: 'Session 1' }

      await result.deleteSession({ id: 's1', name: 'Session 1' })

      expect(sessionManager.deleteSession).toHaveBeenCalledWith('s1')
      expect(store.sessions).toEqual([])
      expect(result.sessionToDelete.value).toBeNull()
      expect(updateStorageUsage).toHaveBeenCalled()
      app.unmount()
    })

    it('handles delete error', async () => {
      const emit = makeEmit()
      sessionManager.deleteSession.mockRejectedValue(new Error('Delete failed'))

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      await result.deleteSession({ id: 's1', name: 'Test' })

      const store = useSessionStore()
      expect(store.error).toBe('Failed to delete session: Delete failed')
      expect(emit).toHaveBeenCalledWith('error', expect.any(Error))
      app.unmount()
    })

    it('calls updateStorageUsage callback after deletion', async () => {
      const updateStorageUsage = vi.fn()
      sessionManager.deleteSession.mockResolvedValue()

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks({ updateStorageUsage }))
      )
      await flushPromises()

      const store = useSessionStore()
      store.sessions = [{ id: 's1', name: 'Test' }]

      await result.deleteSession({ id: 's1', name: 'Test' })

      expect(updateStorageUsage).toHaveBeenCalledTimes(1)
      app.unmount()
    })
  })

  describe('proceedWithLoad', () => {
    it('loads pending session and clears warning', async () => {
      const emit = makeEmit()
      sessionManager.loadSession.mockResolvedValue({ id: 's1', name: 'Pending' })

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      result.pendingSession.value = { id: 's1' }
      result.verificationWarning.value = { warnings: ['Mismatch'] }

      result.proceedWithLoad()

      // Wait for async loadSession to complete
      await flushPromises()

      expect(result.verificationWarning.value).toBeNull()
      expect(result.pendingSession.value).toBeNull()
      app.unmount()
    })

    it('does nothing when no pending session', async () => {
      const emit = makeEmit()
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), emit, makeCallbacks())
      )
      await flushPromises()

      result.verificationWarning.value = { warnings: ['Test'] }

      result.proceedWithLoad()

      expect(sessionManager.loadSession).not.toHaveBeenCalled()
      expect(result.verificationWarning.value).toBeNull()
      expect(result.pendingSession.value).toBeNull()
      app.unmount()
    })
  })

  describe('cancelLoad', () => {
    it('clears warning and pending session', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      result.verificationWarning.value = { warnings: ['Test'] }
      result.pendingSession.value = { id: 's1' }

      result.cancelLoad()

      expect(result.verificationWarning.value).toBeNull()
      expect(result.pendingSession.value).toBeNull()
      app.unmount()
    })
  })

  describe('onMounted', () => {
    it('calls refreshSessions on mount', async () => {
      sessionManager.listSessions.mockResolvedValue([
        { id: 's1', name: 'Session 1' }
      ])

      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      expect(sessionManager.listSessions).toHaveBeenCalled()

      const store = useSessionStore()
      expect(store.sessions).toEqual([{ id: 's1', name: 'Session 1' }])
      app.unmount()
    })
  })

  describe('return shape', () => {
    it('returns all expected properties and methods', async () => {
      const [result, app] = withSetup(() =>
        useSessionActions(makeProps(), makeEmit(), makeCallbacks())
      )
      await flushPromises()

      // State refs
      expect(result).toHaveProperty('newSessionName')
      expect(result).toHaveProperty('sessionToDelete')
      expect(result).toHaveProperty('verificationWarning')
      expect(result).toHaveProperty('pendingSession')
      expect(result).toHaveProperty('sessionFileExtension')

      // Computed
      expect(result).toHaveProperty('isBusy')
      expect(result).toHaveProperty('canSave')

      // Methods
      expect(typeof result.formatFileSize).toBe('function')
      expect(typeof result.formatDate).toBe('function')
      expect(typeof result.refreshSessions).toBe('function')
      expect(typeof result.saveNewSession).toBe('function')
      expect(typeof result.saveCurrentSession).toBe('function')
      expect(typeof result.loadSession).toBe('function')
      expect(typeof result.closeSession).toBe('function')
      expect(typeof result.exportSession).toBe('function')
      expect(typeof result.handleImport).toBe('function')
      expect(typeof result.confirmDelete).toBe('function')
      expect(typeof result.deleteSession).toBe('function')
      expect(typeof result.proceedWithLoad).toBe('function')
      expect(typeof result.cancelLoad).toBe('function')

      app.unmount()
    })
  })
})
