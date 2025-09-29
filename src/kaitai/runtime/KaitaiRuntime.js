/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KaitaiRuntime.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { getFormatRegistry } from './FormatRegistry'
import { getSafeStructureParser } from '../SafeStructureParser'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('KaitaiRuntime')

/**
 * Runtime for executing KSY-based parsers
 * Bridges between KSY parsers and BytesRevealer's structure view
 */
class KaitaiRuntime {
  constructor() {
    this.formatRegistry = getFormatRegistry()
    this.fallbackParser = getSafeStructureParser()
    this.cache = new Map()
  }

  /**
   * Parse file using appropriate parser
   * @param {Uint8Array} data - File data
   * @param {string} formatId - Optional format ID
   * @param {string} fileName - Optional file name
   * @returns {Object} Parsed structure
   */
  async parse(data, formatId = null, fileName = null) {
    try {
      // Get format from registry or detect
      let format = null
      if (formatId) {
        logger.debug(`Looking for format with ID: ${formatId}`)
        format = await this.formatRegistry.getCompiledFormat(formatId)
        if (!format) {
          logger.debug(`Format not found with ID ${formatId}, checking registry...`)
          // Try to get it directly from the registry
          format = this.formatRegistry.getFormat(formatId)
        }
        logger.debug(`Found format:`, format ? format.name : 'none')
      } else {
        format = await this.formatRegistry.detectFormat(data, fileName)
      }

      // If we have a KSY-based parser, use it
      if (format && format.parser) {
        logger.debug(`Using KSY parser for format: ${format.name}`)
        return await this.parseWithKsy(data, format)
      }

      logger.debug(`Falling back to SafeStructureParser for format: ${formatId}`)
      // Fall back to SafeStructureParser
      return await this.parseWithFallback(data, formatId)
    } catch (error) {
      logger.error('Parse error:', error)
      // Always return something to avoid breaking the UI
      return this.createErrorResult(error)
    }
  }

  /**
   * Parse with KSY-based parser
   * @param {Uint8Array} data - File data
   * @param {Object} format - Format with parser
   * @returns {Object} Parsed structure
   */
  async parseWithKsy(data, format) {
    try {
      // Check if parser exists and is valid
      if (!format.parser) {
        logger.warn(`No parser for format ${format.name}`)
        return await this.parseWithFallback(data)
      }
      
      // SimpleKsyCompiler parsers expect Uint8Array directly, not KaitaiStream
      const ParserClass = format.parser
      
      // Check if parser exists
      if (!ParserClass) {
        logger.warn(`Parser is undefined for format ${format.name}`)
        return await this.parseWithFallback(data)
      }
      
      // Check if it's a class or already has a parse method
      if (typeof ParserClass.parse === 'function') {
        logger.debug(`Using parser's parse method for ${format.name}`)
        // Use the static parse method
        const result = ParserClass.parse(data)
        logger.debug(`Parse result:`, result)
        
        if (result && result.success && result.fields && result.fields.length > 0) {
          logger.debug(`Parse successful with ${result.fields.length} fields`)
          return {
            fields: result.fields,
            offset: 0,
            size: data.length
          }
        } else if (result && result.success) {
          logger.debug(`Parse succeeded but no fields returned`)
          // Parse succeeded but no fields - still valid
          return {
            fields: [],
            offset: 0,
            size: data.length
          }
        } else {
          throw new Error(result.error || 'Parse failed')
        }
      } else {
        // Try instantiating the class
        const parsed = new ParserClass(data)
        return this.convertToStructure(parsed, format)
      }
    } catch (error) {
      logger.error(`KSY parse error for ${format.name}:`, error)
      // Fall back to safe parser
      return await this.parseWithFallback(data)
    }
  }

  /**
   * Parse with fallback SafeStructureParser
   * @param {Uint8Array} data - File data
   * @param {string} formatId - Optional format ID
   * @returns {Object} Parsed structure
   */
  async parseWithFallback(data, formatId = null) {
    await this.fallbackParser.initialize()
    
    // If formatId provided, try to load that format
    if (formatId) {
      logger.debug(`Fallback parser trying format: ${formatId}`)
      await this.fallbackParser.loadFormat(formatId)
    } else {
      // Detect format
      const format = this.fallbackParser.detectFormat(data)
      if (format) {
        await this.fallbackParser.loadFormat(format)
      }
    }
    
    // Parse file
    const result = await this.fallbackParser.parseFile(data)
    logger.debug(`Fallback parser result:`, result)
    return result
  }

  /**
   * Convert KSY parsed object to BytesRevealer structure format
   * @param {Object} parsed - Parsed KSY object
   * @param {Object} format - Format metadata
   * @returns {Object} Structure for display
   */
  convertToStructure(parsed, format) {
    const fields = []
    let offset = 0
    
    // Process each field in the parsed object
    for (const [key, value] of Object.entries(parsed)) {
      // Skip internal properties
      if (key.startsWith('_')) continue
      
      const field = this.convertField(key, value, offset)
      if (field) {
        fields.push(field)
        offset += field.size || 0
      }
    }
    
    return {
      fields,
      offset: 0,
      size: offset
    }
  }

  /**
   * Convert a single field to structure format
   * @param {string} name - Field name
   * @param {*} value - Field value
   * @param {number} offset - Field offset
   * @returns {Object} Field structure
   */
  convertField(name, value, offset) {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return {
        name: this.formatFieldName(name),
        value: null,
        offset,
        size: 0,
        fields: []
      }
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return {
        name: this.formatFieldName(name),
        value: `[${value.length} items]`,
        offset,
        size: this.calculateArraySize(value),
        fields: value.map((item, index) => 
          this.convertField(`[${index}]`, item, offset + index * this.getItemSize(item))
        ).filter(Boolean)
      }
    }
    
    // Handle objects (nested structures)
    if (typeof value === 'object') {
      const subFields = []
      let subOffset = offset
      
      for (const [subKey, subValue] of Object.entries(value)) {
        if (subKey.startsWith('_')) continue
        
        const subField = this.convertField(subKey, subValue, subOffset)
        if (subField) {
          subFields.push(subField)
          subOffset += subField.size || 0
        }
      }
      
      return {
        name: this.formatFieldName(name),
        value: null,
        offset,
        size: subOffset - offset,
        fields: subFields
      }
    }
    
    // Handle primitive values
    return {
      name: this.formatFieldName(name),
      value: this.formatValue(value),
      offset,
      size: this.getValueSize(value),
      fields: []
    }
  }

  /**
   * Format field name for display
   * @param {string} name - Raw field name
   * @returns {string} Formatted name
   */
  formatFieldName(name) {
    // Convert snake_case to Title Case
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  /**
   * Format value for display
   * @param {*} value - Raw value
   * @returns {string} Formatted value
   */
  formatValue(value) {
    if (typeof value === 'number') {
      // Show both decimal and hex for numbers
      if (Number.isInteger(value)) {
        return `${value} (0x${value.toString(16).toUpperCase()})`
      }
      return value.toString()
    }
    
    if (typeof value === 'string') {
      // Truncate long strings
      if (value.length > 50) {
        return `"${value.substring(0, 50)}..."`
      }
      return `"${value}"`
    }
    
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }
    
    return String(value)
  }

  /**
   * Calculate size of a value
   * @param {*} value - Value
   * @returns {number} Size in bytes
   */
  getValueSize(value) {
    if (typeof value === 'number') {
      // Assume 4 bytes for numbers (could be improved)
      return 4
    }
    
    if (typeof value === 'string') {
      // UTF-8 encoded size
      return new TextEncoder().encode(value).length
    }
    
    if (typeof value === 'boolean') {
      return 1
    }
    
    return 0
  }

  /**
   * Get size of array item
   * @param {*} item - Array item
   * @returns {number} Size in bytes
   */
  getItemSize(item) {
    if (typeof item === 'object' && item !== null) {
      // Complex object, estimate size
      return 16 // Default estimate
    }
    return this.getValueSize(item)
  }

  /**
   * Calculate total array size
   * @param {Array} array - Array
   * @returns {number} Total size
   */
  calculateArraySize(array) {
    return array.reduce((sum, item) => sum + this.getItemSize(item), 0)
  }

  /**
   * Create error result structure
   * @param {Error} error - Error object
   * @returns {Object} Error structure
   */
  createErrorResult(error) {
    return {
      fields: [
        {
          name: 'Parse Error',
          value: error.message,
          offset: 0,
          size: 0,
          fields: []
        }
      ],
      offset: 0,
      size: 0
    }
  }

  /**
   * Parse viewport (for lazy loading)
   * @param {Uint8Array} data - File data
   * @param {number} startOffset - Start offset
   * @param {number} endOffset - End offset
   * @param {string} formatId - Format ID
   * @returns {Array} Structures in viewport
   */
  async parseViewport(data, startOffset, endOffset, formatId = null) {
    // Optimize for large files - only parse the viewport window
    const MAX_PARSE_SIZE = 2 * 1024 * 1024 // 2MB max for parsing
    const windowSize = endOffset - startOffset
    
    if (windowSize > MAX_PARSE_SIZE) {
      logger.debug(`Viewport too large (${windowSize} bytes), limiting to ${MAX_PARSE_SIZE} bytes`)
      endOffset = startOffset + MAX_PARSE_SIZE
    }
    
    // For large files, create a slice of data for parsing
    // This prevents parsing the entire file for viewport display
    let parseData = data
    let adjustedOffset = 0
    
    if (data.length > 10 * 1024 * 1024) { // For files > 10MB
      // Create a window around the viewport with some context
      const contextSize = 1024 * 1024 // 1MB context before/after
      const sliceStart = Math.max(0, startOffset - contextSize)
      const sliceEnd = Math.min(data.length, endOffset + contextSize)
      
      parseData = data.slice(sliceStart, sliceEnd)
      adjustedOffset = sliceStart
      
      logger.debug(`Large file optimization: parsing slice [${sliceStart}:${sliceEnd}] of ${data.length} bytes`)
    }
    
    // Parse the data (or slice)
    const result = await this.parse(parseData, formatId)
    
    if (result && result.fields) {
      // Adjust offsets if we used a slice
      if (adjustedOffset > 0) {
        result.fields.forEach(field => {
          if (field.offset !== undefined) {
            field.offset += adjustedOffset
          }
        })
      }
      
      // Filter fields within viewport
      const viewportFields = result.fields.filter(field => {
        const fieldSize = field.size || 1
        const fieldEnd = field.offset + fieldSize
        return field.offset < endOffset && fieldEnd > startOffset
      })
      
      logger.debug(`Viewport fields: ${viewportFields.length} of ${result.fields.length} total`)
      return viewportFields
    }
    return []
  }

  /**
   * Load preset formats
   */
  async loadPresets() {
    const presetFiles = [
      { path: 'executable/dos_mz.ksy', category: 'system' },
      { path: 'archive/zip.ksy', category: 'system' },
      { path: 'media/png.ksy', category: 'system' }
    ]
    
    for (const preset of presetFiles) {
      try {
        // In a real implementation, these would be loaded from files
        // For now, we'll create them programmatically
        const content = await this.loadPresetContent(preset.path)
        if (content) {
          const formatName = preset.path.split('/').pop().replace('.ksy', '')
          await this.formatRegistry.manager.add({
            name: formatName,
            content,
            category: preset.category,
            metadata: {
              isPreset: true,
              path: preset.path
            }
          })
        }
      } catch (error) {
        logger.warn(`Failed to load preset ${preset.path}:`, error)
      }
    }
  }

  /**
   * Load preset content (placeholder)
   * @param {string} path - Preset path
   * @returns {string} KSY content
   */
  async loadPresetContent(path) {
    // In a real implementation, this would load from the file system
    // For now, return null to use fallback parser
    return null
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Destroy runtime
   */
  async destroy() {
    this.clearCache()
    if (this.formatRegistry) {
      await this.formatRegistry.destroy()
    }
    if (this.fallbackParser) {
      this.fallbackParser.destroy()
    }
  }
}

// Export singleton
let instance = null

export function getKaitaiRuntime() {
  if (!instance) {
    instance = new KaitaiRuntime()
  }
  return instance
}

export default KaitaiRuntime