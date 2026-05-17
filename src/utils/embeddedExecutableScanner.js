/**
 * VULNEX -Bytes Revealer-
 *
 * File: embeddedExecutableScanner.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-08
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Full-file scanner for embedded PE / ELF / Mach-O executables.
 * Detects magic bytes at arbitrary offsets and validates structurally
 * to eliminate false positives. See devnotes/embedded-executable-scanner-design.md.
 */

import { isMachOFatBinary } from './fileSignatures'
import { readU16LE, readU16BE, readU32LE, readU32BE } from './binaryReaders'
import {
  computePEFileSize,
  computeELFFileSize,
  computeMachOFileSize,
  computeMachOFatFileSize
} from './embeddedExecutableExtents'

export const FORMAT = {
  PE: 'PE',
  ELF: 'ELF',
  MACHO: 'Mach-O',
  MACHO_FAT: 'Mach-O Fat'
}

export const DEFAULT_MAX_FINDINGS = 1000
export const DEFAULT_FALLBACK_SKIP = 4096

const PE_KNOWN_MACHINES = new Set([
  0x014c, // i386
  0x0200, // IA64
  0x8664, // AMD64
  0x01c0, // ARM
  0x01c4, // ARMv7 Thumb
  0xaa64, // ARM64
  0x01f0, // PowerPC
  0x01f1, // PowerPC FP
  0x0166, // MIPS16
  0x0266, // MIPS FPU
  0x0366, // MIPS FPU16
  0x0162, // MIPS R3000
  0x0168, // MIPS R10000
  0x0184, // ALPHA
  0x0284, // ALPHA64
  0x0ebc, // EFI
  0x9041, // M32R
  0x5032, // RISC-V 32
  0x5064, // RISC-V 64
  0x5128 // RISC-V 128
])

const ELF_MACHINES = new Set([
  0x00, // NONE (still allow — some tooling emits it)
  0x02, // SPARC
  0x03, // x86
  0x08, // MIPS
  0x14, // PowerPC
  0x15, // PowerPC64
  0x16, // S390
  0x28, // ARM
  0x2a, // SuperH
  0x32, // IA-64
  0x3e, // x86-64
  0x53, // AVR
  0xb7, // AArch64
  0xf3, // RISC-V
  0xf7 // BPF
])

const MACHO_CPU_TYPES = new Set([
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

const MAGIC_PE = [0x4d, 0x5a]
const MAGIC_ELF = [0x7f, 0x45, 0x4c, 0x46]
const MAGIC_MACHO_32_BE = [0xfe, 0xed, 0xfa, 0xce]
const MAGIC_MACHO_64_BE = [0xfe, 0xed, 0xfa, 0xcf]
const MAGIC_MACHO_32_LE = [0xce, 0xfa, 0xed, 0xfe]
const MAGIC_MACHO_64_LE = [0xcf, 0xfa, 0xed, 0xfe]
const MAGIC_MACHO_FAT = [0xca, 0xfe, 0xba, 0xbe]

export const MAX_MAGIC_LENGTH = 4

function matchesAt(bytes, pattern, offset) {
  if (offset + pattern.length > bytes.length) return false
  for (let i = 0; i < pattern.length; i++) {
    if (bytes[offset + i] !== pattern[i]) return false
  }
  return true
}

/**
 * Validate a PE candidate at the given offset.
 * Returns { valid, machine, is64bit, sizeOfImage } or { valid: false }.
 *
 * Requires bytes to contain enough data starting at `offset` to read the DOS
 * header (64 bytes) and the PE/optional headers it points to (~1 KB beyond).
 */
export function validatePE(bytes, offset = 0) {
  if (offset + 64 > bytes.length) return { valid: false }
  if (bytes[offset] !== 0x4d || bytes[offset + 1] !== 0x5a) return { valid: false }

  const eLfanew = readU32LE(bytes, offset + 0x3c)
  if (eLfanew < 0x40) return { valid: false }

  const peHeaderAbs = offset + eLfanew
  if (peHeaderAbs + 24 > bytes.length) return { valid: false }

  if (
    bytes[peHeaderAbs] !== 0x50 ||
    bytes[peHeaderAbs + 1] !== 0x45 ||
    bytes[peHeaderAbs + 2] !== 0x00 ||
    bytes[peHeaderAbs + 3] !== 0x00
  ) {
    return { valid: false }
  }

  const machine = readU16LE(bytes, peHeaderAbs + 4)
  if (!PE_KNOWN_MACHINES.has(machine)) return { valid: false }

  const sizeOfOptionalHeader = readU16LE(bytes, peHeaderAbs + 20)
  const optHeaderAbs = peHeaderAbs + 24

  let is64bit = false
  let sizeOfImage = 0
  if (sizeOfOptionalHeader >= 2 && optHeaderAbs + 2 <= bytes.length) {
    const magic = readU16LE(bytes, optHeaderAbs)
    if (magic === 0x20b) is64bit = true
    else if (magic !== 0x10b && magic !== 0x107) return { valid: false }

    // SizeOfImage is at +56 in optional header (same offset for PE32 and PE32+)
    if (optHeaderAbs + 60 <= bytes.length) {
      sizeOfImage = readU32LE(bytes, optHeaderAbs + 56)
    }
  }

  // Characteristics (LE u16) at PE header + 22 — drives .exe/.dll/.sys filename.
  const characteristics = readU16LE(bytes, peHeaderAbs + 22)

  // Floor for skip-after-hit: end of headers we just validated.
  const headerEnd = optHeaderAbs + sizeOfOptionalHeader - offset
  if (sizeOfImage < headerEnd) sizeOfImage = headerEnd

  return { valid: true, machine, is64bit, sizeOfImage, characteristics }
}

/**
 * Validate an ELF candidate at the given offset.
 * Returns { valid, is64bit, isLittleEndian, machine, totalSize } or { valid: false }.
 */
export function validateELF(bytes, offset = 0) {
  if (offset + 52 > bytes.length) return { valid: false }
  if (
    bytes[offset] !== 0x7f ||
    bytes[offset + 1] !== 0x45 ||
    bytes[offset + 2] !== 0x4c ||
    bytes[offset + 3] !== 0x46
  ) {
    return { valid: false }
  }

  const eiClass = bytes[offset + 4]
  const eiData = bytes[offset + 5]
  const eiVersion = bytes[offset + 6]

  if (eiClass !== 1 && eiClass !== 2) return { valid: false }
  if (eiData !== 1 && eiData !== 2) return { valid: false }
  if (eiVersion !== 1) return { valid: false }

  const is64bit = eiClass === 2
  const isLittleEndian = eiData === 1
  const read16 = isLittleEndian ? readU16LE : readU16BE
  const read32 = isLittleEndian ? readU32LE : readU32BE

  const eMachine = read16(bytes, offset + 0x12)
  if (!ELF_MACHINES.has(eMachine)) return { valid: false }

  // Floor for skip-after-hit: header size. Section-header table extent is added when readable.
  const headerSize = is64bit ? 64 : 52
  let totalSize = headerSize
  if (is64bit) {
    if (offset + 0x40 <= bytes.length) {
      // e_shoff at 0x28, e_shentsize at 0x3a, e_shnum at 0x3c
      const shoffLow = read32(bytes, offset + 0x28)
      const shoffHigh = read32(bytes, offset + 0x2c)
      const shentsize = read16(bytes, offset + 0x3a)
      const shnum = read16(bytes, offset + 0x3c)
      if (shoffHigh === 0 && shoffLow > 0) {
        totalSize = Math.max(totalSize, shoffLow + shentsize * shnum)
      }
    }
  } else {
    if (offset + 0x34 <= bytes.length) {
      // e_shoff at 0x20, e_shentsize at 0x2e, e_shnum at 0x30
      const shoff = read32(bytes, offset + 0x20)
      const shentsize = read16(bytes, offset + 0x2e)
      const shnum = read16(bytes, offset + 0x30)
      if (shoff > 0) {
        totalSize = Math.max(totalSize, shoff + shentsize * shnum)
      }
    }
  }

  return { valid: true, is64bit, isLittleEndian, machine: eMachine, totalSize }
}

/**
 * Validate a Mach-O thin-binary candidate (not fat) at the given offset.
 * Returns { valid, is64bit, isLittleEndian, cputype, ncmds, totalSize } or { valid: false }.
 */
export function validateMachO(bytes, offset = 0) {
  if (offset + 28 > bytes.length) return { valid: false }

  const m0 = bytes[offset]
  const m1 = bytes[offset + 1]
  const m2 = bytes[offset + 2]
  const m3 = bytes[offset + 3]

  let is64bit = false
  let isLittleEndian = false
  if (m0 === 0xfe && m1 === 0xed && m2 === 0xfa && m3 === 0xce) {
    is64bit = false
    isLittleEndian = false
  } else if (m0 === 0xfe && m1 === 0xed && m2 === 0xfa && m3 === 0xcf) {
    is64bit = true
    isLittleEndian = false
  } else if (m0 === 0xce && m1 === 0xfa && m2 === 0xed && m3 === 0xfe) {
    is64bit = false
    isLittleEndian = true
  } else if (m0 === 0xcf && m1 === 0xfa && m2 === 0xed && m3 === 0xfe) {
    is64bit = true
    isLittleEndian = true
  } else {
    return { valid: false }
  }

  const read32 = isLittleEndian ? readU32LE : readU32BE

  const cputype = read32(bytes, offset + 4)
  if (!MACHO_CPU_TYPES.has(cputype)) return { valid: false }

  const ncmds = read32(bytes, offset + 16)
  if (ncmds === 0 || ncmds >= 1024) return { valid: false }

  const sizeofcmds = read32(bytes, offset + 20)
  if (sizeofcmds === 0 || sizeofcmds > 16 * 1024 * 1024) return { valid: false }

  const headerSize = is64bit ? 32 : 28
  const totalSize = headerSize + sizeofcmds

  return { valid: true, is64bit, isLittleEndian, cputype, ncmds, totalSize }
}

/**
 * Validate a Mach-O fat-binary candidate at the given offset.
 * Reuses isMachOFatBinary from fileSignatures.js to disambiguate from Java.
 */
export function validateMachOFat(bytes, offset = 0) {
  if (offset + 8 > bytes.length) return { valid: false }
  // isMachOFatBinary expects offset 0; pass a subarray view.
  const view = bytes.subarray(offset)
  if (!isMachOFatBinary(view)) return { valid: false }
  const nfatArch = readU32BE(bytes, offset + 4)
  return { valid: true, nfatArch }
}

/**
 * Scan a single contiguous buffer for embedded PE/ELF/Mach-O executables.
 *
 * @param {Uint8Array} bytes - The buffer to scan
 * @param {object} [options]
 * @param {number} [options.baseOffset=0] - Absolute file offset of bytes[0]; reported offsets are relative to this
 * @param {number} [options.skipFirstMatch=true] - Skip a hit at offset 0 (already covered by detectFileTypes)
 * @param {number} [options.maxFindings=1000] - Stop after this many findings
 * @param {Set<number>} [options.skipUntil] - Set of absolute offsets already covered (skip-after-hit cross-call)
 * @param {(scanned:number) => void} [options.onProgress] - Progress callback (bytes scanned within this buffer)
 * @param {() => boolean} [options.shouldCancel] - Returns true to abort
 * @returns {{ findings: Array, cancelled: boolean, truncated: boolean, nextScanFrom: number }}
 */
export function scanBuffer(bytes, options = {}) {
  const {
    baseOffset = 0,
    skipFirstMatch = baseOffset === 0,
    maxFindings = DEFAULT_MAX_FINDINGS,
    onProgress,
    shouldCancel
  } = options

  const findings = []
  let truncated = false
  let cancelled = false

  if (!bytes || bytes.length < 4) {
    return { findings, cancelled, truncated, nextScanFrom: baseOffset + (bytes?.length || 0) }
  }

  const length = bytes.length
  // Re-scan attempt cursor — we advance past validated hits using their declared size.
  let i = 0
  // Progress reporting cadence (every 1 MB).
  const PROGRESS_INTERVAL = 1024 * 1024
  let nextProgress = PROGRESS_INTERVAL
  // Cancellation check cadence (every 64 KB).
  const CANCEL_INTERVAL = 64 * 1024
  let nextCancelCheck = CANCEL_INTERVAL

  while (i < length) {
    if (i >= nextCancelCheck) {
      if (shouldCancel && shouldCancel()) {
        cancelled = true
        break
      }
      nextCancelCheck = i + CANCEL_INTERVAL
    }
    if (onProgress && i >= nextProgress) {
      onProgress(i)
      nextProgress = i + PROGRESS_INTERVAL
    }

    const absoluteOffset = baseOffset + i
    let advanced = false

    // ELF (4 bytes, strong)
    if (matchesAt(bytes, MAGIC_ELF, i)) {
      if (!(skipFirstMatch && absoluteOffset === 0)) {
        const result = validateELF(bytes, i)
        if (result.valid) {
          const extents = computeELFFileSize(bytes, i)
          findings.push({
            type: 'Embedded Executable',
            format: FORMAT.ELF,
            offset: absoluteOffset,
            size: result.totalSize,
            fileSize: extents.fileSize,
            extractable: extents.extractable,
            extractError: extents.extractError,
            confidence: 'High',
            details: {
              is64bit: result.is64bit,
              isLittleEndian: result.isLittleEndian,
              machine: result.machine
            }
          })
          if (findings.length >= maxFindings) {
            truncated = true
            break
          }
          i += skipDistance(result.totalSize, length - i)
          advanced = true
        }
      }
    }

    // Mach-O thin (4 bytes, strong) — checked before fat to avoid CA FE BA BE collision path
    if (!advanced) {
      const isMachoMagic =
        matchesAt(bytes, MAGIC_MACHO_32_BE, i) ||
        matchesAt(bytes, MAGIC_MACHO_64_BE, i) ||
        matchesAt(bytes, MAGIC_MACHO_32_LE, i) ||
        matchesAt(bytes, MAGIC_MACHO_64_LE, i)
      if (isMachoMagic && !(skipFirstMatch && absoluteOffset === 0)) {
        const result = validateMachO(bytes, i)
        if (result.valid) {
          const extents = computeMachOFileSize(bytes, i)
          findings.push({
            type: 'Embedded Executable',
            format: FORMAT.MACHO,
            offset: absoluteOffset,
            size: result.totalSize,
            fileSize: extents.fileSize,
            extractable: extents.extractable,
            extractError: extents.extractError,
            confidence: 'High',
            details: {
              is64bit: result.is64bit,
              isLittleEndian: result.isLittleEndian,
              cputype: result.cputype,
              ncmds: result.ncmds
            }
          })
          if (findings.length >= maxFindings) {
            truncated = true
            break
          }
          i += skipDistance(result.totalSize, length - i)
          advanced = true
        }
      }
    }

    // Mach-O fat (4 bytes, collides with Java)
    if (!advanced && matchesAt(bytes, MAGIC_MACHO_FAT, i)) {
      if (!(skipFirstMatch && absoluteOffset === 0)) {
        const result = validateMachOFat(bytes, i)
        if (result.valid) {
          const extents = computeMachOFatFileSize(bytes, i)
          findings.push({
            type: 'Embedded Executable',
            format: FORMAT.MACHO_FAT,
            offset: absoluteOffset,
            fileSize: extents.fileSize,
            extractable: extents.extractable,
            extractError: extents.extractError,
            confidence: 'High',
            details: {
              nfatArch: result.nfatArch
            }
          })
          if (findings.length >= maxFindings) {
            truncated = true
            break
          }
          // Skip past the fat header (8 + nfat_arch * 20 bytes).
          i += skipDistance(8 + result.nfatArch * 20, length - i)
          advanced = true
        }
      }
    }

    // PE (2 bytes, weak — strict validation kills nearly all false positives)
    if (!advanced && matchesAt(bytes, MAGIC_PE, i)) {
      if (!(skipFirstMatch && absoluteOffset === 0)) {
        const result = validatePE(bytes, i)
        if (result.valid) {
          const extents = computePEFileSize(bytes, i)
          findings.push({
            type: 'Embedded Executable',
            format: FORMAT.PE,
            offset: absoluteOffset,
            size: result.sizeOfImage,
            fileSize: extents.fileSize,
            extractable: extents.extractable,
            extractError: extents.extractError,
            confidence: 'High',
            details: {
              machine: result.machine,
              is64bit: result.is64bit,
              characteristics: result.characteristics
            }
          })
          if (findings.length >= maxFindings) {
            truncated = true
            break
          }
          i += skipDistance(result.sizeOfImage, length - i)
          advanced = true
        }
      }
    }

    if (!advanced) i++
  }

  if (onProgress && !cancelled) onProgress(Math.min(i, length))

  return {
    findings,
    cancelled,
    truncated,
    nextScanFrom: baseOffset + i
  }
}

function skipDistance(declaredSize, remaining) {
  if (!declaredSize || declaredSize <= 0) return DEFAULT_FALLBACK_SKIP
  // Cap at remaining bytes — declared size may exceed file length (truncated embed).
  return Math.min(declaredSize, remaining)
}
