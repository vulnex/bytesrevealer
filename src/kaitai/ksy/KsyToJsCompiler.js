/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KsyToJsCompiler.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import * as yaml from 'yaml'

/**
 * Compiles KSY format definitions to JavaScript parsers
 * This is a simplified compiler that generates runtime parsers
 */
class KsyToJsCompiler {
  constructor() {
    this.typeMap = {
      u1: { size: 1, read: 'readUInt8' },
      u2: { size: 2, read: 'readUInt16LE' },
      u4: { size: 4, read: 'readUInt32LE' },
      u8: { size: 8, read: 'readBigUInt64LE' },
      s1: { size: 1, read: 'readInt8' },
      s2: { size: 2, read: 'readInt16LE' },
      s4: { size: 4, read: 'readInt32LE' },
      s8: { size: 8, read: 'readBigInt64LE' },
      f4: { size: 4, read: 'readFloatLE' },
      f8: { size: 8, read: 'readDoubleLE' }
    }
  }

  /**
   * Compile KSY YAML to JavaScript
   * @param {string} ksyContent - KSY YAML content
   * @returns {Object} Compilation result with code and parser
   */
  compile(ksyContent) {
    try {
      // Parse YAML
      const ksy = yaml.parse(ksyContent)
      
      // Generate JavaScript code
      const code = this.generateCode(ksy)
      
      // Create parser class
      const Parser = this.createParser(ksy)
      
      return {
        success: true,
        code,
        parser: Parser,
        metadata: {
          id: ksy.meta?.id,
          title: ksy.meta?.title,
          extensions: Array.isArray(ksy.meta?.['file-extension']) 
            ? ksy.meta['file-extension'] 
            : [ksy.meta?.['file-extension']].filter(Boolean)
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Generate JavaScript code from KSY
   * @param {Object} ksy - Parsed KSY object
   * @returns {string} JavaScript code
   */
  generateCode(ksy) {
    const className = this.toPascalCase(ksy.meta?.id || 'CustomFormat')
    const endian = ksy.meta?.endian === 'be' ? 'BE' : 'LE'
    
    let code = `// Generated from KSY format: ${ksy.meta?.title || 'Unknown'}\n`
    code += `class ${className} {\n`
    code += `  constructor(buffer) {\n`
    code += `    this.buffer = buffer;\n`
    code += `    this.offset = 0;\n`
    code += `    this.endian = '${endian}';\n`
    code += `    this.parse();\n`
    code += `  }\n\n`
    
    // Generate parse method
    code += `  parse() {\n`
    
    if (ksy.seq) {
      for (const field of ksy.seq) {
        code += this.generateFieldParser(field, '    ')
      }
    }
    
    code += `  }\n\n`
    
    // Generate helper methods
    code += this.generateHelperMethods()
    
    code += `}\n\n`
    code += `export default ${className};\n`
    
    return code
  }

  /**
   * Generate parser for a single field
   * @param {Object} field - Field definition
   * @param {string} indent - Indentation
   * @returns {string} Field parser code
   */
  generateFieldParser(field, indent = '') {
    let code = ''
    const fieldName = this.toCamelCase(field.id)
    
    // Handle magic/contents validation
    if (field.contents) {
      const contents = Array.isArray(field.contents) ? field.contents : [field.contents]
      const bytesArray = contents.map(c => {
        if (typeof c === 'string') {
          // Convert string to byte array
          return Array.from(c).map(ch => ch.charCodeAt(0))
        } else if (typeof c === 'number') {
          return [c]
        } else if (Array.isArray(c)) {
          return c
        }
        return []
      }).flat()
      
      code += `${indent}// Validate magic: ${field.id}\n`
      code += `${indent}const ${fieldName}Expected = [${bytesArray.join(', ')}];\n`
      code += `${indent}const ${fieldName} = this.readBytes(${bytesArray.length});\n`
      code += `${indent}for (let i = 0; i < ${bytesArray.length}; i++) {\n`
      code += `${indent}  if (${fieldName}[i] !== ${fieldName}Expected[i]) {\n`
      code += `${indent}    throw new Error('Invalid magic at offset ' + (this.offset - ${bytesArray.length}));\n`
      code += `${indent}  }\n`
      code += `${indent}}\n`
      code += `${indent}this.${fieldName} = ${fieldName};\n\n`
      return code
    }
    
    // Handle primitive types
    if (field.type && typeof field.type === 'string') {
      const typeInfo = this.typeMap[field.type]
      if (typeInfo) {
        code += `${indent}// Read ${field.id}: ${field.type}\n`
        code += `${indent}this.${fieldName} = this.${typeInfo.read}();\n`
        if (field.doc) {
          code += `${indent}// ${field.doc}\n`
        }
        code += '\n'
      } else if (field.type === 'str') {
        const size = field.size || field['size-eos'] ? 'null' : '0'
        const encoding = field.encoding || 'UTF-8'
        code += `${indent}// Read string: ${field.id}\n`
        code += `${indent}this.${fieldName} = this.readString(${size}, '${encoding}');\n\n`
      } else if (field.type === 'strz') {
        const encoding = field.encoding || 'UTF-8'
        code += `${indent}// Read null-terminated string: ${field.id}\n`
        code += `${indent}this.${fieldName} = this.readStringZ('${encoding}');\n\n`
      }
    }
    
    // Handle sized data
    if (field.size) {
      code += `${indent}// Read sized data: ${field.id}\n`
      code += `${indent}this.${fieldName} = this.readBytes(${field.size});\n\n`
    }
    
    // Handle repetition
    if (field.repeat) {
      code += `${indent}// Read repeated field: ${field.id}\n`
      code += `${indent}this.${fieldName} = [];\n`
      if (field.repeat === 'eos') {
        code += `${indent}while (this.offset < this.buffer.length) {\n`
        code += `${indent}  this.${fieldName}.push(this.readField_${fieldName}());\n`
        code += `${indent}}\n\n`
      } else if (field.repeat === 'expr') {
        code += `${indent}const ${fieldName}Count = ${field['repeat-expr']};\n`
        code += `${indent}for (let i = 0; i < ${fieldName}Count; i++) {\n`
        code += `${indent}  this.${fieldName}.push(this.readField_${fieldName}());\n`
        code += `${indent}}\n\n`
      }
    }
    
    return code
  }

  /**
   * Generate helper methods for reading data
   * @returns {string} Helper methods code
   */
  generateHelperMethods() {
    return `
  readUInt8() {
    const val = this.buffer[this.offset];
    this.offset += 1;
    return val;
  }
  
  readUInt16LE() {
    const val = this.buffer[this.offset] | (this.buffer[this.offset + 1] << 8);
    this.offset += 2;
    return val;
  }
  
  readUInt32LE() {
    const val = this.buffer[this.offset] | 
                (this.buffer[this.offset + 1] << 8) |
                (this.buffer[this.offset + 2] << 16) |
                (this.buffer[this.offset + 3] << 24);
    this.offset += 4;
    return val >>> 0;
  }
  
  readInt8() {
    const val = this.buffer[this.offset];
    this.offset += 1;
    return val > 127 ? val - 256 : val;
  }
  
  readInt16LE() {
    const val = this.readUInt16LE();
    return val > 32767 ? val - 65536 : val;
  }
  
  readInt32LE() {
    const val = this.readUInt32LE();
    return val > 2147483647 ? val - 4294967296 : val;
  }
  
  readFloatLE() {
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.offset, 4);
    const val = view.getFloat32(0, true);
    this.offset += 4;
    return val;
  }
  
  readDoubleLE() {
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.offset, 8);
    const val = view.getFloat64(0, true);
    this.offset += 8;
    return val;
  }
  
  readBytes(size) {
    const bytes = this.buffer.slice(this.offset, this.offset + size);
    this.offset += size;
    return bytes;
  }
  
  readString(size, encoding = 'UTF-8') {
    let bytes;
    if (size === null) {
      bytes = this.buffer.slice(this.offset);
      this.offset = this.buffer.length;
    } else {
      bytes = this.readBytes(size);
    }
    return new TextDecoder(encoding.toLowerCase()).decode(bytes);
  }
  
  readStringZ(encoding = 'UTF-8') {
    let end = this.offset;
    while (end < this.buffer.length && this.buffer[end] !== 0) {
      end++;
    }
    const bytes = this.buffer.slice(this.offset, end);
    this.offset = end + 1; // Skip null terminator
    return new TextDecoder(encoding.toLowerCase()).decode(bytes);
  }
`
  }

  /**
   * Create parser class from KSY
   * @param {Object} ksy - Parsed KSY object
   * @returns {Function} Parser class
   */
  createParser(ksy) {
    try {
      const code = this.generateCode(ksy)
      
      // Clean up the code for Function constructor
      const cleanCode = code
        .replace(/export default.*$/m, '')
        .replace(/export\s+/g, '')
      
      // Create a function that returns the parser
      const parserFactory = new Function('return ' + cleanCode)
      const Parser = parserFactory()
      
      // Add parse method for compatibility
      Parser.parse = function(buffer) {
        try {
          // Ensure buffer is Uint8Array
          if (!(buffer instanceof Uint8Array)) {
            buffer = new Uint8Array(buffer)
          }
          
          const instance = new Parser(buffer)
          return {
            success: true,
            data: instance,
            fields: Object.keys(instance)
              .filter(key => !['buffer', 'offset', 'endian', 'parse'].includes(key) && !key.startsWith('read'))
              .map(key => ({
                name: key,
                value: instance[key],
                offset: 0, // Would need to track during parsing
                size: 0 // Would need to track during parsing
              }))
          }
        } catch (error) {
          return {
            success: false,
            error: error.message
          }
        }
      }
      
      return Parser
    } catch (error) {
      logger.error('Failed to create parser:', error)
      // Return a dummy parser that always fails
      return {
        parse: () => ({ success: false, error: error.message })
      }
    }
  }

  /**
   * Convert to PascalCase
   * @param {string} str - Input string
   * @returns {string} PascalCase string
   */
  toPascalCase(str) {
    return str
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }

  /**
   * Convert to camelCase
   * @param {string} str - Input string
   * @returns {string} camelCase string
   */
  toCamelCase(str) {
    const pascal = this.toPascalCase(str)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
  }
}

// Export singleton
let instance = null

export function getKsyToJsCompiler() {
  if (!instance) {
    instance = new KsyToJsCompiler()
  }
  return instance
}

export default KsyToJsCompiler