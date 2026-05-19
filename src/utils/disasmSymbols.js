/**
 * VULNEX -Bytes Revealer-
 *
 * File: disasmSymbols.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Extract function symbol names from binary metadata (PE exports, ELF
 * symtab, Mach-O LC_FUNCTION_STARTS) and return them as a
 * Map<fileOffset, name> the disassembly store can overlay onto the
 * heuristically detected function list. For binaries without symbol
 * metadata (or when extraction fails) the map is empty and the disasm
 * tab falls back to heuristic-only names.
 */

import { getPEExportSymbols } from './advancedFileDetection'

function looksLikePE(bytes) {
  return bytes && bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a
}

/**
 * Returns Map<fileOffset, name>. Addresses are file offsets within
 * `fileBytes` — comparable directly against the addresses Capstone emits
 * when disassembling with baseAddress = 0 (standalone-PE case).
 *
 * Embedded-executable disassembly (where the user clicks "Disassemble"
 * on a finding row) hands the worker host-file offsets, so the symbol
 * extraction here against the host's `fileBytes` won't match the embed's
 * own export RVAs. That's fine — the overlay degrades to no-match and
 * heuristic names remain. A future commit can lift this by extracting
 * symbols from the embed slice when that path is taken.
 */
export function extractSymbolNames(fileBytes) {
  const empty = new Map()
  if (!fileBytes || !fileBytes.length) return empty

  if (looksLikePE(fileBytes)) {
    const exports = getPEExportSymbols(fileBytes)
    if (!exports || !exports.length) return empty
    const map = new Map()
    for (const sym of exports) {
      if (Number.isFinite(sym.fileOffset) && typeof sym.name === 'string' && sym.name.length) {
        // First write wins — if two exports share a function offset the
        // alphabetically-earlier name will be kept by the export-table
        // ordering already in place.
        if (!map.has(sym.fileOffset)) {
          map.set(sym.fileOffset, sym.name)
        }
      }
    }
    return map
  }

  // ELF / Mach-O symbol extraction is intentionally deferred — see
  // devnotes/disassembly-phase5-design.md for the plan.
  return empty
}
