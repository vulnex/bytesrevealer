/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KsyCompiler.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import * as yaml from 'yaml'
import CompilerCache from '../compiler/CompilerCache.js'
import { getAdvancedKsyCompiler } from './AdvancedKsyCompiler.js'
import { getSimpleKsyCompiler } from './SimpleKsyCompiler.js'
import { getTestKsyCompiler } from './TestKsyCompiler.js'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('KsyCompiler')

/**
 * KSY Compiler wrapper for browser-based compilation
 * Compiles Kaitai Struct YAML definitions to JavaScript parsers
 */
class KsyCompiler {
  constructor() {
    this.cache = new CompilerCache()
    this.worker = null
    this.initWorker()
  }

  /**
   * Initialize the compilation worker
   */
  initWorker() {
    // Worker will be initialized when needed
    this.workerReady = false
  }

  /**
   * Validate KSY syntax
   * @param {string} ksyContent - Raw KSY file content
   * @returns {Object} Validation result
   */
  async validate(ksyContent) {
    try {
      // Parse YAML to check syntax
      const parsed = yaml.parse(ksyContent)
      
      // Basic validation checks - only check for truly required fields
      const errors = []
      const warnings = []
      
      if (!parsed.meta) {
        errors.push('Missing meta section')
      } else {
        if (!parsed.meta.id) errors.push('Missing meta.id')
        // endian is optional - defaults to 'le' if not specified
        if (!parsed.meta.endian) {
          warnings.push('Missing meta.endian - defaulting to little-endian')
        }
      }
      
      // seq and instances are both optional - a KSY can have neither
      if (!parsed.seq && !parsed.instances) {
        warnings.push('No seq or instances section - file will be parsed as raw bytes')
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        parsed
      }
    } catch (error) {
      return {
        valid: false,
        errors: [`YAML parse error: ${error.message}`],
        warnings: [],
        parsed: null
      }
    }
  }

  /**
   * Generate a hash for caching
   * @param {string} content - Content to hash
   * @returns {string} Hash string
   */
  generateHash(content) {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Compile KSY to JavaScript parser
   * Uses KsyToJsCompiler for actual compilation
   * @param {string} ksyContent - KSY definition
   * @returns {Object} Compilation result
   */
  async compile(ksyContent) {
    try {
      // Skip cache for now to debug the issue
      // const hash = this.generateHash(ksyContent)
      // const cached = await this.cache.get(hash)
      // if (cached) {
      //   return cached
      // }

      // Try AdvancedKsyCompiler first for complex format support
      let compiler = getAdvancedKsyCompiler()
      let result = null
      
      if (compiler) {
        logger.debug('Using AdvancedKsyCompiler for compilation')
        result = await compiler.compile(ksyContent)
      }
      
      // Fall back to SimpleKsyCompiler if advanced fails
      if (!result) {
        logger.debug('Falling back to SimpleKsyCompiler')
        compiler = getSimpleKsyCompiler()
        
        if (compiler) {
          result = await compiler.compile(ksyContent)
        }
      }
      
      // Final fallback to TestKsyCompiler
      if (!result) {
        logger.debug('Final fallback to TestKsyCompiler')
        compiler = getTestKsyCompiler()
        
        if (!compiler) {
          return {
            success: false,
            error: 'No compiler available'
          }
        }
        
        result = await compiler.compile(ksyContent)
      }
      
      if (!result) {
        return {
          success: false,
          error: 'Compilation failed - no result'
        }
      }
      
      // Skip caching for now
      // if (result.success) {
      //   await this.cache.set(hash, result)
      // }
      
      return result
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Simplified KSY to JS compilation
   * This is a basic implementation that handles simple formats
   * @param {Object} ksyParsed - Parsed KSY object
   * @returns {string} JavaScript code
   */
  async compileToJS(ksyParsed) {
    const className = this.toPascalCase(ksyParsed.meta.id)
    
    let js = `
class ${className} {
  constructor(_io, _parent = null, _root = null) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;
    this._read();
  }

  _read() {
`

    // Process seq section
    if (ksyParsed.seq) {
      for (const field of ksyParsed.seq) {
        js += this.generateFieldReader(field, ksyParsed.meta.endian)
      }
    }

    js += `  }
`

    // Add getters for instances
    if (ksyParsed.instances) {
      for (const [name, instance] of Object.entries(ksyParsed.instances)) {
        js += this.generateInstanceGetter(name, instance, ksyParsed.meta.endian)
      }
    }

    js += `}

// Export the parser class
${className};
`

    return js
  }

  /**
   * Generate field reader code
   * @param {Object} field - Field definition
   * @param {string} endian - Endianness
   * @returns {string} JavaScript code
   */
  generateFieldReader(field, endian) {
    const fieldName = field.id
    const fieldType = field.type
    
    let code = ''
    
    if (typeof fieldType === 'string') {
      // Built-in types
      switch (fieldType) {
        case 'u1':
          code = `    this.${fieldName} = this._io.readU1();\n`
          break
        case 'u2':
        case 'u2le':
        case 'u2be':
          code = `    this.${fieldName} = this._io.readU2${this.getEndianSuffix(fieldType, endian)}();\n`
          break
        case 'u4':
        case 'u4le':
        case 'u4be':
          code = `    this.${fieldName} = this._io.readU4${this.getEndianSuffix(fieldType, endian)}();\n`
          break
        case 'u8':
        case 'u8le':
        case 'u8be':
          code = `    this.${fieldName} = this._io.readU8${this.getEndianSuffix(fieldType, endian)}();\n`
          break
        case 'str':
        case 'strz':
          if (field.size) {
            code = `    this.${fieldName} = this._io.readStr(${field.size}, '${field.encoding || 'ASCII'}');\n`
          } else if (field.terminator !== undefined) {
            code = `    this.${fieldName} = this._io.readStrz('${field.encoding || 'ASCII'}', ${field.terminator});\n`
          }
          break
        default:
          // User-defined type
          code = `    this.${fieldName} = new ${this.toPascalCase(fieldType)}(this._io, this, this._root);\n`
      }
    }
    
    // Handle repeat
    if (field.repeat) {
      let loopCode = code.trim()
      if (field.repeat === 'eos') {
        code = `    this.${fieldName} = [];\n`
        code += `    while (!this._io.isEof()) {\n`
        code += `      ${loopCode.replace(`this.${fieldName}`, `this.${fieldName}.push(`)}))\n`
        code += `    }\n`
      } else if (field['repeat-expr']) {
        code = `    this.${fieldName} = [];\n`
        code += `    for (let i = 0; i < ${field['repeat-expr']}; i++) {\n`
        code += `      ${loopCode.replace(`this.${fieldName}`, `this.${fieldName}.push(`)}))\n`
        code += `    }\n`
      }
    }
    
    return code
  }

  /**
   * Generate instance getter code
   * @param {string} name - Instance name
   * @param {Object} instance - Instance definition
   * @param {string} endian - Endianness
   * @returns {string} JavaScript code
   */
  generateInstanceGetter(name, instance, endian) {
    let code = `
  get ${name}() {
    if (this._m_${name} !== undefined)
      return this._m_${name};
`
    
    if (instance.pos !== undefined) {
      code += `    const _pos = this._io.pos;\n`
      code += `    this._io.seek(${instance.pos});\n`
    }
    
    // Add instance reading logic based on type
    const readCode = this.generateFieldReader({ id: `_m_${name}`, ...instance }, endian)
    code += readCode.replace(`this._m_${name}`, `this._m_${name}`)
    
    if (instance.pos !== undefined) {
      code += `    this._io.seek(_pos);\n`
    }
    
    code += `    return this._m_${name};
  }
`
    
    return code
  }

  /**
   * Get endian suffix for type
   * @param {string} type - Type string
   * @param {string} defaultEndian - Default endianness
   * @returns {string} Endian suffix
   */
  getEndianSuffix(type, defaultEndian) {
    if (type.endsWith('le')) return 'le'
    if (type.endsWith('be')) return 'be'
    return defaultEndian === 'le' ? 'le' : 'be'
  }

  /**
   * Convert string to PascalCase
   * @param {string} str - Input string
   * @returns {string} PascalCase string
   */
  toPascalCase(str) {
    return str.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase())
  }

  /**
   * Create parser from compiled JavaScript
   * @param {string} compiledJS - Compiled JavaScript code
   * @returns {Function} Parser class
   */
  createParserFromCompiled(compiledJS) {
    try {
      // Use Function constructor instead of eval for better security
      // This creates a function in the global scope, isolated from local variables
      const ParserClass = new Function('return ' + compiledJS)()
      return ParserClass
    } catch (error) {
      throw new Error(`Failed to create parser: ${error.message}`)
    }
  }

  /**
   * Compile from Worker (for complex formats)
   * @param {string} ksyContent - KSY content
   * @returns {Promise<Function>} Parser class
   */
  async compileInWorker(ksyContent) {
    if (!this.worker) {
      // Initialize worker on first use
      const workerCode = await import('../compiler/KaitaiCompilerWorker.js')
      this.worker = workerCode.createCompilerWorker()
    }

    return new Promise((resolve, reject) => {
      const messageHandler = (event) => {
        if (event.data.type === 'compiled') {
          this.worker.removeEventListener('message', messageHandler)
          resolve(this.createParserFromCompiled(event.data.result))
        } else if (event.data.type === 'error') {
          this.worker.removeEventListener('message', messageHandler)
          reject(new Error(event.data.error))
        }
      }

      this.worker.addEventListener('message', messageHandler)
      this.worker.postMessage({
        type: 'compile',
        content: ksyContent
      })
    })
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.cache.clear()
  }
}

// Export singleton
let instance = null

export function getKsyCompiler() {
  if (!instance) {
    instance = new KsyCompiler()
  }
  return instance
}

export default KsyCompiler