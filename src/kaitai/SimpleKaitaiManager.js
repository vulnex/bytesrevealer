/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: SimpleKaitaiManager.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

// Simplified Kaitai Manager without Web Workers
class SimpleKaitaiManager {
  constructor() {
    this.currentFormat = null
    this.isReady = true // Always ready since no worker
  }

  async initialize() {
    // No initialization needed
    return Promise.resolve()
  }

  detectFormat(fileBytes) {
    if (!fileBytes || fileBytes.length < 4) return null
    
    // Check for common file signatures
    if (fileBytes[0] === 0x4D && fileBytes[1] === 0x5A) {
      return 'PE'
    }
    if (fileBytes[0] === 0x50 && fileBytes[1] === 0x4B) {
      return 'ZIP'
    }
    if (fileBytes[0] === 0x89 && fileBytes[1] === 0x50 && 
        fileBytes[2] === 0x4E && fileBytes[3] === 0x47) {
      return 'PNG'
    }
    
    return null
  }

  async loadFormat(formatName) {
    this.currentFormat = formatName
    return true
  }

  async parseFile(data) {
    if (!this.currentFormat) {
      return { fields: [], offset: 0, size: data.length }
    }

    switch (this.currentFormat) {
      case 'PE':
        return this.parsePE(data)
      case 'ZIP':
        return this.parseZIP(data)
      case 'PNG':
        return this.parsePNG(data)
      default:
        return { fields: [], offset: 0, size: data.length }
    }
  }

  async parseViewport(data, startOffset, endOffset) {
    // For simplicity, just parse the whole file once
    const result = await this.parseFile(data)
    // Ensure we always return an array with valid structure
    if (!result || !result.fields) {
      return [{
        fields: [],
        offset: 0,
        size: data ? data.length : 0
      }]
    }
    return [result]
  }

  parsePE(bytes) {
    const result = {
      fields: [],
      offset: 0,
      size: bytes.length
    }
    
    if (!bytes || bytes.length < 64) return result
    
    // Check MZ signature
    if (bytes[0] !== 0x4D || bytes[1] !== 0x5A) return result
    
    // DOS Header
    const dosHeader = {
      name: 'DOS Header',
      value: null,
      offset: 0,
      size: 64,
      fields: [
        {
          name: 'Magic',
          value: 'MZ (0x4D5A)',
          offset: 0,
          size: 2,
          fields: []
        },
        {
          name: 'Bytes in Last Page',
          value: bytes[2] | (bytes[3] << 8),
          offset: 2,
          size: 2,
          fields: []
        },
        {
          name: 'Pages',
          value: bytes[4] | (bytes[5] << 8),
          offset: 4,
          size: 2,
          fields: []
        },
        {
          name: 'Relocation Items',
          value: bytes[6] | (bytes[7] << 8),
          offset: 6,
          size: 2,
          fields: []
        },
        {
          name: 'Header Size (paragraphs)',
          value: bytes[8] | (bytes[9] << 8),
          offset: 8,
          size: 2,
          fields: []
        }
      ]
    }
    
    // Get PE offset
    if (bytes.length >= 64) {
      const peOffset = bytes[60] | (bytes[61] << 8) | (bytes[62] << 16) | (bytes[63] << 24)
      dosHeader.fields.push({
        name: 'PE Header Offset',
        value: `0x${peOffset.toString(16).toUpperCase().padStart(8, '0')}`,
        offset: 60,
        size: 4
      })
      
      // Check PE signature
      if (bytes.length > peOffset + 24 && peOffset > 0 && peOffset < bytes.length - 4) {
        const peSignature = bytes[peOffset] | (bytes[peOffset + 1] << 8) | 
                            (bytes[peOffset + 2] << 16) | (bytes[peOffset + 3] << 24)
        
        if (peSignature === 0x00004550) { // "PE\0\0"
          const peHeader = {
            name: 'PE Header',
            value: null,
            offset: peOffset,
            size: 24,
            fields: [
              {
                name: 'Signature',
                value: 'PE\\0\\0 (0x00004550)',
                offset: peOffset,
                size: 4
              }
            ]
          }
          
          // COFF Header fields
          const machine = bytes[peOffset + 4] | (bytes[peOffset + 5] << 8)
          const numSections = bytes[peOffset + 6] | (bytes[peOffset + 7] << 8)
          const timestamp = bytes[peOffset + 8] | (bytes[peOffset + 9] << 8) | 
                           (bytes[peOffset + 10] << 16) | (bytes[peOffset + 11] << 24)
          const symTablePtr = bytes[peOffset + 12] | (bytes[peOffset + 13] << 8) | 
                             (bytes[peOffset + 14] << 16) | (bytes[peOffset + 15] << 24)
          const numSymbols = bytes[peOffset + 16] | (bytes[peOffset + 17] << 8) | 
                            (bytes[peOffset + 18] << 16) | (bytes[peOffset + 19] << 24)
          const optHeaderSize = bytes[peOffset + 20] | (bytes[peOffset + 21] << 8)
          const characteristics = bytes[peOffset + 22] | (bytes[peOffset + 23] << 8)
          
          peHeader.fields.push({
            name: 'Machine',
            value: this.getMachineType(machine),
            offset: peOffset + 4,
            size: 2
          })
          
          peHeader.fields.push({
            name: 'Number of Sections',
            value: numSections,
            offset: peOffset + 6,
            size: 2
          })
          
          peHeader.fields.push({
            name: 'Timestamp',
            value: timestamp ? new Date(timestamp * 1000).toISOString() : 'Invalid',
            offset: peOffset + 8,
            size: 4
          })
          
          peHeader.fields.push({
            name: 'Optional Header Size',
            value: optHeaderSize,
            offset: peOffset + 20,
            size: 2
          })
          
          peHeader.fields.push({
            name: 'Characteristics',
            value: `0x${characteristics.toString(16).toUpperCase().padStart(4, '0')}`,
            offset: peOffset + 22,
            size: 2
          })
          
          result.fields.push(peHeader)
          
          // Optional Header
          if (optHeaderSize > 0 && bytes.length > peOffset + 24 + optHeaderSize) {
            const optOffset = peOffset + 24
            const magic = bytes[optOffset] | (bytes[optOffset + 1] << 8)
            
            const optHeader = {
              name: 'Optional Header',
              value: null,
              offset: optOffset,
              size: optHeaderSize,
              fields: [
                {
                  name: 'Magic',
                  value: magic === 0x10b ? 'PE32 (0x010B)' : 
                         magic === 0x20b ? 'PE32+ (0x020B)' : 
                         `Unknown (0x${magic.toString(16).toUpperCase()})`,
                  offset: optOffset,
                  size: 2
                }
              ]
            }
            
            if (bytes.length > optOffset + 28) {
              const entryPoint = bytes[optOffset + 16] | (bytes[optOffset + 17] << 8) | 
                                (bytes[optOffset + 18] << 16) | (bytes[optOffset + 19] << 24)
              const imageBase = bytes[optOffset + 28] | (bytes[optOffset + 29] << 8) | 
                               (bytes[optOffset + 30] << 16) | (bytes[optOffset + 31] << 24)
              
              optHeader.fields.push({
                name: 'Entry Point',
                value: `0x${entryPoint.toString(16).toUpperCase().padStart(8, '0')}`,
                offset: optOffset + 16,
                size: 4
              })
              
              optHeader.fields.push({
                name: 'Image Base',
                value: `0x${imageBase.toString(16).toUpperCase().padStart(8, '0')}`,
                offset: optOffset + 28,
                size: 4
              })
            }
            
            result.fields.push(optHeader)
          }
        }
      }
    }
    
    result.fields.unshift(dosHeader)
    return result
  }

  parseZIP(bytes) {
    const result = {
      fields: [],
      offset: 0,
      size: bytes.length
    }
    
    if (!bytes || bytes.length < 4) return result
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) return result
    
    let offset = 0
    let fileCount = 0
    
    while (offset < bytes.length - 30 && fileCount < 20) {
      const sig = bytes[offset] | (bytes[offset + 1] << 8) | 
                 (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
      
      if (sig === 0x04034b50) { // Local file header
        fileCount++
        const entry = {
          name: `File Entry ${fileCount}`,
          value: null,
          offset: offset,
          size: 30,
          fields: []
        }
        
        const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8)
        const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8)
        const compSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | 
                        (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24)
        const uncompSize = bytes[offset + 22] | (bytes[offset + 23] << 8) | 
                          (bytes[offset + 24] << 16) | (bytes[offset + 25] << 24)
        
        if (nameLen > 0 && bytes.length > offset + 30 + nameLen) {
          const nameBytes = bytes.slice(offset + 30, Math.min(offset + 30 + nameLen, bytes.length))
          let fileName = ''
          for (let i = 0; i < nameBytes.length; i++) {
            fileName += String.fromCharCode(nameBytes[i])
          }
          entry.name = fileName || `File Entry ${fileCount}`
        }
        
        entry.fields.push({
          name: 'Compressed Size',
          value: compSize,
          offset: offset + 18,
          size: 4
        })
        
        entry.fields.push({
          name: 'Uncompressed Size',
          value: uncompSize,
          offset: offset + 22,
          size: 4
        })
        
        entry.size = 30 + nameLen + extraLen + compSize
        result.fields.push(entry)
        
        offset += entry.size
      } else if (sig === 0x02014b50) { // Central directory
        break
      } else {
        offset++
      }
    }
    
    return result
  }

  parsePNG(bytes) {
    const result = {
      fields: [],
      offset: 0,
      size: bytes.length
    }
    
    if (!bytes || bytes.length < 8) return result
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return result
    
    result.fields.push({
      name: 'PNG Signature',
      value: '89 50 4E 47 0D 0A 1A 0A',
      offset: 0,
      size: 8
    })
    
    let offset = 8
    let chunkCount = 0
    
    while (offset < bytes.length - 12 && chunkCount < 20) {
      const chunkSize = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | 
                       (bytes[offset + 2] << 8) | bytes[offset + 3]
      const chunkType = String.fromCharCode(
        bytes[offset + 4], bytes[offset + 5], 
        bytes[offset + 6], bytes[offset + 7]
      )
      
      const chunk = {
        name: `${chunkType} Chunk`,
        value: null,
        offset: offset,
        size: 12 + chunkSize,
        fields: [
          {
            name: 'Length',
            value: chunkSize,
            offset: offset,
            size: 4
          },
          {
            name: 'Type',
            value: chunkType,
            offset: offset + 4,
            size: 4
          }
        ]
      }
      
      if (chunkType === 'IHDR' && bytes.length >= offset + 12 + 13) {
        const width = (bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | 
                     (bytes[offset + 10] << 8) | bytes[offset + 11]
        const height = (bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | 
                      (bytes[offset + 14] << 8) | bytes[offset + 15]
        const bitDepth = bytes[offset + 16]
        const colorType = bytes[offset + 17]
        
        chunk.fields.push({
          name: 'Width',
          value: width,
          offset: offset + 8,
          size: 4
        })
        
        chunk.fields.push({
          name: 'Height',
          value: height,
          offset: offset + 12,
          size: 4
        })
        
        chunk.fields.push({
          name: 'Bit Depth',
          value: bitDepth,
          offset: offset + 16,
          size: 1
        })
        
        chunk.fields.push({
          name: 'Color Type',
          value: this.getColorType(colorType),
          offset: offset + 17,
          size: 1
        })
      }
      
      result.fields.push(chunk)
      offset += 12 + chunkSize
      chunkCount++
      
      if (chunkType === 'IEND') break
    }
    
    return result
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

  getColorType(type) {
    const types = {
      0: 'Grayscale',
      2: 'RGB',
      3: 'Palette',
      4: 'Grayscale + Alpha',
      6: 'RGBA'
    }
    return types[type] || `Unknown (${type})`
  }

  clearCache() {
    // No cache in simple implementation
  }

  destroy() {
    // Nothing to clean up
  }
}

// Export singleton
let instance = null

export function getSimpleKaitaiManager() {
  if (!instance) {
    instance = new SimpleKaitaiManager()
  }
  return instance
}

export default SimpleKaitaiManager