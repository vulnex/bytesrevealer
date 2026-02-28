/**
 * VULNEX -Bytes Revealer-
 *
 * File: session.js
 * Author: Simon Roses Femerling
 * Created: 2026-01-03
 * Last Modified: 2026-01-03
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { defineStore } from 'pinia'
import { createLogger } from '../utils/logger'

const logger = createLogger('SessionStore')

// Session schema version for forward compatibility
export const SESSION_VERSION = '1.0'

export const useSessionStore = defineStore('session', {
  state: () => ({
    // Current session info
    currentSessionId: null,
    currentSessionName: null,
    isDirty: false, // Has unsaved changes
    lastSaved: null,

    // Session list (metadata only, loaded from IndexedDB)
    sessions: [],

    // Loading states
    isLoading: false,
    isSaving: false,
    error: null,

    // Auto-save settings
    autoSaveEnabled: false,
    autoSaveInterval: 300000 // 5 minutes default
  }),

  getters: {
    hasCurrentSession: (state) => !!state.currentSessionId,
    sessionCount: (state) => state.sessions.length,

    currentSession: (state) => {
      if (!state.currentSessionId) return null
      return state.sessions.find((s) => s.id === state.currentSessionId)
    },

    sortedSessions: (state) => {
      return [...state.sessions].sort((a, b) => new Date(b.modified) - new Date(a.modified))
    }
  },

  actions: {
    // Set current session info
    setCurrentSession(id, name) {
      logger.debug('Setting current session:', id, name)
      this.currentSessionId = id
      this.currentSessionName = name
      this.isDirty = false
      this.lastSaved = new Date().toISOString()
    },

    // Mark session as having unsaved changes
    markDirty() {
      if (this.currentSessionId) {
        this.isDirty = true
      }
    },

    // Clear current session
    clearCurrentSession() {
      logger.debug('Clearing current session')
      this.currentSessionId = null
      this.currentSessionName = null
      this.isDirty = false
      this.lastSaved = null
    },

    // Update sessions list from IndexedDB
    setSessions(sessions) {
      logger.debug('Setting sessions list:', sessions.length)
      this.sessions = sessions
    },

    // Add a new session to the list
    addSession(session) {
      const existing = this.sessions.findIndex((s) => s.id === session.id)
      if (existing >= 0) {
        this.sessions[existing] = session
      } else {
        this.sessions.push(session)
      }
    },

    // Remove session from list
    removeSession(id) {
      const index = this.sessions.findIndex((s) => s.id === id)
      if (index >= 0) {
        this.sessions.splice(index, 1)
      }
      if (this.currentSessionId === id) {
        this.clearCurrentSession()
      }
    },

    // Update session metadata
    updateSessionMetadata(id, metadata) {
      const session = this.sessions.find((s) => s.id === id)
      if (session) {
        Object.assign(session, metadata)
      }
    },

    // Set loading state
    setLoading(isLoading) {
      this.isLoading = isLoading
    },

    // Set saving state
    setSaving(isSaving) {
      this.isSaving = isSaving
    },

    // Set error
    setError(error) {
      this.error = error
      if (error) {
        logger.error('Session error:', error)
      }
    },

    // Clear error
    clearError() {
      this.error = null
    },

    // Toggle auto-save
    setAutoSave(enabled, interval = null) {
      this.autoSaveEnabled = enabled
      if (interval) {
        this.autoSaveInterval = interval
      }
      logger.info('Auto-save:', enabled ? `enabled (${this.autoSaveInterval}ms)` : 'disabled')
    }
  }
})
