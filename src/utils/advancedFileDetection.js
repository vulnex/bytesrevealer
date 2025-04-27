/** 
 * VULNEX -Bytes Revealer-
 *
 * File: advancedFileDetection.js
 * Author: Simon Roses Femerling
 * Created: 2025-04-01
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { FILE_SIGNATURES, detectFileTypes, isFileType } from './fileSignatures';
import { extractMetadata } from './metadataExtractor';

class FileAnalysisError extends Error {
  constructor(message, type = 'ANALYSIS_ERROR') {
    super(message);
    this.name = 'FileAnalysisError';
    this.type = type;
  }
}

// First define the container types
const CONTAINER_TYPES = {
  ZIP: {
    signature: [0x50, 0x4B, 0x03, 0x04],
    name: 'ZIP Archive',
    localFileHeaderSignature: [0x50, 0x4B, 0x03, 0x04],
    centralDirSignature: [0x50, 0x4B, 0x01, 0x02],
    endOfCentralDirSignature: [0x50, 0x4B, 0x05, 0x06]
  },
  PDF: {
    signature: [0x25, 0x50, 0x44, 0x46],
    name: 'PDF Document',
    streamStart: [0x73, 0x74, 0x72, 0x65, 0x61, 0x6D], // 'stream'
    streamEnd: [0x65, 0x6E, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6D] // 'endstream'
  },
  OFFICE: {
    signature: [0x50, 0x4B, 0x03, 0x04],
    name: 'Office Open XML',
    contentTypes: [0x5B, 0x43, 0x6F, 0x6E, 0x74, 0x65, 0x6E, 0x74, 0x5F, 0x54, 0x79, 0x70, 0x65, 0x73, 0x5D] // '[Content_Types]'
  },
  ELF: {
    signature: [0x7F, 0x45, 0x4C, 0x46],
    name: 'ELF Binary',
    sectionHeaderSignature: [0x2E, 0x73, 0x68, 0x73, 0x74, 0x72, 0x74, 0x61, 0x62] // .shstrtab
  },
  PE: {
    signature: [0x4D, 0x5A],
    name: 'Windows PE',
    peHeaderSignature: [0x50, 0x45, 0x00, 0x00]
  },
  JPEG: {
    signature: [0xFF, 0xD8, 0xFF],
    name: 'JPEG Image',
    exifMarker: [0xFF, 0xE1],
    app0Marker: [0xFF, 0xE0]
  },
  GIF: {
    signature: [0x47, 0x49, 0x46, 0x38],
    name: 'GIF Image',
    applicationExt: [0x21, 0xFF, 0x0B]
  },
  MACHO: {
    signature: [0xFE, 0xED, 0xFA, 0xCF], // 64-bit
    signature2: [0xFE, 0xED, 0xFA, 0xCE], // 32-bit
    signature3: [0xCA, 0xFE, 0xBA, 0xBE], // Universal binary
    name: 'Mach-O Executable',
    loadCommandSignature: [0x19, 0x00, 0x00, 0x00] // LC_SEGMENT_64
  }
};

// Define core utility functions first
function matchesPattern(bytes, pattern, offset) {
  if (offset + pattern.length > bytes.length) return false;
  
  for (let i = 0; i < pattern.length; i++) {
    if (bytes[offset + i] !== pattern[i]) return false;
  }
  return true;
}

function findPattern(bytes, pattern, startOffset) {
  for (let i = startOffset; i <= bytes.length - pattern.length; i++) {
    if (matchesPattern(bytes, pattern, i)) return i;
  }
  return -1;
}

// First, define the PE analysis functions at the top level
function findPEHeaderOffset(bytes) {
  try {
    if (!bytes || bytes.length < 64) {
      return -1;
    }
    
    // Check DOS signature (MZ)
    if (bytes[0] !== 0x4D || bytes[1] !== 0x5A) {
      return -1;
    }

    // Get PE header offset from DOS header
    const peOffset = bytes[0x3C] | 
                    (bytes[0x3D] << 8) | 
                    (bytes[0x3E] << 16) | 
                    (bytes[0x3F] << 24);
                    
    if (peOffset < 0 || peOffset > bytes.length - 4) {
      return -1;
    }
    
    // Verify PE signature
    if (bytes[peOffset] === 0x50 && // P
        bytes[peOffset + 1] === 0x45 && // E
        bytes[peOffset + 2] === 0x00 && // \0
        bytes[peOffset + 3] === 0x00) { // \0
      return peOffset;
    }
    
    return -1;
  } catch (error) {
    console.error('Error in findPEHeaderOffset:', error);
    return -1;
  }
}

/**
 * Searches for nested files within container formats
 * @param {Uint8Array} bytes - File bytes to analyze
 * @returns {Array} Array of nested file findings
 */
function detectNestedFiles(bytes) {
  const findings = [];
  
  // Scan for ZIP contents
  if (isFileType(bytes, 'ZIP')) {
    const zipFindings = scanZipContents(bytes);
    findings.push(...zipFindings);
  }
  
  // Scan for PDF embedded files
  if (isFileType(bytes, 'PDF')) {
    const pdfFindings = scanPdfContents(bytes);
    findings.push(...pdfFindings);
  }
  
  // Scan for Office embedded objects
  if (isFileType(bytes, 'OFFICE')) {
    const officeFindings = scanOfficeContents(bytes);
    findings.push(...officeFindings);
  }
  
  return findings;
}

/**
 * Scans ZIP file structure for nested files
 */
function scanZipContents(bytes) {
  const findings = [];
  let offset = 0;
  
  while (offset < bytes.length - 4) {
    // Look for local file header signature
    if (matchesPattern(bytes, CONTAINER_TYPES.ZIP.localFileHeaderSignature, offset)) {
      // Parse ZIP local file header
      const fileNameLength = bytes[offset + 26] | (bytes[offset + 27] << 8);
      const extraFieldLength = bytes[offset + 28] | (bytes[offset + 29] << 8);
      const fileName = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + fileNameLength));
      
      findings.push({
        type: 'ZIP Entry',
        name: fileName,
        offset: offset,
        confidence: 'High'
      });
      
      // Skip to next potential header
      offset += 30 + fileNameLength + extraFieldLength;
    } else {
      offset++;
    }
  }
  
  return findings;
}

/**
 * Scans PDF file structure for embedded files
 */
function scanPdfContents(bytes) {
  const findings = [];
  let offset = 0;
  
  while (offset < bytes.length - 6) {
    // Look for stream markers
    if (matchesPattern(bytes, CONTAINER_TYPES.PDF.streamStart, offset)) {
      // Search for endstream marker
      let endOffset = findPattern(bytes, CONTAINER_TYPES.PDF.streamEnd, offset + 6);
      if (endOffset !== -1) {
        // Analyze stream content for embedded files
        const streamContent = bytes.slice(offset + 6, endOffset);
        const embeddedTypes = detectFileTypes(streamContent);
        
        if (embeddedTypes.length > 0) {
          findings.push({
            type: 'PDF Embedded Object',
            offset: offset,
            size: endOffset - offset,
            embeddedTypes: embeddedTypes,
            confidence: 'Medium'
          });
        }
      }
      offset = endOffset !== -1 ? endOffset : offset + 1;
    } else {
      offset++;
    }
  }
  
  return findings;
}

/**
 * Scans Office Open XML structure for embedded objects
 */
function scanOfficeContents(bytes) {
  const findings = [];
  
  // Parse ZIP structure first (since OOXML is ZIP-based)
  const zipEntries = scanZipContents(bytes);
  
  // Look for specific Office components
  zipEntries.forEach(entry => {
    if (entry.name.includes('word/embeddings/') || 
        entry.name.includes('xl/embeddings/') ||
        entry.name.includes('ppt/embeddings/')) {
      findings.push({
        type: 'Office Embedded Object',
        name: entry.name,
        offset: entry.offset,
        confidence: 'High'
      });
    }
  });
  
  return findings;
}

// Update the analyzePEStructure function
function analyzePEStructure(bytes) {
  try {
    const peOffset = findPEHeaderOffset(bytes);
    if (peOffset === -1) {
      throw new Error('Invalid PE header offset');
    }

    // Get basic PE information
    const characteristics = getPECharacteristics(bytes, peOffset);
    const subsystem = getPESubsystem(bytes, peOffset);
    const timestamp = getPETimestamp(bytes, peOffset);
    const sections = countPESections(bytes, peOffset);
    const imports = getPEImportCount(bytes, peOffset);

    return {
      offset: `0x${peOffset.toString(16).padStart(8, '0')}`,
      characteristics: characteristics,
      subsystem: subsystem,
      timestamp: timestamp,
      sections: sections,
      imports: imports
    };
  } catch (error) {
    console.error('Error analyzing PE structure:', error);
    return { error: error.message };
  }
}

// Update detectSpecificFileType to handle PE files better
function detectSpecificFileType(bytes) {
  try {
    if (!bytes || !bytes.length) {
      throw new Error('No bytes provided for analysis');
    }

    const basicTypes = detectFileTypes(bytes);
    const enhancedTypes = [];
    
    for (const type of basicTypes) {
      const enhanced = {
        ...type,
        details: {},
        nestedFiles: []
      };
      
      try {
        if (type.name.includes('Windows Executable (PE)')) {
          const peDetails = analyzePEStructure(bytes);
          enhanced.details = peDetails;
        } else if (type.name === 'Mach-O Executable') {
          enhanced.details = analyzeMachOStructure(bytes);
        } else if (type.name === 'PDF Document') {
          enhanced.details = analyzePdfStructure(bytes);
        } else if (type.name === 'ZIP Archive') {
          enhanced.details = analyzeZipStructure(bytes);
        } else if (type.name === 'Office Open XML Document') {
          enhanced.details = analyzeZipStructure(bytes);
        } else if (type.name === 'PNG Image') {
          enhanced.details = analyzePngStructure(bytes);
        } else if (type.name === 'ELF Binary') {
          enhanced.details = analyzeElfStructure(bytes);
        } else if (type.name === 'JPEG Image') {
          enhanced.details = analyzeJpegStructure(bytes);
        } else if (type.name === 'GIF Image') {
          enhanced.details = analyzeGifStructure(bytes);
        }
      } catch (error) {
        console.error(`Error analyzing ${type.name}:`, error);
        enhanced.details = { error: error.message };
      }
      
      enhancedTypes.push(enhanced);
    }
    
    return enhancedTypes;
  } catch (error) {
    console.error('Error in detectSpecificFileType:', error);
    throw error;
  }
}

// Specific format analyzers
function analyzePdfStructure(bytes) {
  return {
    version: extractPdfVersion(bytes),
    encrypted: isPdfEncrypted(bytes),
    objectCount: countPdfObjects(bytes)
  };
}

function analyzeZipStructure(bytes) {
  return {
    entryCount: countZipEntries(bytes),
    compressed: isZipCompressed(bytes),
    comment: extractZipComment(bytes)
  };
}

function analyzePngStructure(bytes) {
  return {
    dimensions: extractPngDimensions(bytes),
    colorType: extractPngColorType(bytes),
    compression: extractPngCompression(bytes)
  };
}

// Add implementation details for these helper functions...

function extractPdfVersion(bytes) {
  try {
    // PDF version is typically in the first line: %PDF-1.x
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    const match = header.match(/PDF-(\d+\.\d+)/);
    return match ? match[1] : 'Unknown';
  } catch (error) {
    console.error('Error extracting PDF version:', error);
    return 'Unknown';
  }
}

function isPdfEncrypted(bytes) {
  try {
    // Look for /Encrypt in the first 1024 bytes
    const header = new TextDecoder().decode(bytes.slice(0, 1024));
    return header.includes('/Encrypt');
  } catch (error) {
    console.error('Error checking PDF encryption:', error);
    return false;
  }
}

function countPdfObjects(bytes) {
  try {
    // Count occurrences of "obj" in the file
    let count = 0;
    const pattern = [0x6F, 0x62, 0x6A]; // "obj"
    for (let i = 0; i < bytes.length - 3; i++) {
      if (matchesPattern(bytes, pattern, i)) count++;
    }
    return count;
  } catch (error) {
    console.error('Error counting PDF objects:', error);
    return 0;
  }
}

function countZipEntries(bytes) {
  try {
    let count = 0;
    let offset = 0;
    while (offset < bytes.length - 4) {
      if (matchesPattern(bytes, CONTAINER_TYPES.ZIP.localFileHeaderSignature, offset)) {
        count++;
        offset += 4;
      } else {
        offset++;
      }
    }
    return count;
  } catch (error) {
    console.error('Error counting ZIP entries:', error);
    return 0;
  }
}

function isZipCompressed(bytes) {
  try {
    // Check compression method in local file header
    if (bytes.length < 10) return false;
    const compressionMethod = bytes[8] | (bytes[9] << 8);
    return compressionMethod !== 0; // 0 = no compression
  } catch (error) {
    console.error('Error checking ZIP compression:', error);
    return false;
  }
}

function extractZipComment(bytes) {
  try {
    // Look for end of central directory record
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (matchesPattern(bytes, CONTAINER_TYPES.ZIP.endOfCentralDirSignature, i)) {
        const commentLength = bytes[i + 20] | (bytes[i + 21] << 8);
        if (commentLength > 0) {
          return new TextDecoder().decode(bytes.slice(i + 22, i + 22 + commentLength));
        }
        break;
      }
    }
    return '';
  } catch (error) {
    console.error('Error extracting ZIP comment:', error);
    return '';
  }
}

function extractPngDimensions(bytes) {
  try {
    if (bytes.length < 24) return 'Unknown';
    const width = bytes[16] << 24 | bytes[17] << 16 | bytes[18] << 8 | bytes[19];
    const height = bytes[20] << 24 | bytes[21] << 16 | bytes[22] << 8 | bytes[23];
    return `${width}x${height}`;
  } catch (error) {
    console.error('Error extracting PNG dimensions:', error);
    return 'Unknown';
  }
}

function extractPngColorType(bytes) {
  try {
    if (bytes.length < 25) return 'Unknown';
    const colorType = bytes[25];
    const types = {
      0: 'Grayscale',
      2: 'RGB',
      3: 'Palette',
      4: 'Grayscale+Alpha',
      6: 'RGBA'
    };
    return types[colorType] || 'Unknown';
  } catch (error) {
    console.error('Error extracting PNG color type:', error);
    return 'Unknown';
  }
}

function extractPngCompression(bytes) {
  try {
    if (bytes.length < 24) return 'Unknown';
    const compression = bytes[24];
    return compression === 0 ? 'Deflate' : 'Unknown';
  } catch (error) {
    console.error('Error extracting PNG compression:', error);
    return 'Unknown';
  }
}

// Add these new analyzer functions
function analyzeElfStructure(bytes) {
  try {
    return {
      class: getElfClass(bytes),
      type: getElfType(bytes),
      machine: getElfMachine(bytes),
      sections: countElfSections(bytes),
      entryPoint: getElfEntryPoint(bytes)
    };
  } catch (error) {
    console.error('Error analyzing ELF structure:', error);
    return { error: 'Failed to analyze ELF structure' };
  }
}

function analyzeJpegStructure(bytes) {
  try {
    return {
      dimensions: getJpegDimensions(bytes),
      hasExif: checkJpegExif(bytes),
      compression: getJpegCompression(bytes),
      colorSpace: getJpegColorSpace(bytes),
      thumbnails: checkJpegThumbnails(bytes)
    };
  } catch (error) {
    console.error('Error analyzing JPEG structure:', error);
    return { error: 'Failed to analyze JPEG structure' };
  }
}

function analyzeGifStructure(bytes) {
  try {
    return {
      version: getGifVersion(bytes),
      dimensions: getGifDimensions(bytes),
      frameCount: countGifFrames(bytes),
      hasAnimation: checkGifAnimation(bytes),
      colorDepth: getGifColorDepth(bytes)
    };
  } catch (error) {
    console.error('Error analyzing GIF structure:', error);
    return { error: 'Failed to analyze GIF structure' };
  }
}

// Helper functions for ELF analysis
function getElfClass(bytes) {
  const elfClass = bytes[4];
  return elfClass === 1 ? '32-bit' : elfClass === 2 ? '64-bit' : 'Unknown';
}

function getElfType(bytes) {
  const types = {
    1: 'Relocatable',
    2: 'Executable',
    3: 'Shared object',
    4: 'Core dump'
  };
  const type = bytes[16] | (bytes[17] << 8);
  return types[type] || 'Unknown';
}

function getElfMachine(bytes) {
  const machines = {
    0x03: 'x86',
    0x3E: 'x86-64',
    0x28: 'ARM',
    0xB7: 'AArch64'
  };
  const machine = bytes[18] | (bytes[19] << 8);
  return machines[machine] || `Unknown (0x${machine.toString(16)})`;
}

// Helper functions for PE analysis
function getPESubsystem(bytes, peOffset) {
  try {
    // Optional header offset is PE header + 24
    const optionalHeaderOffset = peOffset + 24;
    if (optionalHeaderOffset + 68 >= bytes.length) return 'Unknown';
    
    const subsystem = bytes[optionalHeaderOffset + 68] | 
                     (bytes[optionalHeaderOffset + 69] << 8);
    
    const subsystems = {
      0: 'Unknown',
      1: 'Native',
      2: 'Windows GUI',
      3: 'Windows CUI',
      7: 'Posix CUI',
      9: 'Windows CE GUI',
      10: 'EFI Application',
      11: 'EFI Boot Service Driver',
      12: 'EFI Runtime Driver',
      13: 'EFI ROM',
      14: 'XBOX',
      16: 'Windows Boot Application'
    };
    
    return subsystems[subsystem] || `Unknown (${subsystem})`;
  } catch (error) {
    throw new FileAnalysisError('Failed to get PE subsystem: ' + error.message);
  }
}

function getPECharacteristics(bytes, peOffset) {
  const characteristics = [];
  if (peOffset === -1) return [];
  
  const flags = bytes[peOffset + 22] | (bytes[peOffset + 23] << 8);
  if (flags & 0x0002) characteristics.push('Executable');
  if (flags & 0x2000) characteristics.push('DLL');
  if (flags & 0x0020) characteristics.push('Large Address Aware');
  
  return characteristics;
}

// Helper functions for JPEG analysis
function getJpegDimensions(bytes) {
  let offset = 2;
  while (offset < bytes.length - 8) {
    if (bytes[offset] === 0xFF && bytes[offset + 1] === 0xC0) {
      const height = bytes[offset + 5] << 8 | bytes[offset + 6];
      const width = bytes[offset + 7] << 8 | bytes[offset + 8];
      return `${width}x${height}`;
    }
    offset++;
  }
  return 'Unknown';
}

function checkJpegExif(bytes) {
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xE1) {
      const exif = new TextDecoder().decode(bytes.slice(i + 4, i + 8));
      return exif === 'Exif';
    }
  }
  return false;
}

// Helper functions for GIF analysis
function getGifVersion(bytes) {
  try {
    const version = new TextDecoder().decode(bytes.slice(3, 6));
    return version === '87a' ? 'GIF87a' : version === '89a' ? 'GIF89a' : 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function countGifFrames(bytes) {
  let frames = 0;
  let offset = 13; // Skip header
  
  while (offset < bytes.length) {
    if (bytes[offset] === 0x2C) { // Image descriptor
      frames++;
      offset += 11;
    } else if (bytes[offset] === 0x21) { // Extension
      offset += 2;
    } else if (bytes[offset] === 0x3B) { // Trailer
      break;
    }
    offset++;
  }
  
  return frames;
}

function checkGifAnimation(bytes) {
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
      return true; // Found Graphics Control Extension
    }
  }
  return false;
}

function getPETimestamp(bytes, peOffset) {
  try {
    if (peOffset === -1) return 'Unknown';
    
    const timestamp = bytes[peOffset + 8] |
                     (bytes[peOffset + 9] << 8) |
                     (bytes[peOffset + 10] << 16) |
                     (bytes[peOffset + 11] << 24);
    
    return new Date(timestamp * 1000).toISOString();
  } catch (error) {
    console.error('Error getting PE timestamp:', error);
    return 'Unknown';
  }
}

function countPESections(bytes, peOffset) {
  try {
    if (peOffset === -1) return 0;
    
    return bytes[peOffset + 6] | (bytes[peOffset + 7] << 8);
  } catch (error) {
    console.error('Error counting PE sections:', error);
    return 0;
  }
}

function getPEImportCount(bytes, peOffset) {
  try {
    if (peOffset === -1) return 0;
    
    // Get import directory RVA
    const importRVA = bytes[peOffset + 0x80] |
                     (bytes[peOffset + 0x81] << 8) |
                     (bytes[peOffset + 0x82] << 16) |
                     (bytes[peOffset + 0x83] << 24);
    
    if (importRVA === 0) return 0;
    
    // Count non-null import directory entries
    let count = 0;
    let offset = importRVA;
    
    while (offset < bytes.length - 20) {
      const firstThunk = bytes[offset + 16] |
                        (bytes[offset + 17] << 8) |
                        (bytes[offset + 18] << 16) |
                        (bytes[offset + 19] << 24);
      
      if (firstThunk === 0) break;
      count++;
      offset += 20;
    }
    
    return count;
  } catch (error) {
    console.error('Error counting PE imports:', error);
    return 0;
  }
}

// JPEG Analysis Helper Functions
function getJpegColorSpace(bytes) {
  try {
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] === 0xFF && bytes[offset + 1] === 0xC0) {
        const components = bytes[offset + 9];
        switch (components) {
          case 1: return 'Grayscale';
          case 3: return 'YCbCr';
          case 4: return 'CMYK';
          default: return 'Unknown';
        }
      }
      offset++;
    }
    return 'Unknown';
  } catch (error) {
    console.error('Error getting JPEG color space:', error);
    return 'Unknown';
  }
}

function getJpegCompression(bytes) {
  try {
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] === 0xFF && bytes[offset + 1] === 0xC0) {
        return 'Baseline DCT';
      } else if (bytes[offset] === 0xFF && bytes[offset + 1] === 0xC2) {
        return 'Progressive DCT';
      }
      offset++;
    }
    return 'Unknown';
  } catch (error) {
    console.error('Error getting JPEG compression:', error);
    return 'Unknown';
  }
}

function checkJpegThumbnails(bytes) {
  try {
    for (let i = 0; i < bytes.length - 10; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xE1) {
        const exif = new TextDecoder().decode(bytes.slice(i + 4, i + 8));
        if (exif === 'Exif') {
          // Check for thumbnail IFD
          const tiffHeader = i + 10;
          const ifdOffset = bytes[tiffHeader + 4] |
                          (bytes[tiffHeader + 5] << 8) |
                          (bytes[tiffHeader + 6] << 16) |
                          (bytes[tiffHeader + 7] << 24);
          return ifdOffset > 0;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking JPEG thumbnails:', error);
    return false;
  }
}

// GIF Analysis Helper Functions
function getGifColorDepth(bytes) {
  try {
    if (bytes.length < 10) return 'Unknown';
    const packedField = bytes[10];
    const bitsPerPixel = (packedField & 0x07) + 1;
    return `${bitsPerPixel} bits`;
  } catch (error) {
    console.error('Error getting GIF color depth:', error);
    return 'Unknown';
  }
}

function getGifDimensions(bytes) {
  try {
    if (bytes.length < 8) return 'Unknown';
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    return `${width}x${height}`;
  } catch (error) {
    console.error('Error getting GIF dimensions:', error);
    return 'Unknown';
  }
}

// Add these missing ELF-related functions
function countElfSections(bytes) {
  try {
    if (bytes.length < 48) return 0;
    return bytes[48] | (bytes[49] << 8);
  } catch (error) {
    console.error('Error counting ELF sections:', error);
    return 0;
  }
}

function getElfEntryPoint(bytes) {
  try {
    if (bytes.length < 27) return 'Unknown';
    const is64bit = bytes[4] === 2;
    const entryOffset = is64bit ? 24 : 28;
    
    if (bytes.length < entryOffset + 8) return 'Unknown';
    
    let entry = 0;
    if (is64bit) {
      entry = bytes[entryOffset] |
              (bytes[entryOffset + 1] << 8) |
              (bytes[entryOffset + 2] << 16) |
              (bytes[entryOffset + 3] << 24) |
              (bytes[entryOffset + 4] << 32) |
              (bytes[entryOffset + 5] << 40) |
              (bytes[entryOffset + 6] << 48) |
              (bytes[entryOffset + 7] << 56);
    } else {
      entry = bytes[entryOffset] |
              (bytes[entryOffset + 1] << 8) |
              (bytes[entryOffset + 2] << 16) |
              (bytes[entryOffset + 3] << 24);
    }
    
    return `0x${entry.toString(16).padStart(is64bit ? 16 : 8, '0')}`;
  } catch (error) {
    console.error('Error getting ELF entry point:', error);
    return 'Unknown';
  }
}

// Add Mach-O analysis functions
function analyzeMachOStructure(bytes) {
  try {
    const machODetails = {
      type: getMachOType(bytes),
      architecture: getMachOArchitecture(bytes),
      loadCommands: countMachOLoadCommands(bytes),
      segments: getMachOSegments(bytes),
      isDynamicallyLinked: checkMachODynamicLinking(bytes),
      minimumVersion: getMachOMinVersion(bytes)
    };

    return machODetails;
  } catch (error) {
    console.error('Error analyzing Mach-O structure:', error);
    return { error: error.message };
  }
}

function getMachOType(bytes) {
  try {
    const magic = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
    const types = {
      0xFEEDFACF: '64-bit Executable',
      0xFEEDFACE: '32-bit Executable',
      0xCAFEBABE: 'Universal Binary',
      0xCFFAEDFE: '64-bit Big-Endian',
      0xCEFAEDFE: '32-bit Big-Endian'
    };
    return types[magic] || 'Unknown';
  } catch (error) {
    console.error('Error getting Mach-O type:', error);
    return 'Unknown';
  }
}

function getMachOArchitecture(bytes) {
  try {
    if (isMachOUniversal(bytes)) {
      return getUniversalArchitectures(bytes);
    }

    const cputype = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const cpusubtypes = {
      0x7: 'x86',
      0x1000007: 'x86_64',
      0xC: 'ARM',
      0x100000C: 'ARM64'
    };
    return cpusubtypes[cputype] || `Unknown (${cputype.toString(16)})`;
  } catch (error) {
    console.error('Error getting Mach-O architecture:', error);
    return 'Unknown';
  }
}

function countMachOLoadCommands(bytes) {
  try {
    const ncmds = bytes[16] | (bytes[17] << 8) | (bytes[18] << 16) | (bytes[19] << 24);
    return ncmds;
  } catch (error) {
    console.error('Error counting Mach-O load commands:', error);
    return 0;
  }
}

function getMachOSegments(bytes) {
  try {
    const segments = [];
    let offset = 32; // Skip Mach header
    const ncmds = countMachOLoadCommands(bytes);
    
    for (let i = 0; i < ncmds; i++) {
      const cmd = bytes[offset] | (bytes[offset + 1] << 8) | 
                 (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
      const cmdsize = bytes[offset + 4] | (bytes[offset + 5] << 8) | 
                     (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
      
      if (cmd === 0x19) { // LC_SEGMENT_64
        const segname = new TextDecoder().decode(bytes.slice(offset + 8, offset + 24)).replace(/\0/g, '');
        segments.push(segname);
      }
      
      offset += cmdsize;
    }
    
    return segments;
  } catch (error) {
    console.error('Error getting Mach-O segments:', error);
    return [];
  }
}

function checkMachODynamicLinking(bytes) {
  try {
    let offset = 32; // Skip Mach header
    const ncmds = countMachOLoadCommands(bytes);
    
    for (let i = 0; i < ncmds; i++) {
      const cmd = bytes[offset] | (bytes[offset + 1] << 8) | 
                 (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
      const cmdsize = bytes[offset + 4] | (bytes[offset + 5] << 8) | 
                     (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
      
      if (cmd === 0x0C || cmd === 0x0D) { // LC_LOAD_DYLIB or LC_LOAD_WEAK_DYLIB
        return true;
      }
      
      offset += cmdsize;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking Mach-O dynamic linking:', error);
    return false;
  }
}

function getMachOMinVersion(bytes) {
  try {
    let offset = 32; // Skip Mach header
    const ncmds = countMachOLoadCommands(bytes);
    
    for (let i = 0; i < ncmds; i++) {
      const cmd = bytes[offset] | (bytes[offset + 1] << 8) | 
                 (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
      const cmdsize = bytes[offset + 4] | (bytes[offset + 5] << 8) | 
                     (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
      
      if (cmd === 0x24) { // LC_VERSION_MIN_MACOSX
        const version = bytes[offset + 8] | (bytes[offset + 9] << 8) | 
                       (bytes[offset + 10] << 16) | (bytes[offset + 11] << 24);
        const major = (version >> 16) & 0xFF;
        const minor = (version >> 8) & 0xFF;
        const patch = version & 0xFF;
        return `${major}.${minor}.${patch}`;
      }
      
      offset += cmdsize;
    }
    
    return 'Unknown';
  } catch (error) {
    console.error('Error getting Mach-O minimum version:', error);
    return 'Unknown';
  }
}

function isMachOUniversal(bytes) {
  try {
    const magic = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
    return magic === 0xCAFEBABE;
  } catch (error) {
    return false;
  }
}

function getUniversalArchitectures(bytes) {
  try {
    if (!isMachOUniversal(bytes)) return [];
    
    const nfat_arch = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const architectures = [];
    
    for (let i = 0; i < nfat_arch; i++) {
      const offset = 8 + (i * 20); // fat_header size + (i * fat_arch size)
      const cputype = bytes[offset] | (bytes[offset + 1] << 8) | 
                     (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
      
      const cpusubtypes = {
        0x7: 'x86',
        0x1000007: 'x86_64',
        0xC: 'ARM',
        0x100000C: 'ARM64'
      };
      
      architectures.push(cpusubtypes[cputype] || `Unknown (${cputype.toString(16)})`);
    }
    
    return architectures;
  } catch (error) {
    console.error('Error getting Universal Binary architectures:', error);
    return [];
  }
}

// Export the functions
export {
  findPEHeaderOffset,
  analyzePEStructure,
  detectSpecificFileType,
  detectNestedFiles
}; 