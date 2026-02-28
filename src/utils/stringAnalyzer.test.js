import { describe, it, expect } from 'vitest'
import { StringAnalyzer } from './stringAnalyzer.js'

describe('StringAnalyzer', () => {
  describe('escapeString()', () => {
    it('escapes HTML entities', () => {
      expect(StringAnalyzer.escapeString('<script>')).toContain('&lt;script&gt;')
    })

    it('escapes ampersand', () => {
      expect(StringAnalyzer.escapeString('a&b')).toBe('a&amp;b')
    })

    it('escapes double quotes', () => {
      expect(StringAnalyzer.escapeString('"hi"')).toContain('&quot;')
    })

    it('escapes single quotes', () => {
      expect(StringAnalyzer.escapeString("it's")).toContain('&#039;')
    })

    it('escapes backslashes', () => {
      expect(StringAnalyzer.escapeString('a\\b')).toContain('\\\\')
    })

    it('replaces control characters with hex', () => {
      const result = StringAnalyzer.escapeString('\x01\x1F')
      expect(result).toContain('\\x01')
      expect(result).toContain('\\x1f')
    })

    it('leaves normal ASCII text unchanged', () => {
      expect(StringAnalyzer.escapeString('Hello World 123')).toBe('Hello World 123')
    })
  })

  describe('extractStrings()', () => {
    const opts = { minLength: 4, maxLength: 1000, batchSize: 1000 }

    it('extracts ASCII strings from byte data', async () => {
      // "Hello World" embedded in zeroes
      const hello = [0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64]
      const bytes = new Uint8Array([0x00, 0x00, ...hello, 0x00, 0x00])

      const strings = await StringAnalyzer.extractStrings(bytes, opts)
      expect(strings.some((s) => s.value === 'Hello World')).toBe(true)
    })

    it('respects minLength', async () => {
      // "AB" (2 chars) should be skipped with minLength=4
      const bytes = new Uint8Array([0x00, 0x41, 0x42, 0x00])
      const strings = await StringAnalyzer.extractStrings(bytes, { ...opts, minLength: 4 })
      expect(strings.filter((s) => s.type === 'ASCII')).toEqual([])
    })

    it('respects maxLength', async () => {
      // Create a long string: 20 'A' characters
      const buf = new Uint8Array(22)
      buf.fill(0x41, 1, 21) // 20 A's
      const strings = await StringAnalyzer.extractStrings(buf, { ...opts, maxLength: 10 })
      const ascii = strings.filter((s) => s.type === 'ASCII')
      // Each extracted string should be at most 10 characters
      for (const s of ascii) {
        expect(s.length).toBeLessThanOrEqual(10)
      }
    })

    it('records offset for each string', async () => {
      const bytes = new Uint8Array([0x00, 0x00, 0x54, 0x65, 0x73, 0x74, 0x00]) // "Test" at offset 2
      const strings = await StringAnalyzer.extractStrings(bytes, opts)
      const found = strings.find((s) => s.value === 'Test')
      expect(found).toBeDefined()
      expect(found.offset).toBe(2)
    })

    it('returns sorted by offset', async () => {
      const bytes = new Uint8Array(30)
      // Place "AAAA" at offset 20 and "BBBB" at offset 5
      bytes.set([0x42, 0x42, 0x42, 0x42], 5)
      bytes.set([0x41, 0x41, 0x41, 0x41], 20)
      const strings = await StringAnalyzer.extractStrings(bytes, opts)
      for (let i = 1; i < strings.length; i++) {
        expect(strings[i].offset).toBeGreaterThanOrEqual(strings[i - 1].offset)
      }
    })

    it('returns empty for empty input', async () => {
      const strings = await StringAnalyzer.extractStrings(new Uint8Array(0), opts)
      expect(strings).toEqual([])
    })

    it('identifies type as ASCII for printable strings', async () => {
      const bytes = new Uint8Array([0x00, 0x54, 0x65, 0x73, 0x74, 0x00])
      const strings = await StringAnalyzer.extractStrings(bytes, opts)
      const found = strings.find((s) => s.value === 'Test')
      expect(found?.type).toBe('ASCII')
    })
  })
})
