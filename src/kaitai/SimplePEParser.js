/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: SimplePEParser.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

// Simple PE parser that works without external dependencies
export function parsePE(bytes) {
  const result = {
    fields: [],
    offset: 0,
    size: bytes.length
  }
  
  if (!bytes || bytes.length < 64) {
    return result
  }
  
  // Check MZ signature
  if (bytes[0] !== 0x4D || bytes[1] !== 0x5A) {
    return result
  }
  
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
        size: 2
      },
      {
        name: 'Bytes in Last Page',
        value: bytes[2] | (bytes[3] << 8),
        offset: 2,
        size: 2
      },
      {
        name: 'Pages',
        value: bytes[4] | (bytes[5] << 8),
        offset: 4,
        size: 2
      }
    ]
  }
  
  // Get PE offset
  if (bytes.length >= 64) {
    const peOffset = bytes[60] | (bytes[61] << 8) | (bytes[62] << 16) | (bytes[63] << 24)
    dosHeader.fields.push({
      name: 'PE Header Offset',
      value: `0x${peOffset.toString(16).toUpperCase()}`,
      offset: 60,
      size: 4
    })
    
    // Check PE signature
    if (bytes.length > peOffset + 4) {
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
              value: 'PE (0x00004550)',
              offset: peOffset,
              size: 4
            }
          ]
        }
        
        if (bytes.length > peOffset + 24) {
          // COFF Header
          const machine = bytes[peOffset + 4] | (bytes[peOffset + 5] << 8)
          const numSections = bytes[peOffset + 6] | (bytes[peOffset + 7] << 8)
          const timestamp = bytes[peOffset + 8] | (bytes[peOffset + 9] << 8) | 
                           (bytes[peOffset + 10] << 16) | (bytes[peOffset + 11] << 24)
          
          peHeader.fields.push({
            name: 'Machine',
            value: getMachineType(machine),
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
            value: new Date(timestamp * 1000).toISOString(),
            offset: peOffset + 8,
            size: 4
          })
        }
        
        result.fields.push(peHeader)
      }
    }
  }
  
  result.fields.unshift(dosHeader)
  
  return result
}

function getMachineType(machine) {
  const types = {
    0x014c: 'x86 (0x014C)',
    0x8664: 'x64 (0x8664)',
    0x01c0: 'ARM (0x01C0)',
    0xaa64: 'ARM64 (0xAA64)',
    0x01c4: 'ARMv7 (0x01C4)'
  }
  return types[machine] || `Unknown (0x${machine.toString(16).toUpperCase()})`
}

// Simple ZIP parser
export function parseZIP(bytes) {
  const result = {
    fields: [],
    offset: 0,
    size: bytes.length
  }
  
  if (!bytes || bytes.length < 4) {
    return result
  }
  
  // Check ZIP signature
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
    return result
  }
  
  let offset = 0
  let fileCount = 0
  
  while (offset < bytes.length - 4) {
    const signature = bytes[offset] | (bytes[offset + 1] << 8) | 
                     (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
    
    if (signature === 0x04034b50) { // Local file header
      fileCount++
      const fileEntry = {
        name: `File Entry ${fileCount}`,
        value: null,
        offset: offset,
        size: 30, // Min header size
        fields: []
      }
      
      if (bytes.length > offset + 30) {
        const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8)
        const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8)
        
        // Read filename
        if (bytes.length > offset + 30 + nameLen) {
          const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen)
          const fileName = String.fromCharCode(...nameBytes)
          fileEntry.name = fileName
          fileEntry.fields.push({
            name: 'Filename',
            value: fileName,
            offset: offset + 30,
            size: nameLen
          })
        }
        
        const compSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | 
                         (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24)
        const uncompSize = bytes[offset + 22] | (bytes[offset + 23] << 8) | 
                          (bytes[offset + 24] << 16) | (bytes[offset + 25] << 24)
        
        fileEntry.fields.push({
          name: 'Compressed Size',
          value: compSize,
          offset: offset + 18,
          size: 4
        })
        
        fileEntry.fields.push({
          name: 'Uncompressed Size',
          value: uncompSize,
          offset: offset + 22,
          size: 4
        })
        
        // Update size and skip to next entry
        fileEntry.size = 30 + nameLen + extraLen + compSize
        offset += fileEntry.size
      } else {
        offset += 4
      }
      
      result.fields.push(fileEntry)
      
    } else if (signature === 0x02014b50) { // Central directory
      break // Stop at central directory
    } else {
      offset++
    }
    
    // Limit to prevent infinite loops
    if (result.fields.length > 100) break
  }
  
  return result
}

// Simple PNG parser
export function parsePNG(bytes) {
  const result = {
    fields: [],
    offset: 0,
    size: bytes.length
  }
  
  if (!bytes || bytes.length < 8) {
    return result
  }
  
  // Check PNG signature
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || 
      bytes[2] !== 0x4E || bytes[3] !== 0x47) {
    return result
  }
  
  result.fields.push({
    name: 'PNG Signature',
    value: '89 50 4E 47 0D 0A 1A 0A',
    offset: 0,
    size: 8
  })
  
  let offset = 8
  
  while (offset < bytes.length - 12) {
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
    
    // Parse IHDR chunk
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
        value: getColorType(colorType),
        offset: offset + 17,
        size: 1
      })
    }
    
    result.fields.push(chunk)
    
    offset += 12 + chunkSize
    
    // Stop at IEND
    if (chunkType === 'IEND') break
    
    // Limit chunks
    if (result.fields.length > 50) break
  }
  
  return result
}

function getColorType(type) {
  const types = {
    0: 'Grayscale',
    2: 'RGB',
    3: 'Palette',
    4: 'Grayscale + Alpha',
    6: 'RGBA'
  }
  return types[type] || `Unknown (${type})`
}