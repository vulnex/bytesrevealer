/**
 * VULNEX -Bytes Revealer-
 *
 * File: disasmDisplay.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Shared display helpers for disassembly UI surfaces (listing + sidebar)
 * so address/byte formatting can't drift between them.
 */

export const ADDRESS_HEX_WIDTH = 8

export function formatDisasmAddress(addr) {
  return (addr ?? 0).toString(16).toUpperCase().padStart(ADDRESS_HEX_WIDTH, '0')
}

export function formatDisasmBytes(bytes) {
  if (!bytes || !bytes.length) return ''
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}
