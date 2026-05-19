import { describe, it, expect } from 'vitest'
import { extractBranchTarget, buildXrefMap, extractDataImmediate } from './disasmXref.js'

const ins = (address, mnemonic, opStr) => ({ address, mnemonic, opStr })

describe('extractBranchTarget', () => {
  it('returns the immediate for an x86 call to a hex literal', () => {
    expect(extractBranchTarget(ins(0x1000, 'call', '0x40809c'))).toBe(0x40809c)
  })

  it('returns the immediate for a conditional jump', () => {
    expect(extractBranchTarget(ins(0x1000, 'je', '0x402000'))).toBe(0x402000)
    expect(extractBranchTarget(ins(0x1000, 'jne', '0x40000A'))).toBe(0x40000a)
  })

  it('handles ARM b/bl with hex target', () => {
    expect(extractBranchTarget(ins(0x1000, 'bl', '0x10500'))).toBe(0x10500)
    expect(extractBranchTarget(ins(0x1000, 'b.eq', '0x10510'))).toBe(0x10510)
  })

  it('returns null for indirect / register / memory targets', () => {
    expect(extractBranchTarget(ins(0x1000, 'call', 'rax'))).toBeNull()
    expect(extractBranchTarget(ins(0x1000, 'jmp', 'qword ptr [rip + 0x10]'))).toBeNull()
    expect(extractBranchTarget(ins(0x1000, 'call', '[r12]'))).toBeNull()
  })

  it('returns null for non-control-flow instructions even when opStr looks like a hex address', () => {
    // `mov rax, 0x40809c` is data movement, not a branch — we don't want
    // to claim 0x40809c is a branch target.
    expect(extractBranchTarget(ins(0x1000, 'mov', '0x40809c'))).toBeNull()
  })

  it('returns null for falsy / malformed input', () => {
    expect(extractBranchTarget(null)).toBeNull()
    expect(extractBranchTarget(undefined)).toBeNull()
    expect(extractBranchTarget({})).toBeNull()
    expect(extractBranchTarget(ins(0, 'jmp', ''))).toBeNull()
    expect(extractBranchTarget(ins(0, 'jmp', 'not hex'))).toBeNull()
  })
})

describe('extractDataImmediate', () => {
  it('returns the immediate from a data move', () => {
    expect(extractDataImmediate(ins(0x1000, 'mov', 'rax, 0x40a230'))).toBe(0x40a230)
    expect(extractDataImmediate(ins(0x1000, 'lea', 'rax, [rip + 0x1234]'))).toBe(0x1234)
  })

  it('takes the last hex literal when several are present', () => {
    expect(extractDataImmediate(ins(0x1000, 'mov', '[rbp - 0x10], 0x40a230'))).toBe(0x40a230)
  })

  it('returns null for control-flow instructions even if opStr has hex', () => {
    expect(extractDataImmediate(ins(0x1000, 'call', '0x40809c'))).toBeNull()
    expect(extractDataImmediate(ins(0x1000, 'jmp', '0x401000'))).toBeNull()
  })

  it('returns null when opStr has no hex literal', () => {
    expect(extractDataImmediate(ins(0x1000, 'mov', 'eax, ebx'))).toBeNull()
    expect(extractDataImmediate(ins(0x1000, 'nop', ''))).toBeNull()
  })

  it('returns null for falsy input', () => {
    expect(extractDataImmediate(null)).toBeNull()
    expect(extractDataImmediate({})).toBeNull()
  })
})

describe('buildXrefMap', () => {
  it('returns an empty map for empty / null input', () => {
    expect(buildXrefMap([])).toEqual(new Map())
    expect(buildXrefMap(null)).toEqual(new Map())
    expect(buildXrefMap(undefined)).toEqual(new Map())
  })

  it('records every branch source under its target', () => {
    const insns = [
      ins(0x1000, 'jmp', '0x2000'),
      ins(0x1010, 'call', '0x2000'),
      ins(0x1020, 'je', '0x3000'),
      ins(0x1030, 'mov', '0x2000') // not a branch, ignored
    ]
    const map = buildXrefMap(insns)
    expect(map.get(0x2000)).toEqual([0x1000, 0x1010])
    expect(map.get(0x3000)).toEqual([0x1020])
    expect(map.size).toBe(2)
  })

  it('preserves source order for stable rendering', () => {
    const insns = [
      ins(0x1030, 'jmp', '0x2000'),
      ins(0x1000, 'call', '0x2000'),
      ins(0x1020, 'jne', '0x2000')
    ]
    expect(buildXrefMap(insns).get(0x2000)).toEqual([0x1030, 0x1000, 0x1020])
  })

  it('records targets even when they fall outside the instruction stream', () => {
    // A jump to an out-of-range address is still a valid xref source —
    // the caller decides whether to render it (typically: only if target
    // is also one of our instructions).
    const insns = [ins(0x1000, 'call', '0xdeadbeef')]
    expect(buildXrefMap(insns).get(0xdeadbeef)).toEqual([0x1000])
  })
})
