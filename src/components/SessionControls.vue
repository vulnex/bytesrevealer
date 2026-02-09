/**
 * VULNEX -Bytes Revealer-
 *
 * File: SessionControls.vue
 * Author: Simon Roses Femerling
 * Created: 2026-01-03
 * Last Modified: 2026-01-03
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="session-controls">
    <div class="session-header">
      <h3>Session Management</h3>
      <p class="session-description">
        Save and restore your analysis sessions. Sessions preserve your annotations,
        search results, and analysis state.
      </p>
    </div>

    <!-- Current Session Status -->
    <div v-if="sessionStore.hasCurrentSession" class="current-session">
      <div class="current-session-info">
        <span class="session-icon">📂</span>
        <div class="session-details">
          <strong>{{ sessionStore.currentSessionName }}</strong>
          <span v-if="sessionStore.isDirty" class="unsaved-indicator" title="Unsaved changes">●</span>
        </div>
      </div>
      <div class="current-session-actions">
        <button @click="saveCurrentSession" :disabled="isBusy" class="btn btn-primary btn-sm">
          {{ sessionStore.isSaving ? 'Saving...' : 'Save' }}
        </button>
        <button @click="closeSession" :disabled="isBusy" class="btn btn-secondary btn-sm">
          Close
        </button>
      </div>
    </div>

    <!-- Save New Session -->
    <div class="save-section">
      <h4>Save Current Analysis</h4>
      <div class="save-form">
        <input
          v-model="newSessionName"
          type="text"
          placeholder="Session name..."
          class="session-name-input"
          :disabled="!hasFileLoaded || isBusy"
          @keyup.enter="saveNewSession"
        />
        <button
          @click="saveNewSession"
          :disabled="!canSave"
          class="btn btn-primary"
        >
          {{ sessionStore.isSaving ? 'Saving...' : 'Save Session' }}
        </button>
      </div>
      <p v-if="!hasFileLoaded" class="hint">Load a file to enable session saving</p>
    </div>

    <!-- Session List -->
    <div class="sessions-section">
      <div class="sessions-header">
        <h4>Saved Sessions ({{ sessionStore.sessionCount }})</h4>
        <div class="sessions-actions">
          <button @click="refreshSessions" :disabled="isBusy" class="btn btn-icon" title="Refresh">
            🔄
          </button>
          <label class="btn btn-secondary btn-sm import-btn">
            Import
            <input
              type="file"
              :accept="sessionFileExtension"
              @change="handleImport"
              class="hidden-input"
              :disabled="isBusy"
            />
          </label>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="sessionStore.isLoading" class="loading-state">
        Loading sessions...
      </div>

      <!-- Empty State -->
      <div v-else-if="sessionStore.sessionCount === 0" class="empty-state">
        <p>No saved sessions yet.</p>
        <p class="hint">Save your first session to get started!</p>
      </div>

      <!-- Session List -->
      <div v-else class="session-list">
        <div
          v-for="session in sessionStore.sortedSessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === sessionStore.currentSessionId }"
        >
          <div class="session-item-info">
            <div class="session-item-header">
              <span class="session-icon">📁</span>
              <span class="session-name">{{ session.name }}</span>
              <span v-if="session.id === sessionStore.currentSessionId" class="current-badge">
                Current
              </span>
            </div>
            <div class="session-item-meta">
              <span v-if="session.file?.name" class="file-name">
                {{ session.file.name }}
              </span>
              <span v-if="session.file?.size" class="file-size">
                ({{ formatFileSize(session.file.size) }})
              </span>
              <span class="modified-date">
                {{ formatDate(session.modified) }}
              </span>
            </div>
            <div v-if="session.tags?.length" class="session-tags">
              <span v-for="tag in session.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
          <div class="session-item-actions">
            <button
              @click="loadSession(session)"
              :disabled="isBusy || session.id === sessionStore.currentSessionId"
              class="btn btn-sm btn-primary"
              title="Load this session"
            >
              Load
            </button>
            <button
              @click="exportSession(session)"
              :disabled="isBusy"
              class="btn btn-sm btn-secondary"
              title="Export to file"
            >
              Export
            </button>
            <button
              @click="confirmDelete(session)"
              :disabled="isBusy"
              class="btn btn-sm btn-danger"
              title="Delete session"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="sessionStore.error" class="error-message">
      {{ sessionStore.error }}
      <button @click="sessionStore.clearError()" class="btn-close">×</button>
    </div>

    <!-- File Verification Warning -->
    <div v-if="verificationWarning" class="warning-message">
      <strong>File Verification:</strong>
      <ul>
        <li v-for="warning in verificationWarning.warnings" :key="warning">{{ warning }}</li>
      </ul>
      <div class="warning-actions">
        <button @click="proceedWithLoad" class="btn btn-warning btn-sm">Load Anyway</button>
        <button @click="cancelLoad" class="btn btn-secondary btn-sm">Cancel</button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="sessionToDelete" class="modal-overlay" @click.self="sessionToDelete = null">
      <div class="modal-content">
        <h4>Delete Session?</h4>
        <p>Are you sure you want to delete "{{ sessionToDelete.name }}"?</p>
        <p class="warning-text">This action cannot be undone.</p>
        <div class="modal-actions">
          <button @click="deleteSession(sessionToDelete)" class="btn btn-danger">Delete</button>
          <button @click="sessionToDelete = null" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Storage Info -->
    <div class="storage-section">
      <div class="storage-header">
        <h4>Storage</h4>
      </div>
      <div v-if="storageUsage" class="storage-details">
        <div class="storage-item">
          <span class="storage-label">Sessions:</span>
          <span class="storage-value">{{ formatFileSize(storageUsage.sessionsUsed) }}</span>
          <span class="storage-count">({{ storageUsage.sessionsCount }} saved)</span>
        </div>
        <div v-if="fileCacheSize > 0" class="storage-item">
          <span class="storage-label">File Cache:</span>
          <span class="storage-value">{{ formatFileSize(fileCacheSize) }}</span>
          <button
            @click="clearFileCache"
            :disabled="isClearingCache"
            class="btn btn-sm btn-secondary clear-cache-btn"
            title="Clear cached file chunks"
          >
            {{ isClearingCache ? 'Clearing...' : 'Clear' }}
          </button>
        </div>
        <div class="storage-item storage-total">
          <span class="storage-label">Total IndexedDB:</span>
          <span class="storage-value">{{ formatFileSize(storageUsage.totalUsed) }}</span>
        </div>
      </div>
      <div v-if="cacheMessage" class="cache-message" :class="cacheMessageType">
        {{ cacheMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useSessionStore } from '../stores/session'
import { sessionManager, SESSION_FILE_EXTENSION } from '../services/SessionManager'
import { createLogger } from '../utils/logger'

const logger = createLogger('SessionControls')

export default {
  name: 'SessionControls',

  props: {
    // Current application state to save
    appState: {
      type: Object,
      default: () => ({})
    },
    // Whether a file is currently loaded
    hasFileLoaded: {
      type: Boolean,
      default: false
    }
  },

  emits: ['session-loaded', 'session-saved', 'error'],

  setup(props, { emit }) {
    const sessionStore = useSessionStore()

    // Local state
    const newSessionName = ref('')
    const sessionToDelete = ref(null)
    const verificationWarning = ref(null)
    const pendingSession = ref(null)
    const storageUsage = ref(null)
    const fileCacheSize = ref(0)
    const isClearingCache = ref(false)
    const cacheMessage = ref('')
    const cacheMessageType = ref('')
    const sessionFileExtension = SESSION_FILE_EXTENSION

    // Computed
    const isBusy = computed(() => sessionStore.isLoading || sessionStore.isSaving)

    const canSave = computed(() => {
      return props.hasFileLoaded &&
             newSessionName.value.trim().length > 0 &&
             !isBusy.value
    })

    // Methods
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

    // Lifecycle
    onMounted(async () => {
      await refreshSessions()
      await updateStorageUsage()
    })

    return {
      sessionStore,
      newSessionName,
      sessionToDelete,
      verificationWarning,
      storageUsage,
      fileCacheSize,
      isClearingCache,
      cacheMessage,
      cacheMessageType,
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
      cancelLoad,
      clearFileCache
    }
  }
}
</script>

<style scoped>
.session-controls {
  padding: 1rem;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
}

.session-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}

.session-description {
  color: var(--text-secondary, #666);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

/* Current Session */
.current-session {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-highlight, #e3f2fd);
  border-radius: 6px;
  margin-bottom: 1rem;
}

.current-session-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-details {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.unsaved-indicator {
  color: var(--color-warning, #f59e0b);
  font-size: 0.75rem;
}

.current-session-actions {
  display: flex;
  gap: 0.5rem;
}

/* Save Section */
.save-section {
  margin-bottom: 1.5rem;
}

.save-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.save-form {
  display: flex;
  gap: 0.5rem;
}

.session-name-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  font-size: 0.875rem;
}

.session-name-input:disabled {
  background: var(--bg-disabled, #eee);
  cursor: not-allowed;
}

/* Sessions List Section */
.sessions-section {
  margin-bottom: 1rem;
}

.sessions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.sessions-header h4 {
  margin: 0;
  font-size: 1rem;
}

.sessions-actions {
  display: flex;
  gap: 0.5rem;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  transition: border-color 0.2s;
}

.session-item:hover {
  border-color: var(--color-primary, #3b82f6);
}

.session-item.active {
  border-color: var(--color-primary, #3b82f6);
  background: var(--bg-highlight, #f0f9ff);
}

.session-item-info {
  flex: 1;
  min-width: 0;
}

.session-item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.session-icon {
  font-size: 1.1rem;
}

.session-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-badge {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  background: var(--color-primary, #3b82f6);
  color: white;
  border-radius: 3px;
}

.session-item-meta {
  font-size: 0.8rem;
  color: var(--text-secondary, #666);
}

.file-name {
  font-family: monospace;
}

.modified-date {
  margin-left: 0.5rem;
}

.session-tags {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.tag {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  background: var(--bg-tag, #e5e7eb);
  border-radius: 3px;
}

.session-item-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

/* States */
.loading-state,
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary, #666);
}

.hint {
  font-size: 0.8rem;
  color: var(--text-secondary, #888);
  margin-top: 0.25rem;
}

/* Messages */
.error-message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-error, #fef2f2);
  color: var(--color-error, #dc2626);
  border-radius: 6px;
  margin-top: 1rem;
}

.warning-message {
  padding: 0.75rem 1rem;
  background: var(--bg-warning, #fffbeb);
  color: var(--color-warning-dark, #92400e);
  border-radius: 6px;
  margin-top: 1rem;
}

.warning-message ul {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
}

.warning-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary, #fff);
  padding: 1.5rem;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
}

.modal-content h4 {
  margin: 0 0 0.5rem 0;
}

.warning-text {
  color: var(--color-error, #dc2626);
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

/* Storage Section */
.storage-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color, #ddd);
}

.storage-header h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
}

.storage-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.storage-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.storage-label {
  color: var(--text-secondary, #666);
  min-width: 100px;
}

.storage-value {
  font-family: monospace;
  font-weight: 500;
}

.storage-count {
  color: var(--text-tertiary, #888);
  font-size: 0.8rem;
}

.storage-total {
  margin-top: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--border-color, #ddd);
}

.clear-cache-btn {
  margin-left: auto;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
}

.cache-message {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.cache-message.success {
  background: var(--bg-success, #dcfce7);
  color: var(--color-success, #166534);
}

.cache-message.error {
  background: var(--bg-error, #fef2f2);
  color: var(--color-error, #dc2626);
}

.cache-message.info {
  background: var(--bg-info, #f0f9ff);
  color: var(--color-info, #075985);
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-secondary {
  background: var(--bg-secondary, #e5e7eb);
  color: var(--text-primary, #333);
}

.btn-danger {
  background: var(--color-error, #dc2626);
  color: white;
}

.btn-warning {
  background: var(--color-warning, #f59e0b);
  color: white;
}

.btn-icon {
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.import-btn {
  cursor: pointer;
}

.hidden-input {
  display: none;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .session-controls {
    --bg-primary: #1f2937;
    --bg-secondary: #111827;
    --bg-highlight: #1e3a5f;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
  }
}

/* Theme class support */
.dark .session-controls {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --bg-highlight: #1e3a5f;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --border-color: #374151;
}
</style>
