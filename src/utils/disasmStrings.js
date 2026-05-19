/**
 * VULNEX -Bytes Revealer-
 *
 * File: disasmStrings.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Probe a file-relative offset for a printable ASCII string. Used to
 * decorate disassembly immediates that look like pointers into .rdata
 * with the string they reference.
 */

// ASCII range: tab (0x09) is allowed inside strings, line breaks are not
// (we want a single-line preview). 0x20–0x7E is printable, plus 0x09.
function isPrintable(byte) {
  return byte === 0x09 || (byte >= 0x20 && byte <= 0x7e)
}

/**
 * Read up to `maxLen` printable ASCII bytes starting at `offset`. Returns
 * the string if it's at least `minLen` chars long and is terminated by NUL
 * (within maxLen) or by a non-printable byte. Returns null otherwise.
 *
 * The terminator requirement (NUL or non-printable) rejects runs of
 * printable bytes embedded in the middle of code — only strings that look
 * intentional surface in the UI.
 */
export function readAsciiAt(fileBytes, offset, options = {}) {
  const { minLen = 4, maxLen = 64 } = options
  if (!fileBytes || !Number.isFinite(offset)) return null
  if (offset < 0 || offset >= fileBytes.length) return null

  // First byte must be printable — short-circuit before allocating.
  if (!isPrintable(fileBytes[offset])) return null

  let end = offset
  const stopAt = Math.min(offset + maxLen, fileBytes.length)
  let terminated = false

  while (end < stopAt) {
    const b = fileBytes[end]
    if (b === 0) {
      terminated = true
      break
    }
    if (!isPrintable(b)) {
      terminated = true
      break
    }
    end++
  }
  // Hit end of file or maxLen without a non-printable byte. We still treat
  // EOF as termination; running off the maxLen without a terminator is
  // suspicious — likely random bytes that happen to be printable — so we
  // bail.
  if (!terminated && end === stopAt && end < fileBytes.length) return null

  const length = end - offset
  if (length < minLen) return null

  const chars = new Array(length)
  for (let i = 0; i < length; i++) {
    chars[i] = String.fromCharCode(fileBytes[offset + i])
  }
  return chars.join('')
}

/**
 * Same contract as readAsciiAt but also truncates with an ellipsis if the
 * full string was at the maxLen ceiling. The returned string is safe to
 * render directly.
 */
export function readAsciiPreview(fileBytes, offset, options = {}) {
  const { previewLen = 40 } = options
  const full = readAsciiAt(fileBytes, offset, options)
  if (full == null) return null
  if (full.length <= previewLen) return full
  return full.slice(0, previewLen) + '…'
}
