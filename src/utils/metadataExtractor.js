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
 * Extract ELF metadata (self-contained, no imports from advancedFileDetection)
 */
function extractELFMetadata(bytes) {
  const metadata = {
    format: 'ELF',
    header: null,
    programHeaders: [],
    sectionHeaders: [],
    dependencies: [],
    interpreter: null,
    security: null,
    rpath: null,
    runpath: null
  };

  try {
    if (!bytes || bytes.length < 52) return metadata;

    // Self-contained helpers
    const isBE = bytes[5] === 2;
    const is64 = bytes[4] === 2;

    const rd16 = (off, be) => {
      if (off + 2 > bytes.length) return 0;
      if (be) return (bytes[off] << 8) | bytes[off + 1];
      return bytes[off] | (bytes[off + 1] << 8);
    };

    const rd32 = (off, be) => {
      if (off + 4 > bytes.length) return 0;
      if (be) {
        return ((bytes[off] << 24) | (bytes[off + 1] << 16) |
                (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
      }
      return ((bytes[off]) | (bytes[off + 1] << 8) |
              (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
    };

    const rd64 = (off, be) => {
      if (off + 8 > bytes.length) return 0;
      const lo = rd32(off, be);
      const hi = rd32(off + 4, be);
      if (be) return hi + lo * 0x100000000;
      return lo + hi * 0x100000000;
    };

    // Parse ELF header fields
    const eType = rd16(16, isBE);
    const eMachine = rd16(18, isBE);
    const eVersion = rd32(20, isBE);
    let eEntry, phoff, shoff, eFlags, phentsize, phnum, shentsize, shnum, shstrndx;

    if (is64) {
      if (bytes.length < 64) return metadata;
      eEntry = rd64(24, isBE);
      phoff = rd64(32, isBE);
      shoff = rd64(40, isBE);
      eFlags = rd32(48, isBE);
      phentsize = rd16(54, isBE);
      phnum = rd16(56, isBE);
      shentsize = rd16(58, isBE);
      shnum = rd16(60, isBE);
      shstrndx = rd16(62, isBE);
    } else {
      eEntry = rd32(24, isBE);
      phoff = rd32(28, isBE);
      shoff = rd32(32, isBE);
      eFlags = rd32(36, isBE);
      phentsize = rd16(42, isBE);
      phnum = rd16(44, isBE);
      shentsize = rd16(46, isBE);
      shnum = rd16(48, isBE);
      shstrndx = rd16(50, isBE);
    }

    const typeNames = { 1: 'Relocatable', 2: 'Executable', 3: 'Shared object', 4: 'Core dump' };
    const machineNames = { 0x03: 'x86', 0x3E: 'x86-64', 0x28: 'ARM', 0xB7: 'AArch64' };

    metadata.header = {
      magic: '0x7F454C46',
      class: is64 ? '64-bit' : '32-bit',
      endianness: isBE ? 'Big-endian' : 'Little-endian',
      type: typeNames[eType] || `Unknown (${eType})`,
      machine: machineNames[eMachine] || `Unknown (0x${eMachine.toString(16)})`,
      version: eVersion,
      entry: `0x${eEntry.toString(16).padStart(is64 ? 16 : 8, '0')}`,
      flags: `0x${eFlags.toString(16)}`
    };

    // Parse program headers
    const ptNames = {
      0: 'PT_NULL', 1: 'PT_LOAD', 2: 'PT_DYNAMIC', 3: 'PT_INTERP',
      4: 'PT_NOTE', 5: 'PT_SHLIB', 6: 'PT_PHDR', 7: 'PT_TLS',
      0x6474E550: 'PT_GNU_EH_FRAME', 0x6474E551: 'PT_GNU_STACK',
      0x6474E552: 'PT_GNU_RELRO', 0x6474E553: 'PT_GNU_PROPERTY'
    };

    const phdrs = [];
    if (phoff > 0 && phnum > 0) {
      for (let i = 0; i < phnum; i++) {
        const off = phoff + i * phentsize;
        if (off + phentsize > bytes.length) break;

        let pType, pFlags, pOffset, pFilesz;
        if (is64) {
          pType = rd32(off, isBE);
          pFlags = rd32(off + 4, isBE);
          pOffset = rd64(off + 8, isBE);
          pFilesz = rd64(off + 32, isBE);
        } else {
          pType = rd32(off, isBE);
          pOffset = rd32(off + 4, isBE);
          pFilesz = rd32(off + 16, isBE);
          pFlags = rd32(off + 24, isBE);
        }

        const r = (pFlags & 4) ? 'r' : '-';
        const w = (pFlags & 2) ? 'w' : '-';
        const x = (pFlags & 1) ? 'x' : '-';

        phdrs.push({ typeValue: pType, flags: pFlags, offset: pOffset, filesz: pFilesz });
        metadata.programHeaders.push({
          type: ptNames[pType] || `0x${pType.toString(16)}`,
          flags: r + w + x,
          offset: pOffset,
          size: pFilesz
        });
      }
    }

    // Read section name string table
    let strtabData = null;
    if (shstrndx > 0 && shstrndx < shnum && shoff > 0) {
      const strtabHdrOff = shoff + shstrndx * shentsize;
      if (strtabHdrOff + shentsize <= bytes.length) {
        let stOff, stSize;
        if (is64) {
          stOff = rd64(strtabHdrOff + 24, isBE);
          stSize = rd64(strtabHdrOff + 32, isBE);
        } else {
          stOff = rd32(strtabHdrOff + 16, isBE);
          stSize = rd32(strtabHdrOff + 20, isBE);
        }
        if (stOff + stSize <= bytes.length) {
          strtabData = bytes.slice(stOff, stOff + stSize);
        }
      }
    }

    const readSecName = (idx) => {
      if (!strtabData || idx >= strtabData.length) return '';
      let end = idx;
      while (end < strtabData.length && strtabData[end] !== 0) end++;
      return new TextDecoder().decode(strtabData.slice(idx, end));
    };

    // Parse section headers
    if (shoff > 0 && shnum > 0) {
      for (let i = 0; i < shnum; i++) {
        const off = shoff + i * shentsize;
        if (off + shentsize > bytes.length) break;

        const shName = rd32(off, isBE);
        const shType = rd32(off + 4, isBE);
        let shSize;
        if (is64) {
          shSize = rd64(off + 32, isBE);
        } else {
          shSize = rd32(off + 20, isBE);
        }

        const name = readSecName(shName);
        if (name) {
          metadata.sectionHeaders.push({ name, type: shType, size: shSize });
        }
      }
    }

    // Find PT_INTERP → interpreter path
    const interpPhdr = phdrs.find(p => p.typeValue === 3);
    if (interpPhdr && interpPhdr.offset + interpPhdr.filesz <= bytes.length) {
      let end = interpPhdr.offset;
      const limit = Math.min(interpPhdr.offset + interpPhdr.filesz, bytes.length);
      while (end < limit && bytes[end] !== 0) end++;
      metadata.interpreter = new TextDecoder().decode(bytes.slice(interpPhdr.offset, end));
    }

    // Parse .dynamic section for dependencies, rpath, runpath, security info
    const dynPhdr = phdrs.find(p => p.typeValue === 2);
    if (dynPhdr && dynPhdr.offset + dynPhdr.filesz <= bytes.length) {
      const dynEntries = [];
      const entrySize = is64 ? 16 : 8;
      let doff = dynPhdr.offset;
      const dend = dynPhdr.offset + dynPhdr.filesz;

      while (doff + entrySize <= dend && doff + entrySize <= bytes.length) {
        let tag, val;
        if (is64) {
          tag = rd64(doff, isBE);
          val = rd64(doff + 8, isBE);
        } else {
          tag = rd32(doff, isBE);
          val = rd32(doff + 4, isBE);
        }
        if (tag === 0) break;
        dynEntries.push({ tag, val });
        doff += entrySize;
      }

      // Find DT_STRTAB and resolve it through PT_LOAD segments
      const strtabEntry = dynEntries.find(e => e.tag === 5);
      const strszEntry = dynEntries.find(e => e.tag === 10);
      let dynStrtab = null;

      if (strtabEntry) {
        const strtabVA = strtabEntry.val;
        const strsz = strszEntry ? strszEntry.val : 4096;

        // Map VA to file offset through PT_LOAD segments
        let fileOffset = null;
        for (let i = 0; i < phnum; i++) {
          const poff = phoff + i * phentsize;
          if (poff + phentsize > bytes.length) break;
          const pt = rd32(poff, isBE);
          if (pt !== 1) continue; // PT_LOAD only
          let vaddr, segOffset, segFilesz;
          if (is64) {
            segOffset = rd64(poff + 8, isBE);
            vaddr = rd64(poff + 16, isBE);
            segFilesz = rd64(poff + 32, isBE);
          } else {
            segOffset = rd32(poff + 4, isBE);
            vaddr = rd32(poff + 8, isBE);
            segFilesz = rd32(poff + 16, isBE);
          }
          if (strtabVA >= vaddr && strtabVA < vaddr + segFilesz) {
            fileOffset = segOffset + (strtabVA - vaddr);
            break;
          }
        }

        if (fileOffset !== null && fileOffset < bytes.length) {
          const tabEnd = Math.min(fileOffset + strsz, bytes.length);
          dynStrtab = bytes.slice(fileOffset, tabEnd);
        }
      }

      const readStr = (idx) => {
        if (!dynStrtab || idx >= dynStrtab.length) return null;
        let end = idx;
        while (end < dynStrtab.length && dynStrtab[end] !== 0) end++;
        return new TextDecoder().decode(dynStrtab.slice(idx, end));
      };

      // Extract dependencies (DT_NEEDED = 1)
      for (const e of dynEntries) {
        if (e.tag === 1) {
          const name = readStr(e.val);
          if (name) metadata.dependencies.push(name);
        }
      }

      // Extract rpath (DT_RPATH = 15) and runpath (DT_RUNPATH = 29)
      for (const e of dynEntries) {
        if (e.tag === 15) metadata.rpath = readStr(e.val);
        if (e.tag === 29) metadata.runpath = readStr(e.val);
      }

      // Security features
      const hasGnuStack = phdrs.some(p => p.typeValue === 0x6474E551);
      const gnuStack = phdrs.find(p => p.typeValue === 0x6474E551);
      const execStack = gnuStack ? (gnuStack.flags & 1) !== 0 : false;
      const pie = eType === 3 && phdrs.some(p => p.typeValue === 3);
      const hasRelro = phdrs.some(p => p.typeValue === 0x6474E552);
      const hasBindNow = dynEntries.some(e => e.tag === 24);
      const flagsE = dynEntries.find(e => e.tag === 30);
      const dfBindNow = flagsE ? (flagsE.val & 0x8) !== 0 : false;
      const relro = hasRelro ? ((hasBindNow || dfBindNow) ? 'full' : 'partial') : 'none';

      metadata.security = {
        pie,
        executableStack: execStack,
        relro
      };
    }
  } catch (error) {
    metadata.error = error.message;
  }

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