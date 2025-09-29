/**
 * VULNEX -Bytes Revealer-
 *
 * File: FileChunkManagerV2.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-17
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * True progressive loading implementation that loads chunks on-demand
 */

import { createLogger } from './logger'

const logger = createLogger('FileChunkManagerV2')

class FileChunkManagerV2 {
  constructor() {
    this.CHUNK_SIZE = 1 * 1024 * 1024 // 1MB chunks for faster loading
    this.MAX_MEMORY_CHUNKS = 50 // Keep max 50 chunks in memory (50MB)
    this.LARGE_FILE_THRESHOLD = 10 * 1024 * 1024 // 10MB threshold for progressive loading
    this.PREFETCH_CHUNKS = 3 // Number of chunks to prefetch

    this.chunks = new Map() // Memory cache
    this.loadingChunks = new Map() // Track chunks being loaded (promises)
    this.db = null
    this.fileReference = null // Keep reference to File object
    this.fileId = null
    this.fileName = null
    this.totalSize = 0
    this.totalChunks = 0
    this.isProgressive = false
    this.accessOrder = [] // Track access order for LRU
    this.chunkLoadListeners = new Set() // Listeners for chunk load events

    this.initIndexedDB()
  }

  async initIndexedDB() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('BytesRevealerChunksV2', 1)

        request.onerror = () => {
          logger.error('Failed to open IndexedDB:', request.error)
          resolve() // Continue without IndexedDB
        }

        request.onsuccess = (event) => {
          this.db = event.target.result
          logger.debug('IndexedDB initialized for chunk storage')
          resolve()
        }

        request.onupgradeneeded = (event) => {
          const db = event.target.result

          if (!db.objectStoreNames.contains('chunks')) {
            const store = db.createObjectStore('chunks', { keyPath: 'id' })
            store.createIndex('fileId', 'fileId', { unique: false })
            store.createIndex('chunkIndex', 'chunkIndex', { unique: false })
          }

          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'fileId' })
          }
        }
      } catch (error) {
        logger.error('IndexedDB initialization failed:', error)
        resolve() // Continue without IndexedDB
      }
    })
  }

  /**
   * Initialize with a file for progressive loading
   * @param {File|Uint8Array} file - The file to manage
   * @param {Object} options - Options for loading
   * @returns {Promise<Object>} - Returns file accessor object
   */
  async initialize(file, options = {}) {
    try {
      // Wait for IndexedDB to be ready
      if (!this.db) {
        await this.initIndexedDB()
      }

      // Clear previous data
      await this.clear()

      // Handle different input types
      if (file instanceof File) {
        this.fileReference = file
        this.fileName = file.name
        this.totalSize = file.size
      } else if (file instanceof Uint8Array) {
        // For Uint8Array, store as a blob for consistent slicing
        this.fileReference = new Blob([file])
        this.fileName = 'memory-buffer'
        this.totalSize = file.byteLength
      } else {
        throw new Error('Invalid file type')
      }

      // Determine if we should use progressive loading
      const forceProgressive = options.forceProgressive
      this.isProgressive = forceProgressive || this.totalSize > this.LARGE_FILE_THRESHOLD

      this.fileId = `file_${this.fileName}_${Date.now()}`
      this.totalChunks = Math.ceil(this.totalSize / this.CHUNK_SIZE)

      if (!this.isProgressive) {
        // For small files, load directly
        logger.debug(`Small file (${this.formatSize(this.totalSize)}), loading directly`)
        const buffer = await this.fileReference.arrayBuffer()
        const data = new Uint8Array(buffer)

        // Return wrapper with consistent API
        return {
          data: data,
          length: this.totalSize,
          byteLength: this.totalSize,
          isProgressive: false,
          getRange: async (start, end) => data.slice(start, end),
          getByte: (index) => data[index],
          slice: (start, end) => data.slice(start, end),
          cleanup: () => this.clear()
        }
      }

      logger.info(`Progressive loading enabled for "${this.fileName}" (${this.formatSize(this.totalSize)}), ${this.totalChunks} chunks`)

      // Return progressive accessor
      return {
        data: null, // No direct data access in progressive mode
        length: this.totalSize,
        byteLength: this.totalSize,
        isProgressive: true,
        totalChunks: this.totalChunks,
        chunkSize: this.CHUNK_SIZE,
        getRange: (start, end) => this.getRange(start, end),
        getByte: (index) => this.getByte(index),
        slice: (start, end) => this.getRange(start, end),
        getChunkStatus: (index) => this.getChunkStatus(index),
        loadChunk: (index) => this.loadChunk(index),
        loadChunksForRange: (start, end) => this.loadChunksForRange(start, end),
        addChunkListener: (listener) => this.addChunkListener(listener),
        removeChunkListener: (listener) => this.removeChunkListener(listener),
        cleanup: () => this.clear(),
        // For compatibility
        subarray: (start, end) => this.getRange(start, end),
        [Symbol.iterator]: function* () {
          logger.warn('Iterator called on progressive file - this may be slow')
          for (let i = 0; i < this.byteLength; i++) {
            yield this.getByte(i)
          }
        }
      }
    } catch (error) {
      logger.error('Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Get a single byte at index
   */
  async getByte(index) {
    if (index < 0 || index >= this.totalSize) return 0

    const chunkIndex = Math.floor(index / this.CHUNK_SIZE)
    const chunk = await this.loadChunk(chunkIndex)

    if (chunk) {
      const offset = index % this.CHUNK_SIZE
      return chunk[offset]
    }

    return 0
  }

  /**
   * Get bytes in a range
   */
  async getRange(start, end) {
    start = Math.max(0, Math.min(start, this.totalSize))
    end = Math.max(start, Math.min(end || this.totalSize, this.totalSize))

    const startChunk = Math.floor(start / this.CHUNK_SIZE)
    const endChunk = Math.floor((end - 1) / this.CHUNK_SIZE)
    const result = new Uint8Array(end - start)

    // Load all required chunks in parallel
    const chunkPromises = []
    for (let ci = startChunk; ci <= endChunk; ci++) {
      chunkPromises.push(this.loadChunk(ci))
    }

    const chunks = await Promise.all(chunkPromises)

    // Copy data from chunks to result
    let resultOffset = 0
    for (let ci = startChunk; ci <= endChunk; ci++) {
      const chunk = chunks[ci - startChunk]
      if (!chunk) continue

      const chunkStart = ci * this.CHUNK_SIZE
      const copyStart = Math.max(0, start - chunkStart)
      const copyEnd = Math.min(chunk.length, end - chunkStart)
      const copyLength = copyEnd - copyStart

      result.set(chunk.subarray(copyStart, copyEnd), resultOffset)
      resultOffset += copyLength
    }

    return result
  }

  /**
   * Load chunks for a given range (without returning data)
   */
  async loadChunksForRange(start, end) {
    const startChunk = Math.floor(start / this.CHUNK_SIZE)
    const endChunk = Math.floor((end - 1) / this.CHUNK_SIZE)

    const promises = []
    for (let ci = startChunk; ci <= endChunk; ci++) {
      promises.push(this.loadChunk(ci))
    }

    await Promise.all(promises)
  }

  /**
   * Get the status of a chunk
   */
  getChunkStatus(chunkIndex) {
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks) return 'invalid'
    if (this.chunks.has(chunkIndex)) return 'loaded'
    if (this.loadingChunks.has(chunkIndex)) return 'loading'
    return 'unloaded'
  }

  /**
   * Load a specific chunk
   */
  async loadChunk(chunkIndex) {
    if (chunkIndex < 0 || chunkIndex >= this.totalChunks) return null

    // Update LRU tracking
    this.trackAccess(chunkIndex)

    // Check memory cache
    if (this.chunks.has(chunkIndex)) {
      return this.chunks.get(chunkIndex)
    }

    // Check if already loading
    if (this.loadingChunks.has(chunkIndex)) {
      return this.loadingChunks.get(chunkIndex)
    }

    // Start loading
    const loadPromise = this.loadChunkInternal(chunkIndex)
    this.loadingChunks.set(chunkIndex, loadPromise)

    try {
      const chunk = await loadPromise
      this.loadingChunks.delete(chunkIndex)

      if (chunk) {
        // Add to cache
        this.chunks.set(chunkIndex, chunk)
        this.evictIfNeeded()

        // Notify listeners
        this.notifyChunkLoaded(chunkIndex)

        // Prefetch nearby chunks
        this.prefetchChunks(chunkIndex)
      }

      return chunk
    } catch (error) {
      this.loadingChunks.delete(chunkIndex)
      throw error
    }
  }

  /**
   * Internal chunk loading
   */
  async loadChunkInternal(chunkIndex) {
    // Try IndexedDB first
    const dbChunk = await this.loadChunkFromDB(chunkIndex)
    if (dbChunk) {
      logger.debug(`Chunk ${chunkIndex} loaded from IndexedDB`)
      return dbChunk
    }

    // Load from file
    const fileChunk = await this.loadChunkFromFile(chunkIndex)
    if (fileChunk) {
      // Save to IndexedDB for future use
      await this.saveChunkToDB(chunkIndex, fileChunk)
      logger.debug(`Chunk ${chunkIndex} loaded from file`)
      return fileChunk
    }

    return null
  }

  /**
   * Load chunk from file
   */
  async loadChunkFromFile(chunkIndex) {
    if (!this.fileReference) return null

    const start = chunkIndex * this.CHUNK_SIZE
    const end = Math.min(start + this.CHUNK_SIZE, this.totalSize)

    try {
      const blob = this.fileReference.slice(start, end)
      const buffer = await blob.arrayBuffer()
      return new Uint8Array(buffer)
    } catch (error) {
      logger.error(`Failed to load chunk ${chunkIndex} from file:`, error)
      return null
    }
  }

  /**
   * Load chunk from IndexedDB
   */
  async loadChunkFromDB(chunkIndex) {
    if (!this.db) return null

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction(['chunks'], 'readonly')
        const store = transaction.objectStore('chunks')
        const request = store.get(`${this.fileId}_${chunkIndex}`)

        request.onsuccess = () => {
          if (request.result && request.result.data) {
            resolve(new Uint8Array(request.result.data))
          } else {
            resolve(null)
          }
        }

        request.onerror = () => {
          logger.error('Failed to load chunk from DB:', request.error)
          resolve(null)
        }
      } catch (error) {
        logger.error('DB transaction failed:', error)
        resolve(null)
      }
    })
  }

  /**
   * Save chunk to IndexedDB
   */
  async saveChunkToDB(chunkIndex, data) {
    if (!this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction(['chunks'], 'readwrite')
        const store = transaction.objectStore('chunks')

        const request = store.put({
          id: `${this.fileId}_${chunkIndex}`,
          fileId: this.fileId,
          chunkIndex: chunkIndex,
          data: data.buffer
        })

        request.onsuccess = () => resolve()
        request.onerror = () => {
          logger.error('Failed to save chunk to DB:', request.error)
          resolve()
        }
      } catch (error) {
        logger.error('DB save failed:', error)
        resolve()
      }
    })
  }

  /**
   * Prefetch nearby chunks
   */
  async prefetchChunks(currentChunkIndex) {
    // Prefetch next chunks
    for (let i = 1; i <= this.PREFETCH_CHUNKS; i++) {
      const nextChunk = currentChunkIndex + i
      if (nextChunk < this.totalChunks &&
          !this.chunks.has(nextChunk) &&
          !this.loadingChunks.has(nextChunk)) {
        // Fire and forget
        this.loadChunk(nextChunk).catch(err =>
          logger.debug(`Prefetch failed for chunk ${nextChunk}:`, err)
        )
      }
    }

    // Also prefetch previous chunk for bidirectional scrolling
    const prevChunk = currentChunkIndex - 1
    if (prevChunk >= 0 &&
        !this.chunks.has(prevChunk) &&
        !this.loadingChunks.has(prevChunk)) {
      this.loadChunk(prevChunk).catch(err =>
        logger.debug(`Prefetch failed for chunk ${prevChunk}:`, err)
      )
    }
  }

  /**
   * Track chunk access for LRU
   */
  trackAccess(chunkIndex) {
    const idx = this.accessOrder.indexOf(chunkIndex)
    if (idx > -1) {
      this.accessOrder.splice(idx, 1)
    }
    this.accessOrder.push(chunkIndex)
  }

  /**
   * Evict chunks if needed (LRU)
   */
  evictIfNeeded() {
    while (this.chunks.size > this.MAX_MEMORY_CHUNKS && this.accessOrder.length > 0) {
      const oldestChunk = this.accessOrder.shift()
      if (this.chunks.has(oldestChunk)) {
        this.chunks.delete(oldestChunk)
        logger.debug(`Evicted chunk ${oldestChunk} (LRU)`)
      }
    }
  }

  /**
   * Add a chunk load listener
   */
  addChunkListener(listener) {
    this.chunkLoadListeners.add(listener)
  }

  /**
   * Remove a chunk load listener
   */
  removeChunkListener(listener) {
    this.chunkLoadListeners.delete(listener)
  }

  /**
   * Notify listeners about chunk load
   */
  notifyChunkLoaded(chunkIndex) {
    this.chunkLoadListeners.forEach(listener => {
      try {
        listener({ chunkIndex, totalChunks: this.totalChunks })
      } catch (error) {
        logger.error('Chunk listener error:', error)
      }
    })
  }

  /**
   * Clear all data
   */
  async clear() {
    this.chunks.clear()
    this.loadingChunks.clear()
    this.accessOrder = []
    this.chunkLoadListeners.clear()
    this.fileReference = null
    this.fileId = null
    this.fileName = null
    this.totalSize = 0
    this.totalChunks = 0
    this.isProgressive = false

    if (this.db) {
      try {
        const transaction = this.db.transaction(['chunks', 'metadata'], 'readwrite')
        transaction.objectStore('chunks').clear()
        transaction.objectStore('metadata').clear()
      } catch (error) {
        logger.error('Failed to clear IndexedDB:', error)
      }
    }
  }

  /**
   * Get memory usage info
   */
  getMemoryInfo() {
    const loadedChunks = this.chunks.size
    const memoryUsage = loadedChunks * this.CHUNK_SIZE
    const loadingCount = this.loadingChunks.size

    return {
      loadedChunks,
      totalChunks: this.totalChunks,
      memoryUsageMB: (memoryUsage / (1024 * 1024)).toFixed(2),
      maxMemoryMB: (this.MAX_MEMORY_CHUNKS * this.CHUNK_SIZE / (1024 * 1024)).toFixed(2),
      loadingChunks: loadingCount,
      cacheHitRate: this.calculateCacheHitRate()
    }
  }

  /**
   * Calculate cache hit rate (for monitoring)
   */
  calculateCacheHitRate() {
    // This would need proper tracking of hits vs misses
    // For now, return an estimate based on loaded chunks
    if (this.totalChunks === 0) return 0
    return Math.min(100, (this.chunks.size / this.totalChunks) * 100).toFixed(1)
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
}

// Export singleton instance
const fileChunkManagerV2 = new FileChunkManagerV2()
export default fileChunkManagerV2