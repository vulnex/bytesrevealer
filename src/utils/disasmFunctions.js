/**
 * VULNEX -Bytes Revealer-
 *
 * File: disasmFunctions.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Heuristic function-start detector. Walks a decoded instruction list and
 * flags addresses that look like the start of a function, using common
 * per-arch prologue patterns. Designed for stripped binaries; when a file
 * carries symbol metadata (PE exports, ELF symtab, Mach-O LC_FUNCTION_STARTS)
 * a future layer will overlay names and improve accuracy.
 */

function defaultName(address) {
  const hex = address.toString(16).toUpperCase().padStart(8, '0')
  return `func_${hex}`
}

// True if `insn` looks like a frame setup `push <reg>` followed by an
// implicit `mov <reg>, sp` on the next instruction. This avoids false
// positives where a function happens to begin with any push.
function isX86FrameSetup(curr, next, basePtrReg, stackPtrReg) {
  if (!curr || !next) return false
  if (curr.mnemonic !== 'push' || (curr.opStr || '').trim() !== basePtrReg) return false
  if (next.mnemonic !== 'mov') return false
  const operands = (next.opStr || '').split(',').map((s) => s.trim())
  return operands.length === 2 && operands[0] === basePtrReg && operands[1] === stackPtrReg
}

// `endbr64` (or `endbr32`) is the Control-flow Enforcement Technology
// landing pad — emitted at the start of every indirect-branch target by
// recent compilers. A reliable function-start marker on its own.
function isEndbr(insn) {
  if (!insn) return false
  return insn.mnemonic === 'endbr64' || insn.mnemonic === 'endbr32'
}

// ARM64: `stp x29, x30, [sp, #...]!` followed by `mov x29, sp` is the
// canonical AArch64 prologue. We accept the `stp` alone — `mov x29, sp`
// is sometimes skipped in leaf functions, but `stp` of (fp, lr) into a
// pre-decremented stack is the strong signal.
function isArm64Prologue(insn) {
  if (!insn) return false
  if (insn.mnemonic !== 'stp') return false
  const op = (insn.opStr || '').replace(/\s+/g, '')
  return op.startsWith('x29,x30,[sp,') && op.endsWith(']!')
}

// ARM A32: `push {..., lr}` saves the link register on entry, a near-
// universal prologue marker. Match by mnemonic + presence of `lr` in
// the register list.
function isArmA32Prologue(insn) {
  if (!insn) return false
  if (insn.mnemonic !== 'push') return false
  const op = insn.opStr || ''
  return /^\{[^}]*\blr\b[^}]*\}$/i.test(op)
}

function isFunctionStart(curr, next, arch) {
  if (!curr) return false
  if (arch === 'x86') {
    if (isEndbr(curr)) return true
    if (isX86FrameSetup(curr, next, 'rbp', 'rsp')) return true
    if (isX86FrameSetup(curr, next, 'ebp', 'esp')) return true
    return false
  }
  if (arch === 'arm64') return isArm64Prologue(curr)
  if (arch === 'arm') return isArmA32Prologue(curr)
  return false
}

/**
 * Walk the instruction list and return detected function starts as
 * `[{ address, name }]`, ordered by address. The first instruction is
 * always treated as a function start (typical when the user picks a
 * range starting at a function entry — without this they'd see an empty
 * list for short ranges).
 */
export function detectFunctionStarts(instructions, arch) {
  if (!instructions || !instructions.length) return []
  const out = []
  const seen = new Set()

  // First instruction is always a candidate entry point.
  const first = instructions[0]
  out.push({ address: first.address, name: defaultName(first.address) })
  seen.add(first.address)

  for (let i = 1; i < instructions.length; i++) {
    const curr = instructions[i]
    const next = instructions[i + 1]
    if (!isFunctionStart(curr, next, arch)) continue
    if (seen.has(curr.address)) continue
    out.push({ address: curr.address, name: defaultName(curr.address) })
    seen.add(curr.address)
  }
  return out
}
