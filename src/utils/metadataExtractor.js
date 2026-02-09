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
      if (fileType && fileType.includes('Mach-O')) {
        return extractMachOMetadata(bytes);
      }
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
 * Extract Mach-O metadata (self-contained, no imports from advancedFileDetection)
 */
function extractMachOMetadata(bytes) {
  const metadata = {
    format: 'Mach-O',
    header: null,
    loadCommandsSummary: [],
    dylibs: [],
    segments: [],
    codeSignature: false,
    buildVersion: null,
    minimumVersion: null,
    entryPoint: null
  };

  try {
    if (!bytes || bytes.length < 28) return metadata;

    // Self-contained helpers
    const isBE = bytes[0] === 0xFE && bytes[1] === 0xED && bytes[2] === 0xFA &&
                 (bytes[3] === 0xCE || bytes[3] === 0xCF);
    const is64 = (bytes[0] === 0xFE && bytes[3] === 0xCF) ||
                 (bytes[0] === 0xCF && bytes[3] === 0xFE);
    const isUniversal = bytes[0] === 0xCA && bytes[1] === 0xFE &&
                        bytes[2] === 0xBA && bytes[3] === 0xBE;

    const rd32 = (off, be) => {
      if (off + 4 > bytes.length) return 0;
      if (be) {
        return ((bytes[off] << 24) | (bytes[off + 1] << 16) |
                (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
      }
      return ((bytes[off]) | (bytes[off + 1] << 8) |
              (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
    };

    // For universal binaries, parse the first slice
    let b = bytes;
    let bigEndian = isBE;
    let bit64 = is64;

    if (isUniversal) {
      const nfat = rd32(4, true);
      metadata.header = { magic: '0xCAFEBABE', type: 'Universal Binary', architectureCount: nfat };
      if (bytes.length >= 28) {
        const sliceOff = rd32(16, true);
        const sliceSize = rd32(20, true);
        if (sliceOff > 0 && sliceOff < bytes.length) {
          b = bytes.slice(sliceOff, Math.min(sliceOff + sliceSize, bytes.length));
          if (b.length < 28) return metadata;
          bigEndian = b[0] === 0xFE && b[1] === 0xED && b[2] === 0xFA &&
                      (b[3] === 0xCE || b[3] === 0xCF);
          bit64 = (b[0] === 0xFE && b[3] === 0xCF) ||
                  (b[0] === 0xCF && b[3] === 0xFE);
        }
      }
    }

    // Parse mach_header
    const magic = rd32(0, bigEndian);
    const cputype = rd32(4, bigEndian);
    const cpusubtype = rd32(8, bigEndian);
    const filetype = rd32(12, bigEndian);
    const ncmds = rd32(16, bigEndian);
    const flags = rd32(24, bigEndian);

    const cpuNames = { 0x7: 'x86', 0x01000007: 'x86_64', 0xC: 'ARM', 0x0100000C: 'ARM64' };
    const fileTypes = { 1: 'Object', 2: 'Executable', 6: 'Dynamic Library', 7: 'Dynamic Linker', 8: 'Bundle' };

    if (!isUniversal) {
      metadata.header = {
        magic: `0x${magic.toString(16)}`,
        cputype: cpuNames[cputype] || `0x${cputype.toString(16)}`,
        cpusubtype: `0x${cpusubtype.toString(16)}`,
        filetype: fileTypes[filetype] || filetype,
        ncmds,
        flags: `0x${flags.toString(16)}`,
        pie: (flags & 0x200000) !== 0,
        allowStackExecution: (flags & 0x20000) !== 0,
        noHeapExecution: (flags & 0x1000000) !== 0
      };
    }

    // Walk load commands
    const headerSize = bit64 ? 32 : 28;
    let offset = headerSize;

    const LC_NAMES = {
      0x01: 'LC_SEGMENT', 0x02: 'LC_SYMTAB', 0x04: 'LC_THREAD', 0x05: 'LC_UNIXTHREAD',
      0x0B: 'LC_DYSYMTAB', 0x0C: 'LC_LOAD_DYLIB', 0x0D: 'LC_ID_DYLIB',
      0x0E: 'LC_LOAD_DYLINKER', 0x18: 'LC_LOAD_WEAK_DYLIB', 0x19: 'LC_SEGMENT_64',
      0x1D: 'LC_CODE_SIGNATURE', 0x1F: 'LC_REEXPORT_DYLIB', 0x20: 'LC_LAZY_LOAD_DYLIB',
      0x21: 'LC_ENCRYPTION_INFO', 0x24: 'LC_VERSION_MIN_MACOSX',
      0x25: 'LC_VERSION_MIN_IPHONEOS', 0x2A: 'LC_FUNCTION_STARTS',
      0x2C: 'LC_ENCRYPTION_INFO_64', 0x32: 'LC_BUILD_VERSION'
    };
    LC_NAMES[0x80000028] = 'LC_MAIN';

    const fmtProt = (p) => ((p & 1) ? 'r' : '-') + ((p & 2) ? 'w' : '-') + ((p & 4) ? 'x' : '-');
    const fmtVer = (v) => `${(v >> 16) & 0xFFFF}.${(v >> 8) & 0xFF}.${v & 0xFF}`;
    const platformNames = { 1: 'macOS', 2: 'iOS', 3: 'tvOS', 4: 'watchOS', 6: 'Mac Catalyst', 11: 'visionOS' };

    for (let i = 0; i < ncmds && offset < b.length - 8; i++) {
      const cmd = rd32(offset, bigEndian);
      const cmdsize = rd32(offset + 4, bigEndian);
      if (cmdsize === 0) break;

      const cmdName = LC_NAMES[cmd] || `0x${cmd.toString(16)}`;
      metadata.loadCommandsSummary.push({ cmd: cmdName, size: cmdsize });

      // Dylibs
      if (cmd === 0x0C || cmd === 0x18 || cmd === 0x1F || cmd === 0x20) {
        const strOff = rd32(offset + 8, bigEndian);
        if (strOff > 0 && strOff < cmdsize) {
          let end = offset + strOff;
          while (end < offset + cmdsize && end < b.length && b[end] !== 0) end++;
          const path = new TextDecoder().decode(b.slice(offset + strOff, end));
          metadata.dylibs.push({ path, type: cmdName });
        }
      }

      // Segments
      if (cmd === 0x19 || cmd === 0x01) {
        const segname = new TextDecoder().decode(b.slice(offset + 8, offset + 24)).replace(/\0/g, '');
        let vmsize, maxprot, initprot;
        if (bit64) {
          const lo = rd32(offset + 24, bigEndian);
          const hi = rd32(offset + 28, bigEndian);
          vmsize = bigEndian ? (hi + lo * 0x100000000) : (lo + hi * 0x100000000);
          maxprot = rd32(offset + 48, bigEndian);
          initprot = rd32(offset + 52, bigEndian);
        } else {
          vmsize = rd32(offset + 20, bigEndian);
          maxprot = rd32(offset + 32, bigEndian);
          initprot = rd32(offset + 36, bigEndian);
        }
        metadata.segments.push({
          name: segname,
          vmsize,
          maxprot: fmtProt(maxprot),
          initprot: fmtProt(initprot)
        });
      }

      // Code signature
      if (cmd === 0x1D) {
        metadata.codeSignature = true;
      }

      // Build version
      if (cmd === 0x32) {
        const platform = rd32(offset + 8, bigEndian);
        const minos = rd32(offset + 12, bigEndian);
        const sdk = rd32(offset + 16, bigEndian);
        metadata.buildVersion = {
          platform: platformNames[platform] || `Unknown (${platform})`,
          minos: fmtVer(minos),
          sdk: fmtVer(sdk)
        };
      }

      // Min version (LC_VERSION_MIN_MACOSX / LC_VERSION_MIN_IPHONEOS)
      if (cmd === 0x24 || cmd === 0x25) {
        const ver = rd32(offset + 8, bigEndian);
        metadata.minimumVersion = fmtVer(ver);
      }

      // Entry point (LC_MAIN)
      if (cmd === 0x80000028) {
        const lo = rd32(offset + 8, bigEndian);
        const hi = rd32(offset + 12, bigEndian);
        const entry = bigEndian ? (hi + lo * 0x100000000) : (lo + hi * 0x100000000);
        metadata.entryPoint = `0x${entry.toString(16)}`;
      }

      offset += cmdsize;
    }
  } catch (error) {
    metadata.error = error.message;
  }

  return metadata;
}

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