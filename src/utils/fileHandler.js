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
    console.error('Analysis error:', error);
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

    console.log('Calculated hashes:', { md5, sha1, sha256 }); // Debug log
    
    return { md5, sha1, sha256 };
  } catch (error) {
    console.error('Hash calculation error:', error);
    throw error;
  }
}