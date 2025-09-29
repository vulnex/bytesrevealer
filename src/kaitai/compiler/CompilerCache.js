/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: CompilerCache.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

/**
 * Cache system for compiled KSY formats
 * Uses localStorage for persistence and memory cache for performance
 */

import { createLogger } from '../../utils/logger'

const logger = createLogger('CompilerCache')

class CompilerCache {
  constructor() {
    this.memoryCache = new Map()
    this.cachePrefix = 'ksy_compiled_'
    this.maxMemoryItems = 50
    this.maxStorageSize = 5 * 1024 * 1024 // 5MB limit for localStorage
  }

  /**
   * Get compiled format from cache
   * @param {string} hash - Format hash
   * @returns {string|null} Compiled JavaScript or null
   */
  async get(hash) {
    // Check memory cache first
    if (this.memoryCache.has(hash)) {
      const entry = this.memoryCache.get(hash)
      entry.lastAccessed = Date.now()
      return entry.content
    }

    // Check localStorage
    try {
      const stored = localStorage.getItem(this.cachePrefix + hash)
      if (stored) {
        const entry = JSON.parse(stored)
        
        // Add to memory cache
        this.addToMemoryCache(hash, entry.content)
        
        return entry.content
      }
    } catch (error) {
      logger.warn('Failed to retrieve from localStorage:', error)
    }

    return null
  }

  /**
   * Store compiled format in cache
   * @param {string} hash - Format hash
   * @param {string} content - Compiled JavaScript
   */
  async set(hash, content) {
    // Add to memory cache
    this.addToMemoryCache(hash, content)

    // Store in localStorage
    try {
      const entry = {
        content,
        timestamp: Date.now(),
        size: content.length
      }

      // Check storage size limit
      if (this.wouldExceedStorageLimit(entry.size)) {
        this.evictFromStorage()
      }

      localStorage.setItem(this.cachePrefix + hash, JSON.stringify(entry))
    } catch (error) {
      logger.warn('Failed to store in localStorage:', error)
      // If localStorage is full, clear old entries
      if (error.name === 'QuotaExceededError') {
        this.evictFromStorage()
        // Try once more
        try {
          const entry = {
            content,
            timestamp: Date.now(),
            size: content.length
          }
          localStorage.setItem(this.cachePrefix + hash, JSON.stringify(entry))
        } catch (retryError) {
          logger.error('Failed to store after eviction:', retryError)
        }
      }
    }
  }

  /**
   * Add to memory cache with LRU eviction
   * @param {string} hash - Format hash
   * @param {string} content - Compiled content
   */
  addToMemoryCache(hash, content) {
    // Check memory cache size limit
    if (this.memoryCache.size >= this.maxMemoryItems) {
      // Evict least recently used
      let oldestKey = null
      let oldestTime = Date.now()

      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed
          oldestKey = key
        }
      }

      if (oldestKey) {
        this.memoryCache.delete(oldestKey)
      }
    }

    this.memoryCache.set(hash, {
      content,
      lastAccessed: Date.now()
    })
  }

  /**
   * Check if adding new item would exceed storage limit
   * @param {number} newSize - Size of new item
   * @returns {boolean} Would exceed limit
   */
  wouldExceedStorageLimit(newSize) {
    let totalSize = newSize

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.cachePrefix)) {
        const item = localStorage.getItem(key)
        if (item) {
          totalSize += item.length
        }
      }
    }

    return totalSize > this.maxStorageSize
  }

  /**
   * Evict old entries from localStorage
   */
  evictFromStorage() {
    const entries = []

    // Collect all cache entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.cachePrefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key))
          entries.push({
            key,
            timestamp: item.timestamp || 0,
            size: item.size || 0
          })
        } catch (error) {
          // Remove corrupted entry
          localStorage.removeItem(key)
        }
      }
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp)

    // Remove oldest 25% of entries
    const removeCount = Math.ceil(entries.length * 0.25)
    for (let i = 0; i < removeCount; i++) {
      if (entries[i]) {
        localStorage.removeItem(entries[i].key)
      }
    }
  }

  /**
   * Remove specific item from cache
   * @param {string} hash - Format hash
   */
  async remove(hash) {
    this.memoryCache.delete(hash)
    try {
      localStorage.removeItem(this.cachePrefix + hash)
    } catch (error) {
      logger.warn('Failed to remove from localStorage:', error)
    }
  }

  /**
   * Clear all cached items
   */
  clear() {
    // Clear memory cache
    this.memoryCache.clear()

    // Clear localStorage entries
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.cachePrefix)) {
        keysToRemove.push(key)
      }
    }

    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        logger.warn('Failed to remove key:', key, error)
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    let storageCount = 0
    let storageSize = 0

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.cachePrefix)) {
        storageCount++
        const item = localStorage.getItem(key)
        if (item) {
          storageSize += item.length
        }
      }
    }

    return {
      memoryCount: this.memoryCache.size,
      storageCount,
      storageSize,
      storageSizeKB: (storageSize / 1024).toFixed(2),
      maxMemoryItems: this.maxMemoryItems,
      maxStorageSizeMB: (this.maxStorageSize / (1024 * 1024)).toFixed(2)
    }
  }
}

export default CompilerCache