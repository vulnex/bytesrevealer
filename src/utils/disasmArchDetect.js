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

import { readU16LE, readU16BE, readU32LE, readU32BE } from './binaryReaders'

const PE_MACHINE_TO_CS = {
  0x014c: { arch: 'x86', mode: '32' },
  0x8664: { arch: 'x86', mode: '64' },
  0x01c0: { arch: 'arm', mode: 'arm' },
  0x01c4: { arch: 'arm', mode: 'thumb' },
  0xaa64: { arch: 'arm64', mode: 'arm' },
  0x0166: { arch: 'mips', mode: 'mips32' },
  0x0266: { arch: 'mips', mode: 'mips32' },
  0x0162: { arch: 'mips', mode: 'mips32' },
  0x0168: { arch: 'mips', mode: 'mips32' }
}

const ELF_MACHINE_TO_CS = {
  0x03: { arch: 'x86', mode: '32' },
  0x3e: { arch: 'x86', mode: '64' },
  0x28: { arch: 'arm', mode: 'arm' },
  0xb7: { arch: 'arm64', mode: 'arm' },
  0x08: { arch: 'mips', mode: 'mips32' }
}

const MACHO_CPU_TO_CS = {
  0x00000007: { arch: 'x86', mode: '32' },
  0x01000007: { arch: 'x86', mode: '64' },
  0x0000000c: { arch: 'arm', mode: 'arm' },
  0x0100000c: { arch: 'arm64', mode: 'arm' }
}

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
  const eiData = bytes[5]
  const bigEndian = eiData === 2
  const machine = bigEndian ? readU16BE(bytes, 18) : readU16LE(bytes, 18)
  const mapped = ELF_MACHINE_TO_CS[machine]
  if (!mapped) return null
  return { format: 'ELF', ...mapped, startOffset: 0 }
}

function detectMachO(bytes) {
  if (bytes.length < 8) return null
  const magic = readU32LE(bytes, 0)
  let cputype = null
  if (magic === 0xfeedfacf || magic === 0xfeedface) {
    cputype = readU32BE(bytes, 4)
  } else if (magic === 0xcffaedfe || magic === 0xcefaedfe) {
    cputype = readU32LE(bytes, 4)
  } else {
    return null
  }
  const mapped = MACHO_CPU_TO_CS[cputype]
  if (!mapped) return null
  return { format: 'MachO', ...mapped, startOffset: 0 }
}

export function detectDisasmArch(bytes) {
  if (!bytes || bytes.length < 8) return null
  return detectPE(bytes) || detectELF(bytes) || detectMachO(bytes)
}
