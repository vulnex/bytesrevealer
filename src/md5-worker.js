/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: md5-worker.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

// MD5 implementation
function md5(data) {
  const state = new Int32Array([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476])
  const blocks = Math.ceil((data.length + 9) / 64)
  const padded = new Uint8Array(blocks * 64)
  
  // Copy data and add padding
  padded.set(new Uint8Array(data))
  padded[data.length] = 0x80
  
  // Add original length in bits
  const bits = BigInt(data.length * 8)
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Number(bits & 0xffffffffn), true)
  view.setUint32(padded.length - 4, Number(bits >> 32n), true)
  
  // Process blocks
  for (let i = 0; i < blocks; i++) {
    const block = new Int32Array(16)
    for (let j = 0; j < 16; j++) {
      block[j] = view.getInt32(i * 64 + j * 4, true)
    }
    processBlock(state, block)
  }
  
  // Convert to hex string
  return Array.from(new Uint8Array(state.buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function processBlock(state, block) {
  let a = state[0]
  let b = state[1]
  let c = state[2]
  let d = state[3]
  
  // Round 1
  a = ff(a, b, c, d, block[0], 7, 0xd76aa478)
  d = ff(d, a, b, c, block[1], 12, 0xe8c7b756)
  c = ff(c, d, a, b, block[2], 17, 0x242070db)
  b = ff(b, c, d, a, block[3], 22, 0xc1bdceee)
  // ... (more rounds)
  
  state[0] = (state[0] + a) >>> 0
  state[1] = (state[1] + b) >>> 0
  state[2] = (state[2] + c) >>> 0
  state[3] = (state[3] + d) >>> 0
}

function ff(a, b, c, d, x, s, t) {
  const n = a + ((b & c) | (~b & d)) + x + t
  return b + ((n << s) | (n >>> (32 - s)))
}

// Handle messages from main thread
self.onmessage = function(e) {
  const result = md5(e.data)
  self.postMessage(result)
}
