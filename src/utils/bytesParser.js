/**
 * VULNEX -Bytes Revealer-
 *
 * File: bytesParser.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-08
 * Last Modified: 2026-05-08
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Parses pasted byte data in multiple formats (hex, escaped, hex0x, base64,
 * hexdump, text) into a Uint8Array. Designed for the Paste Data dialog so
 * analysts can analyze shellcode, payloads, etc. without writing them to disk.
 */

export const MAX_PASTE_SIZE = 50 * 1024 * 1024 // 50MB hard limit
export const LARGE_PASTE_WARNING = 10 * 1024 * 1024 // 10MB warning threshold

export const FORMATS = [
  { id: 'auto', name: 'Auto-detect', label: 'Auto-detect' },
  { id: 'hex', name: 'Hex', label: 'Hex (90 90 31 c0)' },
  { id: 'escaped', name: 'Escaped', label: 'Escaped (\\x90\\x90)' },
  { id: 'hex0x', name: 'Hex 0x', label: 'Hex 0x (0x90, 0x90)' },
  { id: 'base64', name: 'Base64', label: 'Base64' },
  { id: 'hexdump', name: 'Hexdump', label: 'Hexdump (xxd / hexdump -C)' },
  { id: 'text', name: 'Plain text', label: 'Plain text (UTF-8)' }
]

/**
 * Parse pasted text into bytes.
 * @param {string} text - The pasted input.
 * @param {string} formatHint - One of: 'auto', 'hex', 'escaped', 'hex0x', 'base64', 'hexdump', 'text'.
 * @returns {{ok: true, bytes: Uint8Array, format: string, warnings: string[]} | {ok: false, error: string, format: string}}
 */
export function parseInput(text, formatHint = 'auto') {
  if (typeof text !== 'string') {
    return { ok: false, error: 'Input must be a string', format: formatHint }
  }

  let format = formatHint
  if (format === 'auto') {
    const detected = detectFormat(text)
    if (detected === null) {
      return { ok: false, error: 'No data to parse', format: 'auto' }
    }
    format = detected
  }

  switch (format) {
    case 'hex':
      return parseHex(text)
    case 'escaped':
      return parseEscaped(text)
    case 'hex0x':
      return parseHex0x(text)
    case 'base64':
      return parseBase64(text)
    case 'hexdump':
      return parseHexdump(text)
    case 'text':
      return parseText(text)
    default:
      return { ok: false, error: `Unknown format: ${format}`, format }
  }
}

/**
 * Detect the most likely format of pasted text. Returns null for empty input.
 */
export function detectFormat(text) {
  if (!text || !text.trim()) return null

  // 1. Escape sequences (\xNN or octal \NNN)
  if (/\\x[0-9a-fA-F]{2}/.test(text)) return 'escaped'
  if (/\\[0-7]{1,3}(?![0-9a-fA-F])/.test(text) && /\\[0-7]{2,3}/.test(text)) return 'escaped'

  // 2. Hexdump signature: offset + optional colon + hex pair on same line
  if (/^[0-9a-fA-F]{4,16}:?\s+[0-9a-fA-F]{2}/m.test(text)) return 'hexdump'

  // 3. 0x-prefixed bytes
  if (/0x[0-9a-fA-F]{1,2}/.test(text)) return 'hex0x'

  // 4. Pure hex (after stripping whitespace and commas)
  const hexCleaned = text.replace(/[\s,]/g, '')
  if (hexCleaned.length > 0 && hexCleaned.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hexCleaned)) {
    return 'hex'
  }

  // 5. Base64
  const b64Stripped = text.replace(/\s+/g, '')
  if (
    b64Stripped.length > 0 &&
    b64Stripped.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(b64Stripped)
  ) {
    return 'base64'
  }

  // 6. Fallback: treat as plain text
  return 'text'
}

function parseHex(text) {
  const cleaned = text.replace(/[\s,]/g, '').replace(/0[xX]/g, '')
  if (cleaned.length === 0) {
    return { ok: false, error: 'Empty input', format: 'hex' }
  }
  const invalid = cleaned.match(/[^0-9a-fA-F]/)
  if (invalid) {
    return { ok: false, error: `Invalid hex character: '${invalid[0]}'`, format: 'hex' }
  }
  if (cleaned.length % 2 !== 0) {
    return {
      ok: false,
      error: `Hex length must be even (got ${cleaned.length} digits)`,
      format: 'hex'
    }
  }

  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substr(i, 2), 16)
  }

  const warnings = []
  const stripped = text.length - cleaned.length
  if (stripped > 0) {
    warnings.push(`Stripped ${stripped} non-hex characters (whitespace, commas, 0x prefixes)`)
  }
  return { ok: true, bytes, format: 'hex', warnings }
}

function parseEscaped(text) {
  const bytes = []
  // Try hex \xNN first, then octal \NNN. Alternation order ensures \x90 is hex, not \x + octal.
  const re = /\\x([0-9a-fA-F]{2})|\\([0-7]{1,3})/g
  let match
  while ((match = re.exec(text)) !== null) {
    if (match[1] !== undefined) {
      bytes.push(parseInt(match[1], 16))
    } else {
      const value = parseInt(match[2], 8)
      if (value > 255) {
        return {
          ok: false,
          error: `Octal escape \\${match[2]} exceeds 255 (max byte value)`,
          format: 'escaped'
        }
      }
      bytes.push(value)
    }
  }
  if (bytes.length === 0) {
    return {
      ok: false,
      error: 'No \\xNN or \\NNN escape sequences found',
      format: 'escaped'
    }
  }
  return { ok: true, bytes: new Uint8Array(bytes), format: 'escaped', warnings: [] }
}

function parseHex0x(text) {
  const bytes = []
  const re = /0x([0-9a-fA-F]{1,2})/gi
  let match
  while ((match = re.exec(text)) !== null) {
    bytes.push(parseInt(match[1], 16))
  }
  if (bytes.length === 0) {
    return { ok: false, error: 'No 0xNN tokens found', format: 'hex0x' }
  }
  return { ok: true, bytes: new Uint8Array(bytes), format: 'hex0x', warnings: [] }
}

function parseBase64(text) {
  const stripped = text.replace(/\s+/g, '')
  if (stripped.length === 0) {
    return { ok: false, error: 'Empty input', format: 'base64' }
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(stripped)) {
    const invalid = stripped.match(/[^A-Za-z0-9+/=]/)
    return {
      ok: false,
      error: `Invalid base64 character: '${invalid ? invalid[0] : '?'}'`,
      format: 'base64'
    }
  }
  if (stripped.length % 4 !== 0) {
    return {
      ok: false,
      error: `Base64 length must be a multiple of 4 (got ${stripped.length})`,
      format: 'base64'
    }
  }

  let binary
  try {
    binary = atob(stripped)
  } catch (err) {
    return { ok: false, error: `Base64 decode failed: ${err.message}`, format: 'base64' }
  }

  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  const warnings = []
  const whitespaceStripped = text.length - stripped.length
  if (whitespaceStripped > 0) {
    warnings.push(`Stripped ${whitespaceStripped} whitespace characters`)
  }
  return { ok: true, bytes, format: 'base64', warnings }
}

function parseHexdump(text) {
  const lines = text.split(/\r?\n/)
  const bytes = []
  let parsedLines = 0
  let skippedLines = 0

  // Structural regexes for the two canonical output styles:
  //   xxd:        "9090 31c0 5068 2f2f"       (groups of 4 hex chars, single space)
  //   hexdump -C: "90 90 31 c0  50 68 2f 2f"  (pairs of hex chars, 1-2 spaces between)
  // Pick whichever matches more characters from the start of the hex region.
  const XXD_HEX = /^[0-9a-fA-F]{4}(?: [0-9a-fA-F]{4})*/
  const DUMP_HEX = /^[0-9a-fA-F]{2}(?: {1,2}[0-9a-fA-F]{2})*/

  for (const line of lines) {
    if (!line.trim()) continue
    // Drop leading offset (e.g. "00000000:" or "00000000  " or "0x00000000:")
    const offsetMatch = line.match(/^\s*(?:0x)?[0-9a-fA-F]{4,16}:?\s+/)
    if (!offsetMatch) {
      skippedLines++
      continue
    }
    let working = line.slice(offsetMatch[0].length)
    // Strip hexdump -C ASCII gutter wrapped in pipes
    const pipeIdx = working.indexOf('|')
    if (pipeIdx !== -1) {
      working = working.slice(0, pipeIdx)
    }

    const xxdMatch = working.match(XXD_HEX)
    const dumpMatch = working.match(DUMP_HEX)
    const hex =
      xxdMatch && (!dumpMatch || xxdMatch[0].length >= dumpMatch[0].length)
        ? xxdMatch[0]
        : dumpMatch
          ? dumpMatch[0]
          : null

    if (!hex) {
      skippedLines++
      continue
    }
    const hexTokens = hex.replace(/\s+/g, '')
    if (hexTokens.length === 0 || hexTokens.length % 2 !== 0) {
      skippedLines++
      continue
    }
    for (let i = 0; i < hexTokens.length; i += 2) {
      bytes.push(parseInt(hexTokens.substr(i, 2), 16))
    }
    parsedLines++
  }

  if (bytes.length === 0) {
    return {
      ok: false,
      error: 'No hexdump lines parsed (expected format like "00000000: 9090 31c0  ..1.")',
      format: 'hexdump'
    }
  }
  const warnings = [`Parsed ${parsedLines} hexdump line${parsedLines === 1 ? '' : 's'}`]
  if (skippedLines > 0) {
    warnings.push(`Skipped ${skippedLines} unparseable line${skippedLines === 1 ? '' : 's'}`)
  }
  return { ok: true, bytes: new Uint8Array(bytes), format: 'hexdump', warnings }
}

function parseText(text) {
  if (text.length === 0) {
    return { ok: false, error: 'Empty input', format: 'text' }
  }
  return {
    ok: true,
    bytes: new TextEncoder().encode(text),
    format: 'text',
    warnings: []
  }
}

/**
 * Format a small byte preview as space-separated hex (e.g. "90 90 31 c0").
 */
export function previewBytes(bytes, max = 16) {
  if (!bytes || bytes.length === 0) return ''
  const slice = bytes.slice(0, Math.min(max, bytes.length))
  const hex = Array.from(slice, (b) => b.toString(16).padStart(2, '0')).join(' ')
  return bytes.length > max ? `${hex} ...` : hex
}
