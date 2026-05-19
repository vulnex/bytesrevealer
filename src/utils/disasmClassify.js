/**
 * VULNEX -Bytes Revealer-
 *
 * File: disasmClassify.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Lightweight mnemonic + operand classifier for the disassembly sidebar.
 * Pure / synchronous — no Capstone DETAIL mode required.
 */

// Mnemonic → category. Shared across architectures because categories are
// semantic (data movement, arithmetic, …). When the same mnemonic exists on
// multiple archs (e.g. `mov`, `add`) the category matches regardless of arch.
// Architecture-specific conditional families (x86 j*, ARM b*) are handled by
// regex below instead of enumerating every variant.
const CATEGORIES = {
  // Control flow
  jmp: 'control-flow',
  call: 'control-flow',
  ret: 'control-flow',
  retn: 'control-flow',
  retf: 'control-flow',
  iret: 'control-flow',
  iretd: 'control-flow',
  iretq: 'control-flow',
  syscall: 'control-flow',
  sysenter: 'control-flow',
  sysret: 'control-flow',
  int: 'control-flow',
  int3: 'control-flow',
  into: 'control-flow',
  leave: 'control-flow',
  enter: 'control-flow',
  loop: 'control-flow',
  loope: 'control-flow',
  loopne: 'control-flow',
  loopz: 'control-flow',
  loopnz: 'control-flow',

  // Data movement
  mov: 'data',
  movzx: 'data',
  movsx: 'data',
  movsxd: 'data',
  push: 'data',
  pop: 'data',
  pusha: 'data',
  popa: 'data',
  pushf: 'data',
  popf: 'data',
  pushfq: 'data',
  popfq: 'data',
  lea: 'data',
  xchg: 'data',
  bswap: 'data',
  cbw: 'data',
  cwde: 'data',
  cdqe: 'data',
  cdq: 'data',
  cqo: 'data',

  // Arithmetic
  add: 'arithmetic',
  sub: 'arithmetic',
  mul: 'arithmetic',
  imul: 'arithmetic',
  div: 'arithmetic',
  idiv: 'arithmetic',
  inc: 'arithmetic',
  dec: 'arithmetic',
  neg: 'arithmetic',
  adc: 'arithmetic',
  sbb: 'arithmetic',

  // Logical
  and: 'logical',
  or: 'logical',
  xor: 'logical',
  not: 'logical',
  shl: 'logical',
  sal: 'logical',
  shr: 'logical',
  sar: 'logical',
  rol: 'logical',
  ror: 'logical',
  rcl: 'logical',
  rcr: 'logical',

  // Comparison
  cmp: 'comparison',
  test: 'comparison',

  // String ops
  movs: 'string-op',
  movsb: 'string-op',
  movsw: 'string-op',
  movsd: 'string-op',
  movsq: 'string-op',
  cmps: 'string-op',
  cmpsb: 'string-op',
  cmpsw: 'string-op',
  cmpsd: 'string-op',
  scas: 'string-op',
  scasb: 'string-op',
  scasw: 'string-op',
  scasd: 'string-op',
  stos: 'string-op',
  stosb: 'string-op',
  stosw: 'string-op',
  stosd: 'string-op',
  stosq: 'string-op',
  lods: 'string-op',
  lodsb: 'string-op',
  lodsw: 'string-op',
  lodsd: 'string-op',

  // Misc
  nop: 'nop',
  hlt: 'system',
  cli: 'system',
  sti: 'system',
  cld: 'system',
  std: 'system',
  wait: 'system',
  fwait: 'system',
  lock: 'system',
  cpuid: 'system',

  // ── ARM / ARM64 ──
  // Branch family
  b: 'control-flow',
  bl: 'control-flow',
  bx: 'control-flow',
  blx: 'control-flow',
  br: 'control-flow',
  blr: 'control-flow',
  cbz: 'control-flow',
  cbnz: 'control-flow',
  tbz: 'control-flow',
  tbnz: 'control-flow',
  svc: 'control-flow',
  hvc: 'control-flow',
  smc: 'control-flow',
  swi: 'control-flow',
  eret: 'control-flow',
  // Data
  ldr: 'data',
  ldrb: 'data',
  ldrh: 'data',
  ldrsb: 'data',
  ldrsh: 'data',
  ldrsw: 'data',
  ldp: 'data',
  ldm: 'data',
  ldmia: 'data',
  ldmdb: 'data',
  str: 'data',
  strb: 'data',
  strh: 'data',
  stp: 'data',
  stm: 'data',
  stmia: 'data',
  stmdb: 'data',
  mvn: 'data',
  // `mov` is already covered in the x86 section above (same category).
  movw: 'data',
  movt: 'data',
  movz: 'data',
  movk: 'data',
  movn: 'data',
  mrs: 'data',
  msr: 'data',
  adr: 'data',
  adrp: 'data',
  // Arithmetic (extends the x86 'add'/'sub' etc. with arch-unique ones)
  mla: 'arithmetic',
  mls: 'arithmetic',
  sdiv: 'arithmetic',
  udiv: 'arithmetic',
  smull: 'arithmetic',
  umull: 'arithmetic',
  smlal: 'arithmetic',
  umlal: 'arithmetic',
  rsb: 'arithmetic',
  rsc: 'arithmetic',
  // Logical
  orr: 'logical',
  eor: 'logical',
  bic: 'logical',
  lsl: 'logical',
  lsr: 'logical',
  asr: 'logical',
  // Comparison
  tst: 'comparison',
  teq: 'comparison',
  cmn: 'comparison',
  // System
  sev: 'system',
  sevl: 'system',
  wfe: 'system',
  wfi: 'system',
  yield: 'system',
  dmb: 'system',
  dsb: 'system',
  isb: 'system',

  // ── MIPS ──
  // Control-flow
  j: 'control-flow',
  jal: 'control-flow',
  jalr: 'control-flow',
  jr: 'control-flow',
  bnez: 'control-flow',
  beqz: 'control-flow',
  bgtz: 'control-flow',
  bltz: 'control-flow',
  blez: 'control-flow',
  bgez: 'control-flow',
  // Data
  lw: 'data',
  sw: 'data',
  lb: 'data',
  lbu: 'data',
  lh: 'data',
  lhu: 'data',
  sb: 'data',
  sh: 'data',
  lui: 'data',
  lwl: 'data',
  lwr: 'data',
  swl: 'data',
  swr: 'data',
  mflo: 'data',
  mfhi: 'data',
  mtlo: 'data',
  mthi: 'data',
  mfc0: 'data',
  mtc0: 'data',
  mfc1: 'data',
  mtc1: 'data',
  // Arithmetic
  addi: 'arithmetic',
  addu: 'arithmetic',
  addiu: 'arithmetic',
  subu: 'arithmetic',
  mult: 'arithmetic',
  multu: 'arithmetic',
  divu: 'arithmetic',
  // Logical
  andi: 'logical',
  ori: 'logical',
  xori: 'logical',
  nor: 'logical',
  sll: 'logical',
  srl: 'logical',
  sra: 'logical',
  sllv: 'logical',
  srlv: 'logical',
  srav: 'logical',
  // Comparison
  slt: 'comparison',
  slti: 'comparison',
  sltu: 'comparison',
  sltiu: 'comparison',
  // System
  // `syscall` is already covered in the x86 section above (same category).
  break: 'system'
}

// Conditional jumps share one category. Catches je/jne/jz/jnz/jl/jg/jb/ja/etc.
const COND_JUMP_RE = /^j[a-z]+$/
const COND_MOV_RE = /^cmov[a-z]+$/
const COND_SET_RE = /^set[a-z]+$/
// ARM A32 conditional branches: beq, bne, bcs, bhs, bcc, blo, bmi, bpl,
// bvs, bvc, bhi, bls, bge, blt, bgt, ble, bal, bnv.
// Also ARM64 b.<cond>: b.eq, b.ne, etc.
const ARM_COND_BRANCH_RE = /^b\.?(eq|ne|cs|hs|cc|lo|mi|pl|vs|vc|hi|ls|ge|lt|gt|le|al|nv)$/

export function classifyMnemonic(mnemonic) {
  if (!mnemonic) return 'unclassified'
  const m = mnemonic.toLowerCase()
  if (CATEGORIES[m]) return CATEGORIES[m]
  if (COND_JUMP_RE.test(m) && m !== 'jmp') return 'control-flow'
  if (COND_MOV_RE.test(m)) return 'data'
  if (COND_SET_RE.test(m)) return 'data'
  if (ARM_COND_BRANCH_RE.test(m)) return 'control-flow'
  return 'unclassified'
}

const REG_RE = /^[a-z][a-z0-9]{1,5}$/i
const IMM_RE = /^(0x[0-9a-f]+|-?\d+)$/i

function classifyOperandText(text) {
  const t = text.trim()
  if (!t) return 'unknown'
  if (t.startsWith('[') && t.endsWith(']')) return 'memory'
  if (/\bptr\b/i.test(t) || t.includes('[')) return 'memory'
  if (IMM_RE.test(t)) return 'immediate'
  if (REG_RE.test(t)) return 'register'
  return 'unknown'
}

/**
 * Split an opStr into top-level operands. Commas inside `[]` are preserved
 * because x86 memory operands like `[rbp + rax*2 - 0x10]` are not separators.
 */
export function splitOperands(opStr) {
  if (!opStr) return []
  const out = []
  let depth = 0
  let current = ''
  for (let i = 0; i < opStr.length; i++) {
    const ch = opStr[i]
    if (ch === '[') {
      depth++
      current += ch
    } else if (ch === ']') {
      depth = Math.max(0, depth - 1)
      current += ch
    } else if (ch === ',' && depth === 0) {
      if (current.trim()) out.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) out.push(current.trim())
  return out
}

export function classifyOperands(opStr) {
  return splitOperands(opStr).map((text) => ({ text, type: classifyOperandText(text) }))
}

export function classifyInstruction(insn) {
  if (!insn) return null
  return {
    category: classifyMnemonic(insn.mnemonic),
    operands: classifyOperands(insn.opStr)
  }
}
