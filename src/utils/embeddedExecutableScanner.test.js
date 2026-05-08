import { describe, it, expect, vi } from 'vitest'
import {
  scanBuffer,
  validatePE,
  validateELF,
  validateMachO,
  validateMachOFat,
  FORMAT,
  DEFAULT_MAX_FINDINGS
} from './embeddedExecutableScanner.js'

// ─── Fixture builders ─────────────────────────────────────────────────────

function buildPE({ machine = 0x8664, is64bit = true, sizeOfImage = 0x1000, eLfanew = 0x80 } = {}) {
  const total = eLfanew + 24 + 240 // PE header (24) + optional header (PE32+ is 240)
  const buf = new Uint8Array(total)
  buf[0] = 0x4d
  buf[1] = 0x5a
  // e_lfanew at 0x3c (LE u32)
  buf[0x3c] = eLfanew & 0xff
  buf[0x3d] = (eLfanew >> 8) & 0xff
  buf[0x3e] = (eLfanew >> 16) & 0xff
  buf[0x3f] = (eLfanew >> 24) & 0xff
  // PE\0\0 at e_lfanew
  buf[eLfanew] = 0x50
  buf[eLfanew + 1] = 0x45
  buf[eLfanew + 2] = 0x00
  buf[eLfanew + 3] = 0x00
  // Machine (LE u16) at +4
  buf[eLfanew + 4] = machine & 0xff
  buf[eLfanew + 5] = (machine >> 8) & 0xff
  // SizeOfOptionalHeader at +20 (LE u16)
  const optSize = is64bit ? 240 : 224
  buf[eLfanew + 20] = optSize & 0xff
  buf[eLfanew + 21] = (optSize >> 8) & 0xff
  // Optional-header magic at peHeader+24 (LE u16)
  const optAbs = eLfanew + 24
  const optMagic = is64bit ? 0x20b : 0x10b
  buf[optAbs] = optMagic & 0xff
  buf[optAbs + 1] = (optMagic >> 8) & 0xff
  // SizeOfImage at optHeader + 56 (LE u32)
  buf[optAbs + 56] = sizeOfImage & 0xff
  buf[optAbs + 57] = (sizeOfImage >> 8) & 0xff
  buf[optAbs + 58] = (sizeOfImage >> 16) & 0xff
  buf[optAbs + 59] = (sizeOfImage >> 24) & 0xff
  return buf
}

function buildELF({ is64bit = true, isLittleEndian = true, machine = 0x3e } = {}) {
  const size = is64bit ? 0x40 : 0x34
  const buf = new Uint8Array(size)
  buf[0] = 0x7f
  buf[1] = 0x45
  buf[2] = 0x4c
  buf[3] = 0x46
  buf[4] = is64bit ? 2 : 1 // EI_CLASS
  buf[5] = isLittleEndian ? 1 : 2 // EI_DATA
  buf[6] = 1 // EI_VERSION
  // e_machine at 0x12 (u16)
  if (isLittleEndian) {
    buf[0x12] = machine & 0xff
    buf[0x13] = (machine >> 8) & 0xff
  } else {
    buf[0x12] = (machine >> 8) & 0xff
    buf[0x13] = machine & 0xff
  }
  return buf
}

function buildMachO({
  is64bit = true,
  isLittleEndian = true,
  cputype = 0x01000007,
  ncmds = 5,
  sizeofcmds = 200
} = {}) {
  const headerSize = is64bit ? 32 : 28
  const buf = new Uint8Array(headerSize + sizeofcmds)
  if (isLittleEndian) {
    if (is64bit) {
      buf[0] = 0xcf
      buf[1] = 0xfa
      buf[2] = 0xed
      buf[3] = 0xfe
    } else {
      buf[0] = 0xce
      buf[1] = 0xfa
      buf[2] = 0xed
      buf[3] = 0xfe
    }
  } else {
    if (is64bit) {
      buf[0] = 0xfe
      buf[1] = 0xed
      buf[2] = 0xfa
      buf[3] = 0xcf
    } else {
      buf[0] = 0xfe
      buf[1] = 0xed
      buf[2] = 0xfa
      buf[3] = 0xce
    }
  }
  const writeU32 = (off, v) => {
    if (isLittleEndian) {
      buf[off] = v & 0xff
      buf[off + 1] = (v >> 8) & 0xff
      buf[off + 2] = (v >> 16) & 0xff
      buf[off + 3] = (v >> 24) & 0xff
    } else {
      buf[off] = (v >> 24) & 0xff
      buf[off + 1] = (v >> 16) & 0xff
      buf[off + 2] = (v >> 8) & 0xff
      buf[off + 3] = v & 0xff
    }
  }
  writeU32(4, cputype)
  writeU32(8, 0) // cpusubtype
  writeU32(12, 2) // filetype = MH_EXECUTE
  writeU32(16, ncmds)
  writeU32(20, sizeofcmds)
  writeU32(24, 0x00200085) // flags
  return buf
}

function buildMachOFat({ nfatArch = 2, cputype = 0x01000007 } = {}) {
  const headerLen = 8 + nfatArch * 20
  const buf = new Uint8Array(headerLen)
  // magic CA FE BA BE (BE always)
  buf[0] = 0xca
  buf[1] = 0xfe
  buf[2] = 0xba
  buf[3] = 0xbe
  // nfat_arch (BE u32)
  buf[4] = (nfatArch >> 24) & 0xff
  buf[5] = (nfatArch >> 16) & 0xff
  buf[6] = (nfatArch >> 8) & 0xff
  buf[7] = nfatArch & 0xff
  // First fat_arch.cputype (BE u32)
  buf[8] = (cputype >> 24) & 0xff
  buf[9] = (cputype >> 16) & 0xff
  buf[10] = (cputype >> 8) & 0xff
  buf[11] = cputype & 0xff
  return buf
}

function concat(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrays) {
    out.set(a, off)
    off += a.length
  }
  return out
}

// ─── validatePE ───────────────────────────────────────────────────────────

describe('validatePE', () => {
  it('accepts a well-formed PE32+ header', () => {
    const buf = buildPE({ machine: 0x8664, is64bit: true, sizeOfImage: 0x4000 })
    const r = validatePE(buf, 0)
    expect(r.valid).toBe(true)
    expect(r.machine).toBe(0x8664)
    expect(r.is64bit).toBe(true)
    expect(r.sizeOfImage).toBe(0x4000)
  })

  it('accepts a well-formed PE32 header', () => {
    const buf = buildPE({ machine: 0x014c, is64bit: false })
    const r = validatePE(buf, 0)
    expect(r.valid).toBe(true)
    expect(r.is64bit).toBe(false)
  })

  it('rejects when MZ is missing', () => {
    const buf = buildPE()
    buf[0] = 0
    expect(validatePE(buf, 0).valid).toBe(false)
  })

  it('rejects when e_lfanew is too small', () => {
    const buf = buildPE({ eLfanew: 0x10 })
    expect(validatePE(buf, 0).valid).toBe(false)
  })

  it('rejects when e_lfanew points past EOF', () => {
    const buf = buildPE()
    buf[0x3c] = 0xff
    buf[0x3d] = 0xff
    buf[0x3e] = 0xff
    buf[0x3f] = 0x7f
    expect(validatePE(buf, 0).valid).toBe(false)
  })

  it('rejects when PE signature is wrong', () => {
    const buf = buildPE()
    buf[0x80] = 0x4f // O instead of P
    expect(validatePE(buf, 0).valid).toBe(false)
  })

  it('rejects unknown machine type', () => {
    const buf = buildPE({ machine: 0xdead })
    expect(validatePE(buf, 0).valid).toBe(false)
  })

  it('detects PE at non-zero offset', () => {
    const prefix = new Uint8Array(100)
    const buf = concat(prefix, buildPE())
    const r = validatePE(buf, 100)
    expect(r.valid).toBe(true)
  })
})

// ─── validateELF ──────────────────────────────────────────────────────────

describe('validateELF', () => {
  it('accepts ELF64 LE x86-64', () => {
    const r = validateELF(buildELF({ is64bit: true, isLittleEndian: true, machine: 0x3e }), 0)
    expect(r.valid).toBe(true)
    expect(r.is64bit).toBe(true)
    expect(r.isLittleEndian).toBe(true)
  })

  it('accepts ELF32 BE PowerPC', () => {
    const r = validateELF(buildELF({ is64bit: false, isLittleEndian: false, machine: 0x14 }), 0)
    expect(r.valid).toBe(true)
    expect(r.is64bit).toBe(false)
    expect(r.isLittleEndian).toBe(false)
  })

  it('rejects bad EI_CLASS', () => {
    const buf = buildELF()
    buf[4] = 99
    expect(validateELF(buf, 0).valid).toBe(false)
  })

  it('rejects bad EI_DATA', () => {
    const buf = buildELF()
    buf[5] = 99
    expect(validateELF(buf, 0).valid).toBe(false)
  })

  it('rejects bad EI_VERSION', () => {
    const buf = buildELF()
    buf[6] = 2
    expect(validateELF(buf, 0).valid).toBe(false)
  })

  it('rejects unknown machine', () => {
    const buf = buildELF({ machine: 0xfeff })
    expect(validateELF(buf, 0).valid).toBe(false)
  })

  it('rejects non-ELF magic', () => {
    const buf = new Uint8Array(64)
    expect(validateELF(buf, 0).valid).toBe(false)
  })
})

// ─── validateMachO ────────────────────────────────────────────────────────

describe('validateMachO', () => {
  it('accepts Mach-O 64-bit LE', () => {
    const r = validateMachO(buildMachO({ is64bit: true, isLittleEndian: true }), 0)
    expect(r.valid).toBe(true)
    expect(r.is64bit).toBe(true)
    expect(r.isLittleEndian).toBe(true)
  })

  it('accepts Mach-O 32-bit BE', () => {
    const r = validateMachO(
      buildMachO({ is64bit: false, isLittleEndian: false, cputype: 0x00000007 }),
      0
    )
    expect(r.valid).toBe(true)
  })

  it('rejects unknown cputype', () => {
    const buf = buildMachO({ cputype: 0xdeadbeef })
    expect(validateMachO(buf, 0).valid).toBe(false)
  })

  it('rejects ncmds = 0', () => {
    const buf = buildMachO({ ncmds: 0 })
    expect(validateMachO(buf, 0).valid).toBe(false)
  })

  it('rejects ncmds >= 1024', () => {
    const buf = buildMachO({ ncmds: 1024 })
    expect(validateMachO(buf, 0).valid).toBe(false)
  })

  it('rejects sizeofcmds too large', () => {
    const buf = buildMachO({ sizeofcmds: 200 })
    // tweak sizeofcmds field directly to absurd value
    buf[20] = 0xff
    buf[21] = 0xff
    buf[22] = 0xff
    buf[23] = 0xff
    expect(validateMachO(buf, 0).valid).toBe(false)
  })

  it('rejects non-Mach-O magic', () => {
    const buf = new Uint8Array(64)
    expect(validateMachO(buf, 0).valid).toBe(false)
  })
})

// ─── validateMachOFat ─────────────────────────────────────────────────────

describe('validateMachOFat', () => {
  it('accepts a well-formed fat header', () => {
    const r = validateMachOFat(buildMachOFat({ nfatArch: 2 }), 0)
    expect(r.valid).toBe(true)
    expect(r.nfatArch).toBe(2)
  })

  it('rejects fat with nfat_arch out of range', () => {
    const buf = buildMachOFat({ nfatArch: 1 })
    // overwrite nfat_arch to bogus 9999
    buf[4] = 0
    buf[5] = 0
    buf[6] = 0x27
    buf[7] = 0x0f
    expect(validateMachOFat(buf, 0).valid).toBe(false)
  })

  it('rejects when masquerading as Java class file', () => {
    // CA FE BA BE followed by Java version numbers (minor=0, major=52)
    const buf = new Uint8Array(28)
    buf[0] = 0xca
    buf[1] = 0xfe
    buf[2] = 0xba
    buf[3] = 0xbe
    buf[4] = 0
    buf[5] = 0
    buf[6] = 0
    buf[7] = 0x34 // major 52 — would be huge nfat_arch
    expect(validateMachOFat(buf, 0).valid).toBe(false)
  })
})

// ─── scanBuffer ──────────────────────────────────────────────────────────

describe('scanBuffer', () => {
  it('returns no findings for empty/short buffer', () => {
    expect(scanBuffer(new Uint8Array(0)).findings).toEqual([])
    expect(scanBuffer(new Uint8Array([0x4d])).findings).toEqual([])
  })

  it('skips a hit at file offset 0 by default', () => {
    const buf = buildELF()
    const r = scanBuffer(buf)
    expect(r.findings).toEqual([])
  })

  it('detects ELF embedded at non-zero offset', () => {
    const buf = concat(new Uint8Array(1000).fill(0xaa), buildELF())
    const r = scanBuffer(buf)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].format).toBe(FORMAT.ELF)
    expect(r.findings[0].offset).toBe(1000)
  })

  it('detects PE embedded at non-zero offset', () => {
    const buf = concat(new Uint8Array(2048).fill(0xaa), buildPE({ sizeOfImage: 0x2000 }))
    const r = scanBuffer(buf)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].format).toBe(FORMAT.PE)
    expect(r.findings[0].offset).toBe(2048)
    expect(r.findings[0].size).toBe(0x2000)
  })

  it('detects Mach-O thin embedded at non-zero offset', () => {
    const buf = concat(new Uint8Array(500).fill(0xaa), buildMachO())
    const r = scanBuffer(buf)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].format).toBe(FORMAT.MACHO)
    expect(r.findings[0].offset).toBe(500)
  })

  it('detects Mach-O fat embedded at non-zero offset', () => {
    const buf = concat(new Uint8Array(100).fill(0xaa), buildMachOFat())
    const r = scanBuffer(buf)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0].format).toBe(FORMAT.MACHO_FAT)
    expect(r.findings[0].offset).toBe(100)
  })

  it('does NOT report bare MZ without valid PE header', () => {
    // 1 MB of random-ish data sprinkled with MZ — none should match
    const buf = new Uint8Array(64 * 1024)
    for (let i = 0; i < 200; i++) {
      const off = (i * 317) % (buf.length - 2)
      buf[off] = 0x4d
      buf[off + 1] = 0x5a
    }
    const r = scanBuffer(buf)
    expect(r.findings.filter((f) => f.format === FORMAT.PE)).toEqual([])
  })

  it('finds multiple distinct embedded executables', () => {
    const elf = buildELF()
    // sizeOfImage matches actual PE on-disk extent so skip lands inside the gap, not past macho
    const pe = buildPE({ sizeOfImage: 0x80 + 24 + 240 })
    const macho = buildMachO()
    const buf = concat(
      new Uint8Array(100).fill(0xaa),
      elf,
      new Uint8Array(50).fill(0xbb),
      pe,
      new Uint8Array(50).fill(0xcc),
      macho
    )
    const r = scanBuffer(buf)
    const formats = r.findings.map((f) => f.format)
    expect(formats).toContain(FORMAT.ELF)
    expect(formats).toContain(FORMAT.PE)
    expect(formats).toContain(FORMAT.MACHO)
  })

  it('skips ahead past validated PE using SizeOfImage', () => {
    // Place a PE, then bytes that look like MZ inside its declared size — should not re-detect
    const pe = buildPE({ sizeOfImage: 0x800 })
    const trailing = new Uint8Array(0x800)
    // sprinkle MZ-with-broken-header bytes
    trailing[100] = 0x4d
    trailing[101] = 0x5a
    const buf = concat(new Uint8Array(10), pe, trailing)
    const r = scanBuffer(buf)
    expect(r.findings.filter((f) => f.format === FORMAT.PE)).toHaveLength(1)
  })

  it('respects maxFindings cap and reports truncated', () => {
    const elf = buildELF()
    // 5 ELFs back-to-back, but ELF totalSize will be 0 (we built minimal) so skip falls to 4 KB
    const buf = concat(
      new Uint8Array(100),
      elf,
      new Uint8Array(8192),
      elf,
      new Uint8Array(8192),
      elf,
      new Uint8Array(8192),
      elf
    )
    const r = scanBuffer(buf, { maxFindings: 2 })
    expect(r.findings).toHaveLength(2)
    expect(r.truncated).toBe(true)
  })

  it('honors shouldCancel callback', () => {
    // Big buffer of zeros so the scanner has to walk
    const buf = new Uint8Array(256 * 1024)
    let callCount = 0
    const r = scanBuffer(buf, {
      shouldCancel: () => {
        callCount++
        return callCount > 1
      }
    })
    expect(r.cancelled).toBe(true)
  })

  it('reports progress periodically for large buffers', () => {
    const buf = new Uint8Array(3 * 1024 * 1024)
    const onProgress = vi.fn()
    scanBuffer(buf, { onProgress })
    expect(onProgress).toHaveBeenCalled()
    // Should fire at least at ~1MB and ~2MB and the final flush
    expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('translates offsets through baseOffset', () => {
    const buf = concat(new Uint8Array(50), buildELF())
    const r = scanBuffer(buf, { baseOffset: 1000, skipFirstMatch: false })
    expect(r.findings[0].offset).toBe(1050)
  })

  it('reports nextScanFrom in absolute coordinates', () => {
    const buf = new Uint8Array(1000)
    const r = scanBuffer(buf, { baseOffset: 5000 })
    expect(r.nextScanFrom).toBe(6000)
  })

  it('does not crash on truncated PE (e_lfanew points past EOF)', () => {
    // First 64 bytes only — MZ + e_lfanew pointing to 0x80 which doesn't exist
    const buf = new Uint8Array(64)
    buf[0] = 0x4d
    buf[1] = 0x5a
    buf[0x3c] = 0x80
    const r = scanBuffer(new Uint8Array([...new Uint8Array(10), ...buf]))
    expect(r.findings).toEqual([])
  })

  it('default maxFindings constant is 1000', () => {
    expect(DEFAULT_MAX_FINDINGS).toBe(1000)
  })
})
