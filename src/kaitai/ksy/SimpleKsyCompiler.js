/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: SimpleKsyCompiler.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import * as yaml from 'yaml'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('SimpleKsyCompiler')

/**
 * Simplified KSY to JS compiler that creates basic parsers
 */
class SimpleKsyCompiler {
  constructor() {
    this.currentOffset = 0
  }

  /**
   * Compile KSY YAML to a parser function
   * @param {string} ksyContent - KSY YAML content
   * @returns {Function|null} Parser function or null
   */
  async compile(ksyContent) {
    try {
      logger.debug('compile called, content length:', ksyContent?.length)
      
      // Parse YAML
      const ksy = yaml.parse(ksyContent)
      logger.debug('Parsed KSY:', ksy?.meta?.id, 'has seq:', !!ksy?.seq)
      
      if (!ksy || !ksy.meta) {
        throw new Error('Invalid KSY: missing meta section')
      }

      // Create a parser function
      const parser = this.createParserFunction(ksy)
      logger.debug('Created parser, type:', typeof parser)
      
      // Return just the parser for compatibility with FormatRegistry
      return parser
    } catch (error) {
      logger.error('KSY compilation error:', error)
      // Return null on error
      return null
    }
  }

  /**
   * Create a parser function from KSY
   * @param {Object} ksy - Parsed KSY object
   * @returns {Function} Parser function
   */
  createParserFunction(ksy) {
    logger.debug('createParserFunction called for:', ksy.meta?.id)
    const endian = ksy.meta?.endian === 'be' ? 'BE' : 'LE'
    
    // Return a parser class
    const ParserClass = class KsyParser {
      constructor(buffer) {
        this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
        this.offset = 0
        this.endian = endian
        this._parsed = {}
        
        // Parse the structure
        this._parse(ksy)
      }

      _parse(ksy) {
        // Store the KSY definition for type lookups
        this._ksy = ksy
        
        if (ksy.seq) {
          for (const field of ksy.seq) {
            try {
              // Safety check - don't read past buffer
              if (this.offset >= this.buffer.length) {
                logger.debug(`Stopping at field ${field.id} - reached EOF`)
                break
              }
              
              this._parseField(field)
            } catch (error) {
              logger.warn(`Failed to parse field ${field.id}:`, error.message)
              // For critical errors, stop parsing
              if (error.message.includes('Not enough bytes') || 
                  error.message.includes('EOF') ||
                  this.offset >= this.buffer.length) {
                logger.debug('Stopping parse due to error or EOF')
                break
              }
            }
          }
        }
      }

      _parseField(field) {
        if (!field.id) return
        
        const fieldName = field.id
        logger.debug(`Parsing field ${fieldName}: offset before = ${this.offset}`)

        // Capture start offset for all field types
        const startOffset = this.offset
        logger.debug(`Field ${fieldName}: startOffset captured = ${startOffset}`)

        // Handle repeat fields
        if (field.repeat) {
          this._parseRepeatField(field)
          return
        }

        // Handle magic/contents validation
        if (field.contents) {
          const contents = this._normalizeContents(field.contents)
          const bytes = this._readBytes(contents.length)
          
          // Validate magic but don't throw - just log warning
          let isValid = true
          for (let i = 0; i < contents.length; i++) {
            if (bytes[i] !== contents[i]) {
              logger.warn(`Magic mismatch at field ${fieldName}: expected ${contents[i]} but got ${bytes[i]} at position ${i}`)
              isValid = false
              // Don't throw - continue parsing to show structure
            }
          }
          
          // Store the field regardless of validation
          this[fieldName] = bytes
          this._parsed[fieldName] = { value: bytes, offset: startOffset, size: contents.length, valid: isValid }
          logger.debug(`Field ${fieldName}: stored offset=${startOffset}, size=${contents.length}, valid=${isValid}, offset after = ${this.offset}`)
          return
        }

        // Handle typed fields
        if (field.type) {
          // Check if it's a custom type
          if (this._ksy?.types?.[field.type]) {
            const value = this._parseCustomType(field.type)
            this[fieldName] = value
            this._parsed[fieldName] = { value, offset: startOffset, size: this.offset - startOffset }
          } else {
            // Primitive type
            const value = this._readType(field.type, field)
            this[fieldName] = value
            this._parsed[fieldName] = { value, offset: startOffset, size: this._getTypeSize(field.type) }
          }
          return
        }

        // Handle sized fields
        if (field.size) {
          let size = field.size
          
          // Handle size expressions
          if (typeof size === 'string') {
            // Check if it's a reference to another field
            if (this[size] !== undefined) {
              size = this[size]
            } else {
              logger.warn(`Size field '${size}' not found for ${fieldName}`)
              size = 0
            }
          }
          
          const bytes = this._readBytes(size)
          this[fieldName] = bytes
          this._parsed[fieldName] = { value: bytes, offset: startOffset, size }
        }
      }

      _parseRepeatField(field) {
        const fieldName = field.id
        const items = []
        const startOffset = this.offset
        
        if (field.repeat === 'until') {
          // Simple implementation - just read a few items or until EOF
          let maxItems = 20 // Lower safety limit for better performance
          while (this.offset < this.buffer.length - 8 && maxItems-- > 0) {
            try {
              // Need at least 8 bytes for a chunk (len + type)
              if (this.buffer.length - this.offset < 8) {
                logger.debug('Not enough bytes for another chunk')
                break
              }
              
              const item = this._parseSingleField(field)
              if (!item) break
              
              items.push(item)
              
              // Check for IEND chunk type (PNG specific)
              if (field.type === 'chunk' && item && item.type === 'IEND') {
                logger.debug('Found IEND chunk, stopping')
                break
              }
            } catch (error) {
              logger.warn('Error in repeat field:', error.message)
              break
            }
          }
        } else if (field.repeat === 'expr') {
          // Handle repeat-expr (fixed count)
          const count = field['repeat-expr'] || 0
          for (let i = 0; i < count && this.offset < this.buffer.length; i++) {
            try {
              items.push(this._parseSingleField(field))
            } catch (error) {
              logger.warn('Error in repeat field:', error)
              break
            }
          }
        }
        
        this[fieldName] = items
        this._parsed[fieldName] = { value: items, offset: startOffset, size: this.offset - startOffset }
      }
      
      _parseSingleField(field) {
        // Parse a single instance of a field (for repeat fields)
        if (field.type && this._ksy?.types?.[field.type]) {
          // Custom type defined in types section
          return this._parseCustomType(field.type)
        } else if (field.type) {
          // Primitive type
          return this._readType(field.type, field)
        } else if (field.size) {
          return this._readBytes(field.size)
        }
        return null
      }
      
      _parseCustomType(typeName) {
        const typeDef = this._ksy?.types?.[typeName]
        if (!typeDef) {
          logger.warn(`Type ${typeName} not found`)
          return null
        }
        
        const result = {}
        const startOffset = this.offset
        
        if (typeDef.seq) {
          for (const field of typeDef.seq) {
            try {
              const fieldName = field.id
              if (!fieldName) continue
              
              if (field.type && typeof field.type === 'object' && field.type['switch-on']) {
                // Handle switch types - just read as bytes for now
                if (field.size) {
                  let size = field.size
                  if (typeof size === 'string' && result[size] !== undefined) {
                    size = result[size]
                  }
                  result[fieldName] = this._readBytes(size)
                }
              } else if (field.type && typeof field.type === 'string') {
                // Check if it's another custom type
                if (this._ksy?.types?.[field.type]) {
                  result[fieldName] = this._parseCustomType(field.type)
                } else {
                  // For string types, we need to handle the size parameter
                  if (field.type === 'str' && field.size) {
                    let size = field.size
                    if (typeof size === 'string' && result[size] !== undefined) {
                      size = result[size]
                    }
                    result[fieldName] = this._readString(size, field.encoding || 'UTF-8')
                  } else {
                    result[fieldName] = this._readType(field.type, field)
                  }
                }
              } else if (field.size) {
                // Handle size references to fields in the current type
                let size = field.size
                if (typeof size === 'string') {
                  // Check if it's a reference to a field in the current result
                  if (result[size] !== undefined) {
                    size = result[size]
                  } else {
                    logger.warn(`Size field '${size}' not found in type ${typeName}`)
                    size = 0
                  }
                }
                result[fieldName] = this._readBytes(size)
              }
            } catch (error) {
              logger.warn(`Error parsing field ${field.id} in type ${typeName}:`, error)
              // For PNG chunks, if we can't read more, we're probably at EOF
              if (typeName === 'chunk' && this.offset >= this.buffer.length - 8) {
                logger.debug('Reached end of PNG file')
                break
              }
            }
          }
        }
        
        return result
      }

      _normalizeContents(contents) {
        if (typeof contents === 'string') {
          return Array.from(contents).map(c => c.charCodeAt(0))
        }
        if (Array.isArray(contents)) {
          const result = []
          for (const c of contents) {
            if (typeof c === 'string') {
              // Expand string to individual bytes
              for (const char of c) {
                result.push(char.charCodeAt(0))
              }
            } else {
              result.push(c)
            }
          }
          return result
        }
        return []
      }

      _readType(type, field) {
        // Handle primitive types
        switch (type) {
          case 'u1':
            return this._readU1()
          case 'u2':
          case 'u2le':
            return this._readU2LE()
          case 'u2be':
            return this._readU2BE()
          case 'u4':
          case 'u4le':
            return this._readU4LE()
          case 'u4be':
            return this._readU4BE()
          case 's1':
            return this._readS1()
          case 's2':
          case 's2le':
            return this._readS2LE()
          case 's2be':
            return this._readS2BE()
          case 's4':
          case 's4le':
            return this._readS4LE()
          case 's4be':
            return this._readS4BE()
          case 'str':
            return this._readString(field.size, field.encoding)
          case 'strz':
            return this._readStringZ(field.encoding)
          default:
            // Unknown type, read as bytes
            if (field.size) {
              return this._readBytes(field.size)
            }
            return null
        }
      }

      _getTypeSize(type) {
        const sizes = {
          'u1': 1, 's1': 1,
          'u2': 2, 'u2le': 2, 'u2be': 2,
          's2': 2, 's2le': 2, 's2be': 2,
          'u4': 4, 'u4le': 4, 'u4be': 4,
          's4': 4, 's4le': 4, 's4be': 4,
          'u8': 8, 'u8le': 8, 'u8be': 8,
          's8': 8, 's8le': 8, 's8be': 8,
          'f4': 4, 'f4le': 4, 'f4be': 4,
          'f8': 8, 'f8le': 8, 'f8be': 8
        }
        return sizes[type] || 0
      }

      _readBytes(count) {
        // Handle size expressions that reference other fields
        if (typeof count === 'string') {
          // Try to evaluate as a field reference
          if (this[count] !== undefined) {
            count = this[count]
          } else {
            logger.warn(`Size reference '${count}' not found, defaulting to 0`)
            count = 0
          }
        }
        
        if (count < 0 || count > this.buffer.length - this.offset) {
          logger.warn(`Invalid byte count: ${count}, available: ${this.buffer.length - this.offset}`)
          count = Math.min(Math.max(0, count), this.buffer.length - this.offset)
        }
        
        const bytes = this.buffer.slice(this.offset, this.offset + count)
        this.offset += count
        return bytes
      }

      _readU1() {
        if (this.offset >= this.buffer.length) throw new Error('EOF')
        return this.buffer[this.offset++]
      }

      _readU2LE() {
        if (this.offset + 2 > this.buffer.length) throw new Error('EOF')
        const val = this.buffer[this.offset] | (this.buffer[this.offset + 1] << 8)
        this.offset += 2
        return val
      }

      _readU2BE() {
        if (this.offset + 2 > this.buffer.length) throw new Error('EOF')
        const val = (this.buffer[this.offset] << 8) | this.buffer[this.offset + 1]
        this.offset += 2
        return val
      }

      _readU4LE() {
        if (this.offset + 4 > this.buffer.length) throw new Error('EOF')
        const val = this.buffer[this.offset] |
                   (this.buffer[this.offset + 1] << 8) |
                   (this.buffer[this.offset + 2] << 16) |
                   (this.buffer[this.offset + 3] << 24)
        this.offset += 4
        return val >>> 0
      }

      _readU4BE() {
        if (this.offset + 4 > this.buffer.length) throw new Error('EOF')
        const val = (this.buffer[this.offset] << 24) |
                   (this.buffer[this.offset + 1] << 16) |
                   (this.buffer[this.offset + 2] << 8) |
                   this.buffer[this.offset + 3]
        this.offset += 4
        return val >>> 0
      }

      _readS1() {
        const val = this._readU1()
        return val > 127 ? val - 256 : val
      }

      _readS2LE() {
        const val = this._readU2LE()
        return val > 32767 ? val - 65536 : val
      }

      _readS2BE() {
        const val = this._readU2BE()
        return val > 32767 ? val - 65536 : val
      }

      _readS4LE() {
        const val = this._readU4LE()
        return val > 2147483647 ? val - 4294967296 : val
      }

      _readS4BE() {
        const val = this._readU4BE()
        return val > 2147483647 ? val - 4294967296 : val
      }

      _readString(size, encoding = 'UTF-8') {
        const bytes = this._readBytes(size)
        return new TextDecoder(encoding.toLowerCase()).decode(bytes)
      }

      _readStringZ(encoding = 'UTF-8') {
        let end = this.offset
        while (end < this.buffer.length && this.buffer[end] !== 0) {
          end++
        }
        const bytes = this.buffer.slice(this.offset, end)
        this.offset = end + 1 // Skip null terminator
        return new TextDecoder(encoding.toLowerCase()).decode(bytes)
      }

      // Compatibility method for parsing
      static parse(buffer) {
        try {
          logger.debug('KsyParser.parse called with buffer length:', buffer.length)
          const instance = new KsyParser(buffer)
          
          // Debug: log what's in _parsed
          logger.debug('KsyParser _parsed contents:', instance._parsed)
          
          const fields = Object.keys(instance._parsed).map(key => {
            const field = instance._parsed[key]
            logger.debug(`Field ${key}: offset=${field.offset}, size=${field.size}, value=`, field.value)
            return {
              name: key,
              value: field.value,
              offset: field.offset,
              size: field.size
            }
          })
          
          logger.debug('Final fields array:', fields)
          
          return {
            success: true,
            data: instance,
            fields: fields
          }
        } catch (error) {
          logger.error('KsyParser.parse ERROR:', error)
          return {
            success: false,
            error: error.message
          }
        }
      }
    }
    
    logger.debug('Returning ParserClass, type:', typeof ParserClass)
    return ParserClass
  }
}

// Export singleton
let instance = null

export function getSimpleKsyCompiler() {
  if (!instance) {
    logger.debug('CREATING NEW SimpleKsyCompiler INSTANCE')
    instance = new SimpleKsyCompiler()
  }
  return instance
}

export default SimpleKsyCompiler