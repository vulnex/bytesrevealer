/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: filehandler.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-17
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { ref, computed } from 'vue'
import CryptoJS from 'crypto-js'
import { createLogger } from './logger'
import { fileTypeFromBuffer } from 'file-type'

const logger = createLogger('FileHandler')

export const FILE_LIMITS = {
  WARNING_SIZE: 100 * 1024 * 1024,    // 100MB warning threshold
  MAX_SIZE: 500 * 1024 * 1024,        // 500MB max size
  ANALYSIS_SIZE_LIMIT: 50 * 1024 * 1024, // 50MB limit for analysis
  CHUNK_SIZE: 256 * 1024,             // 256KB chunks for better performance
  WORKER_TIMEOUT: 30000               // 30 seconds timeout per chunk
};

export function validateFileSize(file) {
  if (file.size > FILE_LIMITS.MAX_SIZE) {
    throw new Error(`File too large. Maximum size is ${formatFileSize(FILE_LIMITS.MAX_SIZE)}`);
  }
  return file.size > FILE_LIMITS.WARNING_SIZE;
}

export function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export async function processFileInChunks(file, options = {}, onProgress) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  if (onProgress) {
    onProgress(100);
  }
  
  return bytes;
}

export async function analyzeFileInChunks(file, options = {}, onProgress) {
  if (!options.fileAnalysis) {
    return { entropy: 0, strings: [], counts: new Uint32Array(256) };
  }

  const results = {
    counts: new Uint32Array(256),
    strings: [],
    entropy: 0
  };

  // Break into smaller chunks
  const chunkSize = 128 * 1024; // 128KB chunks
  const totalChunks = Math.ceil(file.size / chunkSize);
  let processedChunks = 0;

  try {
    // Process file in chunks
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const chunk = await readChunk(file, offset, chunkSize);
      const bytes = new Uint8Array(chunk);

      // Count bytes frequency
      for (let i = 0; i < bytes.length; i++) {
        results.counts[bytes[i]]++;
      }

      // Update progress
      processedChunks++;
      if (onProgress) {
        onProgress((processedChunks / totalChunks) * 100);
      }

      // Yield to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Calculate entropy after all chunks are processed
    const totalBytes = file.size;
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      if (results.counts[i] > 0) {
        const p = results.counts[i] / totalBytes;
        entropy -= p * Math.log2(p);
      }
    }
    results.entropy = entropy;

    return results;
  } catch (error) {
    logger.error('Analysis error:', error);
    throw error;
  }
}

function createWorker() {
  const workerCode = `
    self.onmessage = async function(e) {
      const { type, chunk, offset } = e.data;
      
      try {
        const bytes = new Uint8Array(chunk);
        const counts = new Uint32Array(256);
        const strings = [];
        let currentString = [];

        // Process in smaller sub-chunks
        const SUB_CHUNK_SIZE = 8192; // 8KB sub-chunks
        
        for (let i = 0; i < bytes.length; i += SUB_CHUNK_SIZE) {
          const end = Math.min(i + SUB_CHUNK_SIZE, bytes.length);
          
          for (let j = i; j < end; j++) {
            const byte = bytes[j];
            counts[byte]++;
            
            if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
              currentString.push(byte);
            } else if (currentString.length >= 4) {
              strings.push({
                offset: offset + j - currentString.length,
                value: String.fromCharCode(...currentString)
              });
              currentString = [];
            } else {
              currentString = [];
            }
          }
          
          // Yield to prevent blocking
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        self.postMessage({
          type: 'complete',
          data: {
            counts: Array.from(counts),
            strings
          }
        });
      } catch (error) {
        self.postMessage({ 
          type: 'error', 
          error: error.message 
        });
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

function calculateEntropy(counts, totalBytes) {
  let entropy = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      const p = counts[i] / totalBytes;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

async function readChunk(file, offset, size) {
  const slice = file.slice(offset, Math.min(offset + size, file.size));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(slice);
  });
}

export async function calculateFileHashes(file, onProgress) {
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(file.size / chunkSize);
  let processedChunks = 0;

  try {
    // Create WordArray for CryptoJS
    const words = [];
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Convert bytes to words
    for (let i = 0; i < bytes.length; i += 4) {
      words.push(
        (bytes[i] << 24) |
        ((bytes[i + 1] || 0) << 16) |
        ((bytes[i + 2] || 0) << 8) |
        (bytes[i + 3] || 0)
      );
    }

    const wordArray = CryptoJS.lib.WordArray.create(words);

    // Calculate all hashes
    const md5 = CryptoJS.MD5(wordArray).toString();
    const sha1 = CryptoJS.SHA1(wordArray).toString();
    const sha256 = CryptoJS.SHA256(wordArray).toString();

    logger.debug('Calculated hashes:', { md5, sha1, sha256 })
    
    return { md5, sha1, sha256 };
  } catch (error) {
    logger.error('Hash calculation error:', error);
    throw error;
  }
}

/**
 * Detect file type using magic bytes (first 1024KB)
 * @param {File|Uint8Array} input - File object or byte array
 * @returns {Promise<Object>} File type information
 */
export async function detectFileType(input) {
  try {
    let bytes;

    if (input instanceof File) {
      // Read first 1024KB (1MB) for detection
      const maxBytes = 1024 * 1024; // 1MB
      const sliceSize = Math.min(input.size, maxBytes);

      try {
        // Use a FileReader for better compatibility with large files
        const reader = new FileReader();
        const slice = input.slice(0, sliceSize);

        const buffer = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsArrayBuffer(slice);
        });

        bytes = new Uint8Array(buffer);
      } catch (readError) {
        // Fallback: try direct arrayBuffer method
        logger.warn('FileReader failed, trying direct arrayBuffer:', readError);
        const buffer = await input.slice(0, sliceSize).arrayBuffer();
        bytes = new Uint8Array(buffer);
      }
    } else if (input instanceof Uint8Array) {
      // Use first 1MB if array is provided
      const maxBytes = 1024 * 1024;
      bytes = input.slice(0, Math.min(input.length, maxBytes));
    } else {
      throw new Error('Input must be a File or Uint8Array');
    }

    // Detect file type using file-type library
    let fileType;
    try {
      fileType = await fileTypeFromBuffer(bytes);
    } catch (err) {
      logger.warn('file-type library error:', err);
      // Continue with fallback detection
    }

    if (fileType) {
      logger.debug('Detected file type:', fileType);
      return {
        detected: true,
        ext: fileType.ext,
        mime: fileType.mime,
        description: getFileTypeDescription(fileType.ext),
        confidence: 'high'
      };
    }

    // Manual fallback detection for common formats
    const manualType = detectCommonFormats(bytes);
    if (manualType) {
      logger.debug('Detected file type via manual check:', manualType);
      return manualType;
    }

    // Fallback detection for text files and other common types
    const textType = detectTextFileType(bytes);
    if (textType) {
      logger.debug('Detected text file type:', textType);
      return textType;
    }

    logger.debug('No file type detected');
    return {
      detected: false,
      ext: 'unknown',
      mime: 'application/octet-stream',
      description: 'Unknown binary file',
      confidence: 'none'
    };
  } catch (error) {
    logger.error('File type detection error:', error);

    // Return a more user-friendly error state
    return {
      detected: false,
      ext: 'unknown',
      mime: 'application/octet-stream',
      description: 'Unable to detect file type',
      confidence: 'none',
      error: error.message
    };
  }
}

/**
 * Manual detection for common binary formats via magic bytes
 */
function detectCommonFormats(bytes) {
  if (!bytes || bytes.length < 4) return null;

  // Check for ZIP (including .app.zip, .jar, .docx, etc.)
  // ZIP files start with PK (0x504B)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
    // PK\x03\x04 or PK\x05\x06 or PK\x07\x08
    if ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08)) {

      logger.debug('Detected ZIP format via magic bytes');
      return {
        detected: true,
        ext: 'zip',
        mime: 'application/zip',
        description: 'ZIP Archive',
        confidence: 'high'
      };
    }
  }

  // Check for RAR
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) {
    return {
      detected: true,
      ext: 'rar',
      mime: 'application/x-rar-compressed',
      description: 'RAR Archive',
      confidence: 'high'
    };
  }

  // Check for 7-Zip
  if (bytes.length >= 6 &&
      bytes[0] === 0x37 && bytes[1] === 0x7A && bytes[2] === 0xBC &&
      bytes[3] === 0xAF && bytes[4] === 0x27 && bytes[5] === 0x1C) {
    return {
      detected: true,
      ext: '7z',
      mime: 'application/x-7z-compressed',
      description: '7-Zip Archive',
      confidence: 'high'
    };
  }

  // Check for PDF
  if (bytes.length >= 4 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46) { // %PDF
    return {
      detected: true,
      ext: 'pdf',
      mime: 'application/pdf',
      description: 'PDF Document',
      confidence: 'high'
    };
  }

  // Check for PNG
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return {
      detected: true,
      ext: 'png',
      mime: 'image/png',
      description: 'PNG Image',
      confidence: 'high'
    };
  }

  // Check for JPEG
  if (bytes.length >= 3 &&
      bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return {
      detected: true,
      ext: 'jpg',
      mime: 'image/jpeg',
      description: 'JPEG Image',
      confidence: 'high'
    };
  }

  // Check for GIF
  if (bytes.length >= 6) {
    const header = String.fromCharCode(...bytes.slice(0, 6));
    if (header === 'GIF87a' || header === 'GIF89a') {
      return {
        detected: true,
        ext: 'gif',
        mime: 'image/gif',
        description: 'GIF Image',
        confidence: 'high'
      };
    }
  }

  // Check for EXE (MZ header)
  if (bytes.length >= 2 &&
      bytes[0] === 0x4D && bytes[1] === 0x5A) { // MZ
    return {
      detected: true,
      ext: 'exe',
      mime: 'application/x-msdownload',
      description: 'Windows Executable',
      confidence: 'high'
    };
  }

  // Check for ELF (Linux/Unix executable)
  if (bytes.length >= 4 &&
      bytes[0] === 0x7F && bytes[1] === 0x45 &&
      bytes[2] === 0x4C && bytes[3] === 0x46) { // .ELF
    return {
      detected: true,
      ext: 'elf',
      mime: 'application/x-elf',
      description: 'ELF Executable',
      confidence: 'high'
    };
  }

  // Check for Mach-O (macOS executable)
  if (bytes.length >= 4) {
    const magic = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    // Mach-O magic numbers
    if (magic === 0xFEEDFACE || magic === 0xFEEDFACF ||
        magic === 0xCEFAEDFE || magic === 0xCFFAEDFE) {
      return {
        detected: true,
        ext: 'macho',
        mime: 'application/x-mach-binary',
        description: 'Mach-O Binary',
        confidence: 'high'
      };
    }
  }

  return null;
}

/**
 * Detect text-based file types
 */
function detectTextFileType(bytes) {
  // Check if file is likely text
  let textCount = 0;
  let totalChecked = Math.min(bytes.length, 8192); // Check first 8KB

  for (let i = 0; i < totalChecked; i++) {
    const byte = bytes[i];
    // Printable ASCII, tab, newline, carriage return
    if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
      textCount++;
    }
  }

  const textRatio = textCount / totalChecked;
  if (textRatio < 0.85) return null; // Not likely a text file

  // Convert to string for pattern matching
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 4096));

  // Check for specific text formats
  if (text.startsWith('<?xml')) {
    return {
      detected: true,
      ext: 'xml',
      mime: 'application/xml',
      description: 'XML Document',
      confidence: 'high'
    };
  }

  if (text.startsWith('<!DOCTYPE html') || text.match(/<html[^>]*>/i)) {
    return {
      detected: true,
      ext: 'html',
      mime: 'text/html',
      description: 'HTML Document',
      confidence: 'high'
    };
  }

  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      JSON.parse(text.slice(0, 4096).trim());
      return {
        detected: true,
        ext: 'json',
        mime: 'application/json',
        description: 'JSON Document',
        confidence: 'high'
      };
    } catch {
      // Not valid JSON
    }
  }

  // Generic text file
  return {
    detected: true,
    ext: 'txt',
    mime: 'text/plain',
    description: 'Plain Text File',
    confidence: 'medium'
  };
}

/**
 * Get human-readable description for file extension
 */
function getFileTypeDescription(ext) {
  const descriptions = {
    // Images
    png: 'PNG Image',
    jpg: 'JPEG Image',
    jpeg: 'JPEG Image',
    gif: 'GIF Image',
    webp: 'WebP Image',
    bmp: 'Bitmap Image',
    ico: 'Icon File',
    svg: 'SVG Vector Graphics',
    tiff: 'TIFF Image',

    // Documents
    pdf: 'PDF Document',
    doc: 'Word Document',
    docx: 'Word Document',
    xls: 'Excel Spreadsheet',
    xlsx: 'Excel Spreadsheet',
    ppt: 'PowerPoint Presentation',
    pptx: 'PowerPoint Presentation',
    odt: 'OpenDocument Text',
    ods: 'OpenDocument Spreadsheet',

    // Archives
    zip: 'ZIP Archive',
    rar: 'RAR Archive',
    '7z': '7-Zip Archive',
    tar: 'TAR Archive',
    gz: 'GZIP Compressed',
    bz2: 'BZIP2 Compressed',
    app: 'macOS Application Bundle (ZIP)',

    // Media
    mp4: 'MP4 Video',
    avi: 'AVI Video',
    mov: 'QuickTime Video',
    mkv: 'Matroska Video',
    webm: 'WebM Video',
    mp3: 'MP3 Audio',
    wav: 'WAV Audio',
    flac: 'FLAC Audio',
    ogg: 'OGG Audio',

    // Executables
    exe: 'Windows Executable',
    dll: 'Dynamic Link Library',
    so: 'Shared Object',
    deb: 'Debian Package',
    rpm: 'RPM Package',
    dmg: 'macOS Disk Image',
    app: 'macOS Application',

    // Programming
    js: 'JavaScript Source',
    py: 'Python Source',
    java: 'Java Source',
    c: 'C Source',
    cpp: 'C++ Source',
    h: 'C/C++ Header',
    cs: 'C# Source',
    go: 'Go Source',
    rs: 'Rust Source',

    // Data
    sqlite: 'SQLite Database',
    db: 'Database File'
  };

  return descriptions[ext] || `${ext.toUpperCase()} File`;
}