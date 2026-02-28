import { describe, it, expect } from 'vitest'
import { FILE_SIGNATURES, isMachOFatBinary, detectFileTypes, isFileType } from './fileSignatures.js'

describe('fileSignatures', () => {
  describe('FILE_SIGNATURES constant', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(FILE_SIGNATURES)).toBe(true)
      expect(FILE_SIGNATURES.length).toBeGreaterThan(30)
    })

    it('each entry has pattern, name, extension', () => {
      for (const sig of FILE_SIGNATURES) {
        expect(sig).toHaveProperty('pattern')
        expect(sig).toHaveProperty('name')
        expect(sig).toHaveProperty('extension')
        expect(Array.isArray(sig.pattern)).toBe(true)
      }
    })
  })

  describe('detectFileTypes()', () => {
    it('detects PNG', () => {
      const png = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...new Array(20).fill(0)
      ])
      const matches = detectFileTypes(png)
      expect(matches.some((m) => m.name === 'PNG Image')).toBe(true)
    })

    it('detects PDF', () => {
      const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
      const matches = detectFileTypes(pdf)
      expect(matches.some((m) => m.name === 'PDF Document')).toBe(true)
    })

    it('detects ZIP', () => {
      const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00])
      const matches = detectFileTypes(zip)
      expect(matches.some((m) => m.extension === 'zip')).toBe(true)
    })

    it('detects PE (MZ)', () => {
      const pe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00])
      const matches = detectFileTypes(pe)
      expect(matches.some((m) => m.name.includes('PE'))).toBe(true)
    })

    it('detects ELF', () => {
      const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00])
      const matches = detectFileTypes(elf)
      expect(matches.some((m) => m.name === 'ELF Binary')).toBe(true)
    })

    it('detects Mach-O 64-bit little-endian', () => {
      const macho = new Uint8Array([0xcf, 0xfa, 0xed, 0xfe, ...new Array(60).fill(0)])
      const matches = detectFileTypes(macho)
      expect(matches.some((m) => m.name.includes('Mach-O'))).toBe(true)
    })

    it('returns empty for unknown bytes', () => {
      const unknown = new Uint8Array([0x01, 0x02, 0x03, 0x04])
      expect(detectFileTypes(unknown)).toEqual([])
    })

    it('returns empty for too-short bytes', () => {
      const short = new Uint8Array([0x89])
      expect(detectFileTypes(short)).toEqual([])
    })

    it('each match has confidence and offset', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const matches = detectFileTypes(png)
      for (const m of matches) {
        expect(m).toHaveProperty('confidence')
        expect(m).toHaveProperty('offset', 0)
      }
    })
  })

  describe('CAFEBABE disambiguation', () => {
    it('identifies Mach-O Universal Binary', () => {
      // Construct a minimal Mach-O fat binary header:
      // magic: CA FE BA BE, nfat_arch: 2
      // First fat_arch: cputype = 0x01000007 (x86_64)
      const buf = new Uint8Array(8 + 2 * 20) // fat_header + 2 * fat_arch
      // magic
      buf[0] = 0xca
      buf[1] = 0xfe
      buf[2] = 0xba
      buf[3] = 0xbe
      // nfat_arch = 2 (big-endian)
      buf[7] = 2
      // First fat_arch: cputype = 0x01000007 (x86_64, big-endian)
      buf[8] = 0x01
      buf[9] = 0x00
      buf[10] = 0x00
      buf[11] = 0x07

      const matches = detectFileTypes(buf)
      expect(matches.some((m) => m.name === 'Mach-O Universal Binary')).toBe(true)
    })

    it('identifies Java Class File when not Mach-O', () => {
      // CAFEBABE with invalid CPU type → Java
      const buf = new Uint8Array(48)
      buf[0] = 0xca
      buf[1] = 0xfe
      buf[2] = 0xba
      buf[3] = 0xbe
      buf[7] = 1 // nfat_arch = 1
      // cputype = 0xFFFFFFFF (not a known CPU type)
      buf[8] = 0xff
      buf[9] = 0xff
      buf[10] = 0xff
      buf[11] = 0xff

      const matches = detectFileTypes(buf)
      expect(matches.some((m) => m.name === 'Java Class File')).toBe(true)
    })
  })

  describe('isMachOFatBinary()', () => {
    it('returns false for null/short input', () => {
      expect(isMachOFatBinary(null)).toBe(false)
      expect(isMachOFatBinary(new Uint8Array(10))).toBe(false)
    })

    it('returns false when nfat_arch is out of range', () => {
      const buf = new Uint8Array(48)
      buf[0] = 0xca
      buf[1] = 0xfe
      buf[2] = 0xba
      buf[3] = 0xbe
      buf[4] = 0
      buf[5] = 0
      buf[6] = 0
      buf[7] = 0 // nfat_arch = 0
      expect(isMachOFatBinary(buf)).toBe(false)
    })

    it('returns true for valid fat binary', () => {
      const buf = new Uint8Array(8 + 20)
      buf[0] = 0xca
      buf[1] = 0xfe
      buf[2] = 0xba
      buf[3] = 0xbe
      buf[7] = 1 // nfat_arch = 1
      // cputype = ARM64 (0x0100000C)
      buf[8] = 0x01
      buf[9] = 0x00
      buf[10] = 0x00
      buf[11] = 0x0c
      expect(isMachOFatBinary(buf)).toBe(true)
    })
  })

  describe('isFileType()', () => {
    it('returns true for matching format', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(isFileType(png, 'PNG')).toBe(true)
    })

    it('returns false for non-matching bytes', () => {
      const random = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
      expect(isFileType(random, 'PNG')).toBe(false)
    })

    it('returns false for unknown format string', () => {
      expect(isFileType(new Uint8Array(8), 'DOESNOTEXIST')).toBe(false)
    })

    it('is case-insensitive', () => {
      const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
      expect(isFileType(pdf, 'pdf')).toBe(true)
      expect(isFileType(pdf, 'PDF')).toBe(true)
    })
  })
})
