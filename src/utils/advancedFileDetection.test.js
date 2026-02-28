import { describe, it, expect } from 'vitest'
import {
  findPEHeaderOffset,
  analyzePEStructure,
  detectSpecificFileType,
  detectNestedFiles
} from './advancedFileDetection.js'

// ── Helpers to build minimal binary headers ──

function buildMinimalPE({ is64 = false, numSections = 1 } = {}) {
  // Builds a minimal valid PE file with MZ + DOS stub + PE header
  const peOffset = 0x80
  const buf = new Uint8Array(
    peOffset + 24 + (is64 ? 112 + 16 * 8 : 96 + 16 * 8) + numSections * 40 + 64
  )

  // DOS header: MZ
  buf[0] = 0x4d
  buf[1] = 0x5a
  // e_lfanew at offset 0x3C (LE)
  buf[0x3c] = peOffset & 0xff
  buf[0x3d] = (peOffset >> 8) & 0xff

  // PE signature
  buf[peOffset] = 0x50 // P
  buf[peOffset + 1] = 0x45 // E
  buf[peOffset + 2] = 0x00
  buf[peOffset + 3] = 0x00

  // COFF header at peOffset + 4
  const coffBase = peOffset + 4
  // Machine: x86-64 or x86
  if (is64) {
    buf[coffBase] = 0x64
    buf[coffBase + 1] = 0x86 // 0x8664
  } else {
    buf[coffBase] = 0x4c
    buf[coffBase + 1] = 0x01 // 0x14C
  }
  // NumberOfSections
  buf[coffBase + 2] = numSections & 0xff
  // TimeDateStamp = 0x60000000 (some date)
  buf[coffBase + 4] = 0x00
  buf[coffBase + 5] = 0x00
  buf[coffBase + 6] = 0x00
  buf[coffBase + 7] = 0x60
  // SizeOfOptionalHeader
  const optHeaderSize = is64 ? 240 : 224
  buf[coffBase + 16] = optHeaderSize & 0xff
  buf[coffBase + 17] = (optHeaderSize >> 8) & 0xff
  // Characteristics: executable
  buf[coffBase + 18] = 0x02
  buf[coffBase + 19] = 0x00

  // Optional header at peOffset + 24
  const optBase = peOffset + 24
  // Magic: PE32 (0x10b) or PE32+ (0x20b)
  if (is64) {
    buf[optBase] = 0x0b
    buf[optBase + 1] = 0x02
  } else {
    buf[optBase] = 0x0b
    buf[optBase + 1] = 0x01
  }

  // EntryPoint at optBase + 16
  buf[optBase + 16] = 0x00
  buf[optBase + 17] = 0x10 // 0x1000

  // Subsystem at optBase + 68
  buf[optBase + 68] = 3 // Windows CUI

  // DllCharacteristics at optBase + 70: ASLR + DEP
  buf[optBase + 70] = 0x40 | 0x00 // ASLR (0x40)
  buf[optBase + 71] = 0x01 // DEP (0x0100)

  return buf
}

function buildMinimalELF({ is64 = true, littleEndian = true } = {}) {
  const size = is64 ? 128 : 96
  const buf = new Uint8Array(size)

  // ELF magic
  buf[0] = 0x7f
  buf[1] = 0x45
  buf[2] = 0x4c
  buf[3] = 0x46

  // EI_CLASS: 1=32-bit, 2=64-bit
  buf[4] = is64 ? 2 : 1
  // EI_DATA: 1=LE, 2=BE
  buf[5] = littleEndian ? 1 : 2
  // EI_VERSION
  buf[6] = 1

  if (littleEndian) {
    // e_type = ET_EXEC (2)
    buf[16] = 2
    buf[17] = 0
    // e_machine = x86-64 (0x3E)
    buf[18] = 0x3e
    buf[19] = 0

    if (is64) {
      // e_entry (64-bit) at offset 24 = 0x400000
      buf[24] = 0x00
      buf[25] = 0x00
      buf[26] = 0x40
      buf[27] = 0x00
    } else {
      // e_entry (32-bit) at offset 24 = 0x8048000
      buf[24] = 0x00
      buf[25] = 0x80
      buf[26] = 0x04
      buf[27] = 0x08
    }
  }

  return buf
}

function buildMinimalMachO64LE() {
  // CF FA ED FE (64-bit little-endian Mach-O)
  const buf = new Uint8Array(64)
  buf[0] = 0xcf
  buf[1] = 0xfa
  buf[2] = 0xed
  buf[3] = 0xfe

  // cputype = x86_64 (0x01000007) LE
  buf[4] = 0x07
  buf[5] = 0x00
  buf[6] = 0x00
  buf[7] = 0x01
  // cpusubtype
  buf[8] = 0x03
  buf[9] = 0x00
  buf[10] = 0x00
  buf[11] = 0x00
  // filetype = 2 (executable)
  buf[12] = 0x02
  buf[13] = 0x00
  buf[14] = 0x00
  buf[15] = 0x00
  // ncmds = 0
  buf[16] = 0x00
  buf[17] = 0x00
  buf[18] = 0x00
  buf[19] = 0x00
  // sizeofcmds = 0
  buf[20] = 0x00
  buf[21] = 0x00
  buf[22] = 0x00
  buf[23] = 0x00
  // flags = MH_PIE (0x200000) LE
  buf[24] = 0x00
  buf[25] = 0x00
  buf[26] = 0x20
  buf[27] = 0x00

  return buf
}

describe('findPEHeaderOffset()', () => {
  it('returns correct PE offset for valid PE', () => {
    const pe = buildMinimalPE()
    expect(findPEHeaderOffset(pe)).toBe(0x80)
  })

  it('returns -1 for non-PE data', () => {
    expect(findPEHeaderOffset(new Uint8Array(100))).toBe(-1)
  })

  it('returns -1 for null/short input', () => {
    expect(findPEHeaderOffset(null)).toBe(-1)
    expect(findPEHeaderOffset(new Uint8Array(10))).toBe(-1)
  })

  it('returns -1 when MZ present but no PE signature', () => {
    const buf = new Uint8Array(256)
    buf[0] = 0x4d
    buf[1] = 0x5a
    buf[0x3c] = 0x80
    // Don't put PE signature at offset 0x80
    expect(findPEHeaderOffset(buf)).toBe(-1)
  })
})

describe('analyzePEStructure()', () => {
  it('parses a minimal 32-bit PE', () => {
    const pe = buildMinimalPE({ is64: false })
    const result = analyzePEStructure(pe)
    expect(result).not.toHaveProperty('error')
    expect(result.machine).toBe('x86')
    expect(result.is64bit).toBe(false)
    expect(result.offset).toBe('0x00000080')
  })

  it('parses a minimal 64-bit PE', () => {
    const pe = buildMinimalPE({ is64: true })
    const result = analyzePEStructure(pe)
    expect(result.machine).toBe('x86-64')
    expect(result.is64bit).toBe(true)
  })

  it('returns characteristics array', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(Array.isArray(result.characteristics)).toBe(true)
    expect(result.characteristics).toContain('Executable')
  })

  it('returns error for invalid input', () => {
    const result = analyzePEStructure(new Uint8Array(10))
    expect(result).toHaveProperty('error')
  })
})

describe('analyzeElfStructure (via detectSpecificFileType)', () => {
  it('detects ELF and returns enhanced type', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    expect(results.length).toBeGreaterThan(0)
    const elfResult = results.find((r) => r.name.includes('ELF'))
    expect(elfResult).toBeDefined()
    expect(elfResult.details).toHaveProperty('class')
    expect(elfResult.details).toHaveProperty('machine')
  })
})

describe('analyzeMachOStructure (via detectSpecificFileType)', () => {
  it('detects Mach-O and returns enhanced type', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details).toHaveProperty('type')
  })
})

describe('detectSpecificFileType()', () => {
  it('throws on empty/null bytes', () => {
    expect(() => detectSpecificFileType(null)).toThrow()
    expect(() => detectSpecificFileType(new Uint8Array(0))).toThrow()
  })

  it('returns enhanced types for PNG', () => {
    const png = new Uint8Array(32)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    // IHDR chunk at offset 8: length=13
    png[11] = 13
    png[12] = 0x49
    png[13] = 0x48
    png[14] = 0x44
    png[15] = 0x52 // "IHDR"
    // Width=1, Height=1 in IHDR
    png[19] = 1
    png[23] = 1

    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult).toBeDefined()
    expect(pngResult.details).toHaveProperty('dimensions')
  })

  it('returns empty for unknown bytes', () => {
    const unknown = new Uint8Array([0x01, 0x02, 0x03, 0x04])
    const results = detectSpecificFileType(unknown)
    expect(results).toEqual([])
  })
})

describe('detectNestedFiles()', () => {
  it('returns empty for non-container bytes', () => {
    const data = new Uint8Array(100)
    expect(detectNestedFiles(data)).toEqual([])
  })
})
