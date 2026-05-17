import { describe, it, expect } from 'vitest'
import {
  computePEFileSize,
  computeELFFileSize,
  computeMachOFileSize,
  computeMachOFatFileSize,
  PE_MAX_SECTIONS,
  MACHO_MAX_NFAT_ARCH
} from './embeddedExecutableExtents.js'

// ─── PE fixtures ──────────────────────────────────────────────────────────

/**
 * Build a minimal PE buffer with N sections.
 * Each section i has PointerToRawData = headerEnd + i*sectionSize, SizeOfRawData = sectionSize.
 *
 * Optional cert table: if `certTable` is { va, size }, write it into the
 * Security data directory (index 4) with NumberOfRvaAndSizes = 16.
 */
function buildPE({
  numberOfSections = 1,
  sectionRawSize = 0x200,
  eLfanew = 0x80,
  optionalHeaderSize = 240,
  is64bit = true,
  trailingPad = 0,
  certTable = null
} = {}) {
  const sectionTableStart = eLfanew + 24 + optionalHeaderSize
  const sectionTableEnd = sectionTableStart + numberOfSections * 40
  // Sections come after the section table; each section gets `sectionRawSize` bytes on disk.
  const lastSectionEnd = sectionTableEnd + numberOfSections * sectionRawSize
  const total = lastSectionEnd + trailingPad
  const buf = new Uint8Array(total)
  buf[0] = 0x4d
  buf[1] = 0x5a
  buf[0x3c] = eLfanew & 0xff
  buf[0x3d] = (eLfanew >> 8) & 0xff
  buf[0x3e] = (eLfanew >> 16) & 0xff
  buf[0x3f] = (eLfanew >> 24) & 0xff
  buf[eLfanew] = 0x50
  buf[eLfanew + 1] = 0x45
  // NumberOfSections at +6
  buf[eLfanew + 6] = numberOfSections & 0xff
  buf[eLfanew + 7] = (numberOfSections >> 8) & 0xff
  // SizeOfOptionalHeader at +20
  buf[eLfanew + 20] = optionalHeaderSize & 0xff
  buf[eLfanew + 21] = (optionalHeaderSize >> 8) & 0xff
  // Optional-header magic
  const optAbs = eLfanew + 24
  const optMagic = is64bit ? 0x20b : 0x10b
  buf[optAbs] = optMagic & 0xff
  buf[optAbs + 1] = (optMagic >> 8) & 0xff

  // Fill section entries
  for (let i = 0; i < numberOfSections; i++) {
    const entry = sectionTableStart + i * 40
    const pointerToRawData = sectionTableEnd + i * sectionRawSize
    // SizeOfRawData at +16
    buf[entry + 16] = sectionRawSize & 0xff
    buf[entry + 17] = (sectionRawSize >> 8) & 0xff
    buf[entry + 18] = (sectionRawSize >> 16) & 0xff
    buf[entry + 19] = (sectionRawSize >> 24) & 0xff
    // PointerToRawData at +20
    buf[entry + 20] = pointerToRawData & 0xff
    buf[entry + 21] = (pointerToRawData >> 8) & 0xff
    buf[entry + 22] = (pointerToRawData >> 16) & 0xff
    buf[entry + 23] = (pointerToRawData >> 24) & 0xff
  }

  if (certTable) {
    // NumberOfRvaAndSizes at optHeader + 92 (PE32) or +108 (PE32+)
    const numRvaOffset = is64bit ? 108 : 92
    // Data directories start at optHeader + 96 (PE32) or +112 (PE32+)
    const ddOffset = is64bit ? 112 : 96
    const optAbs = eLfanew + 24
    // Write NumberOfRvaAndSizes = 16
    buf[optAbs + numRvaOffset] = 16
    buf[optAbs + numRvaOffset + 1] = 0
    buf[optAbs + numRvaOffset + 2] = 0
    buf[optAbs + numRvaOffset + 3] = 0
    // Security entry (index 4): VA at +4*8, Size at +4*8+4
    const secEntry = optAbs + ddOffset + 4 * 8
    const va = certTable.va
    const sz = certTable.size
    buf[secEntry + 0] = va & 0xff
    buf[secEntry + 1] = (va >> 8) & 0xff
    buf[secEntry + 2] = (va >> 16) & 0xff
    buf[secEntry + 3] = (va >> 24) & 0xff
    buf[secEntry + 4] = sz & 0xff
    buf[secEntry + 5] = (sz >> 8) & 0xff
    buf[secEntry + 6] = (sz >> 16) & 0xff
    buf[secEntry + 7] = (sz >> 24) & 0xff
  }

  return { buf, expectedSize: lastSectionEnd }
}

describe('computePEFileSize', () => {
  it('computes size from a single section', () => {
    const { buf, expectedSize } = buildPE({ numberOfSections: 1 })
    const r = computePEFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(expectedSize)
  })

  it('takes the max end across multiple sections', () => {
    const { buf, expectedSize } = buildPE({ numberOfSections: 4, sectionRawSize: 0x400 })
    const r = computePEFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(expectedSize)
  })

  it('handles BSS-like sections with SizeOfRawData=0', () => {
    const { buf, expectedSize } = buildPE({ numberOfSections: 2 })
    // Zero out the SizeOfRawData of the second section (BSS-like)
    const eLfanew = 0x80
    const sectionTableStart = eLfanew + 24 + 240
    const secondEntry = sectionTableStart + 40
    buf[secondEntry + 16] = 0
    buf[secondEntry + 17] = 0
    buf[secondEntry + 18] = 0
    buf[secondEntry + 19] = 0
    const r = computePEFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    // Should fall back to first section's end since second has no file backing.
    expect(r.fileSize).toBeLessThan(expectedSize)
  })

  it('respects PE_MAX_SECTIONS cap', () => {
    // Build a PE buffer claiming PE_MAX_SECTIONS + 1 sections (just rewrite the count)
    const { buf } = buildPE({ numberOfSections: 1 })
    buf[0x80 + 6] = (PE_MAX_SECTIONS + 1) & 0xff
    buf[0x80 + 7] = ((PE_MAX_SECTIONS + 1) >> 8) & 0xff
    const r = computePEFileSize(buf, 0)
    expect(r.extractable).toBe(false)
    expect(r.extractError).toMatch(/exceeds cap/)
  })

  it('rejects when section table extends beyond buffer', () => {
    // Claim many sections; truncate buffer before table fits.
    const { buf } = buildPE({ numberOfSections: 1 })
    buf[0x80 + 6] = 50
    // Truncate to leave no room for 50 entries
    const truncated = buf.slice(0, 0x80 + 24 + 240 + 10)
    const r = computePEFileSize(truncated, 0)
    expect(r.extractable).toBe(false)
    expect(r.extractError).toMatch(/section table extends beyond/)
  })

  it('handles offset != 0 (embedded PE)', () => {
    const { buf, expectedSize } = buildPE({ numberOfSections: 2 })
    const wrapped = new Uint8Array(buf.length + 0x1000)
    wrapped.set(buf, 0x1000)
    const r = computePEFileSize(wrapped, 0x1000)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(expectedSize)
  })

  it('extends fileSize to cover the Authenticode certificate table', () => {
    // Sections end at ~0x2A0; place a 0x800-byte cert table at 0x3000.
    const { buf, expectedSize } = buildPE({
      numberOfSections: 1,
      sectionRawSize: 0x100,
      certTable: { va: 0x3000, size: 0x800 }
    })
    // Allocate room for the certificate so the cert read happens within bounds.
    const padded = new Uint8Array(0x3800)
    padded.set(buf, 0)
    const r = computePEFileSize(padded, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(0x3800)
    expect(r.fileSize).toBeGreaterThan(expectedSize)
  })

  it('ignores a zero-VA certificate table entry', () => {
    const { buf, expectedSize } = buildPE({
      numberOfSections: 1,
      certTable: { va: 0, size: 0 }
    })
    const r = computePEFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    // Should match the section-walk result exactly, not extend past it.
    expect(r.fileSize).toBe(expectedSize)
  })

  it('ignores cert table when NumberOfRvaAndSizes < 5', () => {
    const { buf, expectedSize } = buildPE({
      numberOfSections: 1,
      certTable: { va: 0x3000, size: 0x100 }
    })
    // Patch NumberOfRvaAndSizes down to 4 — security entry is no longer valid.
    const optAbs = 0x80 + 24
    buf[optAbs + 108] = 4
    const padded = new Uint8Array(0x3200)
    padded.set(buf, 0)
    const r = computePEFileSize(padded, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(expectedSize)
  })
})

// ─── ELF fixtures ─────────────────────────────────────────────────────────

function buildELF64({
  isLittleEndian = true,
  phnum = 0,
  shnum = 0,
  phoff = 0x40,
  shoff = 0x40,
  programs = [], // [{ offset, filesz }]
  sections = [] // [{ type, offset, size }]
} = {}) {
  const headerSize = 64
  const phentsize = 56
  const shentsize = 64

  // Layout: header, then phtable, then shtable, then a generous tail for content.
  const phTableEnd = phnum > 0 ? phoff + phnum * phentsize : headerSize
  const shTableEnd = shnum > 0 ? shoff + shnum * shentsize : headerSize
  const maxContentEnd = [
    ...programs.map((p) => p.offset + p.filesz),
    ...sections.map((s) => s.offset + s.size)
  ].reduce((a, b) => Math.max(a, b), 0)
  const total = Math.max(headerSize, phTableEnd, shTableEnd, maxContentEnd)

  const buf = new Uint8Array(total)
  buf[0] = 0x7f
  buf[1] = 0x45
  buf[2] = 0x4c
  buf[3] = 0x46
  buf[4] = 2 // 64-bit
  buf[5] = isLittleEndian ? 1 : 2
  buf[6] = 1

  const write32 = (off, val) => {
    if (isLittleEndian) {
      buf[off] = val & 0xff
      buf[off + 1] = (val >> 8) & 0xff
      buf[off + 2] = (val >> 16) & 0xff
      buf[off + 3] = (val >> 24) & 0xff
    } else {
      buf[off] = (val >> 24) & 0xff
      buf[off + 1] = (val >> 16) & 0xff
      buf[off + 2] = (val >> 8) & 0xff
      buf[off + 3] = val & 0xff
    }
  }
  const write16 = (off, val) => {
    if (isLittleEndian) {
      buf[off] = val & 0xff
      buf[off + 1] = (val >> 8) & 0xff
    } else {
      buf[off] = (val >> 8) & 0xff
      buf[off + 1] = val & 0xff
    }
  }
  const writeU64Lo = (off, val) => {
    // High half stays 0.
    if (isLittleEndian) {
      write32(off, val)
    } else {
      write32(off + 4, val)
    }
  }

  writeU64Lo(0x20, phoff)
  writeU64Lo(0x28, shoff)
  write16(0x36, phentsize)
  write16(0x38, phnum)
  write16(0x3a, shentsize)
  write16(0x3c, shnum)

  for (let i = 0; i < programs.length; i++) {
    const entry = phoff + i * phentsize
    writeU64Lo(entry + 8, programs[i].offset)
    writeU64Lo(entry + 32, programs[i].filesz)
  }
  for (let i = 0; i < sections.length; i++) {
    const entry = shoff + i * shentsize
    write32(entry + 4, sections[i].type ?? 1) // sh_type
    writeU64Lo(entry + 24, sections[i].offset)
    writeU64Lo(entry + 32, sections[i].size)
  }

  return { buf, total }
}

describe('computeELFFileSize', () => {
  it('returns header-end size for minimal ELF with no program/section tables', () => {
    const { buf } = buildELF64({})
    const r = computeELFFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(64)
  })

  it('uses max(p_offset + p_filesz) for program headers', () => {
    const { buf } = buildELF64({
      phnum: 2,
      phoff: 0x40,
      programs: [
        { offset: 0x1000, filesz: 0x500 },
        { offset: 0x2000, filesz: 0x800 }
      ]
    })
    const r = computeELFFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(0x2800)
  })

  it('uses max(sh_offset + sh_size) for section headers, skipping SHT_NOBITS', () => {
    const { buf } = buildELF64({
      shnum: 3,
      shoff: 0x40,
      sections: [
        { type: 1, offset: 0x1000, size: 0x200 },
        { type: 8, offset: 0x9000, size: 0x4000 }, // SHT_NOBITS — ignored
        { type: 1, offset: 0x2000, size: 0x100 }
      ]
    })
    const r = computeELFFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(0x2100)
  })

  it('handles big-endian ELF', () => {
    const { buf } = buildELF64({
      isLittleEndian: false,
      phnum: 1,
      phoff: 0x40,
      programs: [{ offset: 0x500, filesz: 0x100 }]
    })
    const r = computeELFFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(0x600)
  })

  it('handles offset != 0 (embedded ELF)', () => {
    const { buf } = buildELF64({
      phnum: 1,
      phoff: 0x40,
      programs: [{ offset: 0x800, filesz: 0x100 }]
    })
    const wrapped = new Uint8Array(buf.length + 0x500)
    wrapped.set(buf, 0x500)
    const r = computeELFFileSize(wrapped, 0x500)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(0x900)
  })

  it('rejects truncated header', () => {
    const buf = new Uint8Array(8)
    buf[0] = 0x7f
    buf[1] = 0x45
    buf[2] = 0x4c
    buf[3] = 0x46
    const r = computeELFFileSize(buf, 0)
    expect(r.extractable).toBe(false)
  })

  it('rejects program table extending beyond buffer', () => {
    const { buf } = buildELF64({ phnum: 1, phoff: 0x40, programs: [{ offset: 0, filesz: 0 }] })
    const truncated = buf.slice(0, 0x40 + 10)
    const r = computeELFFileSize(truncated, 0)
    expect(r.extractable).toBe(false)
    expect(r.extractError).toMatch(/program header table extends beyond/)
  })
})

// ─── Mach-O fixtures ──────────────────────────────────────────────────────

function buildMachO64({
  isLittleEndian = true,
  segments = [] // [{ fileoff, filesize }]
} = {}) {
  const headerSize = 32
  const LC_SEGMENT_64 = 0x19
  const segmentCmdSize = 72 // standard LC_SEGMENT_64 size with zero sections
  const ncmds = segments.length
  const sizeofcmds = ncmds * segmentCmdSize

  const maxContentEnd = segments.reduce((m, s) => Math.max(m, s.fileoff + s.filesize), 0)
  const total = Math.max(headerSize + sizeofcmds, maxContentEnd)

  const buf = new Uint8Array(total)
  if (isLittleEndian) {
    buf[0] = 0xcf
    buf[1] = 0xfa
    buf[2] = 0xed
    buf[3] = 0xfe
  } else {
    buf[0] = 0xfe
    buf[1] = 0xed
    buf[2] = 0xfa
    buf[3] = 0xcf
  }
  const write32 = (off, val) => {
    if (isLittleEndian) {
      buf[off] = val & 0xff
      buf[off + 1] = (val >> 8) & 0xff
      buf[off + 2] = (val >> 16) & 0xff
      buf[off + 3] = (val >> 24) & 0xff
    } else {
      buf[off] = (val >> 24) & 0xff
      buf[off + 1] = (val >> 16) & 0xff
      buf[off + 2] = (val >> 8) & 0xff
      buf[off + 3] = val & 0xff
    }
  }
  const writeU64Lo = (off, val) => {
    if (isLittleEndian) {
      write32(off, val)
    } else {
      write32(off + 4, val)
    }
  }

  write32(16, ncmds)
  write32(20, sizeofcmds)

  let cursor = headerSize
  for (const seg of segments) {
    write32(cursor, LC_SEGMENT_64)
    write32(cursor + 4, segmentCmdSize)
    writeU64Lo(cursor + 40, seg.fileoff)
    writeU64Lo(cursor + 48, seg.filesize)
    cursor += segmentCmdSize
  }
  return { buf, total }
}

describe('computeMachOFileSize', () => {
  it('returns header+cmds when no LC_SEGMENT_64 commands', () => {
    const buf = new Uint8Array(32)
    buf[0] = 0xcf
    buf[1] = 0xfa
    buf[2] = 0xed
    buf[3] = 0xfe
    buf[16] = 1 // ncmds=1 but no actual segment cmds — should fail load cmd walk
    buf[20] = 0 // sizeofcmds = 0
    const r = computeMachOFileSize(buf, 0)
    expect(r.extractable).toBe(false)
  })

  it('takes max(fileoff + filesize) across LC_SEGMENT_64', () => {
    const { buf } = buildMachO64({
      segments: [
        { fileoff: 0, filesize: 0x1000 },
        { fileoff: 0x2000, filesize: 0x800 },
        { fileoff: 0x1500, filesize: 0x100 }
      ]
    })
    const r = computeMachOFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(0x2800)
  })

  it('handles big-endian Mach-O', () => {
    const { buf } = buildMachO64({
      isLittleEndian: false,
      segments: [{ fileoff: 0, filesize: 0x500 }]
    })
    const r = computeMachOFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBeGreaterThanOrEqual(0x500)
  })

  it('handles offset != 0 (embedded Mach-O)', () => {
    const { buf } = buildMachO64({ segments: [{ fileoff: 0, filesize: 0x800 }] })
    const wrapped = new Uint8Array(buf.length + 0x200)
    wrapped.set(buf, 0x200)
    const r = computeMachOFileSize(wrapped, 0x200)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBeGreaterThanOrEqual(0x800)
  })

  it('rejects unrecognized magic', () => {
    const buf = new Uint8Array(32)
    buf[0] = 0x11
    buf[1] = 0x22
    buf[2] = 0x33
    buf[3] = 0x44
    const r = computeMachOFileSize(buf, 0)
    expect(r.extractable).toBe(false)
  })
})

// ─── Mach-O Fat fixtures ──────────────────────────────────────────────────

function buildMachOFat({ arches = [] } = {}) {
  const nfatArch = arches.length
  const tableEnd = 8 + nfatArch * 20
  const maxContentEnd = arches.reduce((m, a) => Math.max(m, a.offset + a.size), 0)
  const total = Math.max(tableEnd, maxContentEnd)
  const buf = new Uint8Array(total)
  // CAFEBABE BE magic
  buf[0] = 0xca
  buf[1] = 0xfe
  buf[2] = 0xba
  buf[3] = 0xbe
  // nfat_arch BE
  buf[4] = (nfatArch >> 24) & 0xff
  buf[5] = (nfatArch >> 16) & 0xff
  buf[6] = (nfatArch >> 8) & 0xff
  buf[7] = nfatArch & 0xff
  for (let i = 0; i < arches.length; i++) {
    const entry = 8 + i * 20
    // offset at +8, size at +12, both BE u32
    const off = arches[i].offset
    const sz = arches[i].size
    buf[entry + 8] = (off >> 24) & 0xff
    buf[entry + 9] = (off >> 16) & 0xff
    buf[entry + 10] = (off >> 8) & 0xff
    buf[entry + 11] = off & 0xff
    buf[entry + 12] = (sz >> 24) & 0xff
    buf[entry + 13] = (sz >> 16) & 0xff
    buf[entry + 14] = (sz >> 8) & 0xff
    buf[entry + 15] = sz & 0xff
  }
  return buf
}

describe('computeMachOFatFileSize', () => {
  it('takes max(offset + size) over fat_arch entries', () => {
    const buf = buildMachOFat({
      arches: [
        { offset: 0x1000, size: 0x500 },
        { offset: 0x2000, size: 0x800 }
      ]
    })
    const r = computeMachOFatFileSize(buf, 0)
    expect(r.extractable).toBe(true)
    expect(r.fileSize).toBe(0x2800)
  })

  it('rejects 64-bit fat (CAFEBABF)', () => {
    const buf = buildMachOFat({ arches: [{ offset: 0x100, size: 0x100 }] })
    buf[3] = 0xbf // turn into 64-bit fat magic
    const r = computeMachOFatFileSize(buf, 0)
    expect(r.extractable).toBe(false)
    expect(r.extractError).toMatch(/64-bit/)
  })

  it('respects MACHO_MAX_NFAT_ARCH cap', () => {
    const buf = new Uint8Array(8)
    buf[0] = 0xca
    buf[1] = 0xfe
    buf[2] = 0xba
    buf[3] = 0xbe
    buf[7] = (MACHO_MAX_NFAT_ARCH + 1) & 0xff
    buf[6] = ((MACHO_MAX_NFAT_ARCH + 1) >> 8) & 0xff
    const r = computeMachOFatFileSize(buf, 0)
    expect(r.extractable).toBe(false)
    expect(r.extractError).toMatch(/exceeds cap/)
  })

  it('rejects when arch table extends beyond buffer', () => {
    const buf = new Uint8Array(20)
    buf[0] = 0xca
    buf[1] = 0xfe
    buf[2] = 0xba
    buf[3] = 0xbe
    buf[7] = 10 // 10 arches × 20 bytes = 200, but buffer is only 20
    const r = computeMachOFatFileSize(buf, 0)
    expect(r.extractable).toBe(false)
    expect(r.extractError).toMatch(/extends beyond/)
  })
})
