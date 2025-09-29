/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: SafeStructureParser.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { createLogger } from '../utils/logger.js'

const logger = createLogger('SafeStructureParser')

// Safe structure parser that guarantees no null errors
class SafeStructureParser {
  constructor() {
    this.currentFormat = null
  }

  // Helper to create a valid field structure
  createField(name, value, offset, size, fields = []) {
    return {
      name: name || 'Unknown',
      value: value !== undefined && value !== null ? value : null,
      offset: offset || 0,
      size: size || 0,
      fields: fields || []
    }
  }

  // Helper to create a valid result structure
  createResult(fields = [], offset = 0, size = 0) {
    return {
      fields: fields || [],
      offset: offset || 0,
      size: size || 0
    }
  }

  async initialize() {
    return Promise.resolve()
  }

  detectFormat(fileBytes) {
    if (!fileBytes || fileBytes.length < 4) return null
    
    // PE/DOS MZ
    if (fileBytes[0] === 0x4D && fileBytes[1] === 0x5A) {
      // PE/DOS format detected
      return 'PE'
    }
    
    // ZIP
    if (fileBytes[0] === 0x50 && fileBytes[1] === 0x4B && 
        (fileBytes[2] === 0x03 || fileBytes[2] === 0x05 || fileBytes[2] === 0x07)) {
      // ZIP format detected
      return 'ZIP'
    }
    
    // PNG
    if (fileBytes[0] === 0x89 && fileBytes[1] === 0x50 && 
        fileBytes[2] === 0x4E && fileBytes[3] === 0x47) {
      // PNG format detected
      return 'PNG'
    }
    
    // No known format detected
    return null
  }

  async loadFormat(formatName) {
    this.currentFormat = formatName
    // Format loaded
    return true
  }

  async parseFile(data) {
    if (!data) {
      return this.createResult()
    }

    if (!this.currentFormat) {
      return this.createResult([], 0, data.length)
    }

    try {
      let result = null
      switch (this.currentFormat) {
        case 'PE':
          result = this.parsePE(data)
          break
        case 'ZIP':
          result = this.parseZIP(data)
          break
        case 'PNG':
          result = this.parsePNG(data)
          break
        default:
          result = this.createResult([], 0, data.length)
      }
      return result
    } catch (error) {
      logger.error('Parse error:', error)
      return this.createResult([], 0, data.length)
    }
  }

  async parseViewport(data, startOffset, endOffset) {
    if (!data) {
      return []
    }
    const result = await this.parseFile(data)
    // Ensure we always return a valid array with valid structures
    if (!result || typeof result !== 'object') {
      return []
    }
    // Return the fields array directly as these are the structure items to display
    if (result.fields && Array.isArray(result.fields)) {
      return result.fields
    }
    return []
  }

  parsePE(bytes) {
    if (!bytes || bytes.length < 64) {
      return this.createResult([], 0, bytes ? bytes.length : 0)
    }
    
    // Check MZ signature
    if (bytes[0] !== 0x4D || bytes[1] !== 0x5A) {
      return this.createResult([], 0, bytes.length)
    }
    
    const fields = []
    
    // DOS Header
    const dosHeaderFields = []
    
    dosHeaderFields.push(this.createField(
      'Magic',
      'MZ (0x4D5A)',
      0,
      2
    ))
    
    if (bytes.length >= 4) {
      dosHeaderFields.push(this.createField(
        'Bytes in Last Page',
        bytes[2] | (bytes[3] << 8),
        2,
        2
      ))
    }
    
    if (bytes.length >= 6) {
      dosHeaderFields.push(this.createField(
        'Pages',
        bytes[4] | (bytes[5] << 8),
        4,
        2
      ))
    }
    
    if (bytes.length >= 8) {
      dosHeaderFields.push(this.createField(
        'Relocation Items',
        bytes[6] | (bytes[7] << 8),
        6,
        2
      ))
    }
    
    // PE offset
    let peOffset = 0
    if (bytes.length >= 64) {
      peOffset = bytes[60] | (bytes[61] << 8) | (bytes[62] << 16) | (bytes[63] << 24)
      dosHeaderFields.push(this.createField(
        'PE Header Offset',
        `0x${peOffset.toString(16).toUpperCase().padStart(8, '0')}`,
        60,
        4
      ))
    }
    
    const dosHeader = this.createField(
      'DOS Header',
      null,
      0,
      64,
      dosHeaderFields
    )
    fields.push(dosHeader)
    
    // PE Header (if present and valid)
    if (peOffset > 0 && peOffset < bytes.length - 24 && bytes.length > peOffset + 4) {
      const peSignature = bytes[peOffset] | (bytes[peOffset + 1] << 8) | 
                          (bytes[peOffset + 2] << 16) | (bytes[peOffset + 3] << 24)
      
      if (peSignature === 0x00004550) { // "PE\0\0"
        const peHeaderFields = []
        
        peHeaderFields.push(this.createField(
          'Signature',
          'PE\\0\\0 (0x00004550)',
          peOffset,
          4
        ))
        
        if (bytes.length > peOffset + 6) {
          const machine = bytes[peOffset + 4] | (bytes[peOffset + 5] << 8)
          peHeaderFields.push(this.createField(
            'Machine',
            this.getMachineType(machine),
            peOffset + 4,
            2
          ))
        }
        
        if (bytes.length > peOffset + 8) {
          const numSections = bytes[peOffset + 6] | (bytes[peOffset + 7] << 8)
          peHeaderFields.push(this.createField(
            'Number of Sections',
            numSections,
            peOffset + 6,
            2
          ))
        }
        
        if (bytes.length > peOffset + 12) {
          const timestamp = bytes[peOffset + 8] | (bytes[peOffset + 9] << 8) | 
                           (bytes[peOffset + 10] << 16) | (bytes[peOffset + 11] << 24)
          let dateStr = 'Invalid'
          try {
            if (timestamp > 0 && timestamp < 2147483647) {
              dateStr = new Date(timestamp * 1000).toISOString()
            }
          } catch (e) {
            // Keep as Invalid
          }
          peHeaderFields.push(this.createField(
            'Timestamp',
            dateStr,
            peOffset + 8,
            4
          ))
        }
        
        const peHeader = this.createField(
          'PE Header',
          null,
          peOffset,
          24,
          peHeaderFields
        )
        fields.push(peHeader)
        
        // Optional Header
        if (bytes.length > peOffset + 24) {
          const optHeaderSize = bytes[peOffset + 20] | (bytes[peOffset + 21] << 8)
          if (optHeaderSize > 0 && bytes.length > peOffset + 24 + 2) {
            const optOffset = peOffset + 24
            const magic = bytes[optOffset] | (bytes[optOffset + 1] << 8)
            
            const optHeaderFields = []
            optHeaderFields.push(this.createField(
              'Magic',
              magic === 0x10b ? 'PE32 (0x010B)' : 
              magic === 0x20b ? 'PE32+ (0x020B)' : 
              `Unknown (0x${magic.toString(16).toUpperCase()})`,
              optOffset,
              2
            ))
            
            const optHeader = this.createField(
              'Optional Header',
              null,
              optOffset,
              Math.min(optHeaderSize, 96),
              optHeaderFields
            )
            fields.push(optHeader)
          }
        }
      }
    }
    
    return this.createResult(fields, 0, bytes.length)
  }

  parseZIP(bytes) {
    if (!bytes || bytes.length < 4) {
      return this.createResult([], 0, bytes ? bytes.length : 0)
    }
    
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
      return this.createResult([], 0, bytes.length)
    }
    
    const fields = []
    let offset = 0
    let fileCount = 0
    const maxFiles = 10 // Limit to prevent too many entries
    
    while (offset < bytes.length - 30 && fileCount < maxFiles) {
      if (offset + 4 > bytes.length) break
      
      const sig = bytes[offset] | (bytes[offset + 1] << 8) | 
                 (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
      
      if (sig === 0x04034b50) { // Local file header
        fileCount++
        const entryFields = []
        
        let fileName = `File ${fileCount}`
        let compSize = 0
        let uncompSize = 0
        
        if (offset + 30 <= bytes.length) {
          const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8)
          const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8)
          compSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | 
                    (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24)
          uncompSize = bytes[offset + 22] | (bytes[offset + 23] << 8) | 
                      (bytes[offset + 24] << 16) | (bytes[offset + 25] << 24)
          
          if (nameLen > 0 && offset + 30 + nameLen <= bytes.length) {
            try {
              const nameBytes = bytes.slice(offset + 30, offset + 30 + Math.min(nameLen, 256))
              fileName = String.fromCharCode.apply(null, Array.from(nameBytes))
            } catch (e) {
              // Keep default name
            }
          }
          
          entryFields.push(this.createField(
            'Compressed Size',
            compSize,
            offset + 18,
            4
          ))
          
          entryFields.push(this.createField(
            'Uncompressed Size',
            uncompSize,
            offset + 22,
            4
          ))
          
          const entrySize = 30 + nameLen + extraLen + compSize
          const entry = this.createField(
            fileName,
            null,
            offset,
            Math.min(entrySize, bytes.length - offset),
            entryFields
          )
          fields.push(entry)
          
          offset += entrySize
        } else {
          offset += 4
        }
      } else if (sig === 0x02014b50) { // Central directory
        break
      } else {
        offset++
        if (offset > bytes.length / 2) break // Prevent infinite loop
      }
    }
    
    return this.createResult(fields, 0, bytes.length)
  }

  parsePNG(bytes) {
    if (!bytes || bytes.length < 8) {
      return this.createResult([], 0, bytes ? bytes.length : 0)
    }
    
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50) {
      return this.createResult([], 0, bytes.length)
    }
    
    const fields = []
    
    fields.push(this.createField(
      'PNG Signature',
      '89 50 4E 47 0D 0A 1A 0A',
      0,
      8
    ))
    
    let offset = 8
    let chunkCount = 0
    const maxChunks = 20
    
    while (offset < bytes.length - 12 && chunkCount < maxChunks) {
      if (offset + 8 > bytes.length) break
      
      const chunkSize = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | 
                       (bytes[offset + 2] << 8) | bytes[offset + 3]
      
      let chunkType = 'Unknown'
      try {
        chunkType = String.fromCharCode(
          bytes[offset + 4], bytes[offset + 5], 
          bytes[offset + 6], bytes[offset + 7]
        )
      } catch (e) {
        // Keep as Unknown
      }
      
      const chunkFields = []
      chunkFields.push(this.createField(
        'Length',
        chunkSize,
        offset,
        4
      ))
      
      chunkFields.push(this.createField(
        'Type',
        chunkType,
        offset + 4,
        4
      ))
      
      if (chunkType === 'IHDR' && bytes.length >= offset + 12 + 13) {
        const width = (bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | 
                     (bytes[offset + 10] << 8) | bytes[offset + 11]
        const height = (bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | 
                      (bytes[offset + 14] << 8) | bytes[offset + 15]
        
        chunkFields.push(this.createField(
          'Width',
          width,
          offset + 8,
          4
        ))
        
        chunkFields.push(this.createField(
          'Height',
          height,
          offset + 12,
          4
        ))
      }
      
      const chunk = this.createField(
        `${chunkType} Chunk`,
        null,
        offset,
        12 + chunkSize,
        chunkFields
      )
      fields.push(chunk)
      
      offset += 12 + chunkSize
      chunkCount++
      
      if (chunkType === 'IEND') break
    }
    
    return this.createResult(fields, 0, bytes.length)
  }

  getMachineType(machine) {
    const types = {
      0x014c: 'x86 (0x014C)',
      0x8664: 'x64 (0x8664)',
      0x01c0: 'ARM (0x01C0)',
      0xaa64: 'ARM64 (0xAA64)',
      0x01c4: 'ARMv7 (0x01C4)'
    }
    return types[machine] || `Unknown (0x${machine.toString(16).toUpperCase().padStart(4, '0')})`
  }

  clearCache() {
    // No cache needed
  }

  destroy() {
    // Nothing to clean up
  }
}

// Export singleton
let instance = null

export function getSafeStructureParser() {
  if (!instance) {
    instance = new SafeStructureParser()
  }
  return instance
}

export default SafeStructureParser