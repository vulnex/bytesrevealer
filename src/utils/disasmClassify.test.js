import { describe, it, expect } from 'vitest'
import {
  classifyMnemonic,
  splitOperands,
  classifyOperands,
  classifyInstruction
} from './disasmClassify.js'

describe('classifyMnemonic', () => {
  it('categorises known mnemonics', () => {
    expect(classifyMnemonic('mov')).toBe('data')
    expect(classifyMnemonic('add')).toBe('arithmetic')
    expect(classifyMnemonic('xor')).toBe('logical')
    expect(classifyMnemonic('cmp')).toBe('comparison')
    expect(classifyMnemonic('nop')).toBe('nop')
    expect(classifyMnemonic('ret')).toBe('control-flow')
    expect(classifyMnemonic('jmp')).toBe('control-flow')
    expect(classifyMnemonic('cli')).toBe('system')
    expect(classifyMnemonic('movsb')).toBe('string-op')
  })

  it('treats conditional jumps as control-flow', () => {
    expect(classifyMnemonic('je')).toBe('control-flow')
    expect(classifyMnemonic('jne')).toBe('control-flow')
    expect(classifyMnemonic('jz')).toBe('control-flow')
    expect(classifyMnemonic('jge')).toBe('control-flow')
    expect(classifyMnemonic('jrcxz')).toBe('control-flow')
  })

  it('treats cmov/set families as data', () => {
    expect(classifyMnemonic('cmove')).toBe('data')
    expect(classifyMnemonic('cmovne')).toBe('data')
    expect(classifyMnemonic('sete')).toBe('data')
    expect(classifyMnemonic('setnz')).toBe('data')
  })

  it('is case-insensitive', () => {
    expect(classifyMnemonic('MOV')).toBe('data')
    expect(classifyMnemonic('Push')).toBe('data')
  })

  it('returns unclassified for unknown mnemonics', () => {
    expect(classifyMnemonic('xyz')).toBe('unclassified')
    expect(classifyMnemonic('')).toBe('unclassified')
    expect(classifyMnemonic(undefined)).toBe('unclassified')
  })

  it('classifies ARM/ARM64 branches as control-flow', () => {
    expect(classifyMnemonic('b')).toBe('control-flow')
    expect(classifyMnemonic('bl')).toBe('control-flow')
    expect(classifyMnemonic('bx')).toBe('control-flow')
    expect(classifyMnemonic('blx')).toBe('control-flow')
    expect(classifyMnemonic('br')).toBe('control-flow')
    expect(classifyMnemonic('blr')).toBe('control-flow')
    expect(classifyMnemonic('cbz')).toBe('control-flow')
    expect(classifyMnemonic('tbnz')).toBe('control-flow')
    expect(classifyMnemonic('beq')).toBe('control-flow')
    expect(classifyMnemonic('bne')).toBe('control-flow')
    expect(classifyMnemonic('b.eq')).toBe('control-flow')
    expect(classifyMnemonic('b.ne')).toBe('control-flow')
  })

  it('classifies ARM load/store as data', () => {
    expect(classifyMnemonic('ldr')).toBe('data')
    expect(classifyMnemonic('str')).toBe('data')
    expect(classifyMnemonic('ldp')).toBe('data')
    expect(classifyMnemonic('stp')).toBe('data')
    expect(classifyMnemonic('movz')).toBe('data')
    expect(classifyMnemonic('movk')).toBe('data')
    expect(classifyMnemonic('adrp')).toBe('data')
  })

  it('classifies ARM arithmetic and logical', () => {
    expect(classifyMnemonic('mla')).toBe('arithmetic')
    expect(classifyMnemonic('sdiv')).toBe('arithmetic')
    expect(classifyMnemonic('udiv')).toBe('arithmetic')
    expect(classifyMnemonic('orr')).toBe('logical')
    expect(classifyMnemonic('eor')).toBe('logical')
    expect(classifyMnemonic('bic')).toBe('logical')
  })

  it('classifies ARM comparison', () => {
    expect(classifyMnemonic('tst')).toBe('comparison')
    expect(classifyMnemonic('teq')).toBe('comparison')
    expect(classifyMnemonic('cmn')).toBe('comparison')
  })

  it('classifies MIPS control-flow', () => {
    expect(classifyMnemonic('j')).toBe('control-flow')
    expect(classifyMnemonic('jal')).toBe('control-flow')
    expect(classifyMnemonic('jr')).toBe('control-flow')
    expect(classifyMnemonic('jalr')).toBe('control-flow')
    expect(classifyMnemonic('bnez')).toBe('control-flow')
    expect(classifyMnemonic('beqz')).toBe('control-flow')
    expect(classifyMnemonic('syscall')).toBe('control-flow')
  })

  it('classifies MIPS data movement', () => {
    expect(classifyMnemonic('lw')).toBe('data')
    expect(classifyMnemonic('sw')).toBe('data')
    expect(classifyMnemonic('lui')).toBe('data')
    expect(classifyMnemonic('mflo')).toBe('data')
    expect(classifyMnemonic('mtc0')).toBe('data')
  })

  it('classifies MIPS arithmetic, logical, comparison', () => {
    expect(classifyMnemonic('addiu')).toBe('arithmetic')
    expect(classifyMnemonic('mult')).toBe('arithmetic')
    expect(classifyMnemonic('andi')).toBe('logical')
    expect(classifyMnemonic('sll')).toBe('logical')
    expect(classifyMnemonic('srl')).toBe('logical')
    expect(classifyMnemonic('slt')).toBe('comparison')
    expect(classifyMnemonic('sltu')).toBe('comparison')
  })
})

describe('splitOperands', () => {
  it('splits two simple operands', () => {
    expect(splitOperands('eax, ebx')).toEqual(['eax', 'ebx'])
  })

  it('respects brackets when splitting', () => {
    expect(splitOperands('rax, qword ptr [rbp + rax*2 - 0x10]')).toEqual([
      'rax',
      'qword ptr [rbp + rax*2 - 0x10]'
    ])
  })

  it('returns single operand when no comma', () => {
    expect(splitOperands('0x40809c')).toEqual(['0x40809c'])
  })

  it('returns empty array for empty input', () => {
    expect(splitOperands('')).toEqual([])
    expect(splitOperands(null)).toEqual([])
    expect(splitOperands(undefined)).toEqual([])
  })

  it('handles three operands', () => {
    expect(splitOperands('eax, ebx, 0x10')).toEqual(['eax', 'ebx', '0x10'])
  })
})

describe('classifyOperands', () => {
  it('classifies registers, immediates, memory', () => {
    expect(classifyOperands('eax, 0x10')).toEqual([
      { text: 'eax', type: 'register' },
      { text: '0x10', type: 'immediate' }
    ])
  })

  it('classifies memory operands with ptr keyword', () => {
    const result = classifyOperands('rax, qword ptr [rbp - 0x10]')
    expect(result[0]).toEqual({ text: 'rax', type: 'register' })
    expect(result[1]).toEqual({ text: 'qword ptr [rbp - 0x10]', type: 'memory' })
  })

  it('classifies bare [bracket] expressions as memory', () => {
    expect(classifyOperands('[rbp + 8]')).toEqual([{ text: '[rbp + 8]', type: 'memory' }])
  })

  it('classifies negative immediates', () => {
    expect(classifyOperands('-1')).toEqual([{ text: '-1', type: 'immediate' }])
  })
})

describe('classifyInstruction', () => {
  it('returns null for falsy input', () => {
    expect(classifyInstruction(null)).toBeNull()
    expect(classifyInstruction(undefined)).toBeNull()
  })

  it('combines mnemonic + operand classification', () => {
    const out = classifyInstruction({ mnemonic: 'mov', opStr: 'eax, 0x10' })
    expect(out.category).toBe('data')
    expect(out.operands).toEqual([
      { text: 'eax', type: 'register' },
      { text: '0x10', type: 'immediate' }
    ])
  })

  it('handles instructions with no operands', () => {
    const out = classifyInstruction({ mnemonic: 'ret', opStr: '' })
    expect(out.category).toBe('control-flow')
    expect(out.operands).toEqual([])
  })
})
