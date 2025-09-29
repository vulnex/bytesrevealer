/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KaitaiStreamBrowser.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

// Browser-compatible KaitaiStream implementation
// This is a simplified version that doesn't require Node.js modules

export default class KaitaiStream {
  constructor(arrayBuffer, byteOffset = 0) {
    this._byteOffset = byteOffset || 0
    if (arrayBuffer instanceof ArrayBuffer) {
      this.buffer = arrayBuffer
    } else if (typeof arrayBuffer === 'object') {
      this.dataView = arrayBuffer
      if (byteOffset) {
        this._byteOffset += byteOffset
      }
    } else {
      this.buffer = new ArrayBuffer(arrayBuffer)
    }
    this.pos = 0
    this.alignToByte()
  }

  /**
   * Set/get the backing ArrayBuffer of the stream object.
   */
  get buffer() {
    this._trimAlloc()
    return this._buffer
  }

  set buffer(v) {
    this._buffer = v
    this._dataView = new DataView(this._buffer, this._byteOffset)
    this._byteLength = this._buffer.byteLength
  }

  /**
   * Set/get the byteOffset of the stream object.
   */
  get byteOffset() {
    return this._byteOffset
  }

  set byteOffset(v) {
    this._byteOffset = v
    this._dataView = new DataView(this._buffer, this._byteOffset)
    this._byteLength = this._buffer.byteLength
  }

  /**
   * Set/get the backing DataView of the stream object.
   */
  get dataView() {
    return this._dataView
  }

  set dataView(v) {
    this._byteOffset = v.byteOffset
    this._buffer = v.buffer
    this._dataView = v
    this._byteLength = this._byteOffset + v.byteLength
  }

  /**
   * Internal function to trim the KaitaiStream buffer when required.
   * Used for stripping out the extra bytes from the backing buffer when
   * the virtual byteLength is smaller than the buffer byteLength (happens after
   * growing the buffer with writes and not filling the extra space completely).
   */
  _trimAlloc() {
    if (this._byteLength === this._buffer.byteLength) {
      return
    }
    const buf = new ArrayBuffer(this._byteLength)
    const dst = new Uint8Array(buf)
    const src = new Uint8Array(this._buffer, 0, dst.length)
    dst.set(src)
    this.buffer = buf
  }

  // ========================================================================
  // Stream positioning
  // ========================================================================

  /**
   * Returns true if the stream position is at the end of the buffer.
   */
  get isEof() {
    return this.pos >= this.size && this.bitsLeft === 0
  }

  /**
   * Move the stream position to the given absolute position.
   */
  seek(pos) {
    const oldPos = this.pos
    this.pos = pos
    return oldPos
  }

  /**
   * Get the current position in the stream.
   */
  get size() {
    return this._byteLength - this._byteOffset
  }

  // ========================================================================
  // Integer numbers
  // ========================================================================

  // ------------------------------------------------------------------------
  // Signed integers
  // ------------------------------------------------------------------------

  readS1() {
    this.alignToByte()
    const v = this._dataView.getInt8(this.pos)
    this.pos += 1
    return v
  }

  readS2be() {
    this.alignToByte()
    const v = this._dataView.getInt16(this.pos)
    this.pos += 2
    return v
  }

  readS4be() {
    this.alignToByte()
    const v = this._dataView.getInt32(this.pos)
    this.pos += 4
    return v
  }

  readS8be() {
    this.alignToByte()
    const v = this._dataView.getBigInt64(this.pos)
    this.pos += 8
    return v
  }

  readS2le() {
    this.alignToByte()
    const v = this._dataView.getInt16(this.pos, true)
    this.pos += 2
    return v
  }

  readS4le() {
    this.alignToByte()
    const v = this._dataView.getInt32(this.pos, true)
    this.pos += 4
    return v
  }

  readS8le() {
    this.alignToByte()
    const v = this._dataView.getBigInt64(this.pos, true)
    this.pos += 8
    return v
  }

  // ------------------------------------------------------------------------
  // Unsigned integers
  // ------------------------------------------------------------------------

  readU1() {
    this.alignToByte()
    const v = this._dataView.getUint8(this.pos)
    this.pos += 1
    return v
  }

  readU2be() {
    this.alignToByte()
    const v = this._dataView.getUint16(this.pos)
    this.pos += 2
    return v
  }

  readU4be() {
    this.alignToByte()
    const v = this._dataView.getUint32(this.pos)
    this.pos += 4
    return v
  }

  readU8be() {
    this.alignToByte()
    const v = this._dataView.getBigUint64(this.pos)
    this.pos += 8
    return v
  }

  readU2le() {
    this.alignToByte()
    const v = this._dataView.getUint16(this.pos, true)
    this.pos += 2
    return v
  }

  readU4le() {
    this.alignToByte()
    const v = this._dataView.getUint32(this.pos, true)
    this.pos += 4
    return v
  }

  readU8le() {
    this.alignToByte()
    const v = this._dataView.getBigUint64(this.pos, true)
    this.pos += 8
    return v
  }

  // ========================================================================
  // Floating point numbers
  // ========================================================================

  readF4be() {
    this.alignToByte()
    const v = this._dataView.getFloat32(this.pos)
    this.pos += 4
    return v
  }

  readF8be() {
    this.alignToByte()
    const v = this._dataView.getFloat64(this.pos)
    this.pos += 8
    return v
  }

  readF4le() {
    this.alignToByte()
    const v = this._dataView.getFloat32(this.pos, true)
    this.pos += 4
    return v
  }

  readF8le() {
    this.alignToByte()
    const v = this._dataView.getFloat64(this.pos, true)
    this.pos += 8
    return v
  }

  // ========================================================================
  // Byte arrays
  // ========================================================================

  readBytes(len) {
    this.alignToByte()
    const bytes = new Uint8Array(this._buffer, this._byteOffset + this.pos, len)
    this.pos += len
    return bytes
  }

  readBytesFull() {
    this.alignToByte()
    const bytes = new Uint8Array(this._buffer, this._byteOffset + this.pos, this.size - this.pos)
    this.pos = this.size
    return bytes
  }

  // ========================================================================
  // Strings
  // ========================================================================

  readStrz(encoding, terminator, includeTerminator, consumeTerminator) {
    this.alignToByte()
    const blen = this.size - this.pos
    const u8 = new Uint8Array(this._buffer, this._byteOffset + this.pos)
    let i
    for (i = 0; i < blen && u8[i] !== terminator; i++); // find first zero byte
    if (consumeTerminator && i < blen) {
      i++
    }
    const bytes = new Uint8Array(this._buffer, this._byteOffset + this.pos, i)
    this.pos += i
    if (includeTerminator && i < blen) {
      return bytes
    } else {
      return bytes.slice(0, bytes.length - 1)
    }
  }

  readStrEos(encoding) {
    return this.readStr(encoding, this.size - this.pos)
  }

  readStr(encoding, len) {
    this.alignToByte()
    const bytes = this.readBytes(len)
    if (encoding === 'ASCII') {
      let str = ''
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i])
      }
      return str
    } else {
      // For UTF-8 or other encodings
      return new TextDecoder(encoding || 'utf-8').decode(bytes)
    }
  }

  // ========================================================================
  // Byte array processing
  // ========================================================================

  /**
   * Performs XOR processing with given data, XORing every byte of the input
   * with a single given value.
   * @param {Uint8Array} data Data to process
   * @param {number} key Value to XOR with
   * @returns {Uint8Array} Processed data
   */
  static processXorOne(data, key) {
    const r = new Uint8Array(data.length)
    for (let i = 0; i < data.length; i++) {
      r[i] = data[i] ^ key
    }
    return r
  }

  /**
   * Performs XOR processing with given data, XORing every byte of the input
   * with a key array elements cycling through it.
   * @param {Uint8Array} data Data to process
   * @param {Uint8Array} key Array of bytes to XOR with
   * @returns {Uint8Array} Processed data
   */
  static processXorMany(data, key) {
    const r = new Uint8Array(data.length)
    const kl = key.length
    let ki = 0
    for (let i = 0; i < data.length; i++) {
      r[i] = data[i] ^ key[ki]
      ki++
      if (ki >= kl) ki = 0
    }
    return r
  }

  /**
   * Performs rotation processing with given data, rotating every byte of the input
   * by a given amount of bits.
   * @param {Uint8Array} data Data to process
   * @param {number} amount Rotation amount in bits
   * @param {number} groupSize Number of bytes to rotate as one group
   * @returns {Uint8Array} Processed data
   */
  static processRotateLeft(data, amount, groupSize) {
    const r = new Uint8Array(data.length)
    switch (groupSize) {
      case 1:
        for (let i = 0; i < data.length; i++) {
          const bits = data[i]
          r[i] = (bits << amount) | (bits >> (8 - amount))
        }
        break
      default:
        throw new Error(`Unable to rotate left for ${groupSize} bytes yet`)
    }
    return r
  }

  // ========================================================================
  // Misc runtime operations
  // ========================================================================

  /**
   * Returns an array of byte sizes of fixed-size type components.
   * @param {string} typeName Name of the type as per KSY lang spec
   * @returns {?number} Size of the type, or null if type is user-defined
   */
  static sizeOfType(typeName) {
    switch (typeName) {
      case 'u1':
      case 's1':
        return 1

      case 'u2':
      case 'u2le':
      case 'u2be':
      case 's2':
      case 's2le':
      case 's2be':
        return 2

      case 'u4':
      case 'u4le':
      case 'u4be':
      case 's4':
      case 's4le':
      case 's4be':
      case 'f4':
      case 'f4le':
      case 'f4be':
        return 4

      case 'u8':
      case 'u8le':
      case 'u8be':
      case 's8':
      case 's8le':
      case 's8be':
      case 'f8':
      case 'f8le':
      case 'f8be':
        return 8

      default:
        return null
    }
  }

  // ========================================================================
  // Bit stream operations
  // ========================================================================

  alignToByte() {
    this.bits = 0
    this.bitsLeft = 0
  }

  readBitsIntBe(n) {
    let res = 0
    let bitsNeeded = n
    this.bits = 0
    this.bitsLeft = 0

    if (n % 8 !== 0) {
      const bitsToAlign = 8 - (n % 8)
      res = this.readBitsInt(bitsToAlign)
      bitsNeeded -= bitsToAlign
    }

    while (bitsNeeded > 0) {
      res = (res << 8) | this._dataView.getUint8(this.pos)
      this.pos++
      bitsNeeded -= 8
    }

    return res
  }

  readBitsInt(n) {
    let res = 0
    let bitsNeeded = n

    while (bitsNeeded > 0) {
      if (this.bitsLeft === 0) {
        this.bits = this._dataView.getUint8(this.pos)
        this.pos++
        this.bitsLeft = 8
      }

      const bitsConsumed = Math.min(bitsNeeded, this.bitsLeft)
      const mask = (1 << bitsConsumed) - 1
      res = (res << bitsConsumed) | ((this.bits >> (this.bitsLeft - bitsConsumed)) & mask)
      this.bitsLeft -= bitsConsumed
      bitsNeeded -= bitsConsumed
    }

    return res
  }
}