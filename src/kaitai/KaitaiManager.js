/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KaitaiManager.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { createLogger } from '../utils/logger.js'

const logger = createLogger('KaitaiManager')

// Format mapping from file signatures to Kaitai parsers
const FORMAT_MAPPING = {
  'ZIP': 'zip',
  'PNG': 'png',
  'JPEG': 'jpeg',
  'GIF': 'gif',
  'BMP': 'bmp',
  'ELF': 'elf',
  'PE': 'dos_mz',
  'PDF': 'pdf',
  'GZIP': 'gzip',
  'TAR': 'tar',
  'RAR': 'rar',
  'MP3': 'mp3',
  'MP4': 'mp4',
  'AVI': 'avi',
  'WAV': 'wav',
  'WEBP': 'webp',
  'ICO': 'ico',
  'Class': 'java_class',
  'DEX': 'dex',
  'SQLite': 'sqlite3'
}

class KaitaiManager {
  constructor() {
    this.worker = null
    this.pendingRequests = new Map()
    this.requestId = 0
    this.currentFormat = null
    this.isReady = false
    this.readyCallbacks = []
    this.structures = new Map() // Cache parsed structures
    this.viewportCache = new Map() // Cache for viewport chunks
  }

  async initialize() {
    if (this.worker) return

    return new Promise((resolve) => {
      try {
        // Create worker inline to avoid module issues
        const workerCode = `
          ${this.getWorkerCode()}
        `
        const blob = new Blob([workerCode], { type: 'application/javascript' })
        const workerUrl = URL.createObjectURL(blob)
        this.worker = new Worker(workerUrl)

        this.worker.addEventListener('message', (event) => {
          this.handleWorkerMessage(event.data)
        })

        this.worker.addEventListener('error', (error) => {
          logger.error('KaitaiWorker error:', error)
        })

        // Wait for worker ready signal
        this.readyCallbacks.push(resolve)
        
        // Clean up the URL after creating the worker
        URL.revokeObjectURL(workerUrl)
      } catch (error) {
        logger.error('Failed to create worker:', error)
        this.isReady = true // Mark as ready even if worker fails
        resolve()
      }
    })
  }
  
  getWorkerCode() {
    // Inline worker code with actual parsing logic
    return `
      // Parser implementations
      ${this.getParsersCode()}
      
      let currentFormat = null
      let parsers = {
        'dos_mz': parsePE,
        'zip': parseZIP,
        'png': parsePNG
      }
      
      self.addEventListener('message', async (event) => {
        const { type, payload, id } = event.data
        
        switch (type) {
          case 'LOAD_PARSER':
            currentFormat = payload.format
            self.postMessage({
              id,
              type: 'PARSER_LOADED',
              success: true,
              format: payload.format
            })
            break
            
          case 'PARSE_CHUNK':
            try {
              let result = null
              const bytes = new Uint8Array(payload.data)
              
              // Use appropriate parser
              if (currentFormat && parsers[currentFormat]) {
                result = parsers[currentFormat](bytes)
              } else {
                // Default result
                result = {
                  fields: [
                    { name: 'Format', value: currentFormat || 'Unknown', offset: 0, size: 0 },
                    { name: 'Size', value: payload.length || 0, offset: 0, size: 0 }
                  ],
                  offset: payload.offset || 0,
                  size: payload.length || 0
                }
              }
              
              self.postMessage({
                id,
                type: 'CHUNK_PARSED',
                success: true,
                data: result
              })
            } catch (error) {
              self.postMessage({
                id,
                type: 'CHUNK_PARSED',
                success: false,
                error: error.message
              })
            }
            break
            
          case 'PARSE_FULL':
            try {
              let result = null
              const bytes = new Uint8Array(payload.data)
              
              if (currentFormat && parsers[currentFormat]) {
                result = parsers[currentFormat](bytes)
              } else {
                result = {
                  fields: [],
                  offset: 0,
                  size: bytes.length
                }
              }
              
              self.postMessage({
                id,
                type: 'FULL_PARSED',
                success: true,
                data: result
              })
            } catch (error) {
              self.postMessage({
                id,
                type: 'FULL_PARSED',
                success: false,
                error: error.message
              })
            }
            break
            
          case 'CLEAR_CACHE':
            self.postMessage({
              id,
              type: 'CACHE_CLEARED'
            })
            break
            
          default:
            self.postMessage({
              id,
              type: 'ERROR',
              error: 'Unknown message type: ' + type
            })
        }
      })
      
      // Notify ready
      self.postMessage({ type: 'WORKER_READY' })
    `
  }
  
  getParsersCode() {
    // Return the parser functions as a string
    return `
      function parsePE(bytes) {
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
            value: '0x' + peOffset.toString(16).toUpperCase(),
            offset: 60,
            size: 4
          })
          
          // Check PE signature
          if (bytes.length > peOffset + 4) {
            const peSignature = bytes[peOffset] | (bytes[peOffset + 1] << 8) | 
                                (bytes[peOffset + 2] << 16) | (bytes[peOffset + 3] << 24)
            
            if (peSignature === 0x00004550) { // "PE\\0\\0"
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
        return types[machine] || 'Unknown (0x' + machine.toString(16).toUpperCase() + ')'
      }
      
      function parseZIP(bytes) {
        const result = {
          fields: [],
          offset: 0,
          size: bytes.length
        }
        
        if (!bytes || bytes.length < 4) return result
        
        if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) return result
        
        let offset = 0
        let fileCount = 0
        
        while (offset < bytes.length - 4 && result.fields.length < 20) {
          const sig = bytes[offset] | (bytes[offset + 1] << 8) | 
                     (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
          
          if (sig === 0x04034b50) {
            fileCount++
            const entry = {
              name: 'File Entry ' + fileCount,
              value: null,
              offset: offset,
              size: 30,
              fields: []
            }
            
            if (bytes.length > offset + 30) {
              const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8)
              const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8)
              const compSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | 
                              (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24)
              
              if (nameLen > 0 && bytes.length > offset + 30 + nameLen) {
                const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen)
                const fileName = String.fromCharCode.apply(null, nameBytes)
                entry.name = fileName
                entry.fields.push({
                  name: 'Filename',
                  value: fileName,
                  offset: offset + 30,
                  size: nameLen
                })
              }
              
              entry.fields.push({
                name: 'Compressed Size',
                value: compSize,
                offset: offset + 18,
                size: 4
              })
              
              entry.size = 30 + nameLen + extraLen + compSize
              offset += entry.size
            } else {
              offset += 4
            }
            
            result.fields.push(entry)
          } else {
            offset++
          }
        }
        
        return result
      }
      
      function parsePNG(bytes) {
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
        
        while (offset < bytes.length - 12 && result.fields.length < 20) {
          const chunkSize = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | 
                           (bytes[offset + 2] << 8) | bytes[offset + 3]
          const chunkType = String.fromCharCode(
            bytes[offset + 4], bytes[offset + 5], 
            bytes[offset + 6], bytes[offset + 7]
          )
          
          const chunk = {
            name: chunkType + ' Chunk',
            value: null,
            offset: offset,
            size: 12 + chunkSize,
            fields: []
          }
          
          if (chunkType === 'IHDR' && bytes.length >= offset + 12 + 13) {
            const width = (bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | 
                         (bytes[offset + 10] << 8) | bytes[offset + 11]
            const height = (bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | 
                          (bytes[offset + 14] << 8) | bytes[offset + 15]
            
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
          }
          
          result.fields.push(chunk)
          offset += 12 + chunkSize
          
          if (chunkType === 'IEND') break
        }
        
        return result
      }
    `
  }

  handleWorkerMessage(message) {
    const { id, type } = message

    if (type === 'WORKER_READY') {
      this.isReady = true
      this.readyCallbacks.forEach(cb => cb())
      this.readyCallbacks = []
      return
    }

    if (id && this.pendingRequests.has(id)) {
      const { resolve, reject } = this.pendingRequests.get(id)
      this.pendingRequests.delete(id)

      if (message.success === false) {
        reject(new Error(message.error || 'Operation failed'))
      } else {
        resolve(message)
      }
    }
  }

  sendMessage(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      this.pendingRequests.set(id, { resolve, reject })
      
      this.worker.postMessage({
        id,
        type,
        payload
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('Worker timeout'))
        }
      }, 30000)
    })
  }

  async loadFormat(formatName) {
    if (!this.isReady) {
      await this.initialize()
    }

    const kaitaiFormat = FORMAT_MAPPING[formatName] || formatName.toLowerCase()
    
    try {
      const result = await this.sendMessage('LOAD_PARSER', {
        format: kaitaiFormat
      })
      
      if (result.success) {
        this.currentFormat = kaitaiFormat
        return true
      }
      
      return false
    } catch (error) {
      logger.error('Failed to load format:', error)
      return false
    }
  }

  async parseChunk(data, offset, length) {
    if (!this.currentFormat) {
      throw new Error('No format loaded')
    }

    // Check viewport cache
    const cacheKey = `${this.currentFormat}_${offset}_${length}`
    if (this.viewportCache.has(cacheKey)) {
      return this.viewportCache.get(cacheKey)
    }

    try {
      const result = await this.sendMessage('PARSE_CHUNK', {
        data: data instanceof Uint8Array ? data.buffer : data,
        format: this.currentFormat,
        offset,
        length
      })

      if (result.success) {
        // Cache the result
        this.viewportCache.set(cacheKey, result.data)
        
        // Limit cache size
        if (this.viewportCache.size > 100) {
          const firstKey = this.viewportCache.keys().next().value
          this.viewportCache.delete(firstKey)
        }

        return result.data
      }

      return null
    } catch (error) {
      logger.error('Parse chunk error:', error)
      return null
    }
  }

  async parseFile(data) {
    if (!this.currentFormat) {
      throw new Error('No format loaded')
    }

    try {
      const result = await this.sendMessage('PARSE_FULL', {
        data: data instanceof Uint8Array ? data.buffer : data,
        format: this.currentFormat
      })

      if (result.success) {
        this.structures.set(this.currentFormat, result.data)
        return result.data
      }

      return null
    } catch (error) {
      logger.error('Parse file error:', error)
      return null
    }
  }

  async parseViewport(data, startOffset, endOffset, bytesPerRow = 16) {
    const chunkSize = 1024 // Parse 1KB chunks
    const structures = []
    
    for (let offset = startOffset; offset < endOffset; offset += chunkSize) {
      const length = Math.min(chunkSize, endOffset - offset)
      const parsed = await this.parseChunk(data, offset, length)
      
      if (parsed) {
        structures.push({
          ...parsed,
          startOffset: offset,
          endOffset: offset + length
        })
      }
    }

    return structures
  }

  getStructureAtOffset(offset) {
    if (!this.structures.has(this.currentFormat)) {
      return null
    }

    const structure = this.structures.get(this.currentFormat)
    return this.findFieldAtOffset(structure, offset)
  }

  findFieldAtOffset(structure, targetOffset) {
    if (!structure || !structure.fields) return null

    for (const field of structure.fields) {
      if (field.offset <= targetOffset && 
          targetOffset < field.offset + (field.size || 1)) {
        // Check if field has nested structure
        if (field.value && field.value.fields) {
          const nested = this.findFieldAtOffset(field.value, targetOffset)
          if (nested) return nested
        }
        return field
      }
    }

    return null
  }

  clearCache() {
    this.structures.clear()
    this.viewportCache.clear()
    return this.sendMessage('CLEAR_CACHE', {})
  }

  detectFormat(fileBytes) {
    // Use existing file signature detection
    const signatures = this.detectFileSignatures(fileBytes)
    
    logger.debug('Format detection - signatures found:', signatures)
    logger.debug('Format mapping available:', FORMAT_MAPPING)
    
    for (const sig of signatures) {
      if (FORMAT_MAPPING[sig.name]) {
        logger.debug(`Format ${sig.name} mapped to ${FORMAT_MAPPING[sig.name]}`)
        return sig.name
      }
    }

    logger.debug('No format mapping found for detected signatures')
    return null
  }

  detectFileSignatures(bytes) {
    // Simple signature detection for common formats
    const signatures = []
    
    if (!bytes || bytes.length < 4) return signatures
    
    // ZIP
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      signatures.push({ name: 'ZIP', confidence: 100 })
    }
    
    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && 
        bytes[2] === 0x4E && bytes[3] === 0x47) {
      signatures.push({ name: 'PNG', confidence: 100 })
    }
    
    // JPEG
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      signatures.push({ name: 'JPEG', confidence: 100 })
    }
    
    // GIF
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      signatures.push({ name: 'GIF', confidence: 100 })
    }
    
    // PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && 
        bytes[2] === 0x44 && bytes[3] === 0x46) {
      signatures.push({ name: 'PDF', confidence: 100 })
    }
    
    // ELF
    if (bytes[0] === 0x7F && bytes[1] === 0x45 && 
        bytes[2] === 0x4C && bytes[3] === 0x46) {
      signatures.push({ name: 'ELF', confidence: 100 })
    }
    
    // PE/DOS MZ header
    if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
      signatures.push({ name: 'PE', confidence: 100 })
      logger.debug('Detected PE/DOS MZ format')
    }

    logger.debug('Detected signatures:', signatures)
    return signatures
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pendingRequests.clear()
    this.structures.clear()
    this.viewportCache.clear()
    this.isReady = false
  }
}

// Singleton instance
let managerInstance = null

export function getKaitaiManager() {
  if (!managerInstance) {
    managerInstance = new KaitaiManager()
  }
  return managerInstance
}

export default KaitaiManager