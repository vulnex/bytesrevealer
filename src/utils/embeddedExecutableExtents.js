/**
 * VULNEX -Bytes Revealer-
 *
 * File: embeddedExecutableExtents.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-17
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * On-disk size resolvers for embedded PE/ELF/Mach-O executables. Used by
 * the scanner to attach a `fileSize` to each finding so the extraction
 * service can carve the binary out of the host file.
 *
 * Each resolver returns:
 *   { fileSize, extractable: true }              // success
 *   { fileSize: null, extractable: false, extractError } // failure reason
 *
 * Callers pass `bytes` (Uint8Array of the host buffer) and `offset` (start
 * of the embedded header inside that buffer). The functions only read
 * forward from `offset`; they never modify `bytes`.
 *
 * See devnotes/embedded-executable-extraction-design.md.
 */

import { readU16LE, readU16BE, readU32LE, readU32BE } from './binaryReaders'

// Hard caps per spec / sanity. Beyond these, the embedded data is either
// malformed or hostile and we refuse to compute a size.
export const PE_MAX_SECTIONS = 96
export const ELF_MAX_HEADERS = 65535
export const MACHO_MAX_NFAT_ARCH = 128

const PE_SECTION_ENTRY_SIZE = 40
const ELF32_PHENT_SIZE = 32
const ELF32_SHENT_SIZE = 40
const ELF64_PHENT_SIZE = 56
const ELF64_SHENT_SIZE = 64
const MACHO_FAT_ENTRY_SIZE = 20

const SHT_NOBITS = 8
const LC_SEGMENT = 0x01
const LC_SEGMENT_64 = 0x19

// PE Optional Header data-directory layout. The directories array starts at
// different offsets depending on PE32 vs PE32+, and the count is recorded in
// NumberOfRvaAndSizes. The Certificate Table (index 4) is the only entry whose
// VirtualAddress is a *file* offset, not an RVA — special-cased by the spec
// so signatures can be stripped at sign time without rewriting headers.
const PE_DD_OFFSET_PE32 = 96
const PE_DD_OFFSET_PE32PLUS = 112
const PE_NUMRVA_OFFSET_PE32 = 92
const PE_NUMRVA_OFFSET_PE32PLUS = 108
const PE_DD_ENTRY_SIZE = 8
const PE_DD_INDEX_SECURITY = 4

function notExtractable(reason) {
  return { fileSize: null, extractable: false, extractError: reason }
}

/**
 * Compute the on-disk size of an embedded PE.
 * Walks the section table: max(PointerToRawData + SizeOfRawData), and also
 * includes the Certificate Table (Security data directory) extent so signed
 * binaries keep their Authenticode signature on extraction.
 *
 * @param {Uint8Array} bytes - Host buffer
 * @param {number} offset - Absolute start of the DOS/PE header inside `bytes`
 * @returns {{fileSize: number|null, extractable: boolean, extractError?: string}}
 */
export function computePEFileSize(bytes, offset = 0) {
  if (offset + 64 > bytes.length) return notExtractable('truncated DOS header')

  const eLfanew = readU32LE(bytes, offset + 0x3c)
  const peHeaderAbs = offset + eLfanew
  if (peHeaderAbs + 24 > bytes.length) return notExtractable('truncated PE header')

  const numberOfSections = readU16LE(bytes, peHeaderAbs + 6)
  const sizeOfOptionalHeader = readU16LE(bytes, peHeaderAbs + 20)

  if (numberOfSections === 0) return notExtractable('PE has zero sections')
  if (numberOfSections > PE_MAX_SECTIONS) {
    return notExtractable(`PE section count ${numberOfSections} exceeds cap ${PE_MAX_SECTIONS}`)
  }

  const optHeaderAbs = peHeaderAbs + 24
  const sectionTableAbs = optHeaderAbs + sizeOfOptionalHeader
  const sectionTableEnd = sectionTableAbs + numberOfSections * PE_SECTION_ENTRY_SIZE

  if (sectionTableEnd > bytes.length) {
    return notExtractable('PE section table extends beyond available buffer')
  }

  // Floor: end of headers (relative to the embed start).
  let maxEnd = sectionTableEnd - offset

  for (let i = 0; i < numberOfSections; i++) {
    const entry = sectionTableAbs + i * PE_SECTION_ENTRY_SIZE
    const sizeOfRawData = readU32LE(bytes, entry + 16)
    const pointerToRawData = readU32LE(bytes, entry + 20)
    if (sizeOfRawData === 0) continue // BSS-like section, no file backing
    const end = pointerToRawData + sizeOfRawData
    if (end > maxEnd) maxEnd = end
  }

  // Authenticode signature lives in the Security data directory (index 4),
  // and its VirtualAddress is a file offset (not RVA). Include it so signed
  // binaries don't lose their signature on extraction.
  const optMagic = readU16LE(bytes, optHeaderAbs)
  const is64bit = optMagic === 0x20b
  const numRvaOffset = is64bit ? PE_NUMRVA_OFFSET_PE32PLUS : PE_NUMRVA_OFFSET_PE32
  const ddOffset = is64bit ? PE_DD_OFFSET_PE32PLUS : PE_DD_OFFSET_PE32
  const securityEntryAbs = optHeaderAbs + ddOffset + PE_DD_INDEX_SECURITY * PE_DD_ENTRY_SIZE

  if (
    optHeaderAbs + numRvaOffset + 4 <= bytes.length &&
    securityEntryAbs + PE_DD_ENTRY_SIZE <= bytes.length &&
    // The directory entry must actually fit inside the declared Optional Header.
    ddOffset + (PE_DD_INDEX_SECURITY + 1) * PE_DD_ENTRY_SIZE <= sizeOfOptionalHeader
  ) {
    const numberOfRvaAndSizes = readU32LE(bytes, optHeaderAbs + numRvaOffset)
    if (numberOfRvaAndSizes > PE_DD_INDEX_SECURITY) {
      const certVA = readU32LE(bytes, securityEntryAbs)
      const certSize = readU32LE(bytes, securityEntryAbs + 4)
      if (certVA > 0 && certSize > 0) {
        const certEnd = certVA + certSize
        if (certEnd > maxEnd) maxEnd = certEnd
      }
    }
  }

  if (maxEnd <= 0) return notExtractable('PE computed size is zero')
  return { fileSize: maxEnd, extractable: true }
}

/**
 * Read a 64-bit unsigned value as a JS number. ELF/Mach-O fields can be
 * 64-bit, but in practice file offsets stay below 2^32 for files we can
 * handle (max ~1.5 GB). If the high 32 bits are non-zero, the value can't
 * be represented safely — return null and let the caller mark unextractable.
 */
function readU64Halves(bytes, offset, isLittleEndian) {
  const read = isLittleEndian ? readU32LE : readU32BE
  const low = read(bytes, isLittleEndian ? offset : offset + 4)
  const high = read(bytes, isLittleEndian ? offset + 4 : offset)
  if (high !== 0) return null
  return low
}

/**
 * Compute the on-disk size of an embedded ELF.
 * Returns max of: end of section header table, end of any program-header
 * file extent (p_offset + p_filesz), end of any section file extent
 * (sh_offset + sh_size, skipping SHT_NOBITS).
 */
export function computeELFFileSize(bytes, offset = 0) {
  if (offset + 16 > bytes.length) return notExtractable('truncated ELF ident')

  const eiClass = bytes[offset + 4]
  const eiData = bytes[offset + 5]
  if (eiClass !== 1 && eiClass !== 2) return notExtractable('invalid EI_CLASS')
  if (eiData !== 1 && eiData !== 2) return notExtractable('invalid EI_DATA')

  const is64bit = eiClass === 2
  const isLittleEndian = eiData === 1
  const read16 = isLittleEndian ? readU16LE : readU16BE
  const read32 = isLittleEndian ? readU32LE : readU32BE
  const headerSize = is64bit ? 64 : 52

  if (offset + headerSize > bytes.length) return notExtractable('truncated ELF header')

  let phoff, phnum, phentsize, shoff, shnum, shentsize
  if (is64bit) {
    phoff = readU64Halves(bytes, offset + 0x20, isLittleEndian)
    shoff = readU64Halves(bytes, offset + 0x28, isLittleEndian)
    phentsize = read16(bytes, offset + 0x36)
    phnum = read16(bytes, offset + 0x38)
    shentsize = read16(bytes, offset + 0x3a)
    shnum = read16(bytes, offset + 0x3c)
  } else {
    phoff = read32(bytes, offset + 0x1c)
    shoff = read32(bytes, offset + 0x20)
    phentsize = read16(bytes, offset + 0x2a)
    phnum = read16(bytes, offset + 0x2c)
    shentsize = read16(bytes, offset + 0x2e)
    shnum = read16(bytes, offset + 0x30)
  }

  if (phoff === null) return notExtractable('ELF e_phoff exceeds 32-bit range')
  if (shoff === null) return notExtractable('ELF e_shoff exceeds 32-bit range')
  if (phnum > ELF_MAX_HEADERS) return notExtractable(`ELF phnum ${phnum} exceeds cap`)
  if (shnum > ELF_MAX_HEADERS) return notExtractable(`ELF shnum ${shnum} exceeds cap`)

  // Sanity: entry sizes must match the spec when count > 0.
  const expectedPhent = is64bit ? ELF64_PHENT_SIZE : ELF32_PHENT_SIZE
  const expectedShent = is64bit ? ELF64_SHENT_SIZE : ELF32_SHENT_SIZE
  if (phnum > 0 && phentsize !== expectedPhent) {
    return notExtractable(`ELF unexpected phentsize ${phentsize}`)
  }
  if (shnum > 0 && shentsize !== expectedShent) {
    return notExtractable(`ELF unexpected shentsize ${shentsize}`)
  }

  // Floor: end of header. Then add section/program tables and contents.
  let maxEnd = headerSize

  if (shnum > 0 && shoff > 0) {
    const shtableEnd = shoff + shnum * shentsize
    const shtableAbs = offset + shoff
    if (shtableAbs + shnum * shentsize > bytes.length) {
      return notExtractable('ELF section header table extends beyond available buffer')
    }
    if (shtableEnd > maxEnd) maxEnd = shtableEnd

    for (let i = 0; i < shnum; i++) {
      const entry = shtableAbs + i * shentsize
      let shType, shFileOffset, shSize
      if (is64bit) {
        shType = read32(bytes, entry + 4)
        shFileOffset = readU64Halves(bytes, entry + 24, isLittleEndian)
        shSize = readU64Halves(bytes, entry + 32, isLittleEndian)
      } else {
        shType = read32(bytes, entry + 4)
        shFileOffset = read32(bytes, entry + 16)
        shSize = read32(bytes, entry + 20)
      }
      if (shType === SHT_NOBITS) continue
      if (shFileOffset === null || shSize === null) {
        return notExtractable('ELF section offset/size exceeds 32-bit range')
      }
      const end = shFileOffset + shSize
      if (end > maxEnd) maxEnd = end
    }
  }

  if (phnum > 0 && phoff > 0) {
    const phtableAbs = offset + phoff
    if (phtableAbs + phnum * phentsize > bytes.length) {
      return notExtractable('ELF program header table extends beyond available buffer')
    }
    for (let i = 0; i < phnum; i++) {
      const entry = phtableAbs + i * phentsize
      let pOffset, pFilesz
      if (is64bit) {
        // p_offset at +8, p_filesz at +32
        pOffset = readU64Halves(bytes, entry + 8, isLittleEndian)
        pFilesz = readU64Halves(bytes, entry + 32, isLittleEndian)
      } else {
        // p_offset at +4, p_filesz at +16
        pOffset = read32(bytes, entry + 4)
        pFilesz = read32(bytes, entry + 16)
      }
      if (pOffset === null || pFilesz === null) {
        return notExtractable('ELF program offset/filesz exceeds 32-bit range')
      }
      const end = pOffset + pFilesz
      if (end > maxEnd) maxEnd = end
    }
  }

  return { fileSize: maxEnd, extractable: true }
}

/**
 * Compute the on-disk size of an embedded Mach-O thin binary.
 * Walks load commands; tracks max(fileoff + filesize) over LC_SEGMENT*.
 */
export function computeMachOFileSize(bytes, offset = 0) {
  if (offset + 28 > bytes.length) return notExtractable('truncated Mach-O header')

  const m0 = bytes[offset]
  const m3 = bytes[offset + 3]
  let is64bit
  let isLittleEndian
  if (m0 === 0xfe && m3 === 0xce) {
    is64bit = false
    isLittleEndian = false
  } else if (m0 === 0xfe && m3 === 0xcf) {
    is64bit = true
    isLittleEndian = false
  } else if (m0 === 0xce && m3 === 0xfe) {
    is64bit = false
    isLittleEndian = true
  } else if (m0 === 0xcf && m3 === 0xfe) {
    is64bit = true
    isLittleEndian = true
  } else {
    return notExtractable('unrecognized Mach-O magic')
  }

  const read32 = isLittleEndian ? readU32LE : readU32BE
  const ncmds = read32(bytes, offset + 16)
  const sizeofcmds = read32(bytes, offset + 20)
  const headerSize = is64bit ? 32 : 28

  if (ncmds === 0) return notExtractable('Mach-O has zero load commands')
  // existing validator caps at ncmds<1024 and sizeofcmds<=16MB; keep parity here.

  const lcStartAbs = offset + headerSize
  const lcEndAbs = lcStartAbs + sizeofcmds
  if (lcEndAbs > bytes.length) {
    return notExtractable('Mach-O load commands extend beyond available buffer')
  }

  // Floor: end of load commands.
  let maxEnd = headerSize + sizeofcmds
  let cursor = lcStartAbs

  for (let i = 0; i < ncmds; i++) {
    if (cursor + 8 > lcEndAbs) return notExtractable('Mach-O load command header truncated')
    const cmd = read32(bytes, cursor)
    const cmdsize = read32(bytes, cursor + 4)
    if (cmdsize < 8 || cursor + cmdsize > lcEndAbs) {
      return notExtractable('Mach-O load command size out of range')
    }

    if (cmd === LC_SEGMENT && !is64bit) {
      // 32-bit LC_SEGMENT: fileoff at +32, filesize at +36 (both u32)
      const fileoff = read32(bytes, cursor + 32)
      const filesize = read32(bytes, cursor + 36)
      const end = fileoff + filesize
      if (end > maxEnd) maxEnd = end
    } else if (cmd === LC_SEGMENT_64 && is64bit) {
      // 64-bit LC_SEGMENT_64: fileoff at +40 (u64), filesize at +48 (u64)
      const fileoff = readU64Halves(bytes, cursor + 40, isLittleEndian)
      const filesize = readU64Halves(bytes, cursor + 48, isLittleEndian)
      if (fileoff === null || filesize === null) {
        return notExtractable('Mach-O segment offset/size exceeds 32-bit range')
      }
      const end = fileoff + filesize
      if (end > maxEnd) maxEnd = end
    }

    cursor += cmdsize
  }

  return { fileSize: maxEnd, extractable: true }
}

/**
 * Compute the on-disk size of an embedded Mach-O Fat (32-bit) binary.
 * 64-bit fat (magic CAFEBABF) is out of scope for v1.
 */
export function computeMachOFatFileSize(bytes, offset = 0) {
  if (offset + 8 > bytes.length) return notExtractable('truncated fat header')

  // 32-bit fat magic CA FE BA BE (BE). 64-bit fat (CA FE BA BF) not handled.
  if (bytes[offset + 3] !== 0xbe) {
    return notExtractable('Mach-O fat 64-bit (CAFEBABF) not supported')
  }

  const nfatArch = readU32BE(bytes, offset + 4)
  if (nfatArch === 0) return notExtractable('Mach-O fat has zero arches')
  if (nfatArch > MACHO_MAX_NFAT_ARCH) {
    return notExtractable(`Mach-O fat nfat_arch ${nfatArch} exceeds cap ${MACHO_MAX_NFAT_ARCH}`)
  }

  const tableAbs = offset + 8
  const tableEnd = tableAbs + nfatArch * MACHO_FAT_ENTRY_SIZE
  if (tableEnd > bytes.length) {
    return notExtractable('Mach-O fat arch table extends beyond available buffer')
  }

  // Floor: end of fat header table.
  let maxEnd = 8 + nfatArch * MACHO_FAT_ENTRY_SIZE

  for (let i = 0; i < nfatArch; i++) {
    const entry = tableAbs + i * MACHO_FAT_ENTRY_SIZE
    // fat_arch is all big-endian: cputype, cpusubtype, offset, size, align
    const archOffset = readU32BE(bytes, entry + 8)
    const archSize = readU32BE(bytes, entry + 12)
    const end = archOffset + archSize
    if (end > maxEnd) maxEnd = end
  }

  return { fileSize: maxEnd, extractable: true }
}
