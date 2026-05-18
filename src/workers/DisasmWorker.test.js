import { describe, it, expect } from 'vitest'
import { resolveArchMode, resolveSyntax, serializeInstruction } from './DisasmWorker.js'

describe('DisasmWorker.resolveArchMode', () => {
  it('maps x86 64-bit', () => {
    expect(resolveArchMode('x86', '64')).toEqual({ archConst: 3, modeConst: 8 })
  })

  it('maps x86 32-bit', () => {
    expect(resolveArchMode('x86', '32')).toEqual({ archConst: 3, modeConst: 4 })
  })

  it('maps x86 16-bit', () => {
    expect(resolveArchMode('x86', '16')).toEqual({ archConst: 3, modeConst: 2 })
  })

  it('maps ARM (default mode)', () => {
    expect(resolveArchMode('arm', 'arm')).toEqual({ archConst: 0, modeConst: 0 })
  })

  it('maps ARM Thumb', () => {
    expect(resolveArchMode('arm', 'thumb')).toEqual({ archConst: 0, modeConst: 16 })
  })

  it('maps ARM64', () => {
    expect(resolveArchMode('arm64', 'arm')).toEqual({ archConst: 1, modeConst: 0 })
  })

  it('maps MIPS 32-bit', () => {
    expect(resolveArchMode('mips', 'mips32')).toEqual({ archConst: 2, modeConst: 4 })
  })

  it('throws for unsupported architecture', () => {
    expect(() => resolveArchMode('z80', '8')).toThrow('Unsupported architecture: z80')
  })

  it('throws for unsupported mode', () => {
    expect(() => resolveArchMode('x86', '128')).toThrow('Unsupported mode for x86: 128')
  })
})

describe('DisasmWorker.resolveSyntax', () => {
  it('maps intel', () => {
    expect(resolveSyntax('intel')).toBe(1)
  })

  it('maps att', () => {
    expect(resolveSyntax('att')).toBe(2)
  })

  it('returns null for unknown syntax', () => {
    expect(resolveSyntax('weird')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(resolveSyntax(undefined)).toBeNull()
  })
})

describe('DisasmWorker.serializeInstruction', () => {
  it('produces a plain object from an Insn', () => {
    const insn = {
      id: 622,
      address: 0x1000,
      size: 3,
      bytes: new Uint8Array([0x48, 0x89, 0xe5]),
      mnemonic: 'mov',
      opStr: 'rbp, rsp'
    }
    const result = serializeInstruction(insn)
    expect(result).toEqual({
      id: 622,
      address: 0x1000,
      size: 3,
      bytes: new Uint8Array([0x48, 0x89, 0xe5]),
      mnemonic: 'mov',
      opStr: 'rbp, rsp'
    })
  })

  it('coerces bigint address to Number', () => {
    const insn = {
      id: 1,
      address: 0x401000n,
      size: 2,
      bytes: new Uint8Array([0xeb, 0x10]),
      mnemonic: 'jmp',
      opStr: '0x401012'
    }
    const result = serializeInstruction(insn)
    expect(typeof result.address).toBe('number')
    expect(result.address).toBe(0x401000)
  })

  it('preserves the bytes Uint8Array (postMessage-cloneable)', () => {
    const original = new Uint8Array([0x55])
    const result = serializeInstruction({
      id: 1,
      address: 0,
      size: 1,
      bytes: original,
      mnemonic: 'push',
      opStr: 'rbp'
    })
    expect(result.bytes).toBeInstanceOf(Uint8Array)
    expect(result.bytes[0]).toBe(0x55)
  })
})

describe('DisasmWorker end-to-end (capstone-wasm)', () => {
  it('disassembles x86-64 prologue/epilogue correctly', async () => {
    const { Capstone, Const, loadCapstone } = await import('capstone-wasm')
    await loadCapstone()

    // push rbp; mov rbp, rsp; sub rsp, 0x10; leave; ret
    const bytes = new Uint8Array([0x55, 0x48, 0x89, 0xe5, 0x48, 0x83, 0xec, 0x10, 0xc9, 0xc3])
    const cs = new Capstone(Const.CS_ARCH_X86, Const.CS_MODE_64)
    const instructions = cs.disasm(bytes, { address: 0x1000 })
    cs.close()

    expect(instructions).toHaveLength(5)
    expect(instructions.map((i) => i.mnemonic)).toEqual(['push', 'mov', 'sub', 'leave', 'ret'])
    expect(instructions[0].address).toBe(0x1000)
    expect(instructions[1].address).toBe(0x1001)
    expect(instructions[2].address).toBe(0x1004)
  }, 15000)

  it('respects Intel vs AT&T syntax options for x86', async () => {
    const { Capstone, Const, loadCapstone } = await import('capstone-wasm')
    await loadCapstone()

    const bytes = new Uint8Array([0x48, 0x89, 0xe5]) // mov rbp, rsp

    const cs = new Capstone(Const.CS_ARCH_X86, Const.CS_MODE_64)
    cs.setOption(Const.CS_OPT_SYNTAX, Const.CS_OPT_SYNTAX_INTEL)
    const intel = cs.disasm(bytes, { address: 0 })
    cs.close()

    const cs2 = new Capstone(Const.CS_ARCH_X86, Const.CS_MODE_64)
    cs2.setOption(Const.CS_OPT_SYNTAX, Const.CS_OPT_SYNTAX_ATT)
    const att = cs2.disasm(bytes, { address: 0 })
    cs2.close()

    expect(intel[0].opStr).toBe('rbp, rsp')
    expect(att[0].opStr).toBe('%rsp, %rbp')
  }, 15000)
})
