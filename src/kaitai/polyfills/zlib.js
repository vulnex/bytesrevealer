/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: zlib.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

/**
 * Browser polyfill for zlib
 * Provides stub implementation for browser compatibility
 */

// Stub implementation - actual decompression not needed for basic KSY parsing
export function inflateSync(buffer) {
  // console.warn('zlib.inflateSync called in browser - returning original buffer')
  return buffer
}

export function deflateSync(buffer) {
  // console.warn('zlib.deflateSync called in browser - returning original buffer')
  return buffer
}

export function gunzipSync(buffer) {
  // console.warn('zlib.gunzipSync called in browser - returning original buffer')
  return buffer
}

export function gzipSync(buffer) {
  // console.warn('zlib.gzipSync called in browser - returning original buffer')
  return buffer
}

export default {
  inflateSync,
  deflateSync,
  gunzipSync,
  gzipSync
}