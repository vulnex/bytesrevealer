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
  { pattern: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP Archive', extension: 'zip' },
  { pattern: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07], name: 'RAR Archive', extension: 'rar' },
  { pattern: [0x1F, 0x8B, 0x08], name: 'GZIP Archive', extension: 'gz' },
  { pattern: [0x42, 0x5A, 0x68], name: 'BZIP2 Archive', extension: 'bz2' },
  { pattern: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], name: '7-Zip Archive', extension: '7z' },
  
  // Image Formats
  { pattern: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], name: 'PNG Image', extension: 'png' },
  { pattern: [0xFF, 0xD8, 0xFF], name: 'JPEG Image', extension: 'jpg' },
  { pattern: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], name: 'GIF Image (87a)', extension: 'gif' },
  { pattern: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], name: 'GIF Image (89a)', extension: 'gif' },
  { pattern: [0x42, 0x4D], name: 'BMP Image', extension: 'bmp' },
  { pattern: [0x00, 0x00, 0x01, 0x00], name: 'ICO Image', extension: 'ico' },
  
  // Document Formats
  { pattern: [0x25, 0x50, 0x44, 0x46], name: 'PDF Document', extension: 'pdf' },
  { pattern: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], name: 'Microsoft Office Document', extension: 'doc/xls/ppt' },
  { pattern: [0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00], name: 'Office Open XML Document', extension: 'docx/xlsx/pptx' },
  
  // Executable and Binary Formats
  { pattern: [0x4D, 0x5A], name: 'Windows Executable (PE)', extension: 'exe/dll' },
  { pattern: [0x7F, 0x45, 0x4C, 0x46], name: 'ELF Binary', extension: 'elf' },
  { pattern: [0xCA, 0xFE, 0xBA, 0xBE], name: 'Java Class File', extension: 'class' },
  { pattern: [0xFE, 0xED, 0xFA, 0xCE], name: 'Mach-O Binary (32-bit)', extension: 'macho' },
  { pattern: [0xFE, 0xED, 0xFA, 0xCF], name: 'Mach-O Binary (64-bit)', extension: 'macho' },
  
  // Audio/Video Formats
  { pattern: [0x49, 0x44, 0x33], name: 'MP3 Audio (with ID3)', extension: 'mp3' },
  { pattern: [0xFF, 0xFB], name: 'MP3 Audio', extension: 'mp3' },
  { pattern: [0x52, 0x49, 0x46, 0x46], name: 'WAV Audio', extension: 'wav' },
  { pattern: [0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41], name: 'MP4 Video', extension: 'mp4' },
  { pattern: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], name: 'MOV Video', extension: 'mov' },
  
  // Database Formats
  { pattern: [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65], name: 'SQLite Database', extension: 'sqlite' },
  { pattern: [0x1F, 0x8B, 0x08, 0x00], name: 'MySQL Database File', extension: 'ibdata' },
  
  // Virtual Machine and Disk Images
  { pattern: [0x7F, 0x45, 0x4C, 0x46], name: 'VirtualBox Disk Image', extension: 'vdi' },
  { pattern: [0x51, 0x46, 0x49], name: 'QEMU QCOW Disk Image', extension: 'qcow' },
  { pattern: [0x4B, 0x44, 0x4D], name: 'VMware Disk Image', extension: 'vmdk' },
  
  // Certificate and Key Formats
  { pattern: [0x30, 0x82], name: 'X.509 Certificate', extension: 'cer/crt' },
  { pattern: [0x2D, 0x2D, 0x2D, 0x2D, 0x2D, 0x42, 0x45, 0x47, 0x49, 0x4E], name: 'PEM Certificate/Key', extension: 'pem' },
  
  // Font Formats
  { pattern: [0x00, 0x01, 0x00, 0x00], name: 'TrueType Font', extension: 'ttf' },
  { pattern: [0x4F, 0x54, 0x54, 0x4F], name: 'OpenType Font', extension: 'otf' },
  
  // Other Common Formats
  { pattern: [0x75, 0x73, 0x74, 0x61, 0x72], name: 'TAR Archive', extension: 'tar' },
  { pattern: [0x52, 0x49, 0x46, 0x46], name: 'WebP Image', extension: 'webp' },
  { pattern: [0x00, 0x61, 0x73, 0x6D], name: 'WebAssembly Binary', extension: 'wasm' },
  { pattern: [0x43, 0x57, 0x53], name: 'Adobe Flash', extension: 'swf' },
  { pattern: [0x46, 0x4C, 0x56], name: 'Flash Video', extension: 'flv' }
];

/**
 * Get detailed information about a file type based on its signature
 * @param {Uint8Array} bytes - The file bytes to analyze
 * @returns {Array} - Array of matched file signatures
 */
export function detectFileTypes(bytes) {
  const matches = [];
  
  FILE_SIGNATURES.forEach(sig => {
    if (bytes.length >= sig.pattern.length) {
      let match = true;
      for (let i = 0; i < sig.pattern.length; i++) {
        if (bytes[i] !== sig.pattern[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        matches.push({
          name: sig.name,
          extension: sig.extension,
          confidence: 'High',
          offset: 0
        });
      }
    }
  });
  
  return matches;
}

/**
 * Check if a file matches a specific format
 * @param {Uint8Array} bytes - The file bytes to analyze
 * @param {string} format - The format to check (e.g., 'PDF', 'PNG')
 * @returns {boolean} - True if the file matches the format
 */
export function isFileType(bytes, format) {
  const signature = FILE_SIGNATURES.find(sig => sig.name.toLowerCase().includes(format.toLowerCase()));
  if (!signature) return false;
  
  if (bytes.length < signature.pattern.length) return false;
  
  for (let i = 0; i < signature.pattern.length; i++) {
    if (bytes[i] !== signature.pattern[i]) return false;
  }
  
  return true;
} 