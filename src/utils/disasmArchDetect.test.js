import { describe, it, expect } from 'vitest'
import { detectDisasmArch } from './disasmArchDetect.js'

function writeU16LE(bytes, offset, value) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >> 8) & 0xff
}

function writeU32LE(bytes, offset, value) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >> 8) & 0xff
  bytes[offset + 2] = (value >> 16) & 0xff
  bytes[offset + 3] = (value >>> 24) & 0xff
}

function buildPE({ machine, entryRva = 0, sections = [] } = {}) {
  const peOffset = 0x80
  const optionalHeaderSize = 0xf0
  const sectionTableOffset = peOffset + 24 + optionalHeaderSize
  const totalSize = Math.max(sectionTableOffset + sections.length * 40 + 0x200, 0x1000)
  const bytes = new Uint8Array(totalSize)

  bytes[0] = 0x4d
  bytes[1] = 0x5a
  writeU32LE(bytes, 0x3c, peOffset)

  bytes[peOffset] = 0x50
  bytes[peOffset + 1] = 0x45
  bytes[peOffset + 2] = 0
  bytes[peOffset + 3] = 0

  const coffBase = peOffset + 4
  writeU16LE(bytes, coffBase, machine)
  writeU16LE(bytes, coffBase + 2, sections.length)
  writeU16LE(bytes, coffBase + 16, optionalHeaderSize)

  const optBase = peOffset + 24
  writeU32LE(bytes, optBase + 16, entryRva)

  sections.forEach((s, i) => {
    const secOff = sectionTableOffset + i * 40
    writeU32LE(bytes, secOff + 8, s.virtualSize)
    writeU32LE(bytes, secOff + 12, s.virtualAddress)
    writeU32LE(bytes, secOff + 16, s.sizeOfRawData)
    writeU32LE(bytes, secOff + 20, s.pointerToRawData)
  })

  return bytes
}

function buildELF({ machine, classByte = 2, dataByte = 1 } = {}) {
  const bytes = new Uint8Array(64)
  bytes[0] = 0x7f
  bytes[1] = 0x45
  bytes[2] = 0x4c
  bytes[3] = 0x46
  bytes[4] = classByte
  bytes[5] = dataByte
  if (dataByte === 2) {
    bytes[18] = (machine >> 8) & 0xff
    bytes[19] = machine & 0xff
  } else {
    writeU16LE(bytes, 18, machine)
  }
  return bytes
}

function buildMachO({ magic, cputype }) {
  const bytes = new Uint8Array(32)
  writeU32LE(bytes, 0, magic)
  const cpuBigEndian = magic === 0xfeedfacf || magic === 0xfeedface
  if (cpuBigEndian) {
    bytes[4] = (cputype >>> 24) & 0xff
    bytes[5] = (cputype >> 16) & 0xff
    bytes[6] = (cputype >> 8) & 0xff
    bytes[7] = cputype & 0xff
  } else {
    writeU32LE(bytes, 4, cputype)
  }
  return bytes
}

describe('detectDisasmArch — PE', () => {
  it('detects x86-64 PE', () => {
    const bytes = buildPE({ machine: 0x8664 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'PE',
      arch: 'x86',
      mode: '64'
    })
  })

  it('detects i386 PE', () => {
    const bytes = buildPE({ machine: 0x014c })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'PE',
      arch: 'x86',
      mode: '32'
    })
  })

  it('detects ARM64 PE', () => {
    const bytes = buildPE({ machine: 0xaa64 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'PE',
      arch: 'arm64',
      mode: 'arm'
    })
  })

  it('detects ARM Thumb-2 PE', () => {
    const bytes = buildPE({ machine: 0x01c4 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'PE',
      arch: 'arm',
      mode: 'thumb'
    })
  })

  it('resolves entry RVA to file offset via section table', () => {
    const bytes = buildPE({
      machine: 0x8664,
      entryRva: 0x1100,
      sections: [
        {
          virtualAddress: 0x1000,
          virtualSize: 0x500,
          sizeOfRawData: 0x600,
          pointerToRawData: 0x400
        }
      ]
    })
    const result = detectDisasmArch(bytes)
    expect(result.startOffset).toBe(0x400 + (0x1100 - 0x1000))
  })

  it('falls back to startOffset 0 when entry RVA is outside all sections', () => {
    const bytes = buildPE({
      machine: 0x8664,
      entryRva: 0x9000,
      sections: [
        {
          virtualAddress: 0x1000,
          virtualSize: 0x500,
          sizeOfRawData: 0x600,
          pointerToRawData: 0x400
        }
      ]
    })
    expect(detectDisasmArch(bytes).startOffset).toBe(0)
  })

  it('returns null for unknown PE machine type', () => {
    const bytes = buildPE({ machine: 0xdead })
    expect(detectDisasmArch(bytes)).toBeNull()
  })
})

describe('detectDisasmArch — ELF', () => {
  it('detects x86-64 ELF (little-endian)', () => {
    const bytes = buildELF({ machine: 0x3e })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'ELF',
      arch: 'x86',
      mode: '64',
      startOffset: 0
    })
  })

  it('detects i386 ELF', () => {
    const bytes = buildELF({ machine: 0x03 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'ELF',
      arch: 'x86',
      mode: '32'
    })
  })

  it('detects AArch64 ELF', () => {
    const bytes = buildELF({ machine: 0xb7 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'ELF',
      arch: 'arm64'
    })
  })

  it('detects ARM ELF', () => {
    const bytes = buildELF({ machine: 0x28 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'ELF',
      arch: 'arm',
      mode: 'arm'
    })
  })

  it('detects MIPS ELF', () => {
    const bytes = buildELF({ machine: 0x08 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'ELF',
      arch: 'mips',
      mode: 'mips32'
    })
  })

  it('honours big-endian e_machine', () => {
    const bytes = buildELF({ machine: 0x28, dataByte: 2 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'ELF',
      arch: 'arm'
    })
  })

  it('returns null for unknown ELF machine', () => {
    const bytes = buildELF({ machine: 0xff })
    expect(detectDisasmArch(bytes)).toBeNull()
  })
})

describe('detectDisasmArch — Mach-O', () => {
  it('detects 64-bit x86_64 Mach-O (little-endian magic)', () => {
    const bytes = buildMachO({ magic: 0xcffaedfe, cputype: 0x01000007 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'x86',
      mode: '64'
    })
  })

  it('detects 32-bit x86 Mach-O', () => {
    const bytes = buildMachO({ magic: 0xcefaedfe, cputype: 0x00000007 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'x86',
      mode: '32'
    })
  })

  it('detects ARM64 Mach-O', () => {
    const bytes = buildMachO({ magic: 0xcffaedfe, cputype: 0x0100000c })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'arm64'
    })
  })

  it('detects big-endian Mach-O', () => {
    const bytes = buildMachO({ magic: 0xfeedfacf, cputype: 0x01000007 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'x86',
      mode: '64'
    })
  })

  it('returns null for unknown Mach-O cputype', () => {
    const bytes = buildMachO({ magic: 0xcffaedfe, cputype: 0xdeadbeef })
    expect(detectDisasmArch(bytes)).toBeNull()
  })
})

describe('detectDisasmArch — guards', () => {
  it('returns null for null / empty / too-short input', () => {
    expect(detectDisasmArch(null)).toBeNull()
    expect(detectDisasmArch(new Uint8Array(0))).toBeNull()
    expect(detectDisasmArch(new Uint8Array(4))).toBeNull()
  })

  it('returns null for non-executable bytes', () => {
    const bytes = new Uint8Array(64)
    bytes.set([0x89, 0x50, 0x4e, 0x47])
    expect(detectDisasmArch(bytes)).toBeNull()
  })
})
