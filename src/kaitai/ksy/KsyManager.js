/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KsyManager.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { openDB } from 'idb'
import { getKsyValidator } from './KsyValidator.js'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('KsyManager')

/**
 * Manager for KSY file storage and retrieval
 * Uses IndexedDB for persistent storage
 */
class KsyManager {
  constructor() {
    this.dbName = 'BytesRevealerKSY'
    this.dbVersion = 1
    this.storeName = 'ksy_files'
    this.db = null
    this.validator = null
    this.dbPromise = this.initDB()
    this.useMemoryStorage = false
    this.memoryStore = new Map()
  }

  /**
   * Initialize IndexedDB
   */
  async initDB() {
    try {
      this.db = await openDB(this.dbName, this.dbVersion, {
        upgrade(db, oldVersion, newVersion, transaction) {
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains('ksy_files')) {
            const store = db.createObjectStore('ksy_files', {
              keyPath: 'id',
              autoIncrement: false
            })
            
            // Create indexes
            store.createIndex('name', 'name', { unique: false })
            store.createIndex('category', 'category', { unique: false })
            store.createIndex('version', 'version', { unique: false })
            store.createIndex('created', 'created', { unique: false })
            store.createIndex('modified', 'modified', { unique: false })
          }
        }
      })
      
      // Successfully initialized
      this.useMemoryStorage = false
      logger.debug('IndexedDB initialized successfully')
    } catch (error) {
      logger.warn('Failed to initialize IndexedDB, using memory storage:', error)
      // Fallback to in-memory storage
      this.db = null
      this.useMemoryStorage = true
      this.memoryStore = new Map()
    }
  }

  /**
   * Generate unique ID for KSY file
   * @param {string} name - Format name
   * @returns {string} Unique ID
   */
  generateId(name) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    return `${cleanName}_${timestamp}_${random}`
  }

  /**
   * Add new KSY file
   * @param {Object} ksyData - KSY file data
   * @returns {string} File ID
   */
  async add(ksyData) {
    // Ensure DB is initialized
    if (!this.db && this.dbPromise) {
      await this.dbPromise
    }
    
    // Initialize validator if needed
    if (!this.validator) {
      this.validator = getKsyValidator()
    }

    // Validate KSY content
    const validation = await this.validator.validate(ksyData.content)
    
    // Only fail if we can't parse the YAML at all
    if (!validation.parsed) {
      throw new Error(`Invalid KSY: Cannot parse YAML`)
    }
    
    // Log validation warnings but don't fail
    if (!validation.valid && validation.errors.length > 0) {
      logger.warn(`KSY validation warnings for ${ksyData.name}:`, validation.errors)
    }

    const id = ksyData.id || this.generateId(ksyData.name)
    const timestamp = Date.now()

    const entry = {
      id,
      name: ksyData.name,
      content: ksyData.content,
      compiled: ksyData.compiled || null,
      category: ksyData.category || 'user',
      version: ksyData.version || '1.0.0',
      description: ksyData.description || '',
      created: ksyData.created || timestamp,
      modified: timestamp,
      metadata: {
        ...ksyData.metadata,
        formatId: validation.parsed?.meta?.id,
        endian: validation.parsed?.meta?.endian,
        fileExtension: validation.parsed?.meta?.['file-extension'],
        imports: validation.parsed?.meta?.imports || []
      }
    }

    // Store in database
    if (this.useMemoryStorage) {
      this.memoryStore.set(id, entry)
    } else if (this.db) {
      await this.db.put(this.storeName, entry)
    } else {
      // Fallback to memory if DB is not available
      logger.warn('Database not available, using memory storage')
      this.useMemoryStorage = true
      this.memoryStore = this.memoryStore || new Map()
      this.memoryStore.set(id, entry)
    }

    return id
  }

  /**
   * Get KSY file by ID
   * @param {string} id - File ID
   * @returns {Object|null} KSY file data
   */
  async get(id) {
    // Ensure DB is initialized
    if (!this.db && this.dbPromise) {
      await this.dbPromise
    }
    
    if (this.useMemoryStorage) {
      return this.memoryStore.get(id) || null
    }
    
    try {
      return await this.db.get(this.storeName, id) || null
    } catch (error) {
      logger.error('Failed to get KSY file:', error)
      return null
    }
  }

  /**
   * Get all KSY files
   * @param {Object} filter - Optional filter
   * @returns {Array} List of KSY files
   */
  async getAll(filter = {}) {
    // Ensure DB is initialized
    if (!this.db && this.dbPromise) {
      await this.dbPromise
    }
    
    let results = []

    if (this.useMemoryStorage) {
      results = Array.from(this.memoryStore.values())
    } else if (this.db) {
      try {
        results = await this.db.getAll(this.storeName)
      } catch (error) {
        logger.error('Failed to get all KSY files:', error)
        return []
      }
    } else {
      // DB not initialized yet, return empty array
      return []
    }

    // Apply filters
    if (filter.category) {
      results = results.filter(item => item.category === filter.category)
    }

    if (filter.name) {
      const searchTerm = filter.name.toLowerCase()
      results = results.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
      )
    }

    // Sort by modified date (newest first)
    results.sort((a, b) => b.modified - a.modified)

    return results
  }

  /**
   * Update existing KSY file
   * @param {string} id - File ID
   * @param {Object} updates - Updates to apply
   * @returns {boolean} Success
   */
  async update(id, updates) {
    const existing = await this.get(id)
    if (!existing) {
      throw new Error(`KSY file not found: ${id}`)
    }

    // Validate if content is being updated
    if (updates.content) {
      const validation = await this.validator.validate(updates.content)
      if (!validation.valid) {
        throw new Error(`Invalid KSY: ${validation.errors.join(', ')}`)
      }

      // Update metadata from parsed content
      updates.metadata = {
        ...existing.metadata,
        ...updates.metadata,
        formatId: validation.parsed?.meta?.id,
        endian: validation.parsed?.meta?.endian,
        fileExtension: validation.parsed?.meta?.['file-extension'],
        imports: validation.parsed?.meta?.imports || []
      }
    }

    const updated = {
      ...existing,
      ...updates,
      modified: Date.now()
    }

    if (this.useMemoryStorage) {
      this.memoryStore.set(id, updated)
    } else if (this.db) {
      await this.db.put(this.storeName, updated)
    } else {
      // Fallback to memory if DB is not available
      this.useMemoryStorage = true
      this.memoryStore = this.memoryStore || new Map()
      this.memoryStore.set(id, updated)
    }

    return true
  }

  /**
   * Delete KSY file
   * @param {string} id - File ID
   * @returns {boolean} Success
   */
  async delete(id) {
    // Ensure DB is initialized
    if (!this.db && this.dbPromise) {
      await this.dbPromise
    }
    
    if (this.useMemoryStorage) {
      return this.memoryStore.delete(id)
    }

    if (this.db) {
      try {
        await this.db.delete(this.storeName, id)
        return true
      } catch (error) {
        logger.error('Failed to delete KSY file:', error)
        return false
      }
    }
    
    return false
  }

  /**
   * Import KSY file from File object
   * @param {File} file - File object
   * @returns {string} File ID
   */
  async importFile(file) {
    const content = await file.text()
    const name = file.name.replace(/\.ksy$/i, '')

    return await this.add({
      name,
      content,
      category: 'user',
      metadata: {
        originalFileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified
      }
    })
  }

  /**
   * Export KSY file
   * @param {string} id - File ID
   * @returns {Blob} File blob
   */
  async export(id) {
    const ksyFile = await this.get(id)
    if (!ksyFile) {
      throw new Error(`KSY file not found: ${id}`)
    }

    const blob = new Blob([ksyFile.content], {
      type: 'text/x-yaml'
    })

    return blob
  }

  /**
   * Get categories
   * @returns {Array} List of categories
   */
  async getCategories() {
    const files = await this.getAll()
    const categories = new Set(['system', 'user', 'community'])
    
    files.forEach(file => {
      if (file.category) {
        categories.add(file.category)
      }
    })

    return Array.from(categories).sort()
  }

  /**
   * Search KSY files
   * @param {string} query - Search query
   * @returns {Array} Matching files
   */
  async search(query) {
    const searchTerm = query.toLowerCase()
    const files = await this.getAll()

    return files.filter(file => {
      // Search in name
      if (file.name.toLowerCase().includes(searchTerm)) return true
      
      // Search in description
      if (file.description && file.description.toLowerCase().includes(searchTerm)) return true
      
      // Search in format ID
      if (file.metadata?.formatId && file.metadata.formatId.toLowerCase().includes(searchTerm)) return true
      
      // Search in category
      if (file.category && file.category.toLowerCase().includes(searchTerm)) return true

      return false
    })
  }

  /**
   * Load preset KSY files
   * @param {Array} presets - Array of preset KSY files
   */
  async loadPresets(presets) {
    for (const preset of presets) {
      try {
        // Check if already exists
        const existing = await this.search(preset.name)
        if (existing.length === 0) {
          await this.add({
            ...preset,
            category: 'system',
            metadata: {
              ...preset.metadata,
              isPreset: true
            }
          })
        }
      } catch (error) {
        logger.warn(`Failed to load preset ${preset.name}:`, error)
      }
    }
  }

  /**
   * Clear all user files (keep system presets)
   */
  async clearUserFiles() {
    const files = await this.getAll({ category: 'user' })
    
    for (const file of files) {
      await this.delete(file.id)
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  async getStats() {
    const files = await this.getAll()
    let totalSize = 0
    const categoryCounts = {}

    files.forEach(file => {
      totalSize += file.content.length
      categoryCounts[file.category] = (categoryCounts[file.category] || 0) + 1
    })

    return {
      totalFiles: files.length,
      totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      categoryCounts,
      usingMemoryStorage: this.useMemoryStorage
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    
    if (this.memoryStore) {
      this.memoryStore.clear()
    }
  }
}

// Export singleton
let instance = null

export function getKsyManager() {
  if (!instance) {
    instance = new KsyManager()
  }
  return instance
}

export default KsyManager