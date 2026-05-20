/**
 * VULNEX -Bytes Revealer-
 *
 * File: binaryReaders.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-17
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Endian-aware unsigned integer readers over Uint8Array buffers. Returns are
 * unsigned (>>> 0 for u32). Callers must ensure offset + width <= bytes.length;
 * out-of-range reads return NaN-friendly garbage (no bounds check).
 */

export function readU16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

export function readU16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

export function readU32LE(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  )
}

export function readU32BE(bytes, offset) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

// Returned as JS Number. Precision is exact up to Number.MAX_SAFE_INTEGER (2^53-1),
// which covers any realistic file offset or user-mode virtual address. Values above
// that lose precision; callers that may see them (e.g. kernel-half VAs) should treat
// the result as approximate.
export function readU64LE(bytes, offset) {
  const low = readU32LE(bytes, offset)
  const high = readU32LE(bytes, offset + 4)
  return high * 0x100000000 + low
}

export function readU64BE(bytes, offset) {
  const high = readU32BE(bytes, offset)
  const low = readU32BE(bytes, offset + 4)
  return high * 0x100000000 + low
}
