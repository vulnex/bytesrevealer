/**
 * VULNEX -Bytes Revealer-
 *
 * File: fileSignatures.js
 * Author: Simon Roses Femerling
 * Created: 2025-03-19
 * Last Modified: 2025-03-19
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

export const FILE_SIGNATURES = [
  // Archive Formats
  { pattern: [0x50, 0x4b, 0x03, 0x04], name: 'ZIP Archive', extension: 'zip' },
  { pattern: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], name: 'RAR Archive', extension: 'rar' },
  { pattern: [0x1f, 0x8b, 0x08], name: 'GZIP Archive', extension: 'gz' },
  { pattern: [0x42, 0x5a, 0x68], name: 'BZIP2 Archive', extension: 'bz2' },
  { pattern: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], name: '7-Zip Archive', extension: '7z' },

  // Image Formats
  {
    pattern: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    name: 'PNG Image',
    extension: 'png'
  },
  { pattern: [0xff, 0xd8, 0xff], name: 'JPEG Image', extension: 'jpg' },
  { pattern: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], name: 'GIF Image (87a)', extension: 'gif' },
  { pattern: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], name: 'GIF Image (89a)', extension: 'gif' },
  { pattern: [0x42, 0x4d], name: 'BMP Image', extension: 'bmp' },
  { pattern: [0x00, 0x00, 0x01, 0x00], name: 'ICO Image', extension: 'ico' },

  // Document Formats
  { pattern: [0x25, 0x50, 0x44, 0x46], name: 'PDF Document', extension: 'pdf' },
  {
    pattern: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    name: 'Microsoft Office Document',
    extension: 'doc/xls/ppt'
  },
  {
    pattern: [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00],
    name: 'Office Open XML Document',
    extension: 'docx/xlsx/pptx'
  },

  // Executable and Binary Formats
  { pattern: [0x4d, 0x5a], name: 'Windows Executable (PE)', extension: 'exe/dll' },
  { pattern: [0x7f, 0x45, 0x4c, 0x46], name: 'ELF Binary', extension: 'elf' },
  // NOTE: CA FE BA BE is handled specially in detectFileTypes() to disambiguate
  // between Mach-O Universal Binary and Java Class File
  { pattern: [0xfe, 0xed, 0xfa, 0xce], name: 'Mach-O Binary (32-bit BE)', extension: 'macho' },
  { pattern: [0xfe, 0xed, 0xfa, 0xcf], name: 'Mach-O Binary (64-bit BE)', extension: 'macho' },
  { pattern: [0xce, 0xfa, 0xed, 0xfe], name: 'Mach-O Binary (32-bit)', extension: 'macho' },
  { pattern: [0xcf, 0xfa, 0xed, 0xfe], name: 'Mach-O Binary (64-bit)', extension: 'macho' },

  // Audio/Video Formats
  { pattern: [0x49, 0x44, 0x33], name: 'MP3 Audio (with ID3)', extension: 'mp3' },
  { pattern: [0xff, 0xfb], name: 'MP3 Audio', extension: 'mp3' },
  { pattern: [0x52, 0x49, 0x46, 0x46], name: 'WAV Audio', extension: 'wav' },
  { pattern: [0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41], name: 'MP4 Video', extension: 'mp4' },
  {
    pattern: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70],
    name: 'MOV Video',
    extension: 'mov'
  },

  // Database Formats
  { pattern: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65], name: 'SQLite Database', extension: 'sqlite' },
  { pattern: [0x1f, 0x8b, 0x08, 0x00], name: 'MySQL Database File', extension: 'ibdata' },

  // Virtual Machine and Disk Images
  { pattern: [0x7f, 0x45, 0x4c, 0x46], name: 'VirtualBox Disk Image', extension: 'vdi' },
  { pattern: [0x51, 0x46, 0x49], name: 'QEMU QCOW Disk Image', extension: 'qcow' },
  { pattern: [0x4b, 0x44, 0x4d], name: 'VMware Disk Image', extension: 'vmdk' },

  // Certificate and Key Formats
  { pattern: [0x30, 0x82], name: 'X.509 Certificate', extension: 'cer/crt' },
  {
    pattern: [0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x42, 0x45, 0x47, 0x49, 0x4e],
    name: 'PEM Certificate/Key',
    extension: 'pem'
  },

  // Font Formats
  { pattern: [0x00, 0x01, 0x00, 0x00], name: 'TrueType Font', extension: 'ttf' },
  { pattern: [0x4f, 0x54, 0x54, 0x4f], name: 'OpenType Font', extension: 'otf' },

  // Other Common Formats
  { pattern: [0x75, 0x73, 0x74, 0x61, 0x72], name: 'TAR Archive', extension: 'tar' },
  { pattern: [0x52, 0x49, 0x46, 0x46], name: 'WebP Image', extension: 'webp' },
  { pattern: [0x00, 0x61, 0x73, 0x6d], name: 'WebAssembly Binary', extension: 'wasm' },
  { pattern: [0x43, 0x57, 0x53], name: 'Adobe Flash', extension: 'swf' },
  { pattern: [0x46, 0x4c, 0x56], name: 'Flash Video', extension: 'flv' }
]

/**
 * Disambiguate CA FE BA BE: Mach-O fat/universal binary vs Java class file.
 * Both share the same 4-byte magic. Fat binaries have a small nfat_arch count
 * followed by valid CPU type entries; Java class files have version numbers.
 * @param {Uint8Array} bytes - The file bytes to analyze
 * @returns {boolean} - True if this is a Mach-O fat binary
 */
export function isMachOFatBinary(bytes) {
  if (!bytes || bytes.length < 28) return false

  // Read nfat_arch as big-endian uint32 (fat header is always big-endian)
  const nfat_arch = ((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) >>> 0

  // Fat binaries typically have 1-20 architectures
  if (nfat_arch < 1 || nfat_arch > 20) return false

  // Verify file is large enough: fat_header (8) + nfat_arch * fat_arch (20 each)
  if (bytes.length < 8 + nfat_arch * 20) return false

  // Check first fat_arch entry's cputype (bytes 8-11, big-endian)
  const cputype = ((bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11]) >>> 0

  const KNOWN_CPU_TYPES = new Set([
    0x00000001, // VAX
    0x00000006, // MC680x0
    0x00000007, // x86
    0x01000007, // x86_64
    0x0000000c, // ARM
    0x0100000c, // ARM64
    0x0200000c, // ARM64_32
    0x00000012, // PowerPC
    0x01000012 // PowerPC64
  ])

  return KNOWN_CPU_TYPES.has(cputype)
}

/**
 * Get detailed information about a file type based on its signature
 * @param {Uint8Array} bytes - The file bytes to analyze
 * @returns {Array} - Array of matched file signatures
 */
export function detectFileTypes(bytes) {
  const matches = []

  FILE_SIGNATURES.forEach((sig) => {
    if (bytes.length >= sig.pattern.length) {
      let match = true
      for (let i = 0; i < sig.pattern.length; i++) {
        if (bytes[i] !== sig.pattern[i]) {
          match = false
          break
        }
      }
      if (match) {
        matches.push({
          name: sig.name,
          extension: sig.extension,
          confidence: 'High',
          offset: 0
        })
      }
    }
  })

  // Handle CA FE BA BE disambiguation (Mach-O Universal Binary vs Java Class File)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xca &&
    bytes[1] === 0xfe &&
    bytes[2] === 0xba &&
    bytes[3] === 0xbe
  ) {
    if (isMachOFatBinary(bytes)) {
      matches.push({
        name: 'Mach-O Universal Binary',
        extension: 'macho',
        confidence: 'High',
        offset: 0
      })
    } else {
      matches.push({
        name: 'Java Class File',
        extension: 'class',
        confidence: 'High',
        offset: 0
      })
    }
  }

  return matches
}

/**
 * Check if a file matches a specific format
 * @param {Uint8Array} bytes - The file bytes to analyze
 * @param {string} format - The format to check (e.g., 'PDF', 'PNG')
 * @returns {boolean} - True if the file matches the format
 */
export function isFileType(bytes, format) {
  const signature = FILE_SIGNATURES.find((sig) =>
    sig.name.toLowerCase().includes(format.toLowerCase())
  )
  if (!signature) return false

  if (bytes.length < signature.pattern.length) return false

  for (let i = 0; i < signature.pattern.length; i++) {
    if (bytes[i] !== signature.pattern[i]) return false
  }

  return true
}
