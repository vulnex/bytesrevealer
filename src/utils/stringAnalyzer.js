/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: stringAnalyzer.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

// utils/stringAnalyzer.js
import { createLogger } from './logger.js'

const logger = createLogger('StringAnalyzer')

export class StringAnalyzer {
  static escapeString(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\\/g, '\\\\')
      .replace(/\x00/g, '\\0')
      // Replace non-printable characters with their hex representation
      .replace(/[\x00-\x1F\x7F-\x9F]/g, (char) => 
        `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`
      );
  }

  static async extractStrings(fileBytes, options = {
    minLength: 4,
    maxLength: 1000,
    batchSize: 1000
  }) {
    const strings = [];
    
    // ASCII string extraction
    for (let i = 0; i < fileBytes.length; i++) {
      let str = '';
      let j = i;
      
      // Look for ASCII strings
      while (j < fileBytes.length && 
             j - i < options.maxLength && 
             fileBytes[j] >= 0x20 && 
             fileBytes[j] <= 0x7E) {
        str += String.fromCharCode(fileBytes[j]);
        j++;
      }
      
      if (str.length >= options.minLength) {
        strings.push({
          type: 'ASCII',
          offset: i,
          length: str.length,
          value: this.escapeString(str)
        });
        i = j - 1; // Skip ahead, but allow overlap for UTF strings
      }
    }
    
    // UTF-8 string extraction
    const utf8Decoder = new TextDecoder('utf-8');
    for (let i = 0; i < fileBytes.length; i++) {
      try {
        let validUtf8 = false;
        let utf8Length = 0;
        
        // Try to decode UTF-8 sequences
        for (let len = 1; len <= 4; len++) {
          if (i + len <= fileBytes.length) {
            const slice = fileBytes.slice(i, i + len);
            try {
              const str = utf8Decoder.decode(slice);
              if (str.length > 0 && /^[\u0080-\uFFFF]/.test(str)) {
                validUtf8 = true;
                utf8Length = len;
                break;
              }
            } catch {
              // Not a valid UTF-8 sequence of this length
            }
          }
        }
        
        if (validUtf8) {
          let str = '';
          let j = i;
          while (j < fileBytes.length && j - i < options.maxLength) {
            const chunk = fileBytes.slice(j, j + 4);
            try {
              const char = utf8Decoder.decode(chunk);
              if (!/^[\u0020-\u007E\u0080-\uFFFF]/.test(char)) break;
              str += char;
              j += char.length;
            } catch {
              break;
            }
          }
          
          if (str.length >= options.minLength) {
            strings.push({
              type: 'UTF-8',
              offset: i,
              length: str.length,
              value: this.escapeString(str)
            });
            i = j - 1;
          }
        }
      } catch (error) {
        logger.warn(`UTF-8 extraction error at offset ${i}:`, error);
      }
    }
    
    // Sort strings by offset
    return strings.sort((a, b) => a.offset - b.offset);
  }
}
