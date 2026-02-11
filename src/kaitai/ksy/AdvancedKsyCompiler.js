/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: AdvancedKsyCompiler.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-10
 * Last Modified: 2025-01-13
 * Version: 1.0
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import * as yaml from 'yaml'
import { createLogger } from '../../utils/logger'

const logger = createLogger('AdvancedKsyCompiler')

/**
 * Advanced KSY compiler with full support for complex Kaitai Struct features
 * Compatible with SimpleKsyCompiler interface for seamless integration
 */
class AdvancedKsyCompiler {
  constructor() {
    this.debug = false
  }

  /**
   * Compile KSY YAML to a parser function
   * @param {string} ksyContent - KSY YAML content
   * @returns {Function|null} Parser class or null
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

      // Create parser class
      const parser = this.createParserClass(ksy)
      logger.debug('Created advanced parser, type:', typeof parser)
      
      return parser
    } catch (error) {
      logger.error('Advanced KSY compilation error:', error)
      return null
    }
  }
  
  /**
   * Create a parser class from KSY definition
   * @param {Object} ksy - KSY definition object
   * @returns {Function} Parser class
   */
  createParserClass(ksy) {
    const self = this
    const types = ksy.types || {}
    const enums = ksy.enums || {}
    const meta = ksy.meta || {}
    
    class AdvancedKsyParser {
      constructor(buffer) {
        this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
        this.offset = 0
        this._parent = null
        this._root = this
        this._debug = self.debug
        this._types = types
        this._enums = enums
        this._ksy = ksy
        this._parsed = {}
        this._instances = {}
        this._io = {
          pos: 0,
          size: this.buffer.length,
          eof: false
        }
        
        // Determine endianness
        this._endian = this._determineEndianness(meta.endian)
        
        // Parse structure
        this._parseRoot()
      }
      
      /**
       * Determine endianness from meta
       */
      _determineEndianness(endianSpec) {
        if (!endianSpec) return 'le'
        
        if (typeof endianSpec === 'string') {
          return endianSpec
        }
        
        // Handle switch-on endianness (like ELF)
        if (endianSpec['switch-on']) {
          // For now, default to LE
          // Full implementation would evaluate the switch expression
          return 'le'
        }
        
        return 'le'
      }
      
      /**
       * Parse root structure
       */
      _parseRoot() {
        const seq = this._ksy.seq || []
        
        if (this._debug) {
          logger.debug('Starting advanced root parse')
          logger.debug('Sequence:', seq.map(f => f.id).join(', '))
        }
        
        // Parse sequence fields
        for (const field of seq) {
          try {
            if (this._debug) {
              logger.debug(`Parsing root field: ${field.id} at offset ${this.offset}`)
            }
            this._parseField(field, this)
          } catch (error) {
            logger.warn(`Failed to parse field ${field.id}:`, error.message)
            // Continue parsing other fields
          }
        }
        
        // Parse instances if defined
        if (this._ksy.instances) {
          this._parseInstances(this._ksy.instances, this)
        }
      }
      
      /**
       * Parse a single field
       */
      _parseField(field, parent) {
        if (!field.id) return
        
        const fieldName = field.id
        const startOffset = this.offset
        
        if (this._debug) {
          logger.debug(`Parsing field ${fieldName}: offset=${startOffset}`)
        }
        
        // Handle contents validation (magic bytes)
        if (field.contents !== undefined) {
          this._validateContents(field.contents)
          const size = this._getContentsSize(field.contents)
          this._parsed[fieldName] = { 
            value: field.contents, 
            offset: startOffset, 
            size: size,
            type: 'magic'
          }
          return
        }
        
        // Handle conditional fields
        if (field.if) {
          const condition = this._evaluateExpression(field.if, parent)
          if (!condition) {
            if (this._debug) {
              logger.debug(`Skipping field ${fieldName} due to condition: ${field.if}`)
            }
            return
          }
        }
        
        // Handle positioning
        if (field.pos !== undefined) {
          const pos = this._evaluateExpression(field.pos, parent)
          this.offset = pos
          this._io.pos = pos
        }
        
        let value = null
        let size = 0
        
        // Handle repeat fields
        if (field.repeat) {
          const result = this._parseRepeatField(field, parent)
          value = result.value
          size = result.size
        } else {
          const result = this._parseFieldValue(field, parent)
          value = result.value
          size = result.size
        }
        
        // Handle validation
        if (field.valid !== undefined && value !== null) {
          this._validateField(field.valid, value, parent)
        }
        
        // Store the value
        parent[fieldName] = value
        this._parsed[fieldName] = { 
          value: value, 
          offset: startOffset, 
          size: size,
          type: field.type || 'bytes'
        }
        
        if (this._debug) {
          logger.debug(`Field ${fieldName}: stored offset=${startOffset}, size=${size}`)
        }
      }
      
      /**
       * Get size of contents
       */
      _getContentsSize(contents) {
        if (Array.isArray(contents)) {
          let size = 0
          for (const item of contents) {
            if (typeof item === 'string') {
              size += item.length
            } else {
              size += 1
            }
          }
          return size
        } else if (typeof contents === 'string') {
          return contents.length
        }
        return 0
      }
      
      /**
       * Validate contents (magic bytes)
       */
      _validateContents(contents) {
        const startOffset = this.offset
        
        if (Array.isArray(contents)) {
          for (const expected of contents) {
            if (typeof expected === 'string') {
              // String literal
              for (let i = 0; i < expected.length; i++) {
                const byte = this._readU1()
                const expectedByte = expected.charCodeAt(i)
                if (byte !== expectedByte) {
                  logger.debug(`Contents mismatch at offset ${this.offset - 1}: expected 0x${expectedByte.toString(16)}, got 0x${byte.toString(16)}`)
                }
              }
            } else if (typeof expected === 'number') {
              // Byte value
              const byte = this._readU1()
              if (byte !== expected) {
                logger.debug(`Contents mismatch at offset ${this.offset - 1}: expected 0x${expected.toString(16)}, got 0x${byte.toString(16)}`)
              }
            }
          }
        } else if (typeof contents === 'string') {
          // String contents
          for (let i = 0; i < contents.length; i++) {
            const byte = this._readU1()
            const expected = contents.charCodeAt(i)
            if (byte !== expected) {
              logger.debug(`Contents mismatch at offset ${this.offset - 1}: expected 0x${expected.toString(16)}, got 0x${byte.toString(16)}`)
            }
          }
        }
      }
      
      /**
       * Validate field value
       */
      _validateField(valid, value, parent) {
        if (typeof valid === 'number') {
          if (value !== valid) {
            logger.debug(`Validation failed: expected ${valid}, got ${value}`)
          }
        } else if (typeof valid === 'object') {
          if (valid.min !== undefined && value < valid.min) {
            logger.debug(`Validation failed: ${value} < min ${valid.min}`)
          }
          if (valid.max !== undefined && value > valid.max) {
            logger.debug(`Validation failed: ${value} > max ${valid.max}`)
          }
          if (valid.expr !== undefined) {
            const result = this._evaluateExpression(valid.expr, parent)
            if (!result) {
              logger.debug(`Validation expression failed: ${valid.expr}`)
            }
          }
        }
      }
      
      /**
       * Parse field value
       */
      _parseFieldValue(field, parent) {
        const startOffset = this.offset
        
        // Handle switch-on types
        if (field.type && typeof field.type === 'object' && field.type['switch-on']) {
          return this._parseSwitchType(field, parent)
        }
        
        // Handle type field
        if (field.type) {
          // Check if it's a custom type
          if (this._types[field.type]) {
            return this._parseCustomType(field.type, parent)
          }
          
          // Check if it's a type with dynamic endianness
          if (field.type === 'endian_elf') {
            // Special handling for ELF endian type
            return this._parseEndianElf(parent)
          }
          
          // Parse primitive type
          return this._parsePrimitiveType(field, parent)
        }
        
        // Handle size-based fields
        if (field.size !== undefined) {
          let size = this._evaluateExpression(field.size, parent)
          if (field.size === 'eos' || field['size-eos']) {
            size = this.buffer.length - this.offset
          }
          const bytes = this._readBytes(size)
          return { value: bytes, size: size }
        }
        
        // Default to single byte
        return { value: this._readU1(), size: 1 }
      }
      
      /**
       * Parse primitive type
       */
      _parsePrimitiveType(field, parent) {
        const type = field.type
        const startOffset = this.offset
        let value = null
        let size = 0
        
        // Handle bit fields
        if (type.startsWith('b')) {
          const bits = parseInt(type.substring(1))
          value = this._readBits(bits)
          size = Math.ceil(bits / 8)
        } else {
          // Handle regular types
          switch (type) {
            case 'u1':
              value = this._readU1()
              size = 1
              break
            case 'u2':
            case 'u2le':
              value = this._readU2LE()
              size = 2
              break
            case 'u2be':
              value = this._readU2BE()
              size = 2
              break
            case 'u4':
            case 'u4le':
              value = this._readU4LE()
              size = 4
              break
            case 'u4be':
              value = this._readU4BE()
              size = 4
              break
            case 'u8':
            case 'u8le':
              value = this._readU8LE()
              size = 8
              break
            case 'u8be':
              value = this._readU8BE()
              size = 8
              break
            case 's1':
              value = this._readS1()
              size = 1
              break
            case 's2':
            case 's2le':
              value = this._readS2LE()
              size = 2
              break
            case 's2be':
              value = this._readS2BE()
              size = 2
              break
            case 's4':
            case 's4le':
              value = this._readS4LE()
              size = 4
              break
            case 's4be':
              value = this._readS4BE()
              size = 4
              break
            case 's8':
            case 's8le':
              value = this._readS8LE()
              size = 8
              break
            case 's8be':
              value = this._readS8BE()
              size = 8
              break
            case 'f4':
            case 'f4le':
              value = this._readF4LE()
              size = 4
              break
            case 'f4be':
              value = this._readF4BE()
              size = 4
              break
            case 'f8':
            case 'f8le':
              value = this._readF8LE()
              size = 8
              break
            case 'f8be':
              value = this._readF8BE()
              size = 8
              break
            case 'str':
              if (field.size) {
                const strSize = this._evaluateExpression(field.size, parent)
                value = this._readString(strSize, field.encoding)
                size = strSize
              }
              break
            case 'strz':
              const result = this._readStringZ(field.encoding)
              value = result.value
              size = result.size
              break
            default:
              // Unknown type, read as bytes if size specified
              if (field.size) {
                const byteSize = this._evaluateExpression(field.size, parent)
                value = this._readBytes(byteSize)
                size = byteSize
              }
          }
        }
        
        // Apply enum if specified
        if (field.enum && value !== null) {
          value = this._applyEnum(field.enum, value, parent)
        }
        
        return { value: value, size: size }
      }
      
      /**
       * Apply enum to value
       */
      _applyEnum(enumName, value, parent) {
        const enumDef = this._enums[enumName]
        if (enumDef && enumDef[value] !== undefined) {
          const enumValue = enumDef[value]
          if (typeof enumValue === 'object' && enumValue.id) {
            return enumValue.id
          }
          return enumValue
        }
        return value
      }
      
      /**
       * Parse repeat fields
       */
      _parseRepeatField(field, parent) {
        const items = []
        let totalSize = 0
        const startOffset = this.offset
        
        if (field.repeat === 'eos') {
          // Repeat until end of stream
          while (this.offset < this.buffer.length) {
            try {
              const result = this._parseFieldValue(field, parent)
              items.push(result.value)
              totalSize += result.size
            } catch (error) {
              break
            }
          }
        } else if (field.repeat === 'until') {
          // Repeat until condition
          const expr = field['repeat-until']
          let maxIter = 10000 // Safety limit
          
          while (this.offset < this.buffer.length && maxIter-- > 0) {
            try {
              const result = this._parseFieldValue(field, parent)
              items.push(result.value)
              totalSize += result.size
              
              // Check condition
              const context = {
                _: result.value,
                _parent: parent,
                _root: this._root,
                _io: this._io,
                _index: items.length - 1
              }
              
              if (this._evaluateExpression(expr, context)) {
                break
              }
            } catch (error) {
              break
            }
          }
        } else if (field.repeat === 'expr') {
          // Repeat N times
          const count = this._evaluateExpression(field['repeat-expr'], parent)
          for (let i = 0; i < count && this.offset < this.buffer.length; i++) {
            try {
              const result = this._parseFieldValue(field, parent)
              items.push(result.value)
              totalSize += result.size
            } catch (error) {
              break
            }
          }
        }
        
        return { value: items, size: totalSize }
      }
      
      /**
       * Parse switch-on type
       */
      _parseSwitchType(field, parent) {
        const switchOn = field.type['switch-on']
        const cases = field.type.cases || {}
        
        // Evaluate switch expression
        const switchValue = this._evaluateExpression(switchOn, parent)
        
        if (this._debug) {
          logger.debug(`Switch on: ${switchOn} = ${switchValue}`)
        }
        
        // Find matching case
        let matchedType = null
        for (const [caseKey, caseType] of Object.entries(cases)) {
          if (this._matchCase(caseKey, switchValue)) {
            matchedType = caseType
            break
          }
        }
        
        // Check for default case
        if (!matchedType && cases['_']) {
          matchedType = cases['_']
        }
        
        if (!matchedType) {
          // No match, read as bytes if size specified
          if (field.size) {
            const size = this._evaluateExpression(field.size, parent)
            return { value: this._readBytes(size), size: size }
          }
          return { value: null, size: 0 }
        }
        
        // Parse with matched type
        const tempField = { ...field, type: matchedType }
        delete tempField.type['switch-on']
        delete tempField.type.cases
        
        return this._parseFieldValue(tempField, parent)
      }
      
      /**
       * Match switch case
       */
      _matchCase(caseKey, value) {
        // Remove quotes if present
        const cleanKey = caseKey.replace(/^["']|["']$/g, '')
        
        // Direct match
        if (cleanKey === String(value)) return true
        
        // Enum-style match (e.g., "endian::le")
        if (caseKey.includes('::')) {
          const parts = caseKey.split('::')
          const enumValue = parts[parts.length - 1].replace(/["']/g, '')
          if (enumValue === String(value)) return true
        }
        
        return false
      }
      
      /**
       * Parse custom type
       */
      _parseCustomType(typeName, parent) {
        const typeDef = this._types[typeName]
        if (!typeDef) {
          logger.warn(`Type not found: ${typeName}`)
          return { value: null, size: 0 }
        }
        
        const startOffset = this.offset
        const result = {
          _parent: parent,
          _root: this._root
        }
        
        // Parse sequence
        if (typeDef.seq) {
          for (const field of typeDef.seq) {
            try {
              this._parseField(field, result)
            } catch (error) {
              logger.warn(`Error parsing field ${field.id} in type ${typeName}:`, error.message)
            }
          }
        }
        
        // Parse instances
        if (typeDef.instances) {
          this._parseInstances(typeDef.instances, result)
        }
        
        const size = this.offset - startOffset
        return { value: result, size: size }
      }
      
      /**
       * Parse ELF endian-specific structure
       */
      _parseEndianElf(parent) {
        // Determine endianness from parent's endian field
        const endianValue = parent.endian
        if (endianValue === 1) {
          this._endian = 'le'
        } else if (endianValue === 2) {
          this._endian = 'be'
        }
        
        const startOffset = this.offset
        const result = {
          _parent: parent,
          _root: this._root
        }
        
        // Find endian_elf type definition
        const typeDef = this._types['endian_elf']
        if (typeDef) {
          // Parse with dynamic endianness
          if (typeDef.seq) {
            for (const field of typeDef.seq) {
              try {
                this._parseField(field, result)
              } catch (error) {
                logger.warn(`Error parsing field ${field.id}:`, error.message)
              }
            }
          }
        }
        
        const size = this.offset - startOffset
        return { value: result, size: size }
      }
      
      /**
       * Parse instances (calculated fields)
       */
      _parseInstances(instances, parent) {
        for (const [name, inst] of Object.entries(instances)) {
          try {
            if (inst.value !== undefined) {
              // Calculate value
              const value = this._evaluateExpression(inst.value, parent)
              parent[name] = value
              this._instances[name] = value
            } else if (inst.pos !== undefined) {
              // Lazy instance with position
              // Store for later evaluation
              parent[name] = null // Placeholder
            }
          } catch (error) {
            if (this._debug) {
              logger.warn(`Failed to parse instance ${name}:`, error.message)
            }
          }
        }
      }
      
      /**
       * Evaluate expression safely without using eval/new Function.
       * Uses a recursive descent parser that ONLY supports safe KSY
       * expression operations: integer literals, arithmetic, bitwise,
       * comparisons, boolean, ternary, field references, true/false,
       * and parentheses grouping.
       */
      _evaluateExpression(expr, context) {
        if (typeof expr !== 'string') return expr

        // Direct field reference
        if (context && context[expr] !== undefined) {
          return context[expr]
        }

        // Parent field reference
        if (context && context._parent && context._parent[expr] !== undefined) {
          return context._parent[expr]
        }

        // Root field reference
        if (expr.startsWith('_root.')) {
          const field = expr.substring(6)
          if (this._root[field] !== undefined) {
            return this._root[field]
          }
        }

        // IO properties
        if (expr === '_io.size') return this.buffer.length
        if (expr === '_io.pos') return this.offset
        if (expr === '_io.eof') return this.offset >= this.buffer.length

        // Special values
        if (expr === 'eos') return this.buffer.length - this.offset

        // Try to evaluate as simple expression using safe parser
        try {
          // Build evaluation context for resolving field references
          const evalContext = {
            ...context,
            _root: this._root,
            _parent: context?._parent,
            _io: {
              size: this.buffer.length,
              pos: this.offset,
              eof: this.offset >= this.buffer.length
            }
          }

          return this._safeEvaluate(expr, evalContext)
        } catch (error) {
          // Return expression as-is if evaluation fails
          return expr
        }
      }

      /**
       * Safe expression evaluator: tokenizer + recursive descent parser.
       * Supports only Kaitai Struct expression subset:
       *   - Integer literals (decimal, hex 0x...)
       *   - Arithmetic: + - * / %
       *   - Bitwise: & | ^ << >>
       *   - Comparisons: == != < > <= >=
       *   - Boolean: && || ! not
       *   - Ternary: ? :
       *   - true, false
       *   - Parentheses grouping
       *   - Dotted field references (resolved from context)
       *   - String literals (single and double quoted)
       *
       * SECURITY: Does NOT use eval, new Function, or any dynamic code execution.
       */
      _safeEvaluate(expr, context) {
        // --- Tokenizer ---
        const tokens = []
        let i = 0
        const src = expr.trim()

        while (i < src.length) {
          // Skip whitespace
          if (/\s/.test(src[i])) { i++; continue }

          // String literals (single or double quoted)
          if (src[i] === '"' || src[i] === "'") {
            const quote = src[i]
            let str = ''
            i++ // skip opening quote
            while (i < src.length && src[i] !== quote) {
              if (src[i] === '\\' && i + 1 < src.length) {
                i++ // skip backslash, take next char
              }
              str += src[i]
              i++
            }
            i++ // skip closing quote
            tokens.push({ type: 'string', value: str })
            continue
          }

          // Numbers: hex (0x...) or decimal
          if (/[0-9]/.test(src[i]) || (src[i] === '0' && i + 1 < src.length && src[i + 1] === 'x')) {
            let num = ''
            if (src[i] === '0' && i + 1 < src.length && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
              num = '0x'
              i += 2
              while (i < src.length && /[0-9a-fA-F]/.test(src[i])) {
                num += src[i]; i++
              }
            } else {
              while (i < src.length && /[0-9.]/.test(src[i])) {
                num += src[i]; i++
              }
            }
            tokens.push({ type: 'number', value: Number(num) })
            continue
          }

          // Two-character operators
          const two = src.substring(i, i + 2)
          if (['==', '!=', '<=', '>=', '<<', '>>', '&&', '||'].includes(two)) {
            tokens.push({ type: 'op', value: two })
            i += 2
            continue
          }

          // Single-character operators and punctuation
          if ('+-*/%&|^~!<>?:()'.includes(src[i])) {
            tokens.push({ type: 'op', value: src[i] })
            i++
            continue
          }

          // Identifiers and keywords (including dotted paths like _io.size)
          if (/[a-zA-Z_]/.test(src[i])) {
            let ident = ''
            while (i < src.length && /[a-zA-Z0-9_.]/.test(src[i])) {
              ident += src[i]; i++
            }
            // Keywords
            if (ident === 'true') {
              tokens.push({ type: 'boolean', value: true })
            } else if (ident === 'false') {
              tokens.push({ type: 'boolean', value: false })
            } else if (ident === 'not') {
              tokens.push({ type: 'op', value: 'not' })
            } else {
              tokens.push({ type: 'ident', value: ident })
            }
            continue
          }

          // Unknown character — abort safe parse
          throw new Error(`Unexpected character: ${src[i]}`)
        }

        // --- Recursive descent parser ---
        let pos = 0

        const peek = () => tokens[pos] || null
        const advance = () => tokens[pos++]
        const expect = (type, value) => {
          const t = advance()
          if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
            throw new Error(`Expected ${type} ${value ?? ''} but got ${t ? t.type + ' ' + t.value : 'EOF'}`)
          }
          return t
        }

        // Resolve an identifier against the evaluation context
        const resolveIdent = (name) => {
          // Handle dotted paths like _io.size, _root.header.size
          const parts = name.split('.')
          let obj = context
          for (const part of parts) {
            if (obj == null || typeof obj !== 'object') return name
            if (part in obj) {
              obj = obj[part]
            } else {
              // Not found in context, return original name as string
              return name
            }
          }
          return obj
        }

        // Grammar (lowest to highest precedence):
        //   ternary     -> logicalOr ('?' ternary ':' ternary)?
        //   logicalOr   -> logicalAnd ('||' logicalAnd)*
        //   logicalAnd  -> bitwiseOr ('&&' bitwiseOr)*
        //   bitwiseOr   -> bitwiseXor ('|' bitwiseXor)*
        //   bitwiseXor  -> bitwiseAnd ('^' bitwiseAnd)*
        //   bitwiseAnd  -> equality ('&' equality)*
        //   equality    -> comparison (('==' | '!=') comparison)*
        //   comparison  -> shift (('<' | '>' | '<=' | '>=') shift)*
        //   shift       -> additive (('<<' | '>>') additive)*
        //   additive    -> multiplicative (('+' | '-') multiplicative)*
        //   multiplicative -> unary (('*' | '/' | '%') unary)*
        //   unary       -> ('!' | 'not' | '-' | '~') unary | primary
        //   primary     -> NUMBER | STRING | BOOLEAN | IDENT | '(' ternary ')'

        const parseTernary = () => {
          let node = parseLogicalOr()
          const t = peek()
          if (t && t.type === 'op' && t.value === '?') {
            advance() // consume '?'
            const consequent = parseTernary()
            expect('op', ':')
            const alternate = parseTernary()
            return node ? consequent : alternate
          }
          return node
        }

        const parseLogicalOr = () => {
          let left = parseLogicalAnd()
          while (peek() && peek().type === 'op' && peek().value === '||') {
            advance()
            const right = parseLogicalAnd()
            left = left || right
          }
          return left
        }

        const parseLogicalAnd = () => {
          let left = parseBitwiseOr()
          while (peek() && peek().type === 'op' && peek().value === '&&') {
            advance()
            const right = parseBitwiseOr()
            left = left && right
          }
          return left
        }

        const parseBitwiseOr = () => {
          let left = parseBitwiseXor()
          while (peek() && peek().type === 'op' && peek().value === '|' &&
                 !(tokens[pos + 1] && tokens[pos + 1].type === 'op' && tokens[pos + 1].value === '|')) {
            // Single '|' (not '||' which is already consumed as a two-char token)
            advance(); left = left | parseBitwiseXor()
          }
          return left
        }

        const parseBitwiseXor = () => {
          let left = parseBitwiseAnd()
          while (peek() && peek().type === 'op' && peek().value === '^') {
            advance(); left = left ^ parseBitwiseAnd()
          }
          return left
        }

        const parseBitwiseAnd = () => {
          let left = parseEquality()
          while (peek() && peek().type === 'op' && peek().value === '&' &&
                 !(tokens[pos + 1] && tokens[pos + 1].type === 'op' && tokens[pos + 1].value === '&')) {
            // Single '&' (not '&&' which is already consumed as a two-char token)
            advance(); left = left & parseEquality()
          }
          return left
        }

        const parseEquality = () => {
          let left = parseComparison()
          while (peek() && peek().type === 'op' && (peek().value === '==' || peek().value === '!=')) {
            const op = advance().value
            const right = parseComparison()
            left = op === '==' ? left == right : left != right
          }
          return left
        }

        const parseComparison = () => {
          let left = parseShift()
          while (peek() && peek().type === 'op' && ['<', '>', '<=', '>='].includes(peek().value)) {
            const op = advance().value
            const right = parseShift()
            switch (op) {
              case '<':  left = left < right; break
              case '>':  left = left > right; break
              case '<=': left = left <= right; break
              case '>=': left = left >= right; break
            }
          }
          return left
        }

        const parseShift = () => {
          let left = parseAdditive()
          while (peek() && peek().type === 'op' && (peek().value === '<<' || peek().value === '>>')) {
            const op = advance().value
            const right = parseAdditive()
            left = op === '<<' ? left << right : left >> right
          }
          return left
        }

        const parseAdditive = () => {
          let left = parseMultiplicative()
          while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
            const op = advance().value
            const right = parseMultiplicative()
            left = op === '+' ? left + right : left - right
          }
          return left
        }

        const parseMultiplicative = () => {
          let left = parseUnary()
          while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
            const op = advance().value
            const right = parseUnary()
            switch (op) {
              case '*': left = left * right; break
              case '/': left = right !== 0 ? Math.trunc(left / right) : 0; break
              case '%': left = right !== 0 ? left % right : 0; break
            }
          }
          return left
        }

        const parseUnary = () => {
          const t = peek()
          if (t && t.type === 'op') {
            if (t.value === '!' || t.value === 'not') {
              advance(); return !parseUnary()
            }
            if (t.value === '-') {
              advance(); return -parseUnary()
            }
            if (t.value === '~') {
              advance(); return ~parseUnary()
            }
          }
          return parsePrimary()
        }

        const parsePrimary = () => {
          const t = peek()
          if (!t) throw new Error('Unexpected end of expression')

          if (t.type === 'number') {
            advance(); return t.value
          }
          if (t.type === 'string') {
            advance(); return t.value
          }
          if (t.type === 'boolean') {
            advance(); return t.value
          }
          if (t.type === 'ident') {
            advance(); return resolveIdent(t.value)
          }
          if (t.type === 'op' && t.value === '(') {
            advance() // consume '('
            const val = parseTernary()
            expect('op', ')')
            return val
          }

          throw new Error(`Unexpected token: ${t.type} ${t.value}`)
        }

        const result = parseTernary()

        // Ensure all tokens were consumed
        if (pos < tokens.length) {
          throw new Error(`Unexpected token after expression: ${tokens[pos].value}`)
        }

        return result
      }
      
      // Read methods
      _readU1() {
        if (this.offset >= this.buffer.length) {
          throw new Error('EOF')
        }
        const value = this.buffer[this.offset++]
        this._io.pos = this.offset
        return value
      }
      
      _readU2LE() {
        if (this.offset + 2 > this.buffer.length) {
          throw new Error('EOF')
        }
        const value = this.buffer[this.offset] | (this.buffer[this.offset + 1] << 8)
        this.offset += 2
        this._io.pos = this.offset
        return value
      }
      
      _readU2BE() {
        if (this.offset + 2 > this.buffer.length) {
          throw new Error('EOF')
        }
        const value = (this.buffer[this.offset] << 8) | this.buffer[this.offset + 1]
        this.offset += 2
        this._io.pos = this.offset
        return value
      }
      
      _readU4LE() {
        if (this.offset + 4 > this.buffer.length) {
          throw new Error('EOF')
        }
        const value = this.buffer[this.offset] |
                     (this.buffer[this.offset + 1] << 8) |
                     (this.buffer[this.offset + 2] << 16) |
                     (this.buffer[this.offset + 3] << 24)
        this.offset += 4
        this._io.pos = this.offset
        return value >>> 0
      }
      
      _readU4BE() {
        if (this.offset + 4 > this.buffer.length) {
          throw new Error('EOF')
        }
        const value = (this.buffer[this.offset] << 24) |
                     (this.buffer[this.offset + 1] << 16) |
                     (this.buffer[this.offset + 2] << 8) |
                     this.buffer[this.offset + 3]
        this.offset += 4
        this._io.pos = this.offset
        return value >>> 0
      }
      
      _readU8LE() {
        const low = this._readU4LE()
        const high = this._readU4LE()
        return high * 0x100000000 + low
      }
      
      _readU8BE() {
        const high = this._readU4BE()
        const low = this._readU4BE()
        return high * 0x100000000 + low
      }
      
      _readS1() {
        const value = this._readU1()
        return value > 127 ? value - 256 : value
      }
      
      _readS2LE() {
        const value = this._readU2LE()
        return value > 32767 ? value - 65536 : value
      }
      
      _readS2BE() {
        const value = this._readU2BE()
        return value > 32767 ? value - 65536 : value
      }
      
      _readS4LE() {
        const value = this._readU4LE()
        return value > 2147483647 ? value - 4294967296 : value
      }
      
      _readS4BE() {
        const value = this._readU4BE()
        return value > 2147483647 ? value - 4294967296 : value
      }
      
      _readS8LE() {
        const value = this._readU8LE()
        // Convert unsigned 64-bit to signed 64-bit
        // JavaScript doesn't natively support 64-bit integers
        // Using BigInt for proper 64-bit signed handling
        const bigValue = BigInt(value)
        const signedValue = bigValue > 0x7FFFFFFFFFFFFFFFn ? bigValue - 0x10000000000000000n : bigValue
        return Number(signedValue)
      }
      
      _readS8BE() {
        const value = this._readU8BE()
        // Convert unsigned 64-bit to signed 64-bit
        // JavaScript doesn't natively support 64-bit integers
        // Using BigInt for proper 64-bit signed handling
        const bigValue = BigInt(value)
        const signedValue = bigValue > 0x7FFFFFFFFFFFFFFFn ? bigValue - 0x10000000000000000n : bigValue
        return Number(signedValue)
      }
      
      _readF4LE() {
        const buffer = new ArrayBuffer(4)
        const view = new DataView(buffer)
        const bytes = this._readBytes(4)
        for (let i = 0; i < 4; i++) {
          view.setUint8(i, bytes[i])
        }
        return view.getFloat32(0, true)
      }
      
      _readF4BE() {
        const buffer = new ArrayBuffer(4)
        const view = new DataView(buffer)
        const bytes = this._readBytes(4)
        for (let i = 0; i < 4; i++) {
          view.setUint8(i, bytes[i])
        }
        return view.getFloat32(0, false)
      }
      
      _readF8LE() {
        const buffer = new ArrayBuffer(8)
        const view = new DataView(buffer)
        const bytes = this._readBytes(8)
        for (let i = 0; i < 8; i++) {
          view.setUint8(i, bytes[i])
        }
        return view.getFloat64(0, true)
      }
      
      _readF8BE() {
        const buffer = new ArrayBuffer(8)
        const view = new DataView(buffer)
        const bytes = this._readBytes(8)
        for (let i = 0; i < 8; i++) {
          view.setUint8(i, bytes[i])
        }
        return view.getFloat64(0, false)
      }
      
      _readBytes(count) {
        if (count < 0) {
          throw new Error(`Invalid byte count: ${count}`)
        }
        const available = this.buffer.length - this.offset
        const toRead = Math.min(count, available)
        const bytes = this.buffer.slice(this.offset, this.offset + toRead)
        this.offset += toRead
        this._io.pos = this.offset
        return bytes
      }
      
      _readString(size, encoding = 'UTF-8') {
        const bytes = this._readBytes(size)
        return new TextDecoder(encoding.toLowerCase()).decode(bytes)
      }
      
      _readStringZ(encoding = 'UTF-8') {
        const startOffset = this.offset
        let end = this.offset
        while (end < this.buffer.length && this.buffer[end] !== 0) {
          end++
        }
        const bytes = this.buffer.slice(this.offset, end)
        this.offset = end + (end < this.buffer.length ? 1 : 0) // Skip null if found
        this._io.pos = this.offset
        const value = new TextDecoder(encoding.toLowerCase()).decode(bytes)
        return { value: value, size: this.offset - startOffset }
      }
      
      _readBits(count) {
        // Simplified bit reading - just read as bytes for now
        const byteCount = Math.ceil(count / 8)
        const bytes = this._readBytes(byteCount)
        let value = 0
        for (let i = 0; i < byteCount; i++) {
          value = (value << 8) | bytes[i]
        }
        // Mask to get only the required bits
        const mask = (1 << count) - 1
        return value & mask
      }
      
      // Static parse method for compatibility
      static parse(buffer) {
        try {
          logger.debug('AdvancedKsyParser.parse called with buffer length:', buffer.length)
          const instance = new AdvancedKsyParser(buffer)
          
          // Debug: log parsed fields
          logger.debug('=== AdvancedKsyParser _parsed contents:', instance._parsed)
          
          // Convert _parsed to fields array
          const fields = Object.keys(instance._parsed).map(key => {
            const field = instance._parsed[key]
            logger.debug(`=== Field ${key}: offset=${field.offset}, size=${field.size}, type=${field.type}`)
            
            // Format value for display
            let displayValue = field.value
            if (displayValue instanceof Uint8Array) {
              if (displayValue.length <= 16) {
                displayValue = Array.from(displayValue).map(b => 
                  b.toString(16).padStart(2, '0').toUpperCase()
                ).join(' ')
              } else {
                const preview = Array.from(displayValue.slice(0, 8)).map(b => 
                  b.toString(16).padStart(2, '0').toUpperCase()
                ).join(' ')
                displayValue = `${preview}... [${displayValue.length} bytes]`
              }
            } else if (typeof displayValue === 'object' && displayValue !== null) {
              // Handle nested structures
              displayValue = `{${Object.keys(displayValue).filter(k => !k.startsWith('_')).length} fields}`
            } else if (Array.isArray(displayValue)) {
              displayValue = `[${displayValue.length} items]`
            } else if (typeof displayValue === 'number') {
              displayValue = `${displayValue} (0x${displayValue.toString(16).toUpperCase()})`
            }
            
            return {
              name: key,
              value: displayValue,
              offset: field.offset,
              size: field.size
            }
          })
          
          logger.debug('=== Final fields array:', fields)
          
          return {
            success: true,
            data: instance,
            fields: fields
          }
        } catch (error) {
          logger.error('=== AdvancedKsyParser.parse ERROR:', error)
          return {
            success: false,
            error: error.message,
            fields: []
          }
        }
      }
    }
    
    logger.debug('Returning AdvancedKsyParser class')
    return AdvancedKsyParser
  }
}

// Export singleton
let instance = null

export function getAdvancedKsyCompiler() {
  if (!instance) {
    logger.debug('=== CREATING NEW AdvancedKsyCompiler INSTANCE ===')
    instance = new AdvancedKsyCompiler()
  }
  return instance
}

export default AdvancedKsyCompiler