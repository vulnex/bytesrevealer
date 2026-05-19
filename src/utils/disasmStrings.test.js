import { describe, it, expect } from 'vitest'
import { readAsciiAt, readAsciiPreview } from './disasmStrings.js'

function bytesFromString(s, { trailingNul = true } = {}) {
  const arr = new Uint8Array(s.length + (trailingNul ? 1 : 0))
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i)
  return arr
}

describe('readAsciiAt', () => {
  it('reads a NUL-terminated ASCII string', () => {
    const bytes = bytesFromString('Hello, world')
    expect(readAsciiAt(bytes, 0)).toBe('Hello, world')
  })

  it('reads at a non-zero offset', () => {
    const bytes = new Uint8Array([0xff, 0xff, ...bytesFromString('PE\0').slice(0, 3)])
    // First two bytes are non-printable; offset into the embedded "PE"
    expect(readAsciiAt(bytes, 2, { minLen: 2 })).toBe('PE')
  })

  it('rejects offsets out of file bounds', () => {
    const bytes = bytesFromString('abc')
    expect(readAsciiAt(bytes, -1)).toBeNull()
    expect(readAsciiAt(bytes, 999)).toBeNull()
  })

  it('rejects null / undefined fileBytes', () => {
    expect(readAsciiAt(null, 0)).toBeNull()
    expect(readAsciiAt(undefined, 0)).toBeNull()
  })

  it('returns null when the first byte is not printable', () => {
    const bytes = new Uint8Array([0x00, 0x41, 0x42, 0x43, 0x44, 0x00])
    expect(readAsciiAt(bytes, 0)).toBeNull()
  })

  it('returns null when length is below minLen', () => {
    const bytes = bytesFromString('ab')
    expect(readAsciiAt(bytes, 0, { minLen: 4 })).toBeNull()
  })

  it('terminates on non-printable byte', () => {
    const bytes = new Uint8Array([0x41, 0x42, 0x43, 0x44, 0x07, 0x45])
    // ABCD then BEL — should stop at BEL.
    expect(readAsciiAt(bytes, 0)).toBe('ABCD')
  })

  it('returns null when maxLen is reached without a terminator (looks like noise)', () => {
    // Long run of printable bytes that doesn't terminate within maxLen=8
    // → reject.
    const noisy = bytesFromString('aaaaaaaaaaaaaaaa', { trailingNul: false })
    expect(readAsciiAt(noisy, 0, { maxLen: 8 })).toBeNull()
  })

  it('accepts EOF as a terminator', () => {
    // No trailing NUL, but the string runs right up to end of file.
    const bytes = bytesFromString('hello', { trailingNul: false })
    expect(readAsciiAt(bytes, 0)).toBe('hello')
  })

  it('allows tab inside the string', () => {
    const bytes = new Uint8Array([0x41, 0x09, 0x42, 0x43, 0x00])
    expect(readAsciiAt(bytes, 0)).toBe('A\tBC')
  })
})

describe('readAsciiPreview', () => {
  it('returns the full string when under previewLen', () => {
    const bytes = bytesFromString('short')
    expect(readAsciiPreview(bytes, 0, { previewLen: 40 })).toBe('short')
  })

  it('truncates with ellipsis at previewLen', () => {
    const long = 'a'.repeat(50)
    const bytes = bytesFromString(long)
    const result = readAsciiPreview(bytes, 0, { previewLen: 10 })
    expect(result).toBe('aaaaaaaaaa…')
  })

  it('returns null when underlying read returns null', () => {
    const bytes = new Uint8Array([0x00, 0x00])
    expect(readAsciiPreview(bytes, 0)).toBeNull()
  })
})
