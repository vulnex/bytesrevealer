import { describe, it, expect } from 'vitest'
import {
  readU16LE,
  readU16BE,
  readU32LE,
  readU32BE,
  readU64LE,
  readU64BE
} from './binaryReaders.js'

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

  it('readU64LE combines low and high halves little-endian', () => {
    // bytes: 78 56 34 12 21 43 65 87 → low=0x12345678, high=0x87654321
    const buf = new Uint8Array([0x78, 0x56, 0x34, 0x12, 0x21, 0x43, 0x65, 0x87])
    expect(readU64LE(buf, 0)).toBe(0x87654321 * 0x100000000 + 0x12345678)
  })

  it('readU64BE combines high and low halves big-endian', () => {
    const buf = new Uint8Array([0x87, 0x65, 0x43, 0x21, 0x12, 0x34, 0x56, 0x78])
    expect(readU64BE(buf, 0)).toBe(0x87654321 * 0x100000000 + 0x12345678)
  })

  it('readU64LE returns realistic user-mode virtual addresses exactly', () => {
    // 0x0000_7fff_0040_1050 — a typical x86_64 entry point
    const buf = new Uint8Array([0x50, 0x10, 0x40, 0x00, 0xff, 0x7f, 0x00, 0x00])
    expect(readU64LE(buf, 0)).toBe(0x00007fff00401050)
  })

  it('readU64LE handles values below 2^32 with high=0', () => {
    const buf = new Uint8Array([0x50, 0x3f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    expect(readU64LE(buf, 0)).toBe(0x3f50)
  })
})
