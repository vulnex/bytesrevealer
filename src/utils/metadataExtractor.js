/** 
 * VULNEX -Bytes Revealer-
 *
 * File: metadataExtractor.js
 * Author: Simon Roses Femerling
 * Created: 2025-04-01
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

/**
 * Main metadata extraction function
 * @param {Uint8Array} bytes - File bytes to analyze
 * @param {string} fileType - Detected file type
 * @returns {Object} Extracted metadata
 */
export function extractMetadata(bytes, fileType) {
  switch (fileType) {
    case 'JPEG Image':
      return extractJpegMetadata(bytes);
    case 'PNG Image':
      return extractPngMetadata(bytes);
    case 'PDF Document':
      return extractPdfMetadata(bytes);
    case 'Office Open XML Document':
      return extractOfficeMetadata(bytes);
    case 'Windows Executable (PE)':
      return extractPEMetadata(bytes);
    case 'ELF Binary':
      return extractELFMetadata(bytes);
    default:
      return { error: 'Unsupported file type for metadata extraction' };
  }
}

/**
 * Extract JPEG/EXIF metadata
 */
function extractJpegMetadata(bytes) {
  const metadata = {
    format: 'JPEG',
    segments: [],
    exif: null,
    xmp: null,
    iptc: null,
    comments: []
  };

  let offset = 2; // Skip JPEG SOI marker
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xE1) { // APP1 (EXIF/XMP)
      const segmentSize = (bytes[offset + 2] << 8) | bytes[offset + 3];
      const segmentData = bytes.slice(offset + 4, offset + 2 + segmentSize);
      
      if (isExifData(segmentData)) {
        metadata.exif = parseExifData(segmentData);
      } else if (isXMPData(segmentData)) {
        metadata.xmp = parseXMPData(segmentData);
      }
      
      offset += 2 + segmentSize;
    } else if (marker === 0xED) { // APP13 (IPTC)
      const segmentSize = (bytes[offset + 2] << 8) | bytes[offset + 3];
      const segmentData = bytes.slice(offset + 4, offset + 2 + segmentSize);
      metadata.iptc = parseIPTCData(segmentData);
      offset += 2 + segmentSize;
    } else if (marker === 0xFE) { // COM (Comment)
      const segmentSize = (bytes[offset + 2] << 8) | bytes[offset + 3];
      const commentData = bytes.slice(offset + 4, offset + 2 + segmentSize);
      metadata.comments.push(new TextDecoder().decode(commentData));
      offset += 2 + segmentSize;
    } else {
      offset += 2;
    }
  }

  return metadata;
}

/**
 * Extract PNG metadata
 */
function extractPngMetadata(bytes) {
  const metadata = {
    format: 'PNG',
    chunks: [],
    textualData: {},
    physicalPixelDimensions: null,
    colorProfile: null,
    timestamp: null
  };

  let offset = 8; // Skip PNG signature
  while (offset < bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);

    metadata.chunks.push({
      type,
      length,
      offset: offset
    });

    switch (type) {
      case 'tEXt':
        const textData = parseTextChunk(data);
        metadata.textualData[textData.keyword] = textData.text;
        break;
      case 'pHYs':
        metadata.physicalPixelDimensions = parsePhysicalDimensions(data);
        break;
      case 'iCCP':
        metadata.colorProfile = parseColorProfile(data);
        break;
      case 'tIME':
        metadata.timestamp = parseTimeChunk(data);
        break;
    }

    offset += 8 + length + 4; // Length + Type + Data + CRC
  }

  return metadata;
}

/**
 * Extract PDF metadata
 */
function extractPdfMetadata(bytes) {
  const metadata = {
    format: 'PDF',
    version: null,
    info: {},
    xmp: null,
    encryption: null,
    permissions: []
  };

  // Extract PDF version
  const header = new TextDecoder().decode(bytes.slice(0, 8));
  const versionMatch = header.match(/PDF-(\d+\.\d+)/);
  metadata.version = versionMatch ? versionMatch[1] : null;

  // Find and parse Info dictionary
  const infoDict = findPdfInfoDictionary(bytes);
  if (infoDict) {
    metadata.info = parsePdfInfoDictionary(infoDict);
  }

  // Extract XMP metadata if present
  const xmpData = findPdfXMPMetadata(bytes);
  if (xmpData) {
    metadata.xmp = parseXMPData(xmpData);
  }

  // Check encryption and permissions
  const encrypt = findPdfEncryption(bytes);
  if (encrypt) {
    metadata.encryption = parsePdfEncryption(encrypt);
    metadata.permissions = extractPdfPermissions(encrypt);
  }

  return metadata;
}

/**
 * Extract Office Open XML metadata
 */
function extractOfficeMetadata(bytes) {
  const metadata = {
    format: 'Office Open XML',
    core: null,
    app: null,
    custom: null,
    contentTypes: [],
    relationships: []
  };

  // Since OOXML is ZIP-based, we need to extract specific XML files
  const zipEntries = extractZipEntries(bytes);

  for (const entry of zipEntries) {
    switch (entry.name) {
      case 'docProps/core.xml':
        metadata.core = parseOfficeXMLMetadata(entry.data);
        break;
      case 'docProps/app.xml':
        metadata.app = parseOfficeXMLMetadata(entry.data);
        break;
      case 'docProps/custom.xml':
        metadata.custom = parseOfficeXMLMetadata(entry.data);
        break;
      case '[Content_Types].xml':
        metadata.contentTypes = parseContentTypes(entry.data);
        break;
      case '_rels/.rels':
        metadata.relationships = parseRelationships(entry.data);
        break;
    }
  }

  return metadata;
}

/**
 * Extract PE (Windows Executable) metadata
 */
function extractPEMetadata(bytes) {
  const metadata = {
    format: 'PE',
    headers: {
      dos: null,
      pe: null,
      optional: null
    },
    sections: [],
    imports: [],
    exports: [],
    resources: [],
    versionInfo: null,
    certificates: []
  };

  const peOffset = findPEHeaderOffset(bytes);
  if (peOffset === -1) return metadata;

  // Parse DOS header
  metadata.headers.dos = parseDOSHeader(bytes);

  // Parse PE header
  metadata.headers.pe = parsePEHeader(bytes, peOffset);

  // Parse Optional header
  metadata.headers.optional = parseOptionalHeader(bytes, peOffset + 24);

  // Parse Sections
  metadata.sections = parsePESections(bytes, peOffset);

  // Parse Imports
  metadata.imports = parsePEImports(bytes, metadata.headers.optional.importTableRVA);

  // Parse Exports
  metadata.exports = parsePEExports(bytes, metadata.headers.optional.exportTableRVA);

  // Parse Resources
  metadata.resources = parsePEResources(bytes, metadata.headers.optional.resourceTableRVA);

  // Parse Version Info
  metadata.versionInfo = extractVersionInfo(metadata.resources);

  // Parse Certificates
  metadata.certificates = parsePECertificates(bytes, metadata.headers.optional.certificateTableRVA);

  return metadata;
}

/**
 * Extract ELF metadata
 */
function extractELFMetadata(bytes) {
  const metadata = {
    format: 'ELF',
    header: null,
    programHeaders: [],
    sectionHeaders: [],
    dynamics: [],
    symbols: [],
    strings: [],
    notes: []
  };

  // Parse ELF header
  metadata.header = parseELFHeader(bytes);

  // Parse Program headers
  metadata.programHeaders = parseELFProgramHeaders(bytes, metadata.header);

  // Parse Section headers
  metadata.sectionHeaders = parseELFSectionHeaders(bytes, metadata.header);

  // Parse Dynamic section
  metadata.dynamics = parseELFDynamic(bytes, metadata.header);

  // Parse Symbol tables
  metadata.symbols = parseELFSymbols(bytes, metadata.header);

  // Parse String tables
  metadata.strings = parseELFStrings(bytes, metadata.header);

  // Parse Notes
  metadata.notes = parseELFNotes(bytes, metadata.header);

  return metadata;
}

// Helper functions for various formats...
// (Implementation details for helper functions would go here)

/**
 * Utility function to read 32-bit unsigned integer in big-endian
 */
function readUint32BE(bytes, offset) {
  return (bytes[offset] << 24) |
         (bytes[offset + 1] << 16) |
         (bytes[offset + 2] << 8) |
         bytes[offset + 3];
}

// Export additional utility functions if needed
export const MetadataUtils = {
  readUint32BE,
  // ... other utility functions
}; 