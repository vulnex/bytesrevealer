/**
 * VULNEX -Bytes Revealer-
 *
 * File: disasmXref.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Branch-target extraction + cross-reference (xref) map building.
 * Pure / synchronous — operates on the regex-parsed instructions we get
 * from the worker today (no Capstone DETAIL needed).
 */

import { classifyMnemonic } from './disasmClassify'

// Match a single hex immediate that constitutes the whole opStr (after
// trimming). Branch instructions whose target is a register or computed
// address (e.g. `jmp rax`, `call qword ptr [rip + 0x10]`) don't have a
// static target we can extract — they return null.
const STATIC_BRANCH_TARGET_RE = /^0x([0-9a-f]+)$/i

/**
 * Returns the absolute branch target address for the instruction if it's a
 * control-flow instruction with a static immediate target, otherwise null.
 * Conservative on purpose — we'd rather miss a target than emit a wrong one.
 */
export function extractBranchTarget(insn) {
  if (!insn || !insn.mnemonic) return null
  const category = classifyMnemonic(insn.mnemonic)
  if (category !== 'control-flow') return null
  const op = (insn.opStr || '').trim()
  const match = op.match(STATIC_BRANCH_TARGET_RE)
  if (!match) return null
  const target = Number.parseInt(match[1], 16)
  return Number.isFinite(target) ? target : null
}

// Match a hex literal anywhere inside the opStr. Used to find data
// references (the last immediate in things like `mov rax, 0x40a230`).
const HEX_LITERAL_RE = /0x([0-9a-f]+)/gi

/**
 * For a non-control-flow instruction, return the last hex immediate in
 * the opStr as a number — typically the source operand of a data move.
 * Returns null for branches (use extractBranchTarget for those) or if no
 * hex literal is present.
 */
export function extractDataImmediate(insn) {
  if (!insn || !insn.mnemonic) return null
  const category = classifyMnemonic(insn.mnemonic)
  if (category === 'control-flow') return null
  const op = insn.opStr || ''
  let last = null
  for (const match of op.matchAll(HEX_LITERAL_RE)) last = match[1]
  if (last == null) return null
  const value = Number.parseInt(last, 16)
  return Number.isFinite(value) ? value : null
}

/**
 * Walk an instruction list, build target → [source addresses] map.
 * Sources are recorded in encounter order so the rendered xref badge is
 * stable across re-renders. Targets not present in the instruction list are
 * still recorded (caller can decide whether to filter to in-range targets).
 */
export function buildXrefMap(instructions) {
  const map = new Map()
  if (!instructions || !instructions.length) return map
  for (const insn of instructions) {
    const target = extractBranchTarget(insn)
    if (target == null) continue
    const sources = map.get(target)
    if (sources) {
      sources.push(insn.address)
    } else {
      map.set(target, [insn.address])
    }
  }
  return map
}
