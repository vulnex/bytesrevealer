import { describe, it, expect } from 'vitest'
import { detectDisasmArch } from './disasmArchDetect.js'

function writeU16LE(bytes, offset, value) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >> 8) & 0xff
}

function writeU16BE(bytes, offset, value) {
  bytes[offset] = (value >> 8) & 0xff
  bytes[offset + 1] = value & 0xff
}

function writeU32LE(bytes, offset, value) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >> 8) & 0xff
  bytes[offset + 2] = (value >> 16) & 0xff
  bytes[offset + 3] = (value >>> 24) & 0xff
}

function writeU32BE(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >> 16) & 0xff
  bytes[offset + 2] = (value >> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

function writeU64LE(bytes, offset, value) {
  const low = value >>> 0
  const high = Math.floor(value / 0x100000000) >>> 0
  writeU32LE(bytes, offset, low)
  writeU32LE(bytes, offset + 4, high)
}

function writeU64BE(bytes, offset, value) {
  const low = value >>> 0
  const high = Math.floor(value / 0x100000000) >>> 0
  writeU32BE(bytes, offset, high)
  writeU32BE(bytes, offset + 4, low)
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

// Build a minimal ELF with optional PT_LOAD program header so entry-point
// resolution has something to walk. Bytes layout matches real on-disk ELFs.
function buildELF({
  machine,
  classByte = 2, // 1 = 32-bit, 2 = 64-bit
  dataByte = 1, // 1 = LE, 2 = BE
  entry = 0,
  loadSegment = null
} = {}) {
  const is64 = classByte === 2
  const bigEndian = dataByte === 2
  const ehSize = is64 ? 64 : 52
  const phEntSize = is64 ? 56 : 32
  const phOff = ehSize
  const phNum = loadSegment ? 1 : 0
  const fileSize = loadSegment
    ? Math.max(ehSize + phEntSize + (loadSegment.fileOffset || 0) + (loadSegment.filesz || 0), 256)
    : 256
  const bytes = new Uint8Array(fileSize)

  bytes[0] = 0x7f
  bytes[1] = 0x45
  bytes[2] = 0x4c
  bytes[3] = 0x46
  bytes[4] = classByte
  bytes[5] = dataByte

  const writeU16 = bigEndian ? writeU16BE : writeU16LE
  const writeU32 = bigEndian ? writeU32BE : writeU32LE
  const writeU64 = bigEndian ? writeU64BE : writeU64LE

  writeU16(bytes, 18, machine)

  if (is64) {
    writeU64(bytes, 0x18, entry)
    writeU64(bytes, 0x20, phNum ? phOff : 0)
    writeU16(bytes, 0x36, phNum ? phEntSize : 0)
    writeU16(bytes, 0x38, phNum)
  } else {
    writeU32(bytes, 0x18, entry)
    writeU32(bytes, 0x1c, phNum ? phOff : 0)
    writeU16(bytes, 0x2a, phNum ? phEntSize : 0)
    writeU16(bytes, 0x2c, phNum)
  }

  if (loadSegment) {
    const phStart = phOff
    writeU32(bytes, phStart, 1) // p_type = PT_LOAD
    if (is64) {
      writeU64(bytes, phStart + 8, loadSegment.fileOffset)
      writeU64(bytes, phStart + 16, loadSegment.vaddr)
      writeU64(bytes, phStart + 32, loadSegment.filesz)
    } else {
      writeU32(bytes, phStart + 4, loadSegment.fileOffset)
      writeU32(bytes, phStart + 8, loadSegment.vaddr)
      writeU32(bytes, phStart + 16, loadSegment.filesz)
    }
  }

  return bytes
}

// Build a minimal thin Mach-O. Byte layouts match what xxd shows for real
// macOS binaries — magic stored in the file's native byte order, every
// other multi-byte field in that same byte order.
//
//   macOS x86_64 thin: CF FA ED FE 07 00 00 01 ...  (is64 + LE)
//   legacy PPC BE  64: FE ED FA CF 00 00 00 12 ...  (is64 + BE)
function buildMachO({
  is64 = true,
  bigEndian = false,
  cputype,
  loadCommands = [],
  fileSize: explicitSize = null
} = {}) {
  const headerSize = is64 ? 32 : 28
  const cmdsBytes = loadCommands.reduce((sum, c) => sum + c.length, 0)
  // Default fixture size is generous enough that LC_MAIN entryoffs in the
  // 0x1000–0x10000 range stay within bytes.length; tests that probe larger
  // offsets can override via `fileSize`.
  const fileSize = explicitSize ?? Math.max(headerSize + cmdsBytes + 64, 0x20000)
  const bytes = new Uint8Array(fileSize)

  let magic
  if (is64 && !bigEndian) magic = 0xfeedfacf
  else if (!is64 && !bigEndian) magic = 0xfeedface
  else if (is64 && bigEndian) magic = 0xcffaedfe
  else magic = 0xcefaedfe

  writeU32LE(bytes, 0, magic)

  const writeU32 = bigEndian ? writeU32BE : writeU32LE
  writeU32(bytes, 4, cputype) // cputype
  writeU32(bytes, 8, 0) // cpusubtype
  writeU32(bytes, 12, 2) // filetype (MH_EXECUTE)
  writeU32(bytes, 16, loadCommands.length) // ncmds
  writeU32(bytes, 20, cmdsBytes) // sizeofcmds
  writeU32(bytes, 24, 0) // flags
  // is64 also has 4 bytes of reserved at 28 — leave zero

  let off = headerSize
  for (const cmd of loadCommands) {
    bytes.set(cmd, off)
    off += cmd.length
  }

  return bytes
}

function lcMain({ entryoff, bigEndian = false }) {
  const buf = new Uint8Array(24)
  const writeU32 = bigEndian ? writeU32BE : writeU32LE
  const writeU64 = bigEndian ? writeU64BE : writeU64LE
  writeU32(buf, 0, 0x80000028) // LC_MAIN
  writeU32(buf, 4, 24) // cmdsize
  writeU64(buf, 8, entryoff)
  writeU64(buf, 16, 0) // stacksize
  return buf
}

function lcOther({ cmd, size, bigEndian = false }) {
  const buf = new Uint8Array(size)
  const writeU32 = bigEndian ? writeU32BE : writeU32LE
  writeU32(buf, 0, cmd)
  writeU32(buf, 4, size)
  return buf
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
    const bytes = buildELF({ machine: 0x03, classByte: 1 })
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
    const bytes = buildELF({ machine: 0x28, classByte: 1 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'ELF',
      arch: 'arm',
      mode: 'arm'
    })
  })

  it('does not auto-detect MIPS (capstone-wasm has no MIPS support)', () => {
    const bytes = buildELF({ machine: 0x08 })
    expect(detectDisasmArch(bytes)).toBeNull()
  })

  it('honours big-endian e_machine', () => {
    const bytes = buildELF({ machine: 0x28, classByte: 1, dataByte: 2 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'ELF',
      arch: 'arm'
    })
  })

  it('returns null for unknown ELF machine', () => {
    const bytes = buildELF({ machine: 0xff })
    expect(detectDisasmArch(bytes)).toBeNull()
  })

  it('resolves ELF64 entry virtual address to file offset via PT_LOAD', () => {
    const bytes = buildELF({
      machine: 0x3e,
      entry: 0x401050,
      loadSegment: { fileOffset: 0x1000, vaddr: 0x401000, filesz: 0x200 }
    })
    expect(detectDisasmArch(bytes).startOffset).toBe(0x1000 + (0x401050 - 0x401000))
  })

  it('resolves ELF32 entry virtual address to file offset via PT_LOAD', () => {
    const bytes = buildELF({
      machine: 0x03,
      classByte: 1,
      entry: 0x80483a0,
      loadSegment: { fileOffset: 0x100, vaddr: 0x8048000, filesz: 0x800 }
    })
    expect(detectDisasmArch(bytes).startOffset).toBe(0x100 + (0x80483a0 - 0x8048000))
  })

  it('falls back to startOffset 0 when entry falls outside any PT_LOAD', () => {
    const bytes = buildELF({
      machine: 0x3e,
      entry: 0x500000,
      loadSegment: { fileOffset: 0x1000, vaddr: 0x401000, filesz: 0x200 }
    })
    expect(detectDisasmArch(bytes).startOffset).toBe(0)
  })

  it('falls back to startOffset 0 when no program headers are present', () => {
    const bytes = buildELF({ machine: 0x3e, entry: 0x401050 })
    expect(detectDisasmArch(bytes).startOffset).toBe(0)
  })
})

describe('detectDisasmArch — Mach-O', () => {
  it('detects 64-bit x86_64 Mach-O', () => {
    const bytes = buildMachO({ is64: true, cputype: 0x01000007 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'x86',
      mode: '64'
    })
  })

  it('detects 32-bit x86 Mach-O', () => {
    const bytes = buildMachO({ is64: false, cputype: 0x00000007 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'x86',
      mode: '32'
    })
  })

  it('detects ARM64 Mach-O', () => {
    const bytes = buildMachO({ is64: true, cputype: 0x0100000c })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'arm64'
    })
  })

  it('detects big-endian (PPC-era) Mach-O magic', () => {
    const bytes = buildMachO({ is64: true, bigEndian: true, cputype: 0x01000007 })
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'x86',
      mode: '64'
    })
  })

  it('returns null for unknown Mach-O cputype', () => {
    const bytes = buildMachO({ is64: true, cputype: 0xdeadbeef })
    expect(detectDisasmArch(bytes)).toBeNull()
  })

  it('matches the real on-disk byte layout of macOS x86_64 thin binaries', () => {
    // Mirrors `xxd /tmp/ls_thin` on a real machine: cf fa ed fe 07 00 00 01 ...
    const bytes = new Uint8Array(64)
    bytes.set([0xcf, 0xfa, 0xed, 0xfe, 0x07, 0x00, 0x00, 0x01], 0)
    expect(detectDisasmArch(bytes)).toMatchObject({
      format: 'MachO',
      arch: 'x86',
      mode: '64'
    })
  })

  it('reads LC_MAIN entryoff as the Mach-O startOffset', () => {
    const bytes = buildMachO({
      is64: true,
      cputype: 0x01000007,
      loadCommands: [lcMain({ entryoff: 0x3f50 })]
    })
    expect(detectDisasmArch(bytes).startOffset).toBe(0x3f50)
  })

  it('skips non-LC_MAIN load commands and still finds the entry offset', () => {
    const bytes = buildMachO({
      is64: true,
      cputype: 0x0100000c,
      loadCommands: [
        lcOther({ cmd: 0x19, size: 72 }), // LC_SEGMENT_64 (truncated, just header)
        lcOther({ cmd: 0x0b, size: 24 }), // LC_DYSYMTAB (stub)
        lcMain({ entryoff: 0x4200 })
      ]
    })
    expect(detectDisasmArch(bytes).startOffset).toBe(0x4200)
  })

  it('falls back to startOffset 0 when no LC_MAIN is present', () => {
    const bytes = buildMachO({
      is64: true,
      cputype: 0x01000007,
      loadCommands: [lcOther({ cmd: 0x05, size: 16 })] // LC_UNIXTHREAD stub (not parsed)
    })
    expect(detectDisasmArch(bytes).startOffset).toBe(0)
  })

  it('reads LC_MAIN in a big-endian Mach-O', () => {
    const bytes = buildMachO({
      is64: true,
      bigEndian: true,
      cputype: 0x01000007,
      loadCommands: [lcMain({ entryoff: 0x2000, bigEndian: true })]
    })
    expect(detectDisasmArch(bytes).startOffset).toBe(0x2000)
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
