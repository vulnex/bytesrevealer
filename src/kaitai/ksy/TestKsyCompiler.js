/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: TestKsyCompiler.js - Fixed PNG parser
 * Author: Simon Roses Femerling
 * Created: 2025-01-10
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import * as yaml from 'yaml'
import KaitaiStream from '../KaitaiStreamBrowser'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('TestKsyCompiler')

/**
 * Fixed KSY compiler for PNG parsing
 */
class TestKsyCompiler {
  constructor() {
    this.debug = false // Disable verbose logging in production
  }

  async compile(ksyContent) {
    try {
      const ksy = yaml.parse(ksyContent)
      if (!ksy) {
        throw new Error('Invalid KSY content')
      }
      return this.createParserClass(ksy)
    } catch (error) {
      // Re-throw without logging to reduce console noise
      throw error
    }
  }
  
  createParserClass(ksy) {
    const self = this
    const types = ksy.types || {}
    const enums = ksy.enums || {}
    const endian = ksy.meta?.endian || 'le'
    
    class TestKsyParser {
      constructor(buffer) {
        // Use the proper KaitaiStream implementation
        this._io = new KaitaiStream(buffer instanceof ArrayBuffer ? buffer : buffer.buffer)
        this._parent = null
        this._root = this
        this._debug = self.debug
        this._types = types
        this._enums = enums
        this._endian = endian
        
        if (this._debug) {
          logger.debug('Starting parse with endian:', endian)
          logger.debug('Buffer size:', this._io.size)
        }
        
        this._parseRoot(ksy)
      }
      
      _parseRoot(ksy) {
        const seq = ksy.seq || []
        
        for (const field of seq) {
          try {
            if (this._debug) {
              logger.debug(`Parsing root field: ${field.id} at pos 0x${this._io.pos.toString(16)}`)
            }
            this._parseField(field, this, ksy)
          } catch (error) {
            if (this._debug) {
              logger.error(`Failed to parse field ${field.id}:`, error.message)
            }
            // Store null but continue
            this[field.id] = null
          }
        }
      }
      
      _parseField(field, parent, parentDef) {
        if (!field.id) return
        
        try {
          // Handle contents validation
          if (field.contents !== undefined) {
            this._validateContents(field.contents)
            parent[field.id] = field.contents // Store the expected value
            return
          }
          
          let value = null
          
          if (field.repeat) {
            value = this._parseRepeatField(field, parent, parentDef)
          } else {
            value = this._parseFieldValue(field, parent, parentDef)
          }
          
          // Validate if needed
          if (field.valid !== undefined && value !== null) {
            this._validateField(field.valid, value, field.id)
          }
          
          parent[field.id] = value
          
          if (this._debug && field.id !== 'body') { // Don't log large body data
            const displayValue = value instanceof Uint8Array ? 
              `[${value.length} bytes]` : 
              (typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value)
            logger.debug(`Stored field ${field.id}:`, displayValue)
          }
        } catch (error) {
          if (this._debug) {
            logger.error(`Error parsing field ${field.id}:`, error)
          }
          parent[field.id] = null
        }
      }
      
      _validateContents(contents) {
        const io = this._io
        
        if (Array.isArray(contents)) {
          // Validate magic bytes
          for (const expected of contents) {
            const actual = io.readU1()
            if (actual !== expected && this._debug) {
              logger.warn(`Contents mismatch: expected ${expected}, got ${actual}`)
            }
          }
        } else if (typeof contents === 'string') {
          // Validate string contents
          const bytes = io.readBytes(contents.length)
          const str = new TextDecoder('utf-8').decode(bytes)
          if (str !== contents && this._debug) {
            logger.warn(`Contents mismatch: expected "${contents}", got "${str}"`)
          }
        }
      }
      
      _validateField(valid, value, fieldName) {
        try {
          if (typeof valid === 'number') {
            if (value !== valid && this._debug) {
              logger.warn(`Validation warning for ${fieldName}: expected ${valid}, got ${value}`)
            }
          } else if (typeof valid === 'object') {
            if (valid.min !== undefined && value < valid.min && this._debug) {
              logger.warn(`Validation warning for ${fieldName}: value ${value} < min ${valid.min}`)
            }
            if (valid.max !== undefined && value > valid.max && this._debug) {
              logger.warn(`Validation warning for ${fieldName}: value ${value} > max ${valid.max}`)
            }
          }
        } catch (error) {
          if (this._debug) {
            logger.warn('Validation error:', error)
          }
        }
      }
      
      _parseFieldValue(field, parent, parentDef) {
        const io = this._io
        
        // Handle switch-on types
        if (field.type && typeof field.type === 'object' && field.type['switch-on']) {
          return this._parseSwitchType(field, parent, parentDef)
        }
        
        const type = field.type || 'u1'
        
        // Handle custom types
        if (typeof type === 'string' && this._types[type]) {
          return this._parseCustomType(type, parent)
        }
        
        // Handle size
        let size = field.size
        if (typeof size === 'string') {
          size = this._evaluateExpression(size, parent)
        }
        
        // Parse primitive types with proper endian support
        switch (type) {
          case 'u1': 
            return io.readU1()
          case 'u2': 
            return this._endian === 'be' ? io.readU2be() : io.readU2le()
          case 'u4': 
            return this._endian === 'be' ? io.readU4be() : io.readU4le()
          case 'u8':
            return this._endian === 'be' ? io.readU8be() : io.readU8le()
          case 's1': 
            return io.readS1()
          case 's2':
            return this._endian === 'be' ? io.readS2be() : io.readS2le()
          case 's4':
            return this._endian === 'be' ? io.readS4be() : io.readS4le()
          case 's8':
            return this._endian === 'be' ? io.readS8be() : io.readS8le()
          case 'str':
            if (size !== undefined && size !== null) {
              const encoding = field.encoding || 'UTF-8'
              return io.readStr(encoding === 'UTF-8' ? 'utf-8' : encoding, size)
            }
            return null
          case 'strz':
            const terminator = field.terminator || 0
            const encoding = field.encoding || 'ASCII'
            return io.readStrz(encoding, terminator, false, true)
          default:
            // Handle raw bytes
            if (size !== undefined && size !== null && size > 0) {
              return io.readBytes(size)
            }
            return null
        }
      }
      
      _parseSwitchType(field, parent, parentDef) {
        const switchOn = field.type['switch-on']
        const cases = field.type.cases || {}
        
        // Evaluate switch expression
        const switchValue = this._evaluateExpression(switchOn, parent)
        
        if (this._debug) {
          logger.debug(`Switch-on "${switchOn}" evaluated to: "${switchValue}"`)
        }
        
        // Find matching case - try exact match first
        let caseType = cases[`"${switchValue}"`] || cases[switchValue]
        
        if (!caseType) {
          // No matching case, read raw bytes if size is specified
          const size = this._evaluateExpression(field.size || 'len', parent)
          if (size !== undefined && size !== null && size >= 0) {
            if (this._debug) {
              logger.debug(`No case matched for "${switchValue}", reading ${size} bytes as raw`)
            }
            return this._io.readBytes(size)
          }
          return null
        }
        
        if (this._debug) {
          logger.debug(`Matched case: "${switchValue}" -> ${caseType}`)
        }
        
        // Parse with the matched type
        if (typeof caseType === 'string' && this._types[caseType]) {
          return this._parseCustomType(caseType, parent)
        }
        
        // If no custom type, read as raw bytes
        const size = this._evaluateExpression(field.size || 'len', parent)
        if (size !== undefined && size !== null && size >= 0) {
          return this._io.readBytes(size)
        }
        
        return null
      }
      
      _parseRepeatField(field, parent, parentDef) {
        const io = this._io
        const items = []
        
        if (field.repeat === 'until') {
          const expr = field['repeat-until']
          
          if (this._debug) {
            logger.debug(`Starting repeat-until with expression: ${expr}`)
          }
          
          let count = 0
          const maxIterations = 1000 // Safety limit
          
          while (!io.isEof && count < maxIterations) {
            try {
              const startPos = io.pos
              
              if (this._debug && count < 10) { // Only log first 10
                logger.debug(`Parsing item ${count + 1} at position 0x${startPos.toString(16)}`)
              }
              
              // Parse the item
              let item = null
              if (field.type) {
                // Parse as custom type
                if (typeof field.type === 'string' && this._types[field.type]) {
                  item = this._parseCustomType(field.type, parent)
                } else {
                  item = this._parseFieldValue(field, parent, parentDef)
                }
              }
              
              if (item === null) {
                if (this._debug) {
                  logger.warn('Got null item in repeat-until, breaking')
                }
                break
              }
              
              items.push(item)
              count++
              
              // Check the repeat-until condition
              if (this._evaluateRepeatUntil(expr, item, io)) {
                if (this._debug) {
                  logger.debug('Repeat-until condition met, stopping')
                }
                break
              }
              
              // Safety check
              if (io.pos <= startPos) {
                if (this._debug) {
                  logger.error('Parser not advancing, breaking')
                }
                break
              }
            } catch (error) {
              if (this._debug) {
                logger.error(`Error in repeat-until at item ${count + 1}:`, error.message)
              }
              if (io.isEof) break
              
              // Try to recover
              try {
                io.seek(io.pos + 1)
              } catch (e) {
                break
              }
            }
          }
          
          if (this._debug) {
            logger.debug(`Finished repeat-until, parsed ${items.length} items`)
          }
        } else if (field.repeat === 'eos') {
          while (!io.isEof) {
            try {
              const item = this._parseFieldValue(field, parent, parentDef)
              if (item !== null) {
                items.push(item)
              }
            } catch (error) {
              if (this._debug) {
                logger.error('Error in repeat-eos:', error)
              }
              break
            }
          }
        } else if (field['repeat-expr']) {
          const count = this._evaluateExpression(field['repeat-expr'], parent)
          for (let i = 0; i < count; i++) {
            try {
              const item = this._parseFieldValue(field, parent, parentDef)
              if (item !== null) {
                items.push(item)
              }
            } catch (error) {
              if (this._debug) {
                logger.error(`Error in repeat-expr at item ${i}:`, error)
              }
              break
            }
          }
        }
        
        return items
      }
      
      _evaluateRepeatUntil(expr, item, io) {
        // Handle PNG-specific repeat-until: _.type == "IEND" or _io.eof
        if (expr.includes('type == "IEND"')) {
          if (item && item.type === 'IEND') {
            return true
          }
        }
        
        if (expr.includes('_io.eof')) {
          if (io.isEof) {
            return true
          }
        }
        
        // Check both conditions for PNG
        return (item && item.type === 'IEND') || io.isEof
      }
      
      _parseCustomType(typeName, parent) {
        const typeDef = this._types[typeName]
        if (!typeDef) {
          if (this._debug) {
            logger.warn(`Type definition not found: ${typeName}`)
          }
          return null
        }
        
        if (this._debug) {
          logger.debug(`Parsing custom type: ${typeName} at pos 0x${this._io.pos.toString(16)}`)
        }
        
        const result = {
          _parent: parent,
          _root: this._root,
          _io: this._io
        }
        
        if (typeDef.seq) {
          for (const field of typeDef.seq) {
            try {
              this._parseField(field, result, typeDef)
            } catch (error) {
              if (this._debug) {
                logger.error(`Failed to parse field ${field.id} in type ${typeName}:`, error)
              }
              result[field.id] = null
            }
          }
        }
        
        // Process instances if any
        if (typeDef.instances) {
          for (const [instName, instDef] of Object.entries(typeDef.instances)) {
            // Instances are lazy-evaluated, so we'll add getters
            Object.defineProperty(result, instName, {
              get: () => {
                if (!result[`_m_${instName}`]) {
                  const savedPos = this._io.pos
                  if (instDef.pos !== undefined) {
                    this._io.seek(instDef.pos)
                  }
                  result[`_m_${instName}`] = this._parseFieldValue(instDef, result, typeDef)
                  this._io.seek(savedPos)
                }
                return result[`_m_${instName}`]
              }
            })
          }
        }
        
        return result
      }
      
      _evaluateExpression(expr, context) {
        if (typeof expr !== 'string') return expr
        
        // Direct field reference
        if (context && context[expr] !== undefined) {
          return context[expr]
        }
        
        // Parent field reference (e.g., _parent.len)
        if (expr.startsWith('_parent.') && context._parent) {
          const fieldName = expr.substring(8)
          return context._parent[fieldName]
        }
        
        // Root field reference (e.g., _root.ihdr)
        if (expr.startsWith('_root.') && context._root) {
          const fieldName = expr.substring(6)
          return context._root[fieldName]
        }
        
        // Special size-eos handling
        if (expr === 'size-eos' || expr.includes('eos')) {
          return this._io.size - this._io.pos
        }
        
        // Try to parse as number
        const num = parseInt(expr, 10)
        if (!isNaN(num)) {
          return num
        }
        
        // Silent fail for unknown expressions
        
        // Return the expression for field names like 'len'
        return expr
      }
    }
    
    // Add static parse method for compatibility
    TestKsyParser.parse = function(buffer) {
      try {
        const instance = new TestKsyParser(buffer)
        
        // Convert to field structure for UI
        const fields = []
        
        for (const [key, value] of Object.entries(instance)) {
          if (key.startsWith('_')) continue
          
          const field = {
            name: key,
            value: null,
            offset: 0,
            size: 0,
            fields: []
          }
          
          if (value === null || value === undefined) {
            field.value = 'null'
          } else if (Array.isArray(value)) {
            field.value = `[${value.length} items]`
            // Add array items as children (limit to prevent UI overload)
            const limit = Math.min(value.length, 20)
            for (let i = 0; i < limit; i++) {
              const item = value[i]
              if (item && typeof item === 'object') {
                const childField = {
                  name: `[${i}]`,
                  value: item.type || '{object}',
                  offset: 0,
                  size: 0,
                  fields: []
                }
                // Add object properties
                for (const [subKey, subValue] of Object.entries(item)) {
                  if (subKey.startsWith('_')) continue
                  const subField = {
                    name: subKey,
                    value: subValue instanceof Uint8Array ? 
                      `[${subValue.length} bytes]` : 
                      String(subValue),
                    offset: 0,
                    size: 0,
                    fields: []
                  }
                  childField.fields.push(subField)
                }
                field.fields.push(childField)
              } else {
                field.fields.push({
                  name: `[${i}]`,
                  value: String(item),
                  offset: 0,
                  size: 0,
                  fields: []
                })
              }
            }
            if (value.length > limit) {
              field.fields.push({
                name: '...',
                value: `${value.length - limit} more items`,
                offset: 0,
                size: 0,
                fields: []
              })
            }
          } else if (value instanceof Uint8Array) {
            field.value = `[${value.length} bytes]`
          } else if (typeof value === 'object') {
            field.value = '{object}'
            // Add object properties as children
            for (const [subKey, subValue] of Object.entries(value)) {
              if (subKey.startsWith('_')) continue
              field.fields.push({
                name: subKey,
                value: subValue instanceof Uint8Array ? 
                  `[${subValue.length} bytes]` : 
                  String(subValue),
                offset: 0,
                size: 0,
                fields: []
              })
            }
          } else {
            field.value = String(value)
          }
          
          fields.push(field)
        }
        
        return {
          success: true,
          data: instance,
          fields: fields
        }
      } catch (error) {
        if (self.debug) {
          logger.error('Parse error:', error)
        }
        return {
          success: false,
          error: error.message,
          fields: []
        }
      }
    }
    
    return TestKsyParser
  }
}

// Export singleton
let instance = null

export function getTestKsyCompiler() {
  if (!instance) {
    instance = new TestKsyCompiler()
  }
  return instance
}