/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: FormatRegistry.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { getKsyManager } from '../ksy/KsyManager.js'
import { getKsyCompiler } from '../ksy/KsyCompiler.js'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('FormatRegistry')

/**
 * Registry for managing available binary formats
 * Handles format registration, detection, and retrieval
 */
class FormatRegistry {
  constructor() {
    this.formats = new Map()
    this.signatures = new Map()
    this.extensions = new Map()
    this.manager = null
    this.compiler = null
    this.initialized = false
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    // If already initialized and has formats, just ensure managers are ready
    if (this.initialized && this.formats.size > 0) {
      logger.debug(`Already initialized with ${this.formats.size} formats, keeping existing...`)
      
      // Ensure manager and compiler are initialized
      if (!this.manager) {
        this.manager = getKsyManager()
      }
      if (!this.compiler) {
        this.compiler = getKsyCompiler()
      }
      
      return
    }

    logger.debug('Initializing...')
    try {
      // Initialize manager and compiler
      this.manager = getKsyManager()
      this.compiler = getKsyCompiler()
      
      if (!this.manager || !this.compiler) {
        throw new Error('Failed to initialize KSY manager or compiler')
      }

      // Only clear if this is truly the first initialization
      if (!this.initialized && this.formats.size === 0) {
        this.formats.clear()
        this.signatures.clear()
        this.extensions.clear()
      }

      // Load all stored formats
      const storedFormats = await this.manager.getAll()
      logger.debug(`Loading ${storedFormats.length} stored formats`)
    
    for (const format of storedFormats) {
      try {
        await this.registerFormat(format)
      } catch (error) {
        logger.warn(`Failed to register format ${format.name}:`, error)
      }
    }

      // Load built-in formats only if we don't have them yet
      if (this.formats.size === 0 || !this.initialized) {
        await this.loadBuiltinFormats()
      }

      this.initialized = true
      logger.debug(`Initialization complete. Total formats: ${this.formats.size}`)
    } catch (error) {
      logger.error('Failed to initialize FormatRegistry:', error)
      // Don't set initialized to false if we already have formats
      if (this.formats.size === 0) {
        this.initialized = false
        // Try loading fallback formats even if initialization failed
        this.loadFallbackFormats()
      }
    }
  }

  /**
   * Register a format
   * @param {Object} formatData - Format data including KSY content
   * @returns {string} Format ID
   */
  async registerFormat(formatData) {
    // Check if parser is already provided
    let parser = formatData.parser || null

    // Only compile if we don't have a parser but have content
    if (!parser && formatData.content) {
      try {
        parser = await this.compiler.compile(formatData.content)
        // Only update if compilation succeeded
        if (parser) {
          // Don't try to serialize the parser - it's a complex function/class
          // Just mark that we have compiled it
          await this.manager.update(formatData.id, {
            compiled: true  // Mark as compiled without serializing
          })
        }
      } catch (error) {
        logger.warn(`Failed to compile format ${formatData.name}:`, error)
        // Continue without parser - will use fallback
      }
    }

    const format = {
      id: formatData.id,
      name: formatData.name,
      parser,
      metadata: formatData.metadata || {},
      category: formatData.category || 'user'
    }

    // Register format
    this.formats.set(format.id, format)
    logger.debug(`Registered format ${format.id} with parser: ${!!format.parser}`)

    // Register signatures if available
    if (formatData.metadata?.signature) {
      this.registerSignature(format.id, formatData.metadata.signature)
    }

    // Register file extensions
    if (formatData.metadata?.fileExtension) {
      const extensions = Array.isArray(formatData.metadata.fileExtension) 
        ? formatData.metadata.fileExtension 
        : [formatData.metadata.fileExtension]
      
      extensions.forEach(ext => {
        if (!this.extensions.has(ext)) {
          this.extensions.set(ext, [])
        }
        this.extensions.get(ext).push(format.id)
      })
    }

    return format.id
  }

  /**
   * Register a signature for format detection
   * @param {string} formatId - Format ID
   * @param {Object} signature - Signature definition
   */
  registerSignature(formatId, signature) {
    const sig = {
      formatId,
      offset: signature.offset || 0,
      bytes: signature.bytes || [],
      mask: signature.mask || null
    }

    // Convert hex strings to byte arrays
    if (typeof sig.bytes === 'string') {
      sig.bytes = this.hexToBytes(sig.bytes)
    }
    if (typeof sig.mask === 'string') {
      sig.mask = this.hexToBytes(sig.mask)
    }

    // Group signatures by first byte for faster lookup
    const firstByte = sig.bytes[0]
    if (!this.signatures.has(firstByte)) {
      this.signatures.set(firstByte, [])
    }
    this.signatures.get(firstByte).push(sig)
  }

  /**
   * Detect format from file bytes
   * @param {Uint8Array} bytes - File bytes
   * @param {string} fileName - Optional file name for extension matching
   * @returns {Object|null} Detected format or null
   */
  async detectFormat(bytes, fileName = null) {
    // Ensure registry is initialized
    if (!this.initialized) {
      await this.initialize()
    }

    // Validate input
    if (!bytes || bytes.length === 0) {
      return null
    }

    try {
      // For large files, only use first 64KB for signature detection
      const MAX_DETECTION_SIZE = 65536 // 64KB
      const detectionBytes = bytes.length > MAX_DETECTION_SIZE 
        ? bytes.slice(0, MAX_DETECTION_SIZE)
        : bytes
      
      // Try signature-based detection first
      const signatureMatch = this.detectBySignature(detectionBytes)
      if (signatureMatch) {
        const format = this.formats.get(signatureMatch)
        if (format) {
          logger.debug(`Detected format by signature: ${format.name || signatureMatch}`)
          return format
        }
      }

      // Try extension-based detection
      if (fileName) {
        const extensionMatch = this.detectByExtension(fileName)
        if (extensionMatch) {
          const format = this.formats.get(extensionMatch)
          if (format) {
            logger.debug(`Detected format by extension: ${format.name || extensionMatch}`)
            return format
          }
        }
      }
    } catch (error) {
      logger.warn('Error in format detection:', error)
    }

    // Try heuristic detection (using limited bytes for performance)
    const heuristicMatch = this.detectByHeuristics(detectionBytes)
    if (heuristicMatch) {
      const format = this.formats.get(heuristicMatch)
      if (format) {
        logger.debug(`Detected format by heuristics: ${format.name || heuristicMatch}`)
        return format
      }
    }

    return null
  }

  /**
   * Detect format by signature
   * @param {Uint8Array} bytes - File bytes
   * @returns {string|null} Format ID or null
   */
  detectBySignature(bytes) {
    if (!bytes || bytes.length === 0) return null

    // Check signatures that start with the first byte
    const firstByte = bytes[0]
    const candidates = this.signatures.get(firstByte) || []

    for (const sig of candidates) {
      if (this.matchesSignature(bytes, sig)) {
        return sig.formatId
      }
    }

    // Check signatures with wildcard first byte (0xFF in mask)
    const wildcardCandidates = this.signatures.get(0xFF) || []
    for (const sig of wildcardCandidates) {
      if (this.matchesSignature(bytes, sig)) {
        return sig.formatId
      }
    }

    return null
  }

  /**
   * Check if bytes match signature
   * @param {Uint8Array} bytes - File bytes
   * @param {Object} signature - Signature to match
   * @returns {boolean} Matches
   */
  matchesSignature(bytes, signature) {
    const offset = signature.offset || 0
    const sigBytes = signature.bytes
    const mask = signature.mask

    if (bytes.length < offset + sigBytes.length) {
      return false
    }

    for (let i = 0; i < sigBytes.length; i++) {
      const fileByte = bytes[offset + i]
      const sigByte = sigBytes[i]
      
      if (mask && mask[i] !== undefined) {
        // Apply mask
        if ((fileByte & mask[i]) !== (sigByte & mask[i])) {
          return false
        }
      } else {
        // Direct comparison
        if (fileByte !== sigByte) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Detect format by file extension
   * @param {string} fileName - File name
   * @returns {string|null} Format ID or null
   */
  detectByExtension(fileName) {
    const ext = fileName.split('.').pop().toLowerCase()
    const formatIds = this.extensions.get(ext)
    
    if (formatIds && formatIds.length > 0) {
      // Return first matching format
      // Could be enhanced to return best match based on additional criteria
      return formatIds[0]
    }

    return null
  }

  /**
   * Detect format using heuristics
   * @param {Uint8Array} bytes - File bytes
   * @returns {string|null} Format ID or null
   */
  detectByHeuristics(bytes) {
    // Basic heuristics for common formats
    
    // PE/DOS executable
    if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
      const peFormat = Array.from(this.formats.values()).find(f => 
        f.name.toLowerCase().includes('pe') || f.name.toLowerCase().includes('dos')
      )
      if (peFormat) return peFormat.id
    }

    // ZIP
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && 
        (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
      const zipFormat = Array.from(this.formats.values()).find(f => 
        f.name.toLowerCase().includes('zip')
      )
      if (zipFormat) return zipFormat.id
    }

    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && 
        bytes[2] === 0x4E && bytes[3] === 0x47) {
      const pngFormat = Array.from(this.formats.values()).find(f => 
        f.name.toLowerCase().includes('png')
      )
      if (pngFormat) return pngFormat.id
    }

    return null
  }

  /**
   * Get format by ID
   * @param {string} formatId - Format ID
   * @returns {Object|null} Format or null
   */
  getFormat(formatId) {
    return this.formats.get(formatId) || null
  }

  /**
   * Get format by ID and compile if needed
   * @param {string} formatId - Format ID
   * @returns {Object|null} Format with parser or null
   */
  async getCompiledFormat(formatId) {
    const format = this.formats.get(formatId)
    if (!format) return null

    // If format needs compilation, compile it now
    if (format.metadata?.needsCompilation && !format.parser) {
      try {
        logger.debug(`Compiling format on-demand: ${format.name}`)
        const parser = await this.compiler.compile(format.metadata.content)
        
        if (parser) {
          logger.debug(`✅ Compilation successful for ${format.name}`)
          // Update the format with the compiled parser
          format.parser = parser
          format.metadata.needsCompilation = false
          delete format.metadata.content // Free up memory
        } else {
          logger.warn(`❌ Failed to compile format ${format.name} - parser is null/undefined`)
        }
      } catch (error) {
        logger.warn(`❌ Error compiling format ${format.name}:`, error)
      }
    }

    return format
  }

  /**
   * Get all formats
   * @param {Object} filter - Optional filter
   * @returns {Array} List of formats
   */
  getAllFormats(filter = {}) {
    let formats = Array.from(this.formats.values())

    if (filter.category) {
      formats = formats.filter(f => f.category === filter.category)
    }

    if (filter.name) {
      const searchTerm = filter.name.toLowerCase()
      formats = formats.filter(f => 
        f.name.toLowerCase().includes(searchTerm)
      )
    }

    return formats
  }

  /**
   * Remove format from registry
   * @param {string} formatId - Format ID
   * @returns {boolean} Success
   */
  async removeFormat(formatId) {
    const format = this.formats.get(formatId)
    if (!format) return false

    // Remove from formats map
    this.formats.delete(formatId)

    // Remove from signatures
    for (const [key, sigs] of this.signatures.entries()) {
      const filtered = sigs.filter(s => s.formatId !== formatId)
      if (filtered.length === 0) {
        this.signatures.delete(key)
      } else {
        this.signatures.set(key, filtered)
      }
    }

    // Remove from extensions
    for (const [ext, ids] of this.extensions.entries()) {
      const filtered = ids.filter(id => id !== formatId)
      if (filtered.length === 0) {
        this.extensions.delete(ext)
      } else {
        this.extensions.set(ext, filtered)
      }
    }

    // Remove from storage
    await this.manager.delete(formatId)

    return true
  }

  /**
   * Load built-in formats
   */
  async loadBuiltinFormats() {
    try {
      // Import preset formats
      const { getPresetFormats, builtinPresets } = await import('../ksy/presets/index.js')
      const presets = await getPresetFormats() // Now async!
      
      // Load built-in presets first (these are small and reliable)
      for (const preset of builtinPresets || []) {
        try {
          const parser = await this.compiler.compile(preset.content)
          
          if (parser) {
            this.formats.set(preset.id, {
              id: preset.id,
              name: preset.name,
              category: preset.category,
              parser: parser,
              metadata: preset.metadata
            })
            
            if (preset.metadata?.signature) {
              this.registerSignature(preset.id, preset.metadata.signature)
            }
            
            if (preset.metadata?.fileExtensions) {
              preset.metadata.fileExtensions.forEach(ext => {
                if (!this.extensions.has(ext)) {
                  this.extensions.set(ext, [])
                }
                this.extensions.get(ext).push(preset.id)
              })
            }
          }
        } catch (error) {
          logger.warn(`Error loading built-in preset ${preset.name}:`, error)
        }
      }
      
      // Register all generated formats without compiling (compile on-demand)
      const allPresets = presets || []
      for (const preset of allPresets) {
        if (!preset.metadata?.isPreset) {
          // This is a generated format - register without compiling
          this.formats.set(preset.id, {
            id: preset.id,
            name: preset.name,
            category: preset.category,
            parser: null, // Will be compiled on-demand
            metadata: {
              ...preset.metadata,
              content: preset.content, // Store content for lazy compilation
              needsCompilation: true
            }
          })
          
          // Register signature for detection
          if (preset.metadata?.signature) {
            this.registerSignature(preset.id, preset.metadata.signature)
          }
          
          // Register file extensions
          if (preset.metadata?.fileExtensions) {
            preset.metadata.fileExtensions.forEach(ext => {
              if (!this.extensions.has(ext)) {
                this.extensions.set(ext, [])
              }
              this.extensions.get(ext).push(preset.id)
            })
          }
        }
      }
      
      logger.debug(`Loaded ${this.formats.size} formats (${builtinPresets?.length || 0} compiled, ${allPresets.length - (builtinPresets?.length || 0)} on-demand)`)
      
    } catch (error) {
      logger.error('Failed to load preset formats:', error)
      // Fall back to basic formats without compilation
      this.loadFallbackFormats()
    }
  }
  
  /**
   * Load fallback formats when KSY compilation fails
   */
  loadFallbackFormats() {
    const fallbackFormats = [
      {
        id: 'fallback_pe',
        name: 'PE/DOS Executable',
        category: 'system',
        parser: null,
        metadata: {
          signature: { offset: 0, bytes: [0x4D, 0x5A] },
          fileExtension: ['exe', 'dll', 'sys']
        }
      },
      {
        id: 'fallback_zip',
        name: 'ZIP Archive',
        category: 'system',
        parser: null,
        metadata: {
          signature: { offset: 0, bytes: [0x50, 0x4B] },
          fileExtension: ['zip', 'jar', 'apk']
        }
      },
      {
        id: 'fallback_png',
        name: 'PNG Image',
        category: 'system',
        parser: null,
        metadata: {
          signature: { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
          fileExtension: ['png']
        }
      }
    ]
    
    for (const format of fallbackFormats) {
      this.formats.set(format.id, format)
      
      if (format.metadata?.signature) {
        this.registerSignature(format.id, format.metadata.signature)
      }
      
      if (format.metadata?.fileExtension) {
        const extensions = Array.isArray(format.metadata.fileExtension)
          ? format.metadata.fileExtension
          : [format.metadata.fileExtension]
        
        extensions.forEach(ext => {
          if (!this.extensions.has(ext)) {
            this.extensions.set(ext, [])
          }
          this.extensions.get(ext).push(format.id)
        })
      }
    }
  }

  /**
   * Convert hex string to byte array
   * @param {string} hex - Hex string
   * @returns {Array} Byte array
   */
  hexToBytes(hex) {
    const bytes = []
    const cleanHex = hex.replace(/\s/g, '').replace(/^0x/i, '')
    
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16))
    }
    
    return bytes
  }

  /**
   * Get registry statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalFormats: this.formats.size,
      totalSignatures: Array.from(this.signatures.values()).flat().length,
      totalExtensions: this.extensions.size,
      categories: {
        system: Array.from(this.formats.values()).filter(f => f.category === 'system').length,
        user: Array.from(this.formats.values()).filter(f => f.category === 'user').length,
        community: Array.from(this.formats.values()).filter(f => f.category === 'community').length
      }
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    logger.warn('destroy() called - this will clear all formats!')
    this.formats.clear()
    this.signatures.clear()
    this.extensions.clear()
    this.initialized = false
    
    if (this.manager) {
      await this.manager.destroy()
    }
    
    if (this.compiler) {
      this.compiler.destroy()
    }
  }
}

// Export singleton
let instance = null

export function getFormatRegistry() {
  if (!instance) {
    instance = new FormatRegistry()
  }
  return instance
}

export default FormatRegistry