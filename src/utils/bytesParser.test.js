import { describe, it, expect } from 'vitest'
import {
  parseInput,
  detectFormat,
  previewBytes,
  FORMATS,
  MAX_PASTE_SIZE,
  LARGE_PASTE_WARNING
} from './bytesParser.js'

const SHELLCODE = new Uint8Array([0x90, 0x90, 0x31, 0xc0, 0x50, 0x68, 0x2f, 0x2f])

describe('bytesParser', () => {
  describe('exports', () => {
    it('exposes FORMATS list including auto', () => {
      expect(FORMATS.length).toBe(7)
      expect(FORMATS[0].id).toBe('auto')
      expect(FORMATS.find((f) => f.id === 'hex')).toBeTruthy()
      expect(FORMATS.find((f) => f.id === 'escaped')).toBeTruthy()
      expect(FORMATS.find((f) => f.id === 'hex0x')).toBeTruthy()
      expect(FORMATS.find((f) => f.id === 'base64')).toBeTruthy()
      expect(FORMATS.find((f) => f.id === 'hexdump')).toBeTruthy()
      expect(FORMATS.find((f) => f.id === 'text')).toBeTruthy()
    })

    it('exposes size limits', () => {
      expect(MAX_PASTE_SIZE).toBe(50 * 1024 * 1024)
      expect(LARGE_PASTE_WARNING).toBe(10 * 1024 * 1024)
      expect(MAX_PASTE_SIZE).toBeGreaterThan(LARGE_PASTE_WARNING)
    })
  })

  describe('parseInput input validation', () => {
    it('rejects non-string input', () => {
      const r = parseInput(null)
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/string/i)
    })

    it('rejects empty/whitespace-only input under auto', () => {
      const r = parseInput('   \n\t', 'auto')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/no data/i)
    })

    it('rejects unknown format hint', () => {
      const r = parseInput('90', 'martian')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/unknown format/i)
    })
  })

  describe('hex format', () => {
    it('parses spaced hex', () => {
      const r = parseInput('90 90 31 c0 50 68 2f 2f', 'hex')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('parses unspaced hex', () => {
      const r = parseInput('90903 1c050682f2f', 'hex')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('parses hex with mixed case', () => {
      const r = parseInput('9090 31C0 5068 2F2F', 'hex')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('parses hex with newlines', () => {
      const r = parseInput('9090\n31c0\n5068\n2f2f', 'hex')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('strips embedded 0x prefixes (permissive)', () => {
      const r = parseInput('0x90 0x90 0x31 0xc0', 'hex')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE.slice(0, 4)))
    })

    it('reports stripped non-hex characters in warnings', () => {
      const r = parseInput('90 90 31 c0', 'hex')
      expect(r.warnings.length).toBeGreaterThan(0)
      expect(r.warnings[0]).toMatch(/stripped/i)
    })

    it('rejects odd-length hex', () => {
      const r = parseInput('909', 'hex')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/even/i)
    })

    it('rejects invalid hex characters', () => {
      const r = parseInput('90zz', 'hex')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/invalid hex/i)
    })

    it('rejects empty after stripping', () => {
      const r = parseInput('   ', 'hex')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/empty/i)
    })
  })

  describe('escaped format', () => {
    it('parses C-style \\xNN escapes', () => {
      const r = parseInput('\\x90\\x90\\x31\\xc0\\x50\\x68\\x2f\\x2f', 'escaped')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('parses escapes embedded in C source code', () => {
      const r = parseInput('const char shellcode[] = "\\x90\\x90\\x31\\xc0";', 'escaped')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE.slice(0, 4)))
    })

    it('parses Python b-string', () => {
      const r = parseInput("b'\\x90\\x90\\x31\\xc0'", 'escaped')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE.slice(0, 4)))
    })

    it('parses octal escapes', () => {
      // \110\145\154\154\157 = "Hello"
      const r = parseInput('\\110\\145\\154\\154\\157', 'escaped')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    })

    it('mixes hex and octal escapes', () => {
      // \x48 = H, \145 = e (octal)
      const r = parseInput('\\x48\\145', 'escaped')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual([0x48, 0x65])
    })

    it('rejects octal > 255', () => {
      const r = parseInput('\\777', 'escaped')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/exceeds 255/i)
    })

    it('disambiguates \\x90 as hex (not \\x then octal 90)', () => {
      // 90 is not valid octal anyway (9 not in 0-7), so this confirms the regex order
      const r = parseInput('\\x90', 'escaped')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual([0x90])
    })

    it('rejects input with no escapes', () => {
      const r = parseInput('hello world', 'escaped')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/no .*escape/i)
    })
  })

  describe('hex0x format', () => {
    it('parses comma-separated 0x list', () => {
      const r = parseInput('0x90, 0x90, 0x31, 0xc0, 0x50, 0x68, 0x2f, 0x2f', 'hex0x')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('parses space-separated 0x list', () => {
      const r = parseInput('0x90 0x90 0x31 0xc0 0x50 0x68 0x2f 0x2f', 'hex0x')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('parses single-digit 0x tokens', () => {
      const r = parseInput('0x9 0xa', 'hex0x')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual([0x9, 0xa])
    })

    it('parses C array declaration', () => {
      const r = parseInput('unsigned char buf[] = { 0x90, 0x90, 0x31, 0xc0 };', 'hex0x')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE.slice(0, 4)))
    })

    it('rejects input with no 0x tokens', () => {
      const r = parseInput('90 90 31 c0', 'hex0x')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/no 0x/i)
    })
  })

  describe('base64 format', () => {
    it('parses standard base64', () => {
      // SHELLCODE -> kJAxwFBoLy8=
      const r = parseInput('kJAxwFBoLy8=', 'base64')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('strips whitespace and newlines', () => {
      const r = parseInput('kJAx\nwFBo\nLy8=\n', 'base64')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('rejects invalid base64 characters', () => {
      const r = parseInput('kJAx@wA==', 'base64')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/invalid base64/i)
    })

    it('rejects wrong-length base64', () => {
      const r = parseInput('kJAxw', 'base64')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/multiple of 4/i)
    })

    it('rejects empty input', () => {
      const r = parseInput('   ', 'base64')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/empty/i)
    })
  })

  describe('hexdump format', () => {
    it('parses xxd output', () => {
      const dump = '00000000: 9090 31c0 5068 2f2f                      ..1.Ph//'
      const r = parseInput(dump, 'hexdump')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual(Array.from(SHELLCODE))
    })

    it('parses multi-line hexdump', () => {
      const dump = [
        '00000000: 9090 31c0 5068 2f2f                      ..1.Ph//',
        '00000008: 7368                                     sh'
      ].join('\n')
      const r = parseInput(dump, 'hexdump')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual([
        0x90, 0x90, 0x31, 0xc0, 0x50, 0x68, 0x2f, 0x2f, 0x73, 0x68
      ])
    })

    it('parses hexdump -C output (no colon, two-column)', () => {
      const dump = '00000000  90 90 31 c0 50 68 2f 2f  73 68                    |..1.Ph//sh|'
      const r = parseInput(dump, 'hexdump')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual([
        0x90, 0x90, 0x31, 0xc0, 0x50, 0x68, 0x2f, 0x2f, 0x73, 0x68
      ])
    })

    it('rejects input with no offset prefixes', () => {
      const r = parseInput('just some text\nwithout offsets', 'hexdump')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/no hexdump lines/i)
    })

    it('reports parsed line count in warnings', () => {
      const dump = '00000000: 9090 31c0                                ..1.'
      const r = parseInput(dump, 'hexdump')
      expect(r.warnings.some((w) => /1 hexdump line/.test(w))).toBe(true)
    })

    it('handles full xxd row with letter-only ASCII gutter', () => {
      // Edge case: gutter "abcdef..." contains valid hex chars; structural regex must stop at the 2-space gap
      const dump = '00000000: 6162 6364 6566 6768 6970 6a6b 6c6d 6e6f  abcdefghijklmno'
      const r = parseInput(dump, 'hexdump')
      expect(r.ok).toBe(true)
      expect(r.bytes.length).toBe(16)
      expect(r.bytes[0]).toBe(0x61)
      expect(r.bytes[15]).toBe(0x6f)
    })
  })

  describe('text format', () => {
    it('encodes ASCII as UTF-8', () => {
      const r = parseInput('Hello', 'text')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    })

    it('encodes multi-byte UTF-8', () => {
      // "café" = 63 61 66 c3 a9
      const r = parseInput('café', 'text')
      expect(r.ok).toBe(true)
      expect(Array.from(r.bytes)).toEqual([0x63, 0x61, 0x66, 0xc3, 0xa9])
    })

    it('rejects empty string', () => {
      const r = parseInput('', 'text')
      expect(r.ok).toBe(false)
      expect(r.error).toMatch(/empty/i)
    })
  })

  describe('detectFormat (auto)', () => {
    it('detects escaped over everything else', () => {
      expect(detectFormat('\\x90\\x90')).toBe('escaped')
    })

    it('detects hexdump signature', () => {
      expect(detectFormat('00000000: 9090 31c0  ..1.')).toBe('hexdump')
    })

    it('detects 0x prefixes', () => {
      expect(detectFormat('0x90, 0x90, 0x31')).toBe('hex0x')
    })

    it('detects plain hex', () => {
      expect(detectFormat('90 90 31 c0')).toBe('hex')
    })

    it('detects compact hex', () => {
      expect(detectFormat('909031c0')).toBe('hex')
    })

    it('prefers hex over base64 for ambiguous deadbeef', () => {
      // 'deadbeef' is valid hex AND valid base64
      expect(detectFormat('deadbeef')).toBe('hex')
    })

    it('detects base64 with padding', () => {
      expect(detectFormat('kJAxwFBoLy8=')).toBe('base64')
    })

    it('falls back to text', () => {
      expect(detectFormat('hello world!')).toBe('text')
    })

    it('returns null for empty/whitespace input', () => {
      expect(detectFormat('')).toBeNull()
      expect(detectFormat('   \n\t')).toBeNull()
    })
  })

  describe('parseInput auto mode', () => {
    it('round-trips through auto-detect for hex', () => {
      const r = parseInput('90 90 31 c0', 'auto')
      expect(r.ok).toBe(true)
      expect(r.format).toBe('hex')
      expect(Array.from(r.bytes)).toEqual([0x90, 0x90, 0x31, 0xc0])
    })

    it('round-trips through auto-detect for escaped', () => {
      const r = parseInput('\\x90\\x90\\x31\\xc0', 'auto')
      expect(r.ok).toBe(true)
      expect(r.format).toBe('escaped')
    })

    it('round-trips through auto-detect for base64', () => {
      const r = parseInput('kJAxwFBoLy8=', 'auto')
      expect(r.ok).toBe(true)
      expect(r.format).toBe('base64')
    })

    it('falls back to text for non-binary input', () => {
      const r = parseInput('hello world', 'auto')
      expect(r.ok).toBe(true)
      expect(r.format).toBe('text')
    })
  })

  describe('previewBytes', () => {
    it('formats short arrays without ellipsis', () => {
      expect(previewBytes(new Uint8Array([0x90, 0xab]))).toBe('90 ab')
    })

    it('truncates long arrays with ellipsis', () => {
      const long = new Uint8Array(100).fill(0xab)
      const preview = previewBytes(long, 4)
      expect(preview).toBe('ab ab ab ab ...')
    })

    it('returns empty string for empty input', () => {
      expect(previewBytes(new Uint8Array())).toBe('')
      expect(previewBytes(null)).toBe('')
    })
  })
})
