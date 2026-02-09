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

import { FILE_SIGNATURES, detectFileTypes, isFileType, isMachOFatBinary } from './fileSignatures';
import { extractMetadata } from './metadataExtractor';
import { createLogger } from './logger';

const logger = createLogger('AdvancedFileDetection');

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
    logger.error('Error in findPEHeaderOffset:', error);
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
    logger.error('Error analyzing PE structure:', error);
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
        } else if (type.name.includes('Mach-O')) {
          enhanced.details = analyzeMachOStructure(bytes);
          enhanced.metadata = extractMetadata(bytes, type.name);
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
          enhanced.metadata = extractMetadata(bytes, type.name);
        } else if (type.name === 'JPEG Image') {
          enhanced.details = analyzeJpegStructure(bytes);
        } else if (type.name === 'GIF Image') {
          enhanced.details = analyzeGifStructure(bytes);
        }
      } catch (error) {
        logger.error(`Error analyzing ${type.name}:`, error);
        enhanced.details = { error: error.message };
      }
      
      enhancedTypes.push(enhanced);
    }
    
    return enhancedTypes;
  } catch (error) {
    logger.error('Error in detectSpecificFileType:', error);
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
    logger.error('Error extracting PDF version:', error);
    return 'Unknown';
  }
}

function isPdfEncrypted(bytes) {
  try {
    // Look for /Encrypt in the first 1024 bytes
    const header = new TextDecoder().decode(bytes.slice(0, 1024));
    return header.includes('/Encrypt');
  } catch (error) {
    logger.error('Error checking PDF encryption:', error);
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
    logger.error('Error counting PDF objects:', error);
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
    logger.error('Error counting ZIP entries:', error);
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
    logger.error('Error checking ZIP compression:', error);
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
    logger.error('Error extracting ZIP comment:', error);
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
    logger.error('Error extracting PNG dimensions:', error);
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
    logger.error('Error extracting PNG color type:', error);
    return 'Unknown';
  }
}

function extractPngCompression(bytes) {
  try {
    if (bytes.length < 24) return 'Unknown';
    const compression = bytes[24];
    return compression === 0 ? 'Deflate' : 'Unknown';
  } catch (error) {
    logger.error('Error extracting PNG compression:', error);
    return 'Unknown';
  }
}

// Add these new analyzer functions
function analyzeElfStructure(bytes) {
  try {
    const sectionList = getElfSections(bytes);
    const sectionNames = sectionList.map(s => s.name).filter(n => n.length > 0);
    const interpreter = getElfInterpreter(bytes);
    const dependencies = getElfDependencies(bytes);
    const { segments, hasRWX } = getElfSegmentPermissions(bytes);
    const security = getElfSecurityFeatures(bytes);
    const { rpath, runpath } = getElfRpath(bytes);
    const isStripped = getElfIsStripped(bytes);

    return {
      class: getElfClass(bytes),
      type: getElfType(bytes),
      machine: getElfMachine(bytes),
      sections: countElfSections(bytes),
      entryPoint: getElfEntryPoint(bytes),
      sectionNames,
      isDynamicallyLinked: interpreter !== null,
      interpreter,
      dependencies,
      segments,
      hasRWXSegments: hasRWX,
      pie: security.pie,
      executableStack: security.executableStack,
      relro: security.relro,
      textrel: security.textrel,
      isStripped,
      rpath,
      runpath
    };
  } catch (error) {
    logger.error('Error analyzing ELF structure:', error);
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
    logger.error('Error analyzing JPEG structure:', error);
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
    logger.error('Error analyzing GIF structure:', error);
    return { error: 'Failed to analyze GIF structure' };
  }
}

// ── ELF Core Utilities ──

function isElfBigEndian(bytes) { return bytes[5] === 2; }
function isElf64bit(bytes) { return bytes[4] === 2; }

function readElfUint16(bytes, offset, bigEndian) {
  if (offset + 2 > bytes.length) return 0;
  if (bigEndian) return (bytes[offset] << 8) | bytes[offset + 1];
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readElfUint32(bytes, offset, bigEndian) {
  if (offset + 4 > bytes.length) return 0;
  if (bigEndian) {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }
  return ((bytes[offset]) | (bytes[offset + 1] << 8) |
          (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readElfUint64(bytes, offset, bigEndian) {
  if (offset + 8 > bytes.length) return 0;
  const lo = readElfUint32(bytes, offset, bigEndian);
  const hi = readElfUint32(bytes, offset + 4, bigEndian);
  if (bigEndian) return hi + lo * 0x100000000;
  return lo + hi * 0x100000000;
}

function getElfHeaderInfo(bytes) {
  const is64 = isElf64bit(bytes);
  const bigEndian = isElfBigEndian(bytes);
  if (is64) {
    if (bytes.length < 64) return null;
    return {
      is64, bigEndian,
      type: readElfUint16(bytes, 16, bigEndian),
      machine: readElfUint16(bytes, 18, bigEndian),
      entry: readElfUint64(bytes, 24, bigEndian),
      phoff: readElfUint64(bytes, 32, bigEndian),
      shoff: readElfUint64(bytes, 40, bigEndian),
      flags: readElfUint32(bytes, 48, bigEndian),
      phentsize: readElfUint16(bytes, 54, bigEndian),
      phnum: readElfUint16(bytes, 56, bigEndian),
      shentsize: readElfUint16(bytes, 58, bigEndian),
      shnum: readElfUint16(bytes, 60, bigEndian),
      shstrndx: readElfUint16(bytes, 62, bigEndian)
    };
  }
  if (bytes.length < 52) return null;
  return {
    is64, bigEndian,
    type: readElfUint16(bytes, 16, bigEndian),
    machine: readElfUint16(bytes, 18, bigEndian),
    entry: readElfUint32(bytes, 24, bigEndian),
    phoff: readElfUint32(bytes, 28, bigEndian),
    shoff: readElfUint32(bytes, 32, bigEndian),
    flags: readElfUint32(bytes, 36, bigEndian),
    phentsize: readElfUint16(bytes, 42, bigEndian),
    phnum: readElfUint16(bytes, 44, bigEndian),
    shentsize: readElfUint16(bytes, 46, bigEndian),
    shnum: readElfUint16(bytes, 48, bigEndian),
    shstrndx: readElfUint16(bytes, 50, bigEndian)
  };
}

// ── ELF Program Header Helpers ──

const ELF_PT_NAMES = {
  0: 'PT_NULL', 1: 'PT_LOAD', 2: 'PT_DYNAMIC', 3: 'PT_INTERP',
  4: 'PT_NOTE', 5: 'PT_SHLIB', 6: 'PT_PHDR', 7: 'PT_TLS',
  0x6474E550: 'PT_GNU_EH_FRAME', 0x6474E551: 'PT_GNU_STACK',
  0x6474E552: 'PT_GNU_RELRO', 0x6474E553: 'PT_GNU_PROPERTY'
};

function getElfProgramHeaders(bytes) {
  try {
    const hdr = getElfHeaderInfo(bytes);
    if (!hdr || hdr.phoff === 0 || hdr.phnum === 0) return [];

    const headers = [];
    for (let i = 0; i < hdr.phnum; i++) {
      const off = hdr.phoff + i * hdr.phentsize;
      if (off + hdr.phentsize > bytes.length) break;

      let pType, pFlags, pOffset, pFilesz, pMemsz;
      if (hdr.is64) {
        pType = readElfUint32(bytes, off, hdr.bigEndian);
        pFlags = readElfUint32(bytes, off + 4, hdr.bigEndian);
        pOffset = readElfUint64(bytes, off + 8, hdr.bigEndian);
        pFilesz = readElfUint64(bytes, off + 32, hdr.bigEndian);
        pMemsz = readElfUint64(bytes, off + 40, hdr.bigEndian);
      } else {
        pType = readElfUint32(bytes, off, hdr.bigEndian);
        pOffset = readElfUint32(bytes, off + 4, hdr.bigEndian);
        pFilesz = readElfUint32(bytes, off + 16, hdr.bigEndian);
        pMemsz = readElfUint32(bytes, off + 20, hdr.bigEndian);
        pFlags = readElfUint32(bytes, off + 24, hdr.bigEndian);
      }

      headers.push({
        type: ELF_PT_NAMES[pType] || `0x${pType.toString(16)}`,
        typeValue: pType,
        flags: pFlags,
        offset: pOffset,
        filesz: pFilesz,
        memsz: pMemsz
      });
    }
    return headers;
  } catch (error) {
    logger.error('Error getting ELF program headers:', error);
    return [];
  }
}

function getElfSections(bytes) {
  try {
    const hdr = getElfHeaderInfo(bytes);
    if (!hdr || hdr.shoff === 0 || hdr.shnum === 0) return [];

    // Read section name string table (.shstrtab)
    let strtabData = null;
    if (hdr.shstrndx > 0 && hdr.shstrndx < hdr.shnum) {
      const strtabOff = hdr.shoff + hdr.shstrndx * hdr.shentsize;
      if (strtabOff + hdr.shentsize <= bytes.length) {
        let shOffset, shSize;
        if (hdr.is64) {
          shOffset = readElfUint64(bytes, strtabOff + 24, hdr.bigEndian);
          shSize = readElfUint64(bytes, strtabOff + 32, hdr.bigEndian);
        } else {
          shOffset = readElfUint32(bytes, strtabOff + 16, hdr.bigEndian);
          shSize = readElfUint32(bytes, strtabOff + 20, hdr.bigEndian);
        }
        if (shOffset + shSize <= bytes.length) {
          strtabData = bytes.slice(shOffset, shOffset + shSize);
        }
      }
    }

    const readSectionName = (nameIdx) => {
      if (!strtabData || nameIdx >= strtabData.length) return '';
      let end = nameIdx;
      while (end < strtabData.length && strtabData[end] !== 0) end++;
      return new TextDecoder().decode(strtabData.slice(nameIdx, end));
    };

    const sections = [];
    for (let i = 0; i < hdr.shnum; i++) {
      const off = hdr.shoff + i * hdr.shentsize;
      if (off + hdr.shentsize > bytes.length) break;

      const shName = readElfUint32(bytes, off, hdr.bigEndian);
      const shType = readElfUint32(bytes, off + 4, hdr.bigEndian);
      let shFlags, shAddr, shSize;
      if (hdr.is64) {
        shFlags = readElfUint64(bytes, off + 8, hdr.bigEndian);
        shAddr = readElfUint64(bytes, off + 16, hdr.bigEndian);
        shSize = readElfUint64(bytes, off + 32, hdr.bigEndian);
      } else {
        shFlags = readElfUint32(bytes, off + 8, hdr.bigEndian);
        shAddr = readElfUint32(bytes, off + 12, hdr.bigEndian);
        shSize = readElfUint32(bytes, off + 20, hdr.bigEndian);
      }

      sections.push({
        name: readSectionName(shName),
        type: shType,
        flags: shFlags,
        addr: shAddr,
        size: shSize
      });
    }
    return sections;
  } catch (error) {
    logger.error('Error getting ELF sections:', error);
    return [];
  }
}

function getElfDynamicEntries(bytes) {
  try {
    const hdr = getElfHeaderInfo(bytes);
    if (!hdr) return { entries: [], strtab: null };

    // Find PT_DYNAMIC program header
    const phdrs = getElfProgramHeaders(bytes);
    const dynPhdr = phdrs.find(p => p.typeValue === 2); // PT_DYNAMIC
    if (!dynPhdr || dynPhdr.offset + dynPhdr.filesz > bytes.length) return { entries: [], strtab: null };

    // Read all dynamic entries
    const entries = [];
    const entrySize = hdr.is64 ? 16 : 8;
    let off = dynPhdr.offset;
    const end = dynPhdr.offset + dynPhdr.filesz;

    while (off + entrySize <= end && off + entrySize <= bytes.length) {
      let tag, val;
      if (hdr.is64) {
        tag = readElfUint64(bytes, off, hdr.bigEndian);
        val = readElfUint64(bytes, off + 8, hdr.bigEndian);
      } else {
        tag = readElfUint32(bytes, off, hdr.bigEndian);
        val = readElfUint32(bytes, off + 4, hdr.bigEndian);
      }
      if (tag === 0) break; // DT_NULL
      entries.push({ tag, val });
      off += entrySize;
    }

    // Find DT_STRTAB (tag 5) offset and DT_STRSZ (tag 10) for string resolution
    const strtabEntry = entries.find(e => e.tag === 5);
    const strszEntry = entries.find(e => e.tag === 10);
    let strtab = null;

    if (strtabEntry) {
      // DT_STRTAB is a virtual address; we need to find which PT_LOAD segment maps it
      const strtabVA = strtabEntry.val;
      const strsz = strszEntry ? strszEntry.val : 4096; // fallback size
      const loadSeg = phdrs.find(p => p.typeValue === 1 && strtabVA >= p.offset &&
                                       strtabVA < p.offset + p.filesz);
      // Try direct file offset first (works when VA == file offset, common for non-PIE)
      // Then try mapping through PT_LOAD segments
      let fileOffset = null;
      for (const seg of phdrs) {
        if (seg.typeValue !== 1) continue; // PT_LOAD only
        // VA range for this segment: [seg.vaddr, seg.vaddr + seg.filesz)
        // We need the vaddr, which we parse fresh here
        const segOff = hdr.phoff + phdrs.indexOf(seg) * hdr.phentsize;
        let vaddr;
        if (hdr.is64) {
          vaddr = readElfUint64(bytes, segOff + 16, hdr.bigEndian);
        } else {
          vaddr = readElfUint32(bytes, segOff + 8, hdr.bigEndian);
        }
        if (strtabVA >= vaddr && strtabVA < vaddr + seg.filesz) {
          fileOffset = seg.offset + (strtabVA - vaddr);
          break;
        }
      }

      if (fileOffset !== null && fileOffset < bytes.length) {
        const tabEnd = Math.min(fileOffset + strsz, bytes.length);
        strtab = bytes.slice(fileOffset, tabEnd);
      }
    }

    return { entries, strtab };
  } catch (error) {
    logger.error('Error getting ELF dynamic entries:', error);
    return { entries: [], strtab: null };
  }
}

function readDynString(strtab, nameIdx) {
  if (!strtab || nameIdx >= strtab.length) return null;
  let end = nameIdx;
  while (end < strtab.length && strtab[end] !== 0) end++;
  return new TextDecoder().decode(strtab.slice(nameIdx, end));
}

function getElfDependencies(bytes) {
  try {
    const { entries, strtab } = getElfDynamicEntries(bytes);
    const deps = [];
    for (const e of entries) {
      if (e.tag === 1) { // DT_NEEDED
        const name = readDynString(strtab, e.val);
        if (name) deps.push(name);
      }
    }
    return deps;
  } catch (error) {
    logger.error('Error getting ELF dependencies:', error);
    return [];
  }
}

function getElfSecurityFeatures(bytes) {
  try {
    const hdr = getElfHeaderInfo(bytes);
    if (!hdr) return { pie: false, executableStack: false, relro: 'none', textrel: false };

    const phdrs = getElfProgramHeaders(bytes);
    const { entries } = getElfDynamicEntries(bytes);

    // PIE: e_type === ET_DYN (3) AND has PT_INTERP
    const pie = hdr.type === 3 && phdrs.some(p => p.typeValue === 3);

    // Executable stack: PT_GNU_STACK with PF_X (bit 0) set
    const gnuStack = phdrs.find(p => p.typeValue === 0x6474E551);
    const executableStack = gnuStack ? (gnuStack.flags & 1) !== 0 : false;

    // RELRO: PT_GNU_RELRO present → partial; also DT_BIND_NOW → full
    const hasRelro = phdrs.some(p => p.typeValue === 0x6474E552);
    const hasBindNow = entries.some(e => e.tag === 24); // DT_BIND_NOW
    // Also check DT_FLAGS (tag 30) for DF_BIND_NOW (0x8)
    const flagsEntry = entries.find(e => e.tag === 30);
    const dfBindNow = flagsEntry ? (flagsEntry.val & 0x8) !== 0 : false;
    const relro = hasRelro ? ((hasBindNow || dfBindNow) ? 'full' : 'partial') : 'none';

    // TEXTREL: DT_TEXTREL (tag 22) present
    const textrel = entries.some(e => e.tag === 22);

    return { pie, executableStack, relro, textrel };
  } catch (error) {
    logger.error('Error getting ELF security features:', error);
    return { pie: false, executableStack: false, relro: 'none', textrel: false };
  }
}

function getElfRpath(bytes) {
  try {
    const { entries, strtab } = getElfDynamicEntries(bytes);
    let rpath = null;
    let runpath = null;
    for (const e of entries) {
      if (e.tag === 15) { // DT_RPATH
        rpath = readDynString(strtab, e.val);
      } else if (e.tag === 29) { // DT_RUNPATH
        runpath = readDynString(strtab, e.val);
      }
    }
    return { rpath, runpath };
  } catch (error) {
    logger.error('Error getting ELF rpath:', error);
    return { rpath: null, runpath: null };
  }
}

function getElfIsStripped(bytes) {
  try {
    const sections = getElfSections(bytes);
    return !sections.some(s => s.name === '.symtab');
  } catch (error) {
    logger.error('Error checking if ELF is stripped:', error);
    return false;
  }
}

function getElfInterpreter(bytes) {
  try {
    const phdrs = getElfProgramHeaders(bytes);
    const interp = phdrs.find(p => p.typeValue === 3); // PT_INTERP
    if (!interp || interp.offset + interp.filesz > bytes.length) return null;

    let end = interp.offset;
    const limit = Math.min(interp.offset + interp.filesz, bytes.length);
    while (end < limit && bytes[end] !== 0) end++;
    return new TextDecoder().decode(bytes.slice(interp.offset, end));
  } catch (error) {
    logger.error('Error getting ELF interpreter:', error);
    return null;
  }
}

function getElfSegmentPermissions(bytes) {
  try {
    const phdrs = getElfProgramHeaders(bytes);
    const segments = [];
    let hasRWX = false;

    for (const p of phdrs) {
      if (p.typeValue !== 1) continue; // PT_LOAD only
      const r = (p.flags & 4) ? 'r' : '-';
      const w = (p.flags & 2) ? 'w' : '-';
      const x = (p.flags & 1) ? 'x' : '-';
      const flagsStr = r + w + x;
      if ((p.flags & 7) === 7) hasRWX = true;
      segments.push({ type: 'PT_LOAD', flags: flagsStr, memsz: p.memsz });
    }

    return { segments, hasRWX };
  } catch (error) {
    logger.error('Error getting ELF segment permissions:', error);
    return { segments: [], hasRWX: false };
  }
}

// ── ELF Basic Field Helpers (fixed for endianness) ──

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
  const bigEndian = isElfBigEndian(bytes);
  const type = readElfUint16(bytes, 16, bigEndian);
  return types[type] || 'Unknown';
}

function getElfMachine(bytes) {
  const machines = {
    0x03: 'x86',
    0x3E: 'x86-64',
    0x28: 'ARM',
    0xB7: 'AArch64'
  };
  const bigEndian = isElfBigEndian(bytes);
  const machine = readElfUint16(bytes, 18, bigEndian);
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
    logger.error('Error getting PE timestamp:', error);
    return 'Unknown';
  }
}

function countPESections(bytes, peOffset) {
  try {
    if (peOffset === -1) return 0;
    
    return bytes[peOffset + 6] | (bytes[peOffset + 7] << 8);
  } catch (error) {
    logger.error('Error counting PE sections:', error);
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
    logger.error('Error counting PE imports:', error);
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
    logger.error('Error getting JPEG color space:', error);
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
    logger.error('Error getting JPEG compression:', error);
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
    logger.error('Error checking JPEG thumbnails:', error);
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
    logger.error('Error getting GIF color depth:', error);
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
    logger.error('Error getting GIF dimensions:', error);
    return 'Unknown';
  }
}

function countElfSections(bytes) {
  try {
    const hdr = getElfHeaderInfo(bytes);
    if (!hdr) return 0;
    return hdr.shnum;
  } catch (error) {
    logger.error('Error counting ELF sections:', error);
    return 0;
  }
}

function getElfEntryPoint(bytes) {
  try {
    const hdr = getElfHeaderInfo(bytes);
    if (!hdr) return 'Unknown';
    const padLen = hdr.is64 ? 16 : 8;
    return `0x${hdr.entry.toString(16).padStart(padLen, '0')}`;
  } catch (error) {
    logger.error('Error getting ELF entry point:', error);
    return 'Unknown';
  }
}

// Mach-O endianness helpers
function isMachOBigEndian(bytes) {
  return bytes[0] === 0xFE && bytes[1] === 0xED && bytes[2] === 0xFA &&
         (bytes[3] === 0xCE || bytes[3] === 0xCF);
}

function isMachOUniversal(bytes) {
  return bytes.length >= 4 &&
         bytes[0] === 0xCA && bytes[1] === 0xFE &&
         bytes[2] === 0xBA && bytes[3] === 0xBE &&
         isMachOFatBinary(bytes);
}

function readMachOUint32(bytes, offset, bigEndian) {
  if (bigEndian) {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }
  return ((bytes[offset]) | (bytes[offset + 1] << 8) |
          (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function isMachO64bit(bytes) {
  // 64-bit big-endian: FE ED FA CF, 64-bit little-endian: CF FA ED FE
  return (bytes[0] === 0xFE && bytes[3] === 0xCF) ||
         (bytes[0] === 0xCF && bytes[3] === 0xFE);
}

function getMachOHeaderSize(bytes) {
  return isMachO64bit(bytes) ? 32 : 28;
}

// Add Mach-O analysis functions
function analyzeMachOStructure(bytes) {
  try {
    const isUniversal = isMachOUniversal(bytes);

    // Helper to extract full details from a single-arch Mach-O binary
    const extractFullDetails = (b) => {
      const { dylibs, weakDylibs } = getMachODylibs(b);
      const { hasCodeSignature, codeSignatureSize } = getMachOCodeSignature(b);
      const { isEncrypted } = getMachOEncryptionInfo(b);
      const flags = getMachOFlags(b);
      const segments = getMachOSegments(b);
      const hasRWXSegments = segments.some(s => s.isRWX);
      const buildVersion = getMachOBuildVersion(b);

      return {
        fileType: getMachOFileType(b),
        loadCommands: countMachOLoadCommands(b),
        segments,
        isDynamicallyLinked: checkMachODynamicLinking(b),
        dylibs,
        weakDylibs,
        hasCodeSignature,
        codeSignatureSize,
        isEncrypted,
        entryPoint: getMachOEntryPoint(b),
        minimumVersion: getMachOMinVersion(b),
        buildVersion,
        pie: flags.pie,
        allowStackExecution: flags.allowStackExecution,
        noHeapExecution: flags.noHeapExecution,
        hasRWXSegments
      };
    };

    if (isUniversal) {
      const architectures = getUniversalArchitectures(bytes);
      const nfat_arch = readMachOUint32(bytes, 4, true);

      // Parse the first architecture slice for detailed analysis
      let sliceDetails = {};
      if (bytes.length >= 28) {
        const firstSliceOffset = readMachOUint32(bytes, 16, true);
        const firstSliceSize = readMachOUint32(bytes, 20, true);
        if (firstSliceOffset > 0 && firstSliceOffset < bytes.length) {
          const sliceEnd = Math.min(firstSliceOffset + firstSliceSize, bytes.length);
          const sliceBytes = bytes.slice(firstSliceOffset, sliceEnd);
          if (sliceBytes.length > 32) {
            sliceDetails = extractFullDetails(sliceBytes);
          }
        }
      }

      return {
        type: 'Universal Binary',
        architectureCount: nfat_arch,
        architectures: architectures,
        ...sliceDetails
      };
    }

    return {
      type: getMachOType(bytes),
      architecture: getMachOArchitecture(bytes),
      ...extractFullDetails(bytes)
    };
  } catch (error) {
    logger.error('Error analyzing Mach-O structure:', error);
    return { error: error.message };
  }
}

function getMachOType(bytes) {
  try {
    if (bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE) return 'Universal Binary';
    if (bytes[0] === 0xFE && bytes[1] === 0xED && bytes[2] === 0xFA && bytes[3] === 0xCF) return '64-bit Executable (Big-Endian)';
    if (bytes[0] === 0xFE && bytes[1] === 0xED && bytes[2] === 0xFA && bytes[3] === 0xCE) return '32-bit Executable (Big-Endian)';
    if (bytes[0] === 0xCF && bytes[1] === 0xFA && bytes[2] === 0xED && bytes[3] === 0xFE) return '64-bit Executable';
    if (bytes[0] === 0xCE && bytes[1] === 0xFA && bytes[2] === 0xED && bytes[3] === 0xFE) return '32-bit Executable';
    return 'Unknown';
  } catch (error) {
    logger.error('Error getting Mach-O type:', error);
    return 'Unknown';
  }
}

function getMachOArchitecture(bytes) {
  try {
    if (isMachOUniversal(bytes)) {
      return getUniversalArchitectures(bytes);
    }

    const bigEndian = isMachOBigEndian(bytes);
    const cputype = readMachOUint32(bytes, 4, bigEndian);
    const cpuNames = {
      0x7: 'x86',
      0x01000007: 'x86_64',
      0xC: 'ARM',
      0x0100000C: 'ARM64'
    };
    return cpuNames[cputype] || `Unknown (0x${cputype.toString(16)})`;
  } catch (error) {
    logger.error('Error getting Mach-O architecture:', error);
    return 'Unknown';
  }
}

function countMachOLoadCommands(bytes) {
  try {
    if (bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE) return 0;
    const bigEndian = isMachOBigEndian(bytes);
    return readMachOUint32(bytes, 16, bigEndian);
  } catch (error) {
    logger.error('Error counting Mach-O load commands:', error);
    return 0;
  }
}

function getMachOSegments(bytes) {
  try {
    if (bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE) return [];
    const bigEndian = isMachOBigEndian(bytes);
    const is64 = isMachO64bit(bytes);
    const headerSize = getMachOHeaderSize(bytes);
    const segments = [];
    let offset = headerSize;
    const ncmds = countMachOLoadCommands(bytes);

    const formatProt = (p) => {
      return ((p & 1) ? 'r' : '-') + ((p & 2) ? 'w' : '-') + ((p & 4) ? 'x' : '-');
    };

    for (let i = 0; i < ncmds && offset < bytes.length - 8; i++) {
      const cmd = readMachOUint32(bytes, offset, bigEndian);
      const cmdsize = readMachOUint32(bytes, offset + 4, bigEndian);
      if (cmdsize === 0) break;

      if (cmd === 0x19 || cmd === 0x01) { // LC_SEGMENT_64 or LC_SEGMENT
        const segname = new TextDecoder().decode(bytes.slice(offset + 8, offset + 24)).replace(/\0/g, '');
        let vmsize, maxprot, initprot;
        if (is64) {
          // LC_SEGMENT_64: vmsize at +24 (8 bytes), maxprot at +48, initprot at +52
          const vmsizeLo = readMachOUint32(bytes, offset + 24, bigEndian);
          const vmsizeHi = readMachOUint32(bytes, offset + 28, bigEndian);
          vmsize = bigEndian ? (vmsizeHi + vmsizeLo * 0x100000000) : (vmsizeLo + vmsizeHi * 0x100000000);
          maxprot = readMachOUint32(bytes, offset + 48, bigEndian);
          initprot = readMachOUint32(bytes, offset + 52, bigEndian);
        } else {
          // LC_SEGMENT: vmsize at +20 (4 bytes), maxprot at +32, initprot at +36
          vmsize = readMachOUint32(bytes, offset + 20, bigEndian);
          maxprot = readMachOUint32(bytes, offset + 32, bigEndian);
          initprot = readMachOUint32(bytes, offset + 36, bigEndian);
        }
        segments.push({
          name: segname,
          vmsize: vmsize,
          maxprot: formatProt(maxprot),
          initprot: formatProt(initprot),
          isRWX: (initprot & 7) === 7
        });
      }

      offset += cmdsize;
    }

    return segments;
  } catch (error) {
    logger.error('Error getting Mach-O segments:', error);
    return [];
  }
}

function checkMachODynamicLinking(bytes) {
  try {
    if (bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE) return false;
    const bigEndian = isMachOBigEndian(bytes);
    const headerSize = getMachOHeaderSize(bytes);
    let offset = headerSize;
    const ncmds = countMachOLoadCommands(bytes);

    for (let i = 0; i < ncmds && offset < bytes.length - 8; i++) {
      const cmd = readMachOUint32(bytes, offset, bigEndian);
      const cmdsize = readMachOUint32(bytes, offset + 4, bigEndian);
      if (cmdsize === 0) break;

      if (cmd === 0x0C || cmd === 0x0D) { // LC_LOAD_DYLIB or LC_LOAD_WEAK_DYLIB
        return true;
      }

      offset += cmdsize;
    }

    return false;
  } catch (error) {
    logger.error('Error checking Mach-O dynamic linking:', error);
    return false;
  }
}

function getMachOMinVersion(bytes) {
  try {
    if (bytes[0] === 0xCA && bytes[1] === 0xFE && bytes[2] === 0xBA && bytes[3] === 0xBE) return 'Unknown';
    const bigEndian = isMachOBigEndian(bytes);
    const headerSize = getMachOHeaderSize(bytes);
    let offset = headerSize;
    const ncmds = countMachOLoadCommands(bytes);

    for (let i = 0; i < ncmds && offset < bytes.length - 8; i++) {
      const cmd = readMachOUint32(bytes, offset, bigEndian);
      const cmdsize = readMachOUint32(bytes, offset + 4, bigEndian);
      if (cmdsize === 0) break;

      // LC_VERSION_MIN_MACOSX (0x24) or LC_BUILD_VERSION (0x32)
      if (cmd === 0x24) {
        const version = readMachOUint32(bytes, offset + 8, bigEndian);
        const major = (version >> 16) & 0xFF;
        const minor = (version >> 8) & 0xFF;
        const patch = version & 0xFF;
        return `${major}.${minor}.${patch}`;
      }

      offset += cmdsize;
    }

    return 'Unknown';
  } catch (error) {
    logger.error('Error getting Mach-O minimum version:', error);
    return 'Unknown';
  }
}

function getUniversalArchitectures(bytes) {
  try {
    if (!isMachOUniversal(bytes)) return [];

    // Fat header is always big-endian
    const nfat_arch = readMachOUint32(bytes, 4, true);
    const architectures = [];

    for (let i = 0; i < nfat_arch; i++) {
      const offset = 8 + (i * 20);
      const cputype = readMachOUint32(bytes, offset, true);

      const cpuNames = {
        0x00000007: 'x86',
        0x01000007: 'x86_64',
        0x0000000C: 'ARM',
        0x0100000C: 'ARM64',
        0x0200000C: 'ARM64_32',
        0x00000012: 'PowerPC',
        0x01000012: 'PowerPC64'
      };

      architectures.push(cpuNames[cputype] || `Unknown (0x${cputype.toString(16)})`);
    }

    return architectures;
  } catch (error) {
    logger.error('Error getting Universal Binary architectures:', error);
    return [];
  }
}

// Mach-O file type from mach_header filetype field
function getMachOFileType(bytes) {
  try {
    const bigEndian = isMachOBigEndian(bytes);
    const filetype = readMachOUint32(bytes, 12, bigEndian);
    const fileTypes = {
      1: 'Object',
      2: 'Executable',
      3: 'Fixed VM Library',
      4: 'Core Dump',
      5: 'Preloaded',
      6: 'Dynamic Library',
      7: 'Dynamic Linker',
      8: 'Bundle',
      9: 'Dylib Stub',
      10: 'Debug Symbols',
      11: 'Kext'
    };
    return fileTypes[filetype] || `Unknown (${filetype})`;
  } catch (error) {
    logger.error('Error getting Mach-O file type:', error);
    return 'Unknown';
  }
}

// Mach-O flags from mach_header
function getMachOFlags(bytes) {
  try {
    const bigEndian = isMachOBigEndian(bytes);
    const is64 = isMachO64bit(bytes);
    // flags is at offset 24 for both 32-bit and 64-bit mach_header
    const flagsOffset = 24;
    const flags = readMachOUint32(bytes, flagsOffset, bigEndian);
    return {
      pie: (flags & 0x200000) !== 0,
      allowStackExecution: (flags & 0x20000) !== 0,
      noHeapExecution: (flags & 0x1000000) !== 0,
      raw: flags
    };
  } catch (error) {
    logger.error('Error getting Mach-O flags:', error);
    return { pie: false, allowStackExecution: false, noHeapExecution: false, raw: 0 };
  }
}

// Walk load commands for dylib paths
function getMachODylibs(bytes) {
  try {
    const bigEndian = isMachOBigEndian(bytes);
    const headerSize = getMachOHeaderSize(bytes);
    const ncmds = countMachOLoadCommands(bytes);
    let offset = headerSize;
    const dylibs = [];
    const weakDylibs = [];

    const LC_LOAD_DYLIB = 0x0C;
    const LC_LOAD_WEAK_DYLIB = 0x18;
    const LC_REEXPORT_DYLIB = 0x1F;
    const LC_LAZY_LOAD_DYLIB = 0x20;

    for (let i = 0; i < ncmds && offset < bytes.length - 8; i++) {
      const cmd = readMachOUint32(bytes, offset, bigEndian);
      const cmdsize = readMachOUint32(bytes, offset + 4, bigEndian);
      if (cmdsize === 0) break;

      if (cmd === LC_LOAD_DYLIB || cmd === LC_REEXPORT_DYLIB || cmd === LC_LAZY_LOAD_DYLIB ||
          cmd === LC_LOAD_WEAK_DYLIB) {
        // String offset is at cmd+8 (lc_str offset within the load command)
        const strOffset = readMachOUint32(bytes, offset + 8, bigEndian);
        if (strOffset > 0 && strOffset < cmdsize) {
          let end = offset + strOffset;
          while (end < offset + cmdsize && end < bytes.length && bytes[end] !== 0) end++;
          const path = new TextDecoder().decode(bytes.slice(offset + strOffset, end));
          if (cmd === LC_LOAD_WEAK_DYLIB) {
            weakDylibs.push(path);
          } else {
            dylibs.push(path);
          }
        }
      }

      offset += cmdsize;
    }

    return { dylibs, weakDylibs };
  } catch (error) {
    logger.error('Error getting Mach-O dylibs:', error);
    return { dylibs: [], weakDylibs: [] };
  }
}

// Check for LC_CODE_SIGNATURE
function getMachOCodeSignature(bytes) {
  try {
    const bigEndian = isMachOBigEndian(bytes);
    const headerSize = getMachOHeaderSize(bytes);
    const ncmds = countMachOLoadCommands(bytes);
    let offset = headerSize;

    const LC_CODE_SIGNATURE = 0x1D;

    for (let i = 0; i < ncmds && offset < bytes.length - 8; i++) {
      const cmd = readMachOUint32(bytes, offset, bigEndian);
      const cmdsize = readMachOUint32(bytes, offset + 4, bigEndian);
      if (cmdsize === 0) break;

      if (cmd === LC_CODE_SIGNATURE) {
        const dataoff = readMachOUint32(bytes, offset + 8, bigEndian);
        const datasize = readMachOUint32(bytes, offset + 12, bigEndian);
        return { hasCodeSignature: true, codeSignatureSize: datasize };
      }

      offset += cmdsize;
    }

    return { hasCodeSignature: false, codeSignatureSize: 0 };
  } catch (error) {
    logger.error('Error getting Mach-O code signature:', error);
    return { hasCodeSignature: false, codeSignatureSize: 0 };
  }
}

// Check for LC_ENCRYPTION_INFO / LC_ENCRYPTION_INFO_64
function getMachOEncryptionInfo(bytes) {
  try {
    const bigEndian = isMachOBigEndian(bytes);
    const headerSize = getMachOHeaderSize(bytes);
    const ncmds = countMachOLoadCommands(bytes);
    let offset = headerSize;

    const LC_ENCRYPTION_INFO = 0x21;
    const LC_ENCRYPTION_INFO_64 = 0x2C;

    for (let i = 0; i < ncmds && offset < bytes.length - 8; i++) {
      const cmd = readMachOUint32(bytes, offset, bigEndian);
      const cmdsize = readMachOUint32(bytes, offset + 4, bigEndian);
      if (cmdsize === 0) break;

      if (cmd === LC_ENCRYPTION_INFO || cmd === LC_ENCRYPTION_INFO_64) {
        // cryptid is at offset+16 for both variants
        const cryptid = readMachOUint32(bytes, offset + 16, bigEndian);
        return { isEncrypted: cryptid !== 0 };
      }

      offset += cmdsize;
    }

    return { isEncrypted: false };
  } catch (error) {
    logger.error('Error getting Mach-O encryption info:', error);
    return { isEncrypted: false };
  }
}

// Parse LC_MAIN or LC_UNIXTHREAD for entry point
function getMachOEntryPoint(bytes) {
  try {
    const bigEndian = isMachOBigEndian(bytes);
    const headerSize = getMachOHeaderSize(bytes);
    const ncmds = countMachOLoadCommands(bytes);
    let offset = headerSize;

    const LC_MAIN = 0x80000028;
    const LC_UNIXTHREAD = 0x05;

    for (let i = 0; i < ncmds && offset < bytes.length - 8; i++) {
      const cmd = readMachOUint32(bytes, offset, bigEndian);
      const cmdsize = readMachOUint32(bytes, offset + 4, bigEndian);
      if (cmdsize === 0) break;

      if (cmd === LC_MAIN) {
        // entryoff is a 64-bit value at offset+8
        const lo = readMachOUint32(bytes, offset + 8, bigEndian);
        const hi = readMachOUint32(bytes, offset + 12, bigEndian);
        const entry = bigEndian ? (hi + lo * 0x100000000) : (lo + hi * 0x100000000);
        return `0x${entry.toString(16)}`;
      }

      if (cmd === LC_UNIXTHREAD) {
        // Thread state; entry point location varies by arch. For x86_64: offset+144, ARM64: offset+272
        // Use a simplified approach: read the first non-zero 64-bit value after the thread state header
        const is64 = isMachO64bit(bytes);
        if (is64 && offset + 144 + 8 <= bytes.length) {
          const lo = readMachOUint32(bytes, offset + 144, bigEndian);
          const hi = readMachOUint32(bytes, offset + 148, bigEndian);
          const entry = bigEndian ? (hi + lo * 0x100000000) : (lo + hi * 0x100000000);
          if (entry !== 0) return `0x${entry.toString(16)}`;
        }
        return 'Unknown (LC_UNIXTHREAD)';
      }

      offset += cmdsize;
    }

    return 'Unknown';
  } catch (error) {
    logger.error('Error getting Mach-O entry point:', error);
    return 'Unknown';
  }
}

// Parse LC_BUILD_VERSION for platform/minos/sdk
function getMachOBuildVersion(bytes) {
  try {
    const bigEndian = isMachOBigEndian(bytes);
    const headerSize = getMachOHeaderSize(bytes);
    const ncmds = countMachOLoadCommands(bytes);
    let offset = headerSize;

    const LC_BUILD_VERSION = 0x32;
    const platformNames = {
      1: 'macOS',
      2: 'iOS',
      3: 'tvOS',
      4: 'watchOS',
      5: 'bridgeOS',
      6: 'Mac Catalyst',
      7: 'iOSSimulator',
      8: 'tvOSSimulator',
      9: 'watchOSSimulator',
      10: 'DriverKit',
      11: 'visionOS',
      12: 'visionOSSimulator'
    };

    for (let i = 0; i < ncmds && offset < bytes.length - 8; i++) {
      const cmd = readMachOUint32(bytes, offset, bigEndian);
      const cmdsize = readMachOUint32(bytes, offset + 4, bigEndian);
      if (cmdsize === 0) break;

      if (cmd === LC_BUILD_VERSION) {
        const platform = readMachOUint32(bytes, offset + 8, bigEndian);
        const minos = readMachOUint32(bytes, offset + 12, bigEndian);
        const sdk = readMachOUint32(bytes, offset + 16, bigEndian);

        const fmtVer = (v) => `${(v >> 16) & 0xFFFF}.${(v >> 8) & 0xFF}.${v & 0xFF}`;

        return {
          platform: platformNames[platform] || `Unknown (${platform})`,
          minos: fmtVer(minos),
          sdk: fmtVer(sdk)
        };
      }

      offset += cmdsize;
    }

    return null;
  } catch (error) {
    logger.error('Error getting Mach-O build version:', error);
    return null;
  }
}

// Export the functions
export {
  findPEHeaderOffset,
  analyzePEStructure,
  detectSpecificFileType,
  detectNestedFiles
}; 