import { describe, it, expect } from 'vitest'
import { detectFunctionStarts } from './disasmFunctions.js'

const ins = (address, mnemonic, opStr = '') => ({ address, mnemonic, opStr })

describe('detectFunctionStarts', () => {
  it('returns [] for empty input', () => {
    expect(detectFunctionStarts([], 'x86')).toEqual([])
    expect(detectFunctionStarts(null, 'x86')).toEqual([])
  })

  it('always treats the first instruction as a candidate start', () => {
    const result = detectFunctionStarts([ins(0x1000, 'mov', 'eax, ebx')], 'x86')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ address: 0x1000, name: 'func_00001000' })
  })

  it('detects x86-64 push rbp / mov rbp, rsp prologues', () => {
    const insns = [
      ins(0x1000, 'mov', 'eax, ebx'),
      ins(0x1010, 'push', 'rbp'),
      ins(0x1011, 'mov', 'rbp, rsp'),
      ins(0x1014, 'sub', 'rsp, 0x20'),
      ins(0x1018, 'leave'),
      ins(0x1019, 'ret'),
      ins(0x101a, 'push', 'rbp'),
      ins(0x101b, 'mov', 'rbp, rsp')
    ]
    const result = detectFunctionStarts(insns, 'x86')
    expect(result.map((f) => f.address)).toEqual([0x1000, 0x1010, 0x101a])
  })

  it('detects x86-32 push ebp / mov ebp, esp', () => {
    const insns = [
      ins(0x1000, 'mov', 'eax, ebx'),
      ins(0x1002, 'push', 'ebp'),
      ins(0x1003, 'mov', 'ebp, esp')
    ]
    const result = detectFunctionStarts(insns, 'x86')
    expect(result.map((f) => f.address)).toEqual([0x1000, 0x1002])
  })

  it('detects endbr64 / endbr32 as function starts', () => {
    const insns = [
      ins(0x1000, 'mov', 'eax, ebx'),
      ins(0x1010, 'endbr64'),
      ins(0x1014, 'push', 'rbp'),
      ins(0x1015, 'mov', 'rbp, rsp')
    ]
    // endbr64 is a function start; the push/mov right after is *not* a
    // second start (still inside the same function).
    const result = detectFunctionStarts(insns, 'x86')
    expect(result.map((f) => f.address)).toEqual([0x1000, 0x1010, 0x1014])
  })

  it('does not flag a lone push rbp without the follow-on mov', () => {
    const insns = [
      ins(0x1000, 'ret'),
      ins(0x1001, 'push', 'rbp'),
      ins(0x1002, 'call', '0x4000') // not a mov rbp, rsp
    ]
    const result = detectFunctionStarts(insns, 'x86')
    expect(result.map((f) => f.address)).toEqual([0x1000])
  })

  it('detects ARM64 stp x29, x30 prologues', () => {
    const insns = [
      ins(0x1000, 'nop'),
      ins(0x1004, 'stp', 'x29, x30, [sp, #-32]!'),
      ins(0x1008, 'mov', 'x29, sp'),
      ins(0x100c, 'ret')
    ]
    const result = detectFunctionStarts(insns, 'arm64')
    expect(result.map((f) => f.address)).toEqual([0x1000, 0x1004])
  })

  it('does not flag stp on a different register pair', () => {
    const insns = [ins(0x1000, 'nop'), ins(0x1004, 'stp', 'x19, x20, [sp, #-16]!')]
    const result = detectFunctionStarts(insns, 'arm64')
    expect(result.map((f) => f.address)).toEqual([0x1000])
  })

  it('detects ARM A32 push {... lr} prologues', () => {
    const insns = [
      ins(0x1000, 'nop'),
      ins(0x1004, 'push', '{r4, r5, lr}'),
      ins(0x1008, 'pop', '{r4, r5, lr}'),
      ins(0x100c, 'push', '{r4, r5}') // no lr — not a prologue
    ]
    const result = detectFunctionStarts(insns, 'arm')
    expect(result.map((f) => f.address)).toEqual([0x1000, 0x1004])
  })

  it('deduplicates if first instruction also matches a prologue', () => {
    const insns = [ins(0x1000, 'push', 'rbp'), ins(0x1001, 'mov', 'rbp, rsp')]
    const result = detectFunctionStarts(insns, 'x86')
    expect(result.map((f) => f.address)).toEqual([0x1000])
  })

  it('only returns the first-instruction start for an unsupported arch', () => {
    const insns = [ins(0x1000, 'push', 'rbp'), ins(0x1001, 'mov', 'rbp, rsp')]
    const result = detectFunctionStarts(insns, 'mips')
    expect(result.map((f) => f.address)).toEqual([0x1000])
  })

  it('returns names as func_<uppercase-hex-padded-to-8>', () => {
    const result = detectFunctionStarts([ins(0x40a2b6, 'nop')], 'x86')
    expect(result[0].name).toBe('func_0040A2B6')
  })
})
