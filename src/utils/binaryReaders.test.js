import { describe, it, expect } from 'vitest'
import { readU16LE, readU16BE, readU32LE, readU32BE } from './binaryReaders.js'

describe('binaryReaders', () => {
  it('readU16LE assembles little-endian bytes', () => {
    expect(readU16LE(new Uint8Array([0x34, 0x12]), 0)).toBe(0x1234)
    expect(readU16LE(new Uint8Array([0xff, 0xff]), 0)).toBe(0xffff)
    expect(readU16LE(new Uint8Array([0x00, 0x00]), 0)).toBe(0)
  })

  it('readU16BE assembles big-endian bytes', () => {
    expect(readU16BE(new Uint8Array([0x12, 0x34]), 0)).toBe(0x1234)
    expect(readU16BE(new Uint8Array([0xff, 0xff]), 0)).toBe(0xffff)
  })

  it('readU32LE returns unsigned 32-bit value', () => {
    expect(readU32LE(new Uint8Array([0x78, 0x56, 0x34, 0x12]), 0)).toBe(0x12345678)
    // High bit set — must come back unsigned, not negative
    expect(readU32LE(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 0)).toBe(0xffffffff)
    expect(readU32LE(new Uint8Array([0x00, 0x00, 0x00, 0x80]), 0)).toBe(0x80000000)
  })

  it('readU32BE returns unsigned 32-bit value', () => {
    expect(readU32BE(new Uint8Array([0x12, 0x34, 0x56, 0x78]), 0)).toBe(0x12345678)
    expect(readU32BE(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 0)).toBe(0xffffffff)
    expect(readU32BE(new Uint8Array([0x80, 0x00, 0x00, 0x00]), 0)).toBe(0x80000000)
  })

  it('honours offset', () => {
    const buf = new Uint8Array([0xaa, 0x34, 0x12, 0xbb])
    expect(readU16LE(buf, 1)).toBe(0x1234)
    expect(readU16BE(buf, 1)).toBe(0x3412)
  })
})
