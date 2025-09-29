/**
 * VULNEX -Bytes Revealer-
 *
 * File: FileChunkManager.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-16
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import logger from './logger'

class FileChunkManager {
  constructor() {
    this.CHUNK_SIZE = 10 * 1024 * 1024 // 10MB chunks
    this.MAX_MEMORY_CHUNKS = 10 // Keep max 10 chunks in memory (100MB)
    this.LARGE_FILE_THRESHOLD = 50 * 1024 * 1024 // 50MB threshold

    this.chunks = new Map() // Memory cache
    this.chunkMetadata = new Map() // Track chunk info
    this.db = null
    this.fileId = null
    this.totalSize = 0
    this.totalChunks = 0
    this.isLargeFile = false

    this.initIndexedDB()
  }

  async initIndexedDB() {
    try {
      const request = indexedDB.open('BytesRevealerChunks', 1)

      request.onerror = () => {
        logger.error('Failed to open IndexedDB:', request.error)
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        logger.debug('IndexedDB initialized for chunk storage')
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
    }
  }

  /**
   * Initialize chunk manager with a file
   * @param {File|Uint8Array} file - The file to manage
   * @returns {Promise<Uint8Array>} - Returns full array for small files, or proxied array for large files
   */
  async initialize(file) {
    try {
      // Clear previous data
      await this.clear()

      // Store original filename if it's a File object
      if (file instanceof File) {
        this.fileName = file.name
      }

      // Handle Uint8Array (already loaded file)
      if (file instanceof Uint8Array) {
        this.totalSize = file.byteLength
        this.isLargeFile = this.totalSize > this.LARGE_FILE_THRESHOLD

        if (!this.isLargeFile) {
          logger.debug('File is small, using direct mode')
          return file // Return as-is for small files
        }

        // For large Uint8Arrays, split into chunks
        this.fileId = `array_${Date.now()}`
        this.totalChunks = Math.ceil(this.totalSize / this.CHUNK_SIZE)

        logger.info(`Large array detected (${this.formatSize(this.totalSize)}), splitting into ${this.totalChunks} chunks`)

        // Store chunks
        for (let i = 0; i < this.totalChunks; i++) {
          const start = i * this.CHUNK_SIZE
          const end = Math.min(start + this.CHUNK_SIZE, this.totalSize)
          const chunk = file.slice(start, end)

          await this.storeChunk(i, chunk)
        }

        return file // Return full array for compatibility
      }

      // Handle File object
      if (file instanceof File || file instanceof Blob) {
        this.totalSize = file.size
        this.isLargeFile = this.totalSize > this.LARGE_FILE_THRESHOLD

        if (!this.isLargeFile) {
          logger.debug('File is small, loading directly')
          const buffer = await file.arrayBuffer()
          return new Uint8Array(buffer)
        }

        this.fileId = `file_${file.name}_${Date.now()}`
        this.totalChunks = Math.ceil(this.totalSize / this.CHUNK_SIZE)

        logger.info(`Large file "${file.name}" detected (${this.formatSize(this.totalSize)}), loading with chunking`)

        // For now, let's load the entire file but keep chunking metadata
        // This ensures compatibility while we optimize individual components
        const buffer = await file.arrayBuffer()
        const fullArray = new Uint8Array(buffer)

        // Store chunks for caching
        for (let i = 0; i < Math.min(3, this.totalChunks); i++) {
          const start = i * this.CHUNK_SIZE
          const end = Math.min(start + this.CHUNK_SIZE, this.totalSize)
          const chunk = fullArray.slice(start, end)
          await this.storeChunk(i, chunk)
        }

        // Mark as chunked for UI indicator
        fullArray.isChunked = true
        fullArray.chunkManager = this

        return fullArray
      }

      throw new Error('Invalid file type')
    } catch (error) {
      logger.error('Failed to initialize chunk manager:', error)
      throw error
    }
  }

  /**
   * Load a specific chunk from file
   */
  async loadFileChunk(chunkIndex) {
    if (!this.fileReference) return null

    const start = chunkIndex * this.CHUNK_SIZE
    const end = Math.min(start + this.CHUNK_SIZE, this.totalSize)

    const blob = this.fileReference.slice(start, end)
    const buffer = await blob.arrayBuffer()
    const chunk = new Uint8Array(buffer)

    await this.storeChunk(chunkIndex, chunk)
    return chunk
  }

  /**
   * Store chunk in memory and IndexedDB
   */
  async storeChunk(index, data) {
    const chunkId = `${this.fileId}_${index}`

    // Store in memory cache
    this.chunks.set(index, data)

    // Evict old chunks if needed
    if (this.chunks.size > this.MAX_MEMORY_CHUNKS) {
      const oldestKey = this.chunks.keys().next().value
      this.chunks.delete(oldestKey)
      logger.debug(`Evicted chunk ${oldestKey} from memory`)
    }

    // Store metadata
    this.chunkMetadata.set(index, {
      size: data.byteLength,
      loaded: true,
      lastAccess: Date.now()
    })

    // Store in IndexedDB if available
    if (this.db && this.isLargeFile) {
      try {
        const transaction = this.db.transaction(['chunks'], 'readwrite')
        const store = transaction.objectStore('chunks')

        await new Promise((resolve, reject) => {
          const request = store.put({
            id: chunkId,
            fileId: this.fileId,
            chunkIndex: index,
            data: data.buffer
          })
          request.onsuccess = resolve
          request.onerror = reject
        })

        logger.debug(`Chunk ${index} stored in IndexedDB`)
      } catch (error) {
        logger.error(`Failed to store chunk ${index} in IndexedDB:`, error)
      }
    }
  }

  /**
   * Get a specific chunk
   */
  async getChunk(index) {
    if (index < 0 || index >= this.totalChunks) return null

    // Check memory cache first
    if (this.chunks.has(index)) {
      logger.debug(`Chunk ${index} retrieved from memory`)
      return this.chunks.get(index)
    }

    // Check IndexedDB
    if (this.db && this.isLargeFile) {
      try {
        const transaction = this.db.transaction(['chunks'], 'readonly')
        const store = transaction.objectStore('chunks')
        const chunkId = `${this.fileId}_${index}`

        const chunk = await new Promise((resolve, reject) => {
          const request = store.get(chunkId)
          request.onsuccess = () => {
            if (request.result) {
              resolve(new Uint8Array(request.result.data))
            } else {
              resolve(null)
            }
          }
          request.onerror = reject
        })

        if (chunk) {
          logger.debug(`Chunk ${index} retrieved from IndexedDB`)
          this.chunks.set(index, chunk)
          return chunk
        }
      } catch (error) {
        logger.error(`Failed to retrieve chunk ${index} from IndexedDB:`, error)
      }
    }

    // Load from file if we have a reference
    if (this.fileReference) {
      logger.debug(`Loading chunk ${index} from file`)
      return await this.loadFileChunk(index)
    }

    return null
  }

  /**
   * Get a byte range across chunks
   */
  async getRange(start, end) {
    if (!this.isLargeFile) {
      logger.warn('getRange called on small file')
      return null
    }

    const startChunk = Math.floor(start / this.CHUNK_SIZE)
    const endChunk = Math.floor(end / this.CHUNK_SIZE)

    const result = new Uint8Array(end - start)
    let resultOffset = 0

    for (let i = startChunk; i <= endChunk; i++) {
      const chunk = await this.getChunk(i)
      if (!chunk) continue

      const chunkStart = i * this.CHUNK_SIZE
      const chunkEnd = chunkStart + chunk.byteLength

      const copyStart = Math.max(0, start - chunkStart)
      const copyEnd = Math.min(chunk.byteLength, end - chunkStart)

      result.set(chunk.slice(copyStart, copyEnd), resultOffset)
      resultOffset += copyEnd - copyStart
    }

    return result
  }

  /**
   * Create a proxy array that loads chunks on demand
   */
  createProxyArray() {
    const manager = this
    const size = this.totalSize

    // Create a sparse array that loads chunks as needed
    const proxyArray = new Uint8Array(size)

    // Override slice method for efficient range access
    proxyArray.slice = function(start = 0, end = size) {
      if (end - start <= manager.CHUNK_SIZE * 2) {
        // For small slices, use synchronous access
        return Uint8Array.prototype.slice.call(this, start, end)
      }

      // For large slices, return a promise
      logger.debug(`Large slice requested: ${start} to ${end}`)
      return manager.getRange(start, end)
    }

    // Add metadata
    proxyArray.isChunked = true
    proxyArray.chunkManager = manager

    return proxyArray
  }

  /**
   * Clear all cached data
   */
  async clear() {
    this.chunks.clear()
    this.chunkMetadata.clear()

    if (this.db && this.fileId) {
      try {
        const transaction = this.db.transaction(['chunks'], 'readwrite')
        const store = transaction.objectStore('chunks')
        const index = store.index('fileId')

        const request = index.openCursor(IDBKeyRange.only(this.fileId))

        await new Promise((resolve, reject) => {
          request.onsuccess = (event) => {
            const cursor = event.target.result
            if (cursor) {
              store.delete(cursor.primaryKey)
              cursor.continue()
            } else {
              resolve()
            }
          }
          request.onerror = reject
        })

        logger.debug('Cleared all chunks from IndexedDB')
      } catch (error) {
        logger.error('Failed to clear IndexedDB:', error)
      }
    }

    this.fileId = null
    this.fileReference = null
    this.totalSize = 0
    this.totalChunks = 0
    this.isLargeFile = false
  }

  /**
   * Get statistics about chunk usage
   */
  getStats() {
    const memoryChunks = this.chunks.size
    const memorySize = Array.from(this.chunks.values()).reduce((sum, chunk) => sum + chunk.byteLength, 0)

    return {
      totalSize: this.totalSize,
      totalChunks: this.totalChunks,
      chunksInMemory: memoryChunks,
      memoryUsage: memorySize,
      isLargeFile: this.isLargeFile,
      cacheHitRate: this.calculateCacheHitRate()
    }
  }

  calculateCacheHitRate() {
    // TODO: Implement cache hit rate tracking
    return 0
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }
}

// Export singleton instance
const fileChunkManager = new FileChunkManager()
export default fileChunkManager