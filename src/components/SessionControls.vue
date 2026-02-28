/** * VULNEX -Bytes Revealer- * * File: SessionControls.vue * Author: Simon Roses Femerling *
Created: 2026-01-03 * Last Modified: 2026-01-03 * Version: 0.4 * License: Apache-2.0 * Copyright (c)
2025 VULNEX. All rights reserved. * https://www.vulnex.com */

<template>
  <div class="session-controls">
    <div class="session-header">
      <h3>Session Management</h3>
      <p class="session-description">
        Save and restore your analysis sessions. Sessions preserve your annotations, search results,
        and analysis state.
      </p>
    </div>

    <!-- Current Session Status -->
    <div v-if="sessionStore.hasCurrentSession" class="current-session">
      <div class="current-session-info">
        <span class="session-icon">📂</span>
        <div class="session-details">
          <strong>{{ sessionStore.currentSessionName }}</strong>
          <span v-if="sessionStore.isDirty" class="unsaved-indicator" title="Unsaved changes"
            >●</span
          >
        </div>
      </div>
      <div class="current-session-actions">
        <button :disabled="isBusy" class="btn btn-primary btn-sm" @click="saveCurrentSession">
          {{ sessionStore.isSaving ? 'Saving...' : 'Save' }}
        </button>
        <button :disabled="isBusy" class="btn btn-secondary btn-sm" @click="closeSession">
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
        <button :disabled="!canSave" class="btn btn-primary" @click="saveNewSession">
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
          <button :disabled="isBusy" class="btn btn-icon" title="Refresh" @click="refreshSessions">
            🔄
          </button>
          <label class="btn btn-secondary btn-sm import-btn">
            Import
            <input
              type="file"
              :accept="sessionFileExtension"
              class="hidden-input"
              :disabled="isBusy"
              @change="handleImport"
            />
          </label>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="sessionStore.isLoading" class="loading-state">Loading sessions...</div>

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
              :disabled="isBusy || session.id === sessionStore.currentSessionId"
              class="btn btn-sm btn-primary"
              title="Load this session"
              @click="loadSession(session)"
            >
              Load
            </button>
            <button
              :disabled="isBusy"
              class="btn btn-sm btn-secondary"
              title="Export to file"
              @click="exportSession(session)"
            >
              Export
            </button>
            <button
              :disabled="isBusy"
              class="btn btn-sm btn-danger"
              title="Delete session"
              @click="confirmDelete(session)"
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
      <button class="btn-close" @click="sessionStore.clearError()">×</button>
    </div>

    <!-- File Verification Warning -->
    <div v-if="verificationWarning" class="warning-message">
      <strong>File Verification:</strong>
      <ul>
        <li v-for="warning in verificationWarning.warnings" :key="warning">{{ warning }}</li>
      </ul>
      <div class="warning-actions">
        <button class="btn btn-warning btn-sm" @click="proceedWithLoad">Load Anyway</button>
        <button class="btn btn-secondary btn-sm" @click="cancelLoad">Cancel</button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="sessionToDelete" class="modal-overlay" @click.self="sessionToDelete = null">
      <div class="modal-content">
        <h4>Delete Session?</h4>
        <p>Are you sure you want to delete "{{ sessionToDelete.name }}"?</p>
        <p class="warning-text">This action cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-danger" @click="deleteSession(sessionToDelete)">Delete</button>
          <button class="btn btn-secondary" @click="sessionToDelete = null">Cancel</button>
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
            :disabled="isClearingCache"
            class="btn btn-sm btn-secondary clear-cache-btn"
            title="Clear cached file chunks"
            @click="clearFileCache"
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
import { useSessionStore } from '../stores/session'
import { useSessionStorage } from '../composables/useSessionStorage'
import { useSessionActions } from '../composables/useSessionActions'

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

    const storage = useSessionStorage()
    const actions = useSessionActions(props, emit, {
      updateStorageUsage: storage.updateStorageUsage
    })

    return {
      sessionStore,
      // from storage
      storageUsage: storage.storageUsage,
      fileCacheSize: storage.fileCacheSize,
      isClearingCache: storage.isClearingCache,
      cacheMessage: storage.cacheMessage,
      cacheMessageType: storage.cacheMessageType,
      clearFileCache: storage.clearFileCache,
      // from actions
      newSessionName: actions.newSessionName,
      sessionToDelete: actions.sessionToDelete,
      verificationWarning: actions.verificationWarning,
      sessionFileExtension: actions.sessionFileExtension,
      isBusy: actions.isBusy,
      canSave: actions.canSave,
      formatFileSize: actions.formatFileSize,
      formatDate: actions.formatDate,
      refreshSessions: actions.refreshSessions,
      saveNewSession: actions.saveNewSession,
      saveCurrentSession: actions.saveCurrentSession,
      loadSession: actions.loadSession,
      closeSession: actions.closeSession,
      exportSession: actions.exportSession,
      handleImport: actions.handleImport,
      confirmDelete: actions.confirmDelete,
      deleteSession: actions.deleteSession,
      proceedWithLoad: actions.proceedWithLoad,
      cancelLoad: actions.cancelLoad
    }
  }
}
</script>

<style scoped>
@import '../styles/session-controls.css';
</style>
