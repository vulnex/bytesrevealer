/**
 * VULNEX -Bytes Revealer-
 *
 * File: SessionManager.js
 * Author: Simon Roses Femerling
 * Created: 2026-01-03
 * Last Modified: 2026-01-03
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { openDB } from 'idb'
import { createLogger } from '../utils/logger'
import { SESSION_VERSION } from '../stores/session'

const logger = createLogger('SessionManager')

// Database configuration
const DB_NAME = 'bytesrevealer-sessions'
const DB_VERSION = 1
const STORE_SESSIONS = 'sessions'
const STORE_METADATA = 'metadata'

// File extension for exported sessions
export const SESSION_FILE_EXTENSION = '.brsession'

/**
 * SessionManager handles all session persistence operations
 * using IndexedDB for storage and supports import/export.
 */
class SessionManager {
  constructor() {
    this.db = null
    this.initialized = false
  }

  /**
   * Initialize the IndexedDB database
   */
  async init() {
    if (this.initialized) return

    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Sessions store - full session data
          if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
            const sessionsStore = db.createObjectStore(STORE_SESSIONS, {
              keyPath: 'id'
            })
            sessionsStore.createIndex('modified', 'modified')
            sessionsStore.createIndex('name', 'name')
          }

          // Metadata store - lightweight session list
          if (!db.objectStoreNames.contains(STORE_METADATA)) {
            const metaStore = db.createObjectStore(STORE_METADATA, {
              keyPath: 'id'
            })
            metaStore.createIndex('modified', 'modified')
          }
        }
      })

      this.initialized = true
      logger.info('SessionManager initialized')
    } catch (error) {
      logger.error('Failed to initialize SessionManager:', error)
      throw error
    }
  }

  /**
   * Generate a unique session ID
   */
  generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get all session metadata (lightweight list)
   */
  async listSessions() {
    await this.init()

    try {
      const metadata = await this.db.getAll(STORE_METADATA)
      return metadata.sort((a, b) => new Date(b.modified) - new Date(a.modified))
    } catch (error) {
      logger.error('Failed to list sessions:', error)
      throw error
    }
  }

  /**
   * Deep clone and sanitize data for IndexedDB storage
   * IndexedDB uses structured clone which doesn't support certain types
   */
  sanitizeForStorage(obj) {
    if (obj === null || obj === undefined) {
      return obj
    }

    // Handle primitive types
    if (typeof obj !== 'object') {
      return obj
    }

    // Handle Date
    if (obj instanceof Date) {
      return obj.toISOString()
    }

    // Handle ArrayBuffer and TypedArrays - don't store raw bytes
    if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
      return null // Don't store binary data
    }

    // Handle Set
    if (obj instanceof Set) {
      return Array.from(obj)
    }

    // Handle Map
    if (obj instanceof Map) {
      return Object.fromEntries(obj)
    }

    // Handle Array
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForStorage(item)).filter(item => item !== null)
    }

    // Handle plain objects
    const sanitized = {}
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions, symbols, and internal properties
      if (typeof value === 'function' || typeof value === 'symbol') {
        continue
      }
      // Skip properties that start with underscore (internal)
      if (key.startsWith('_')) {
        continue
      }
      const sanitizedValue = this.sanitizeForStorage(value)
      if (sanitizedValue !== null) {
        sanitized[key] = sanitizedValue
      }
    }
    return sanitized
  }

  /**
   * Create session data object from application state
   */
  createSessionData(name, appState) {
    const now = new Date().toISOString()
    const id = this.generateId()

    // Extract file size safely (fileBytes might be a special chunked array)
    let fileSize = 0
    if (appState.fileBytes) {
      fileSize = appState.fileBytes.length || 0
    }

    // Sanitize colored bytes to plain objects
    const coloredBytes = (appState.coloredBytes || []).map(cb => ({
      start: cb.start,
      end: cb.end,
      color: cb.color,
      label: cb.label || ''
    }))

    // Sanitize highlighted bytes to simple arrays
    const highlightedBytes = (appState.highlightedBytes || []).map(hb => {
      if (Array.isArray(hb)) {
        return [...hb]
      }
      if (typeof hb === 'object' && hb !== null) {
        return { start: hb.start, end: hb.end }
      }
      return hb
    })

    // Sanitize file signatures
    const fileSignatures = (appState.fileSignatures || []).map(sig =>
      this.sanitizeForStorage(sig)
    ).filter(Boolean)

    // Sanitize detected file type
    const detectedFileType = appState.detectedFileType
      ? this.sanitizeForStorage(appState.detectedFileType)
      : null

    // Don't store kaitaiStructures - they're too complex and can be regenerated
    // Just store the format ID for re-parsing

    return {
      // Metadata
      id,
      version: SESSION_VERSION,
      name: name || `Session ${new Date().toLocaleDateString()}`,
      created: now,
      modified: now,

      // File identification (NOT the actual bytes)
      file: {
        name: appState.fileName || null,
        size: fileSize,
        sha256: appState.hashes?.sha256 || null
      },

      // Application state
      state: {
        activeTab: appState.activeTab || 'info',
        activeGraphTab: appState.activeGraphTab || 'entropy',
        features: { ...(appState.features || {}) },
        searchPattern: appState.searchPattern || '',
        searchType: appState.searchType || 'hex',
        highlightedBytes: highlightedBytes,
        coloredBytes: coloredBytes,
        baseOffset: appState.baseOffset || 0
      },

      // Cached analysis results
      analysis: {
        entropy: appState.entropy || 0,
        hashes: {
          md5: appState.hashes?.md5 || '',
          sha1: appState.hashes?.sha1 || '',
          sha256: appState.hashes?.sha256 || ''
        },
        fileSignatures: fileSignatures,
        detectedFileType: detectedFileType
      },

      // Format parsing state (simplified - no complex structures)
      format: {
        selectedFormatId: appState.formatStore?.selectedFormatId || '',
        isAutoDetected: appState.formatStore?.isAutoDetected || false,
        confidence: appState.formatStore?.confidence || 0
        // kaitaiStructures intentionally omitted - too complex, will be regenerated
      },

      // User annotations
      annotations: {
        notes: appState.notes || '',
        bookmarks: [...(appState.bookmarks || [])],
        tags: [...(appState.tags || [])]
      }
    }
  }

  /**
   * Extract metadata from full session for lightweight storage
   */
  extractMetadata(session) {
    return {
      id: session.id,
      name: session.name,
      created: session.created,
      modified: session.modified,
      file: {
        name: session.file?.name,
        size: session.file?.size
      },
      tags: session.annotations?.tags || []
    }
  }

  /**
   * Save a new session
   */
  async saveSession(name, appState) {
    await this.init()

    try {
      const session = this.createSessionData(name, appState)

      // Save full session data
      await this.db.put(STORE_SESSIONS, session)

      // Save lightweight metadata
      const metadata = this.extractMetadata(session)
      await this.db.put(STORE_METADATA, metadata)

      logger.info('Session saved:', session.id, session.name)
      return session
    } catch (error) {
      logger.error('Failed to save session:', error)
      throw error
    }
  }

  /**
   * Update an existing session
   */
  async updateSession(id, appState) {
    await this.init()

    try {
      const existing = await this.db.get(STORE_SESSIONS, id)
      if (!existing) {
        throw new Error(`Session not found: ${id}`)
      }

      // Merge with existing session
      const updated = this.createSessionData(existing.name, appState)
      updated.id = id
      updated.created = existing.created
      updated.modified = new Date().toISOString()

      // Preserve annotations if not provided
      if (!appState.notes && existing.annotations?.notes) {
        updated.annotations.notes = existing.annotations.notes
      }
      if (!appState.bookmarks?.length && existing.annotations?.bookmarks?.length) {
        updated.annotations.bookmarks = existing.annotations.bookmarks
      }
      if (!appState.tags?.length && existing.annotations?.tags?.length) {
        updated.annotations.tags = existing.annotations.tags
      }

      // Save updates
      await this.db.put(STORE_SESSIONS, updated)
      await this.db.put(STORE_METADATA, this.extractMetadata(updated))

      logger.info('Session updated:', id)
      return updated
    } catch (error) {
      logger.error('Failed to update session:', error)
      throw error
    }
  }

  /**
   * Load a session by ID
   */
  async loadSession(id) {
    await this.init()

    try {
      const session = await this.db.get(STORE_SESSIONS, id)
      if (!session) {
        throw new Error(`Session not found: ${id}`)
      }

      logger.info('Session loaded:', id, session.name)
      return session
    } catch (error) {
      logger.error('Failed to load session:', error)
      throw error
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(id) {
    await this.init()

    try {
      await this.db.delete(STORE_SESSIONS, id)
      await this.db.delete(STORE_METADATA, id)

      logger.info('Session deleted:', id)
    } catch (error) {
      logger.error('Failed to delete session:', error)
      throw error
    }
  }

  /**
   * Rename a session
   */
  async renameSession(id, newName) {
    await this.init()

    try {
      const session = await this.db.get(STORE_SESSIONS, id)
      if (!session) {
        throw new Error(`Session not found: ${id}`)
      }

      session.name = newName
      session.modified = new Date().toISOString()

      await this.db.put(STORE_SESSIONS, session)
      await this.db.put(STORE_METADATA, this.extractMetadata(session))

      logger.info('Session renamed:', id, newName)
      return session
    } catch (error) {
      logger.error('Failed to rename session:', error)
      throw error
    }
  }

  /**
   * Export a session to a downloadable file
   */
  async exportSession(id) {
    await this.init()

    try {
      const session = await this.db.get(STORE_SESSIONS, id)
      if (!session) {
        throw new Error(`Session not found: ${id}`)
      }

      // Create export wrapper
      const exportData = {
        exportVersion: '1.0',
        exportDate: new Date().toISOString(),
        application: 'BytesRevealer',
        applicationVersion: '0.4',
        session: session
      }

      // Convert to JSON and create blob
      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })

      // Generate filename
      const safeName = session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const filename = `${safeName}_${session.id.split('_')[1]}${SESSION_FILE_EXTENSION}`

      logger.info('Session exported:', id, filename)
      return { blob, filename }
    } catch (error) {
      logger.error('Failed to export session:', error)
      throw error
    }
  }

  /**
   * Import a session from a file
   */
  async importSession(file) {
    await this.init()

    try {
      // Read file content
      const text = await file.text()
      const importData = JSON.parse(text)

      // Validate import format
      if (!importData.session || !importData.session.version) {
        throw new Error('Invalid session file format')
      }

      // Check version compatibility
      const [major] = importData.session.version.split('.')
      const [currentMajor] = SESSION_VERSION.split('.')
      if (major !== currentMajor) {
        throw new Error(`Incompatible session version: ${importData.session.version}`)
      }

      // Generate new ID to avoid conflicts
      const session = importData.session
      session.id = this.generateId()
      session.name = `${session.name} (imported)`
      session.modified = new Date().toISOString()

      // Save imported session
      await this.db.put(STORE_SESSIONS, session)
      await this.db.put(STORE_METADATA, this.extractMetadata(session))

      logger.info('Session imported:', session.id, session.name)
      return session
    } catch (error) {
      logger.error('Failed to import session:', error)
      throw error
    }
  }

  /**
   * Verify that a file matches the session's stored file info
   */
  verifyFile(session, file, fileHash = null) {
    const result = {
      matches: true,
      nameMatch: true,
      sizeMatch: true,
      hashMatch: true,
      warnings: []
    }

    // Check file name
    if (session.file?.name && file.name !== session.file.name) {
      result.nameMatch = false
      result.warnings.push(`File name differs: expected "${session.file.name}", got "${file.name}"`)
    }

    // Check file size
    if (session.file?.size && file.size !== session.file.size) {
      result.sizeMatch = false
      result.matches = false
      result.warnings.push(`File size differs: expected ${session.file.size} bytes, got ${file.size} bytes`)
    }

    // Check hash if provided
    if (session.file?.sha256 && fileHash) {
      if (fileHash.toLowerCase() !== session.file.sha256.toLowerCase()) {
        result.hashMatch = false
        result.matches = false
        result.warnings.push('File hash does not match - file content has changed')
      }
    }

    return result
  }

  /**
   * Clear all sessions (use with caution)
   */
  async clearAllSessions() {
    await this.init()

    try {
      await this.db.clear(STORE_SESSIONS)
      await this.db.clear(STORE_METADATA)
      logger.warn('All sessions cleared')
    } catch (error) {
      logger.error('Failed to clear sessions:', error)
      throw error
    }
  }

  /**
   * Get storage usage estimate for sessions only
   */
  async getStorageUsage() {
    await this.init()

    try {
      // Calculate actual session storage by measuring stored data
      let sessionsSize = 0
      const sessions = await this.db.getAll(STORE_SESSIONS)

      for (const session of sessions) {
        // Estimate size by JSON stringifying (rough approximation)
        sessionsSize += new Blob([JSON.stringify(session)]).size
      }

      // Get total IndexedDB usage for context
      let totalUsage = 0
      let quota = 0
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        totalUsage = estimate.usage || 0
        quota = estimate.quota || 0
      }

      return {
        sessionsUsed: sessionsSize,
        sessionsCount: sessions.length,
        totalUsed: totalUsage,
        quota: quota,
        percentUsed: quota ? ((totalUsage / quota) * 100).toFixed(2) : 0
      }
    } catch (error) {
      logger.error('Failed to get storage usage:', error)
      return { sessionsUsed: 0, sessionsCount: 0, totalUsed: 0, quota: 0, percentUsed: 0 }
    }
  }

  /**
   * Clear the file chunks database (BytesRevealerChunks)
   * This is separate from sessions and used for large file handling
   */
  async clearFileCache() {
    const CHUNKS_DB_NAME = 'BytesRevealerChunks'

    try {
      // Check if the database exists
      const databases = await indexedDB.databases()
      const chunksDbExists = databases.some(db => db.name === CHUNKS_DB_NAME)

      if (!chunksDbExists) {
        logger.info('No file cache database found')
        return { cleared: false, message: 'No file cache to clear' }
      }

      // First, try to open and immediately close to release any stale connections
      try {
        const tempDb = await openDB(CHUNKS_DB_NAME)
        tempDb.close()
        // Small delay to ensure the close is processed
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (e) {
        // Ignore errors here - database might not exist or have issues
      }

      // Delete the entire chunks database
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(CHUNKS_DB_NAME)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => {
          // Try to proceed anyway after a timeout - sometimes the block clears
          logger.warn('File cache database blocked, waiting...')
          setTimeout(() => {
            // Check if it eventually succeeded
            indexedDB.databases().then(dbs => {
              const stillExists = dbs.some(db => db.name === CHUNKS_DB_NAME)
              if (!stillExists) {
                resolve()
              } else {
                reject(new Error('Please refresh the page and try again, or close other BytesRevealer tabs'))
              }
            })
          }, 500)
        }
      })

      logger.info('File cache cleared successfully')
      return { cleared: true, message: 'File cache cleared successfully' }
    } catch (error) {
      logger.error('Failed to clear file cache:', error)
      throw error
    }
  }

  /**
   * Get file cache (chunks database) size
   * Uses navigator.storage.estimate minus session storage for approximation
   * to avoid keeping database connections open
   */
  async getFileCacheSize() {
    const CHUNKS_DB_NAME = 'BytesRevealerChunks'

    try {
      // Check if the database exists
      const databases = await indexedDB.databases()
      const chunksDbExists = databases.some(db => db.name === CHUNKS_DB_NAME)

      if (!chunksDbExists) {
        return 0
      }

      // Get total usage and subtract sessions to estimate cache size
      // This avoids opening the database and causing blocking issues
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const totalUsage = estimate.usage || 0

        // Get sessions size
        await this.init()
        let sessionsSize = 0
        const sessions = await this.db.getAll(STORE_SESSIONS)
        for (const session of sessions) {
          sessionsSize += new Blob([JSON.stringify(session)]).size
        }

        // Subtract a rough estimate for metadata store and other overhead
        const metadataOverhead = 50000 // ~50KB overhead estimate
        const cacheSize = Math.max(0, totalUsage - sessionsSize - metadataOverhead)

        return cacheSize
      }

      return 0
    } catch (error) {
      logger.debug('Could not measure file cache:', error.message)
      return 0
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager()

// Export class for testing
export { SessionManager }
