/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KsyValidator.js
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
 * Validator for KSY file syntax and structure
 */
class KsyValidator {
  constructor() {
    this.requiredMetaFields = ['id']
    this.validEndians = ['le', 'be']
    this.validTypes = [
      'u1', 'u2', 'u2le', 'u2be', 'u4', 'u4le', 'u4be', 'u8', 'u8le', 'u8be',
      's1', 's2', 's2le', 's2be', 's4', 's4le', 's4be', 's8', 's8le', 's8be',
      'f4', 'f4le', 'f4be', 'f8', 'f8le', 'f8be',
      'str', 'strz'
    ]
  }

  /**
   * Validate KSY content
   * @param {string} content - Raw KSY content
   * @returns {Object} Validation result
   */
  async validate(content) {
    const errors = []
    let parsed = null

    // Step 1: Parse YAML
    try {
      parsed = yaml.parse(content)
    } catch (error) {
      return {
        valid: false,
        errors: [`YAML parse error: ${error.message}`],
        parsed: null
      }
    }

    // Step 2: Validate structure
    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        errors: ['Invalid KSY structure: must be an object'],
        parsed: null
      }
    }

    // Step 3: Validate meta section
    if (!parsed.meta) {
      errors.push('Missing required "meta" section')
    } else {
      this.validateMeta(parsed.meta, errors)
    }

    // Step 4: Validate structure definition - not required, just warn
    // A KSY file can be valid without seq or instances (e.g., just enums or types)
    // No error here, handled in warnings

    // Step 5: Validate seq section
    if (parsed.seq) {
      this.validateSeq(parsed.seq, errors)
    }

    // Step 6: Validate instances section
    if (parsed.instances) {
      this.validateInstances(parsed.instances, errors)
    }

    // Step 7: Validate types section
    if (parsed.types) {
      this.validateTypes(parsed.types, errors)
    }

    // Step 8: Validate enums section
    if (parsed.enums) {
      this.validateEnums(parsed.enums, errors)
    }

    return {
      valid: errors.length === 0,
      errors,
      parsed,
      warnings: this.getWarnings(parsed)
    }
  }

  /**
   * Validate meta section
   * @param {Object} meta - Meta section
   * @param {Array} errors - Error array to populate
   */
  validateMeta(meta, errors) {
    // Check required fields
    for (const field of this.requiredMetaFields) {
      if (!meta[field]) {
        errors.push(`Missing required meta field: ${field}`)
      }
    }

    // Validate ID format
    if (meta.id && !/^[a-z][a-z0-9_]*$/.test(meta.id)) {
      errors.push('Invalid meta.id: must start with lowercase letter and contain only lowercase letters, numbers, and underscores')
    }

    // Validate endian
    if (meta.endian && !this.validEndians.includes(meta.endian)) {
      errors.push(`Invalid meta.endian: must be one of ${this.validEndians.join(', ')}`)
    }

    // Validate file extension
    if (meta['file-extension']) {
      const ext = meta['file-extension']
      if (Array.isArray(ext)) {
        ext.forEach(e => {
          if (typeof e !== 'string') {
            errors.push('Invalid file-extension: must be string or array of strings')
          }
        })
      } else if (typeof ext !== 'string') {
        errors.push('Invalid file-extension: must be string or array of strings')
      }
    }

    // Validate imports
    if (meta.imports) {
      if (!Array.isArray(meta.imports)) {
        errors.push('Invalid meta.imports: must be an array')
      } else {
        meta.imports.forEach(imp => {
          if (typeof imp !== 'string') {
            errors.push('Invalid import: must be a string')
          }
        })
      }
    }
  }

  /**
   * Validate seq section
   * @param {Array} seq - Seq section
   * @param {Array} errors - Error array to populate
   */
  validateSeq(seq, errors) {
    if (!Array.isArray(seq)) {
      errors.push('Invalid seq: must be an array')
      return
    }

    seq.forEach((field, index) => {
      this.validateField(field, `seq[${index}]`, errors)
    })
  }

  /**
   * Validate field definition
   * @param {Object} field - Field definition
   * @param {string} path - Field path for error messages
   * @param {Array} errors - Error array to populate
   */
  validateField(field, path, errors) {
    // Skip validation if this is not a proper field object
    if (!field || typeof field !== 'object') {
      return
    }
    
    // Check for ID - only required if not a contents-only field
    if (!field.id && !field.contents) {
      errors.push(`${path}: missing required field "id"`)
    } else if (field.id && typeof field.id === 'string' && !/^[a-z][a-z0-9_]*$/.test(field.id)) {
      errors.push(`${path}.id: invalid format`)
    }

    // Check for type or contents - at least one is needed
    if (!field.type && !field.contents && !field.id) {
      errors.push(`${path}: must have "id" with "type", or just "contents"`)
    }

    // Validate type
    if (field.type) {
      if (typeof field.type === 'string') {
        // Check if it's a built-in type or user type
        if (!this.validTypes.includes(field.type) && !/^[a-z][a-z0-9_]*$/.test(field.type)) {
          errors.push(`${path}.type: invalid type "${field.type}"`)
        }
      } else if (typeof field.type === 'object') {
        // Complex type definition - check both switch_on and switch-on
        if (field.type['switch-on'] || field.type.switch_on) {
          this.validateSwitch(field.type, `${path}.type`, errors)
        }
      }
    }

    // Validate size
    if (field.size !== undefined) {
      if (typeof field.size !== 'number' && typeof field.size !== 'string') {
        errors.push(`${path}.size: must be a number or expression`)
      }
    }

    // Validate repeat
    if (field.repeat) {
      const validRepeats = ['eos', 'expr', 'until']
      if (!validRepeats.includes(field.repeat)) {
        errors.push(`${path}.repeat: must be one of ${validRepeats.join(', ')}`)
      }

      if (field.repeat === 'expr' && !field['repeat-expr']) {
        errors.push(`${path}: repeat "expr" requires "repeat-expr"`)
      }

      if (field.repeat === 'until' && !field['repeat-until']) {
        errors.push(`${path}: repeat "until" requires "repeat-until"`)
      }
    }

    // Validate encoding - be more permissive
    if (field.encoding) {
      // Accept common encoding formats - don't be too strict
      const validEncodings = [
        'ASCII', 'UTF-8', 'UTF-16', 'UTF-16LE', 'UTF-16BE', 
        'UTF-32', 'UTF-32LE', 'UTF-32BE',
        'ISO-8859-1', 'iso-8859-1', 'iso8859-1', 'ISO8859-1',
        'Windows-1252', 'windows-1252', 'CP1252', 'cp1252',
        'Shift_JIS', 'shift_jis', 'SJIS', 'sjis',
        'EUC-JP', 'euc-jp', 'GB2312', 'gb2312',
        'Big5', 'big5', 'KOI8-R', 'koi8-r'
      ]
      
      // Normalize the encoding for comparison
      const normalizedEncoding = field.encoding.toLowerCase().replace(/[-_]/g, '')
      
      // Special case for ISO-8859-1 variations (very common)
      if (normalizedEncoding === 'iso88591' || 
          normalizedEncoding === 'latin1' || 
          normalizedEncoding === 'iso88591') {
        return // Valid encoding, no error
      }
      
      // Check against our list
      const isValid = validEncodings.some(enc => 
        enc.toLowerCase().replace(/[-_]/g, '') === normalizedEncoding
      )
      
      if (!isValid) {
        // Don't error on unknown encodings - just warn
        // Many KSY files use custom or rare encodings
        // The parser will handle or error appropriately
        if (this._strictMode) {
          errors.push(`${path}.encoding: uncommon encoding "${field.encoding}" - may not be supported`)
        }
      }
    }
  }

  /**
   * Validate switch type
   * @param {Object} switchType - Switch type definition
   * @param {string} path - Field path
   * @param {Array} errors - Error array
   */
  validateSwitch(switchType, path, errors) {
    // Check for both formats: switch-on (correct) and switch_on (legacy)
    const switchOn = switchType['switch-on'] || switchType.switch_on
    if (!switchOn) {
      errors.push(`${path}: switch type requires "switch-on"`)
    }

    if (!switchType.cases) {
      errors.push(`${path}: switch type requires "cases"`)
    } else if (typeof switchType.cases !== 'object') {
      errors.push(`${path}.cases: must be an object`)
    }
  }

  /**
   * Validate instances section
   * @param {Object} instances - Instances section
   * @param {Array} errors - Error array
   */
  validateInstances(instances, errors) {
    if (typeof instances !== 'object') {
      errors.push('Invalid instances: must be an object')
      return
    }

    Object.entries(instances).forEach(([name, instance]) => {
      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        errors.push(`Invalid instance name "${name}": must follow naming rules`)
      }

      // For instances, the key IS the id, so we don't need an id field
      // Pass a modified version with id set to avoid validation errors
      const instanceWithId = { ...instance, id: name }
      this.validateInstanceField(instanceWithId, `instances.${name}`, errors)
    })
  }
  
  /**
   * Validate instance field (special validation for instances)
   * @param {Object} field - Instance field definition
   * @param {string} path - Field path for error messages
   * @param {Array} errors - Error array to populate
   */
  validateInstanceField(field, path, errors) {
    // Instances don't need an id field (the key is the id)
    // Instances can have various forms:
    // - type-based: has 'type' field
    // - value-based: has 'value' field (calculated/expression)
    // - contents-based: has 'contents' field
    // - pos-based: has 'pos' field (for seeking to position)
    // - size+pos: raw bytes from position
    // An instance just needs to define what it represents
    
    // No validation needed for instance existence - they're all valid
    
    // Validate type if present
    if (field.type) {
      if (typeof field.type === 'string') {
        // Check if it's a built-in type or user type
        if (!this.validTypes.includes(field.type) && !/^[a-z][a-z0-9_]*$/.test(field.type)) {
          errors.push(`${path}.type: invalid type "${field.type}"`)
        }
      } else if (typeof field.type === 'object') {
        // Complex type definition - check both switch_on and switch-on
        if (field.type['switch-on'] || field.type.switch_on) {
          this.validateSwitch(field.type, `${path}.type`, errors)
        }
      }
    }

    // Don't validate size/pos/value - they can be any expression
    // The parser will handle invalid expressions at runtime

    // Validate encoding - be more permissive
    if (field.encoding) {
      // Accept common encoding formats - don't be too strict
      const validEncodings = [
        'ASCII', 'UTF-8', 'UTF-16', 'UTF-16LE', 'UTF-16BE', 
        'UTF-32', 'UTF-32LE', 'UTF-32BE',
        'ISO-8859-1', 'iso-8859-1', 'iso8859-1', 'ISO8859-1',
        'Windows-1252', 'windows-1252', 'CP1252', 'cp1252',
        'Shift_JIS', 'shift_jis', 'SJIS', 'sjis',
        'EUC-JP', 'euc-jp', 'GB2312', 'gb2312',
        'Big5', 'big5', 'KOI8-R', 'koi8-r'
      ]
      
      // Normalize the encoding for comparison
      const normalizedEncoding = field.encoding.toLowerCase().replace(/[-_]/g, '')
      
      // Special case for ISO-8859-1 variations (very common)
      if (normalizedEncoding === 'iso88591' || 
          normalizedEncoding === 'latin1' || 
          normalizedEncoding === 'iso88591') {
        return // Valid encoding, no error
      }
      
      // Check against our list
      const isValid = validEncodings.some(enc => 
        enc.toLowerCase().replace(/[-_]/g, '') === normalizedEncoding
      )
      
      if (!isValid) {
        // Don't error on unknown encodings - just warn
        // Many KSY files use custom or rare encodings
        // The parser will handle or error appropriately
        if (this._strictMode) {
          errors.push(`${path}.encoding: uncommon encoding "${field.encoding}" - may not be supported`)
        }
      }
    }
  }

  /**
   * Validate types section
   * @param {Object} types - Types section
   * @param {Array} errors - Error array
   */
  validateTypes(types, errors) {
    if (typeof types !== 'object') {
      errors.push('Invalid types: must be an object')
      return
    }

    Object.entries(types).forEach(([name, type]) => {
      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        errors.push(`Invalid type name "${name}": must follow naming rules`)
      }

      // Recursively validate type definition
      if (type.seq) {
        this.validateSeq(type.seq, errors)
      }

      if (type.instances) {
        // Use the same instance validation for nested instances
        this.validateInstances(type.instances, errors)
      }
    })
  }

  /**
   * Validate enums section
   * @param {Object} enums - Enums section
   * @param {Array} errors - Error array
   */
  validateEnums(enums, errors) {
    if (typeof enums !== 'object') {
      errors.push('Invalid enums: must be an object')
      return
    }

    Object.entries(enums).forEach(([name, enumDef]) => {
      if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        errors.push(`Invalid enum name "${name}": must follow naming rules`)
      }

      if (typeof enumDef !== 'object') {
        errors.push(`Invalid enum "${name}": must be an object`)
      } else {
        Object.entries(enumDef).forEach(([key, value]) => {
          if (typeof key !== 'string' && typeof key !== 'number') {
            errors.push(`Invalid enum key in "${name}": keys must be strings or numbers`)
          }
        })
      }
    })
  }

  /**
   * Get warnings for valid KSY
   * @param {Object} parsed - Parsed KSY
   * @returns {Array} Warnings
   */
  getWarnings(parsed) {
    const warnings = []

    // Only warn about truly helpful recommendations
    if (parsed?.meta) {
      // Only warn about endian if parsing binary numbers
      if (!parsed.meta.endian && this.hasNumericFields(parsed)) {
        warnings.push('No endian specified - defaulting to little-endian')
      }
    }
    
    // Warn if no structure defined at all
    if (!parsed?.seq && !parsed?.instances && !parsed?.types) {
      warnings.push('No structure defined - file will be treated as raw bytes')
    }

    // Check for very large repeat counts that could cause performance issues
    if (parsed?.seq) {
      parsed.seq.forEach(field => {
        if (field['repeat-expr'] && typeof field['repeat-expr'] === 'number' && field['repeat-expr'] > 100000) {
          warnings.push(`Very large repeat count (${field['repeat-expr']}) in field "${field.id}" may impact performance`)
        }
      })
    }

    return warnings
  }

  /**
   * Check if KSY has numeric fields that need endian specification
   * @param {Object} parsed - Parsed KSY
   * @returns {boolean} Has numeric fields
   */
  hasNumericFields(parsed) {
    const numericTypes = ['u2', 'u4', 'u8', 's2', 's4', 's8', 'f4', 'f8']
    
    // Check seq fields
    if (parsed.seq) {
      for (const field of parsed.seq) {
        if (field.type && numericTypes.some(t => field.type.includes(t))) {
          return true
        }
      }
    }
    
    // Check types
    if (parsed.types) {
      for (const typeDef of Object.values(parsed.types)) {
        if (typeDef.seq) {
          for (const field of typeDef.seq) {
            if (field.type && numericTypes.some(t => field.type.includes(t))) {
              return true
            }
          }
        }
      }
    }
    
    return false
  }

  /**
   * Quick validation without full parsing
   * @param {string} content - KSY content
   * @returns {boolean} Is valid YAML
   */
  quickValidate(content) {
    try {
      yaml.parse(content)
      return true
    } catch {
      return false
    }
  }
}

// Export singleton
let instance = null

export function getKsyValidator() {
  if (!instance) {
    instance = new KsyValidator()
  }
  return instance
}

export default KsyValidator