/**
 * VULNEX -Bytes Revealer-
 *
 * File: disasmArchDetect.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Maps PE / ELF / Mach-O headers to Capstone arch+mode constants for the
 * disassembly feature. Reads raw header bytes via binaryReaders so it
 * stays independent of advancedFileDetection's heavier analysis path.
 */

import { readU16LE, readU16BE, readU32LE, readU32BE, readU64LE, readU64BE } from './binaryReaders'

// MIPS PE/ELF machines (PE 0x0162/0x0166/0x0168/0x0266, ELF 0x08) are
// intentionally absent: the bundled capstone-wasm build does not include
// MIPS support at runtime. Auto-detecting a binary as MIPS would only seed
// the disasm store with an arch that can't decode — better to fall through
// and let the user pick something else.
const PE_MACHINE_TO_CS = {
  0x014c: { arch: 'x86', mode: '32' },
  0x8664: { arch: 'x86', mode: '64' },
  0x01c0: { arch: 'arm', mode: 'arm' },
  0x01c4: { arch: 'arm', mode: 'thumb' },
  0xaa64: { arch: 'arm64', mode: 'arm' }
}

const ELF_MACHINE_TO_CS = {
  0x03: { arch: 'x86', mode: '32' },
  0x3e: { arch: 'x86', mode: '64' },
  0x28: { arch: 'arm', mode: 'arm' },
  0xb7: { arch: 'arm64', mode: 'arm' }
}

const MACHO_CPU_TO_CS = {
  0x00000007: { arch: 'x86', mode: '32' },
  0x01000007: { arch: 'x86', mode: '64' },
  0x0000000c: { arch: 'arm', mode: 'arm' },
  0x0100000c: { arch: 'arm64', mode: 'arm' }
}

const PT_LOAD = 1
const LC_MAIN = 0x80000028

function detectPE(bytes) {
  if (bytes.length < 0x40) return null
  if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) return null
  const peOffset = readU32LE(bytes, 0x3c)
  if (peOffset <= 0 || peOffset + 24 > bytes.length) return null
  if (
    bytes[peOffset] !== 0x50 ||
    bytes[peOffset + 1] !== 0x45 ||
    bytes[peOffset + 2] !== 0 ||
    bytes[peOffset + 3] !== 0
  ) {
    return null
  }
  const machine = readU16LE(bytes, peOffset + 4)
  const mapped = PE_MACHINE_TO_CS[machine]
  if (!mapped) return null
  const startOffset = resolvePEEntryFileOffset(bytes, peOffset)
  return { format: 'PE', ...mapped, startOffset: startOffset ?? 0 }
}

function resolvePEEntryFileOffset(bytes, peOffset) {
  const coffBase = peOffset + 4
  const optBase = peOffset + 24
  if (optBase + 20 > bytes.length) return null
  const numberOfSections = readU16LE(bytes, coffBase + 2)
  const optionalHeaderSize = readU16LE(bytes, coffBase + 16)
  const entryRva = readU32LE(bytes, optBase + 16)
  if (entryRva === 0) return null
  const sectionHeadersOffset = optBase + optionalHeaderSize
  for (let i = 0; i < numberOfSections; i++) {
    const secOff = sectionHeadersOffset + i * 40
    if (secOff + 40 > bytes.length) break
    const virtualSize = readU32LE(bytes, secOff + 8)
    const virtualAddress = readU32LE(bytes, secOff + 12)
    const sizeOfRawData = readU32LE(bytes, secOff + 16)
    const pointerToRawData = readU32LE(bytes, secOff + 20)
    const sectionSize = Math.max(virtualSize, sizeOfRawData)
    if (entryRva >= virtualAddress && entryRva < virtualAddress + sectionSize) {
      const fileOff = pointerToRawData + (entryRva - virtualAddress)
      if (fileOff >= 0 && fileOff < bytes.length) return fileOff
      return null
    }
  }
  return null
}

function detectELF(bytes) {
  if (bytes.length < 20) return null
  if (bytes[0] !== 0x7f || bytes[1] !== 0x45 || bytes[2] !== 0x4c || bytes[3] !== 0x46) {
    return null
  }
  const eiClass = bytes[4]
  if (eiClass !== 1 && eiClass !== 2) return null
  const bigEndian = bytes[5] === 2
  const machine = bigEndian ? readU16BE(bytes, 18) : readU16LE(bytes, 18)
  const mapped = ELF_MACHINE_TO_CS[machine]
  if (!mapped) return null
  const startOffset = resolveELFEntryFileOffset(bytes, eiClass === 2, bigEndian) ?? 0
  return { format: 'ELF', ...mapped, startOffset }
}

function resolveELFEntryFileOffset(bytes, is64, bigEndian) {
  const readU16 = bigEndian ? readU16BE : readU16LE
  const readU32 = bigEndian ? readU32BE : readU32LE
  const readU64 = bigEndian ? readU64BE : readU64LE
  const headerSize = is64 ? 64 : 52
  if (bytes.length < headerSize) return null

  const eEntry = is64 ? readU64(bytes, 0x18) : readU32(bytes, 0x18)
  if (eEntry === 0) return null
  const ePhoff = is64 ? readU64(bytes, 0x20) : readU32(bytes, 0x1c)
  const ePhentsize = is64 ? readU16(bytes, 0x36) : readU16(bytes, 0x2a)
  const ePhnum = is64 ? readU16(bytes, 0x38) : readU16(bytes, 0x2c)
  if (ePhoff === 0 || ePhentsize === 0 || ePhnum === 0) return null

  // PHDR layouts:
  //   ELF32 (32 bytes): p_type@0, p_offset@4, p_vaddr@8, p_filesz@16
  //   ELF64 (56 bytes): p_type@0, p_offset@8, p_vaddr@16, p_filesz@32
  for (let i = 0; i < ePhnum; i++) {
    const phOff = ePhoff + i * ePhentsize
    if (phOff + ePhentsize > bytes.length) return null
    if (readU32(bytes, phOff) !== PT_LOAD) continue
    const pOffset = is64 ? readU64(bytes, phOff + 8) : readU32(bytes, phOff + 4)
    const pVaddr = is64 ? readU64(bytes, phOff + 16) : readU32(bytes, phOff + 8)
    const pFilesz = is64 ? readU64(bytes, phOff + 32) : readU32(bytes, phOff + 16)
    if (eEntry >= pVaddr && eEntry < pVaddr + pFilesz) {
      const fileOff = pOffset + (eEntry - pVaddr)
      if (fileOff >= 0 && fileOff < bytes.length) return fileOff
      return null
    }
  }
  return null
}

function detectMachO(bytes) {
  if (bytes.length < 8) return null
  // Mach-O magic on disk:
  //   LE 32-bit: CE FA ED FE   (u32-LE → 0xfeedface)
  //   LE 64-bit: CF FA ED FE   (u32-LE → 0xfeedfacf)
  //   BE 32-bit: FE ED FA CE   (u32-LE → 0xcefaedfe)
  //   BE 64-bit: FE ED FA CF   (u32-LE → 0xcffaedfe)
  // Native MH_MAGIC/MH_MAGIC_64 in the file's byte order means the rest of
  // the header is in that same byte order; CIGAM magics mean the file is
  // stored in the opposite byte order from how we're reading it.
  const magic = readU32LE(bytes, 0)
  let bigEndian
  let is64
  if (magic === 0xfeedfacf) {
    bigEndian = false
    is64 = true
  } else if (magic === 0xfeedface) {
    bigEndian = false
    is64 = false
  } else if (magic === 0xcffaedfe) {
    bigEndian = true
    is64 = true
  } else if (magic === 0xcefaedfe) {
    bigEndian = true
    is64 = false
  } else {
    return null
  }

  const readU32 = bigEndian ? readU32BE : readU32LE
  const readU64 = bigEndian ? readU64BE : readU64LE
  const cputype = readU32(bytes, 4)
  const mapped = MACHO_CPU_TO_CS[cputype]
  if (!mapped) return null

  const startOffset = resolveMachOEntryFileOffset(bytes, is64, readU32, readU64) ?? 0
  return { format: 'MachO', ...mapped, startOffset }
}

function resolveMachOEntryFileOffset(bytes, is64, readU32, readU64) {
  const headerSize = is64 ? 32 : 28
  if (bytes.length < headerSize + 8) return null
  const ncmds = readU32(bytes, 16)
  const sizeofcmds = readU32(bytes, 20)
  if (ncmds === 0 || sizeofcmds === 0) return null
  const cmdEnd = Math.min(bytes.length, headerSize + sizeofcmds)

  let off = headerSize
  for (let i = 0; i < ncmds; i++) {
    if (off + 8 > cmdEnd) return null
    const cmd = readU32(bytes, off)
    const cmdsize = readU32(bytes, off + 4)
    if (cmdsize === 0) return null
    if (cmd === LC_MAIN) {
      if (off + 16 > bytes.length) return null
      const entryoff = readU64(bytes, off + 8)
      if (entryoff >= 0 && entryoff < bytes.length) return entryoff
      return null
    }
    off += cmdsize
  }
  return null
}

export function detectDisasmArch(bytes) {
  if (!bytes || bytes.length < 8) return null
  return detectPE(bytes) || detectELF(bytes) || detectMachO(bytes)
}
