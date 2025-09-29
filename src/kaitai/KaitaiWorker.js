/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KaitaiWorker.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import KaitaiStream from './KaitaiStreamBrowser.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('KaitaiWorker')

// LRU Cache implementation for parsed structures
class LRUCache {
  constructor(maxSize = 50) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) return null
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  clear() {
    this.cache.clear()
  }
}

// Main parser class
class KaitaiParser {
  constructor() {
    this.parsers = new Map()
    this.cache = new LRUCache(50)
    this.currentFormat = null
  }

  async loadParser(formatName) {
    if (this.parsers.has(formatName)) {
      return this.parsers.get(formatName)
    }

    try {
      // Dynamically import the parser
      const module = await import(`./formats/common/${formatName}.js`)
      const Parser = module.default || module[formatName]
      this.parsers.set(formatName, Parser)
      return Parser
    } catch (error) {
      logger.error(`Failed to load parser for ${formatName}:`, error)
      return null
    }
  }

  parseChunk(data, format, offset, length) {
    const cacheKey = `${format}_${offset}_${length}`
    
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return { success: true, data: cached, fromCache: true }
    }

    try {
      const Parser = this.parsers.get(format)
      if (!Parser) {
        throw new Error(`Parser not loaded for format: ${format}`)
      }

      // Create a stream for the specific chunk
      const chunkData = data.slice(offset, offset + length)
      const stream = new KaitaiStream(chunkData)
      
      // Parse the chunk
      const parsed = new Parser(stream)
      
      // Convert to serializable format
      const result = this.serializeStructure(parsed, offset)
      
      // Cache the result
      this.cache.set(cacheKey, result)
      
      return { success: true, data: result, fromCache: false }
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        offset,
        length 
      }
    }
  }

  serializeStructure(struct, baseOffset = 0) {
    const result = {
      fields: [],
      offset: baseOffset,
      size: 0
    }

    // Extract field information
    for (const [key, value] of Object.entries(struct)) {
      if (key.startsWith('_')) continue // Skip internal fields
      
      const field = {
        name: key,
        value: this.serializeValue(value),
        offset: baseOffset,
        size: 0
      }

      // Try to get position information if available
      if (struct._io && struct._io.pos !== undefined) {
        field.offset = baseOffset + struct._io.pos
      }

      result.fields.push(field)
    }

    return result
  }

  serializeValue(value) {
    if (value === null || value === undefined) {
      return null
    }
    
    if (typeof value === 'object') {
      if (value instanceof Uint8Array) {
        return Array.from(value.slice(0, 100)) // Limit array size
      }
      if (Array.isArray(value)) {
        return value.slice(0, 100).map(v => this.serializeValue(v))
      }
      // Nested structure
      return this.serializeStructure(value)
    }
    
    return value
  }

  clearCache() {
    this.cache.clear()
  }
}

// Worker message handler
const parser = new KaitaiParser()

self.addEventListener('message', async (event) => {
  const { type, payload, id } = event.data

  switch (type) {
    case 'LOAD_PARSER':
      try {
        const Parser = await parser.loadParser(payload.format)
        self.postMessage({
          id,
          type: 'PARSER_LOADED',
          success: !!Parser,
          format: payload.format
        })
      } catch (error) {
        self.postMessage({
          id,
          type: 'PARSER_LOADED',
          success: false,
          error: error.message
        })
      }
      break

    case 'PARSE_CHUNK':
      const { data, format, offset, length } = payload
      const result = parser.parseChunk(
        new Uint8Array(data),
        format,
        offset,
        length
      )
      
      self.postMessage({
        id,
        type: 'CHUNK_PARSED',
        ...result
      })
      break

    case 'PARSE_FULL':
      try {
        const { data, format } = payload
        const Parser = parser.parsers.get(format)
        
        if (!Parser) {
          throw new Error(`Parser not loaded for format: ${format}`)
        }

        const stream = new KaitaiStream(new Uint8Array(data))
        const parsed = new Parser(stream)
        const serialized = parser.serializeStructure(parsed)

        self.postMessage({
          id,
          type: 'FULL_PARSED',
          success: true,
          data: serialized
        })
      } catch (error) {
        self.postMessage({
          id,
          type: 'FULL_PARSED',
          success: false,
          error: error.message
        })
      }
      break

    case 'CLEAR_CACHE':
      parser.clearCache()
      self.postMessage({
        id,
        type: 'CACHE_CLEARED'
      })
      break

    default:
      self.postMessage({
        id,
        type: 'ERROR',
        error: `Unknown message type: ${type}`
      })
  }
})

// Notify that worker is ready
self.postMessage({ type: 'WORKER_READY' })