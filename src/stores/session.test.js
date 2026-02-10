import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from './session.js'

describe('SessionStore', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSessionStore()
  })

  // ── Initial state ──

  it('starts with default state', () => {
    expect(store.currentSessionId).toBeNull()
    expect(store.currentSessionName).toBeNull()
    expect(store.isDirty).toBe(false)
    expect(store.lastSaved).toBeNull()
    expect(store.sessions).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.isSaving).toBe(false)
    expect(store.error).toBeNull()
    expect(store.autoSaveEnabled).toBe(false)
  })

  // ── Getters ──

  describe('getters', () => {
    it('hasCurrentSession returns false when no session', () => {
      expect(store.hasCurrentSession).toBe(false)
    })

    it('hasCurrentSession returns true when session is set', () => {
      store.setCurrentSession('s1', 'My Session')
      expect(store.hasCurrentSession).toBe(true)
    })

    it('sessionCount reflects sessions length', () => {
      expect(store.sessionCount).toBe(0)
      store.setSessions([{ id: 's1' }, { id: 's2' }])
      expect(store.sessionCount).toBe(2)
    })

    it('currentSession returns matching session', () => {
      store.setSessions([
        { id: 's1', name: 'First' },
        { id: 's2', name: 'Second' }
      ])
      store.setCurrentSession('s2', 'Second')
      expect(store.currentSession).toEqual({ id: 's2', name: 'Second' })
    })

    it('currentSession returns null when no match', () => {
      expect(store.currentSession).toBeNull()
    })

    it('sortedSessions sorts by modified date descending', () => {
      store.setSessions([
        { id: 's1', modified: '2024-01-01' },
        { id: 's2', modified: '2024-06-01' },
        { id: 's3', modified: '2024-03-01' }
      ])
      const sorted = store.sortedSessions
      expect(sorted[0].id).toBe('s2')
      expect(sorted[1].id).toBe('s3')
      expect(sorted[2].id).toBe('s1')
    })
  })

  // ── Actions ──

  describe('setCurrentSession', () => {
    it('sets id, name, clears dirty, records lastSaved', () => {
      store.setCurrentSession('s1', 'Session One')
      expect(store.currentSessionId).toBe('s1')
      expect(store.currentSessionName).toBe('Session One')
      expect(store.isDirty).toBe(false)
      expect(store.lastSaved).toBeTruthy()
    })
  })

  describe('markDirty', () => {
    it('sets isDirty when session exists', () => {
      store.setCurrentSession('s1', 'S1')
      store.markDirty()
      expect(store.isDirty).toBe(true)
    })

    it('does not set isDirty when no session', () => {
      store.markDirty()
      expect(store.isDirty).toBe(false)
    })
  })

  describe('clearCurrentSession', () => {
    it('resets all session fields', () => {
      store.setCurrentSession('s1', 'S1')
      store.markDirty()
      store.clearCurrentSession()
      expect(store.currentSessionId).toBeNull()
      expect(store.currentSessionName).toBeNull()
      expect(store.isDirty).toBe(false)
      expect(store.lastSaved).toBeNull()
    })
  })

  describe('addSession', () => {
    it('adds a new session', () => {
      store.addSession({ id: 's1', name: 'New' })
      expect(store.sessions).toHaveLength(1)
    })

    it('updates existing session with same id', () => {
      store.addSession({ id: 's1', name: 'Old' })
      store.addSession({ id: 's1', name: 'Updated' })
      expect(store.sessions).toHaveLength(1)
      expect(store.sessions[0].name).toBe('Updated')
    })
  })

  describe('removeSession', () => {
    it('removes session from list', () => {
      store.setSessions([{ id: 's1' }, { id: 's2' }])
      store.removeSession('s1')
      expect(store.sessions).toHaveLength(1)
      expect(store.sessions[0].id).toBe('s2')
    })

    it('clears current session if it is the removed one', () => {
      store.setSessions([{ id: 's1' }])
      store.setCurrentSession('s1', 'S1')
      store.removeSession('s1')
      expect(store.currentSessionId).toBeNull()
    })

    it('does nothing for non-existent id', () => {
      store.setSessions([{ id: 's1' }])
      store.removeSession('nope')
      expect(store.sessions).toHaveLength(1)
    })
  })

  describe('updateSessionMetadata', () => {
    it('merges metadata into session', () => {
      store.setSessions([{ id: 's1', name: 'Old' }])
      store.updateSessionMetadata('s1', { name: 'New', extra: 42 })
      expect(store.sessions[0].name).toBe('New')
      expect(store.sessions[0].extra).toBe(42)
    })

    it('does nothing for non-existent id', () => {
      store.setSessions([{ id: 's1', name: 'A' }])
      store.updateSessionMetadata('nope', { name: 'B' })
      expect(store.sessions[0].name).toBe('A')
    })
  })

  describe('loading/saving/error states', () => {
    it('setLoading', () => {
      store.setLoading(true)
      expect(store.isLoading).toBe(true)
    })

    it('setSaving', () => {
      store.setSaving(true)
      expect(store.isSaving).toBe(true)
    })

    it('setError and clearError', () => {
      store.setError('Something broke')
      expect(store.error).toBe('Something broke')
      store.clearError()
      expect(store.error).toBeNull()
    })
  })

  describe('setAutoSave', () => {
    it('enables auto-save', () => {
      store.setAutoSave(true)
      expect(store.autoSaveEnabled).toBe(true)
    })

    it('sets custom interval', () => {
      store.setAutoSave(true, 60000)
      expect(store.autoSaveInterval).toBe(60000)
    })

    it('disables auto-save', () => {
      store.setAutoSave(true)
      store.setAutoSave(false)
      expect(store.autoSaveEnabled).toBe(false)
    })
  })
})
