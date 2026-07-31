/**
 * VULNEX -Bytes Revealer-
 *
 * File: EmbeddedScanWorker.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-08
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Web Worker that streams chunks from the main thread and emits findings
 * for embedded PE / ELF / Mach-O executables.
 * See devnotes/embedded-executable-scanner-design.md.
 */

import {
  scanBuffer,
  MAX_MAGIC_LENGTH,
  DEFAULT_MAX_FINDINGS
} from '../utils/embeddedExecutableScanner.js'

/**
 * Bytes of context kept between chunks. Three purposes:
 *   1. handle a magic that straddles a chunk boundary (needs MAX_MAGIC_LENGTH-1)
 *   2. provide validators with lookahead (PE e_lfanew, Mach-O sizeofcmds)
 *   3. provide on-disk size resolvers (embeddedExecutableExtents) with enough
 *      forward context to walk full section/program/load-command tables
 *
 * 64 KB covers PE max section table (96 × 40 + headers ≈ 4 KB), ELF tables up
 * to ~1000 entries, and Mach-O load commands up to the scanner's 16 MB cap is
 * still not enough for pathological cases — those fall back to extractable=false.
 */
export const VALIDATION_LOOKAHEAD = 64 * 1024

export function createScanState(totalSize, options = {}) {
  return {
    totalSize,
    maxFindings: options.maxFindings ?? DEFAULT_MAX_FINDINGS,
    scannedTo: 0,
    findingCount: 0,
    truncated: false,
    cancelled: false,
    carry: new Uint8Array(0),
    carryStart: 0
  }
}

/**
 * Process a chunk against the current scan state.
 *
 * @param {object} state - State produced by createScanState (mutated in place)
 * @param {number} chunkStart - Absolute file offset of chunkBytes[0]
 * @param {Uint8Array} chunkBytes - Chunk bytes
 * @param {object} [opts]
 * @param {boolean} [opts.isFinal] - Force scan to end-of-buffer (no carry deferral)
 * @param {(finding) => void} [opts.onFinding]
 * @param {(scanned:number, total:number) => void} [opts.onProgress]
 * @param {() => boolean} [opts.shouldCancel]
 * @returns {{ done: boolean, cancelled: boolean, truncated: boolean }}
 */
export function processChunk(state, chunkStart, chunkBytes, opts = {}) {
  const { onFinding, onProgress, shouldCancel } = opts
  const isFinal = opts.isFinal ?? chunkStart + chunkBytes.length >= state.totalSize

  if (state.cancelled || state.truncated) {
    return { done: true, cancelled: state.cancelled, truncated: state.truncated }
  }

  let combined
  let combinedStart
  if (state.carry.length === 0) {
    combined = chunkBytes
    combinedStart = chunkStart
  } else {
    if (chunkStart !== state.carryStart + state.carry.length) {
      throw new Error(
        `Chunk gap or overlap: carry ends at ${state.carryStart + state.carry.length}, chunk starts at ${chunkStart}`
      )
    }
    combined = new Uint8Array(state.carry.length + chunkBytes.length)
    combined.set(state.carry, 0)
    combined.set(chunkBytes, state.carry.length)
    combinedStart = state.carryStart
  }

  const scanFromLocal = state.scannedTo - combinedStart
  if (scanFromLocal < 0) {
    throw new Error(`scannedTo (${state.scannedTo}) precedes combined start (${combinedStart})`)
  }

  // Defer the trailing window so any magic near the end has lookahead context.
  // On the final chunk, scan all the way to the end.
  const reserveTail = isFinal ? 0 : VALIDATION_LOOKAHEAD
  let scanEndLocal = combined.length - reserveTail
  if (scanEndLocal < scanFromLocal) scanEndLocal = scanFromLocal

  if (scanEndLocal > scanFromLocal) {
    const remainingBudget = state.maxFindings - state.findingCount
    const view = combined.subarray(scanFromLocal, scanEndLocal)
    const result = scanBuffer(view, {
      baseOffset: state.scannedTo,
      skipFirstMatch: state.scannedTo === 0,
      maxFindings: remainingBudget,
      onProgress: onProgress ? (p) => onProgress(state.scannedTo + p, state.totalSize) : undefined,
      shouldCancel
    })

    for (const f of result.findings) {
      if (onFinding) onFinding(f)
      state.findingCount++
    }
    state.scannedTo = result.nextScanFrom
    if (result.cancelled) state.cancelled = true
    if (result.truncated) state.truncated = true
  }

  // Update carry: bytes from scannedTo to end of combined become the new carry.
  // Use slice() to release the underlying chunk ArrayBuffer for GC.
  const carryLocalStart = state.scannedTo - combinedStart
  if (carryLocalStart < combined.length) {
    const tailLen = combined.length - carryLocalStart
    // Cap carry at VALIDATION_LOOKAHEAD + boundary buffer to bound memory.
    const maxCarry = VALIDATION_LOOKAHEAD + MAX_MAGIC_LENGTH
    if (tailLen <= maxCarry) {
      state.carry = combined.slice(carryLocalStart)
      state.carryStart = state.scannedTo
    } else {
      const dropFront = tailLen - maxCarry
      state.carry = combined.slice(carryLocalStart + dropFront)
      state.carryStart = state.scannedTo + dropFront
    }
  } else {
    state.carry = new Uint8Array(0)
    state.carryStart = state.scannedTo
  }

  const done = state.cancelled || state.truncated || isFinal
  if (done && onProgress) onProgress(state.scannedTo, state.totalSize)
  return { done, cancelled: state.cancelled, truncated: state.truncated }
}

/**
 * Build the worker-thread → main-thread message envelope for a finding.
 *
 * Findings emitted by the scanner carry their own `type: 'Embedded Executable'`
 * field (a human-readable label, distinct from the worker message protocol).
 * The spread must come *before* the protocol type so `type: 'finding'` wins;
 * otherwise the main-thread switch falls through and the finding is silently
 * dropped — a bug that occurred in v0.5 and prompted this helper.
 */
export function buildFindingMessage(finding) {
  return { ...finding, type: 'finding' }
}

// ─── Worker plumbing (skipped under Node test runners) ────────────────────

const isWorker =
  typeof self !== 'undefined' &&
  typeof self.postMessage === 'function' &&
  typeof window === 'undefined'

if (isWorker) {
  let state = null
  let cancelFlag = false

  const post = (msg) => self.postMessage(msg)

  self.onmessage = (event) => {
    if (!event.data || typeof event.data.type !== 'string') {
      post({ type: 'error', message: 'Invalid message format' })
      return
    }
    const { type } = event.data
    try {
      switch (type) {
        case 'scan': {
          const { totalSize, maxFindings } = event.data
          if (typeof totalSize !== 'number' || totalSize < 0) {
            post({ type: 'error', message: 'scan: totalSize must be non-negative number' })
            return
          }
          state = createScanState(totalSize, { maxFindings })
          cancelFlag = false
          break
        }
        case 'chunk': {
          if (!state) {
            post({ type: 'error', message: 'chunk received before scan' })
            return
          }
          const { start, bytes, isFinal } = event.data
          const result = processChunk(state, start, bytes, {
            isFinal,
            onFinding: (f) => post(buildFindingMessage(f)),
            onProgress: (scanned, total) => post({ type: 'progress', scanned, total }),
            shouldCancel: () => cancelFlag
          })
          if (result.done) {
            post({
              type: 'done',
              findingsCount: state.findingCount,
              cancelled: result.cancelled,
              truncated: result.truncated
            })
            state = null
          }
          break
        }
        case 'cancel':
          cancelFlag = true
          break
        default:
          post({ type: 'error', message: `Unknown message type: ${type}` })
      }
    } catch (err) {
      post({ type: 'error', message: err && err.message ? err.message : String(err) })
    }
  }
}
