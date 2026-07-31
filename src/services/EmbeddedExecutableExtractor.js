/**
 * VULNEX -Bytes Revealer-
 *
 * File: EmbeddedExecutableExtractor.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-17
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Carves an embedded PE/ELF/Mach-O out of the host file into a Blob,
 * streaming in 1 MB slices so it can scale to hundreds of MB without
 * spiking memory. Returns the Blob plus a suggested filename derived
 * from format + architecture + (for PE) the Characteristics flags.
 *
 * See devnotes/embedded-executable-extraction-design.md.
 */

import {
  PE_MACHINE_NAMES,
  ELF_MACHINE_NAMES,
  MACHO_CPU_NAMES,
  sanitizeArchToken
} from '../utils/architectureNames.js'
import {
  validatePE,
  validateELF,
  validateMachO,
  validateMachOFat
} from '../utils/embeddedExecutableScanner.js'

export const EXTRACTION_SLICE_SIZE = 1024 * 1024

// PE Characteristics flags relevant to file-extension choice.
const IMAGE_FILE_DLL = 0x2000
const IMAGE_FILE_SYSTEM = 0x1000

const MIME_PE = 'application/vnd.microsoft.portable-executable'
const MIME_BINARY = 'application/octet-stream'

function abortError() {
  // Use DOMException when available so callers can do `if (e.name === 'AbortError')`.
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Extraction aborted', 'AbortError')
  }
  const e = new Error('Extraction aborted')
  e.name = 'AbortError'
  return e
}

function formatOffsetHex(offset) {
  const hex = offset.toString(16).toUpperCase()
  const width = offset > 0xffffffff ? 16 : 8
  return `0x${hex.padStart(width, '0')}`
}

/**
 * Read a range of bytes from either a plain Uint8Array or a chunked-file
 * wrapper exposing an async `.slice(start, end)` method (as produced by
 * FileChunkManager.initialize for large files).
 */
async function readSlice(source, start, end) {
  if (source instanceof Uint8Array) {
    return source.subarray(start, end)
  }
  if (typeof source?.slice === 'function') {
    // Chunked wrapper — slice may be async.
    const result = source.slice(start, end)
    return result instanceof Promise ? await result : result
  }
  throw new Error('Unsupported file source for extraction')
}

/**
 * Pick a suggested file extension for a PE based on its Characteristics field.
 * IMAGE_FILE_DLL takes priority over IMAGE_FILE_SYSTEM (a DLL with the system
 * flag set is still a DLL on disk).
 */
export function peExtensionFor(characteristics) {
  if (typeof characteristics !== 'number') return 'exe'
  if (characteristics & IMAGE_FILE_DLL) return 'dll'
  if (characteristics & IMAGE_FILE_SYSTEM) return 'sys'
  return 'exe'
}

/**
 * Build the suggested filename for an extracted embedded executable.
 *
 * @param {object} finding - { format, offset, details }
 * @returns {string}
 */
export function suggestFilename(finding) {
  const offsetToken = formatOffsetHex(finding.offset)
  const details = finding.details || {}

  switch (finding.format) {
    case 'PE': {
      const arch = sanitizeArchToken(PE_MACHINE_NAMES[details.machine] || 'unknown-arch')
      const ext = peExtensionFor(details.characteristics)
      return `embedded_PE_${arch}_${offsetToken}.${ext}`
    }
    case 'ELF': {
      const arch = sanitizeArchToken(ELF_MACHINE_NAMES[details.machine] || 'unknown-arch')
      return `embedded_ELF_${arch}_${offsetToken}`
    }
    case 'Mach-O': {
      const arch = sanitizeArchToken(MACHO_CPU_NAMES[details.cputype] || 'unknown-arch')
      return `embedded_MachO_${arch}_${offsetToken}`
    }
    case 'Mach-O Fat':
      return `embedded_MachO-Fat_${offsetToken}`
    default:
      return `embedded_${offsetToken}.bin`
  }
}

function mimeFor(format) {
  return format === 'PE' ? MIME_PE : MIME_BINARY
}

/**
 * Re-validate the extracted bytes by running the appropriate validator over
 * the first slice (which always contains the header). Catches off-by-ones in
 * the extents resolvers or genuine truncation of the host buffer.
 *
 * Validates against `firstSlice` rather than the assembled Blob so we don't
 * round-trip the entire payload through ArrayBuffer (would double peak
 * memory for large extracts).
 */
function revalidateHeader(format, firstSlice) {
  if (!firstSlice || firstSlice.length < 4) {
    return 'extracted bytes too short to re-validate header'
  }
  let result
  switch (format) {
    case 'PE':
      result = validatePE(firstSlice, 0)
      break
    case 'ELF':
      result = validateELF(firstSlice, 0)
      break
    case 'Mach-O':
      result = validateMachO(firstSlice, 0)
      break
    case 'Mach-O Fat':
      result = validateMachOFat(firstSlice, 0)
      break
    default:
      return null // Unknown format — no validator to run.
  }
  return result.valid ? null : `re-validation of extracted ${format} header failed`
}

/**
 * Extract an embedded executable.
 *
 * Two output modes:
 *
 * - **Blob mode (default)**: accumulates slices into a `Uint8Array[]` and
 *   builds a `Blob` at the end. Peak memory is roughly 2× `fileSize` during
 *   the Blob construction step. Used on browsers without File System Access
 *   API (Safari, Firefox).
 *
 * - **Streaming mode**: when `writer` is provided, slices are written
 *   directly to the writer (typically a `FileSystemWritableFileStream` from
 *   `window.showSaveFilePicker().createWritable()`). Peak memory is one
 *   slice (~1 MB). No Blob is created. Used on Chromium-based browsers
 *   that support the API.
 *
 * Both modes still keep the first slice in memory so the header can be
 * re-validated.
 *
 * @param {object} params
 * @param {Uint8Array|object} params.fileBytes - Host file source
 * @param {object} params.finding - Scanner finding (offset, fileSize, format, details, extractable)
 * @param {(bytesRead:number, total:number) => void} [params.onProgress]
 * @param {AbortSignal} [params.signal]
 * @param {{ write: (bytes:Uint8Array) => Promise<void>, close: () => Promise<void>, abort?: (reason?:any) => Promise<void> }} [params.writer]
 *   Optional sink for streaming mode.
 * @returns {Promise<{ blob?: Blob, filename: string, validationWarning?: string, streamed: boolean }>}
 */
export async function extractEmbedded({ fileBytes, finding, onProgress, signal, writer }) {
  if (!finding) throw new Error('finding is required')
  if (finding.extractable === false) {
    throw new Error(finding.extractError || 'Finding is not extractable')
  }
  const { offset, fileSize } = finding
  if (typeof offset !== 'number' || offset < 0) {
    throw new Error('finding.offset must be a non-negative number')
  }
  if (typeof fileSize !== 'number' || fileSize <= 0) {
    throw new Error('finding.fileSize must be a positive number')
  }

  // Determine the upper bound — clamp against the actual source length so we
  // never claim to extract past EOF.
  let sourceLength
  if (fileBytes instanceof Uint8Array) {
    sourceLength = fileBytes.length
  } else if (typeof fileBytes?.length === 'number') {
    sourceLength = fileBytes.length
  } else {
    throw new Error('Cannot determine file source length')
  }
  const endAbs = Math.min(offset + fileSize, sourceLength)
  const totalToRead = Math.max(0, endAbs - offset)

  const streaming = !!writer
  const parts = streaming ? null : []
  let headerSlice = null
  let bytesRead = 0
  let cursor = offset

  const handleAbort = async () => {
    if (streaming && typeof writer.abort === 'function') {
      try {
        await writer.abort('extraction aborted')
      } catch {
        // Best-effort cleanup; rethrow the original abort below.
      }
    }
  }

  try {
    while (cursor < endAbs) {
      if (signal?.aborted) {
        await handleAbort()
        throw abortError()
      }
      const sliceEnd = Math.min(cursor + EXTRACTION_SLICE_SIZE, endAbs)
      const slice = await readSlice(fileBytes, cursor, sliceEnd)
      // Copy into a detached Uint8Array so we don't hold a view onto a chunk
      // that the source may later evict or reuse.
      const owned = slice instanceof Uint8Array ? slice.slice() : new Uint8Array(slice)

      if (streaming) {
        await writer.write(owned)
      } else {
        parts.push(owned)
      }
      // Keep a reference to the first slice for header re-validation. In
      // streaming mode this is the only buffered bytes; the rest are gone.
      if (headerSlice === null) headerSlice = owned

      bytesRead += owned.length
      cursor = sliceEnd
      if (onProgress) onProgress(bytesRead, totalToRead)
    }

    if (signal?.aborted) {
      await handleAbort()
      throw abortError()
    }

    // Re-validate against the first slice (always contains the header). A
    // failure here means our extents resolver and the host bytes disagree;
    // surfaced as a non-blocking validationWarning.
    const validationWarning = headerSlice ? revalidateHeader(finding.format, headerSlice) : null

    if (streaming) {
      await writer.close()
      return {
        filename: suggestFilename(finding),
        validationWarning: validationWarning || undefined,
        streamed: true
      }
    }

    const blob = new Blob(parts, { type: mimeFor(finding.format) })
    return {
      blob,
      filename: suggestFilename(finding),
      validationWarning: validationWarning || undefined,
      streamed: false
    }
  } catch (err) {
    // If writer state allows, signal abort on any thrown error so the
    // partially-written file is not left as a "successful" save.
    if (streaming && err?.name !== 'AbortError') {
      await handleAbort()
    }
    throw err
  }
}
