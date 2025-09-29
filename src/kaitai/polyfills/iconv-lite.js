/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: iconv-lite.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

/**
 * Browser polyfill for iconv-lite
 * Provides basic text encoding/decoding functionality
 */

import { createLogger } from '../../utils/logger'

const logger = createLogger('iconv-lite-polyfill')

const encodings = {
  'utf8': 'utf-8',
  'utf-8': 'utf-8',
  'ascii': 'windows-1252',
  'latin1': 'iso-8859-1',
  'iso-8859-1': 'iso-8859-1',
  'windows-1252': 'windows-1252',
  'utf16le': 'utf-16le',
  'utf-16le': 'utf-16le',
  'utf16be': 'utf-16be',
  'utf-16be': 'utf-16be'
}

export function decode(buffer, encoding = 'utf-8') {
  try {
    const enc = encodings[encoding.toLowerCase()] || 'utf-8'
    
    // Convert buffer to Uint8Array if needed
    let bytes
    if (buffer instanceof Uint8Array) {
      bytes = buffer
    } else if (buffer instanceof ArrayBuffer) {
      bytes = new Uint8Array(buffer)
    } else if (Array.isArray(buffer)) {
      bytes = new Uint8Array(buffer)
    } else {
      bytes = new Uint8Array(0)
    }
    
    // Use TextDecoder for decoding
    const decoder = new TextDecoder(enc)
    return decoder.decode(bytes)
  } catch (error) {
    logger.debug(`Failed to decode with ${encoding}, falling back to UTF-8:`, error)
    try {
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(buffer)
    } catch (fallbackError) {
      // Last resort: convert bytes to string manually
      let str = ''
      const bytes = new Uint8Array(buffer)
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i])
      }
      return str
    }
  }
}

export function encode(str, encoding = 'utf-8') {
  try {
    const enc = encodings[encoding.toLowerCase()] || 'utf-8'
    
    // Use TextEncoder for encoding
    const encoder = new TextEncoder()
    return encoder.encode(str)
  } catch (error) {
    logger.debug(`Failed to encode with ${encoding}, falling back to UTF-8:`, error)
    // Fallback: convert string to bytes manually
    const bytes = []
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i) & 0xFF)
    }
    return new Uint8Array(bytes)
  }
}

export function encodingExists(encoding) {
  return encodings.hasOwnProperty(encoding.toLowerCase())
}

// Default export to mimic iconv-lite structure
export default {
  decode,
  encode,
  encodingExists
}