import { describe, it, expect } from 'vitest'
import { formatAsAsm, suggestAsmFilename } from './disasmFormatter.js'

describe('formatAsAsm', () => {
  it('renders a header even with no instructions', () => {
    const text = formatAsAsm([], {
      architecture: 'x86',
      mode: '64',
      syntaxStyle: 'intel',
      startOffset: 0x1000,
      endOffset: 0x2000,
      generatedAt: '2026-05-19T00:00:00.000Z'
    })
    expect(text).toContain('; Bytes Revealer disassembly')
    expect(text).toContain('; Source: https://bytesrevealer.online')
    expect(text).toContain('; Architecture: x86/64')
    expect(text).toContain('; Syntax: intel')
    expect(text).toContain('; Range: 0x1000 - 0x2000')
    expect(text).toContain('; Generated: 2026-05-19T00:00:00.000Z')
    expect(text).toContain('; Instructions: 0')
    expect(text).toContain('; (no instructions)')
  })

  it('renders address + bytes + mnemonic + operands columns', () => {
    const text = formatAsAsm(
      [
        { address: 0x1000, bytes: [0x55], size: 1, mnemonic: 'push', opStr: 'rbp' },
        {
          address: 0x1001,
          bytes: [0x48, 0x89, 0xe5],
          size: 3,
          mnemonic: 'mov',
          opStr: 'rbp, rsp'
        }
      ],
      { architecture: 'x86', mode: '64', startOffset: 0x1000, generatedAt: 'T' }
    )

    const lines = text.split('\n')
    const insLines = lines.filter((l) => l && !l.startsWith(';'))
    expect(insLines).toHaveLength(2)
    expect(insLines[0]).toMatch(/^0{12}1000:\s+55\s+push\s+rbp$/)
    expect(insLines[1]).toMatch(/^0{12}1001:\s+48 89 e5\s+mov\s+rbp, rsp$/)
  })

  it('omits architecture line when not supplied', () => {
    const text = formatAsAsm([], { generatedAt: 'T' })
    expect(text).not.toContain('; Architecture:')
    expect(text).toContain('; Bytes Revealer disassembly')
  })

  it('marks range as default when endOffset is null', () => {
    const text = formatAsAsm([], {
      architecture: 'x86',
      startOffset: 0x1000,
      endOffset: null,
      generatedAt: 'T'
    })
    expect(text).toContain('; Range: 0x1000 (default range)')
  })

  it('uses an ISO timestamp by default', () => {
    const text = formatAsAsm([], { architecture: 'x86' })
    expect(text).toMatch(/; Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('tolerates instructions missing bytes/mnemonic/operands', () => {
    const text = formatAsAsm([{ address: 0x100 }], { generatedAt: 'T' })
    const ins = text.split('\n').find((l) => l.startsWith('00000000'))
    expect(ins).toMatch(/^0{13}100:/)
  })

  it('ends with a trailing newline', () => {
    expect(formatAsAsm([], {})).toMatch(/\n$/)
    expect(formatAsAsm([{ address: 0, bytes: [0x90], mnemonic: 'nop', opStr: '' }], {})).toMatch(
      /\n$/
    )
  })
})

describe('suggestAsmFilename', () => {
  it('combines arch, mode and start offset into the filename', () => {
    expect(suggestAsmFilename({ architecture: 'x86', mode: '64', startOffset: 0x1000 })).toBe(
      'disassembly_x86-64_0x00001000.asm'
    )
  })

  it('drops the mode segment when missing', () => {
    expect(suggestAsmFilename({ architecture: 'arm64', startOffset: 0 })).toBe(
      'disassembly_arm64_0x00000000.asm'
    )
  })

  it('uses unknown placeholder when arch missing', () => {
    expect(suggestAsmFilename({})).toBe('disassembly_unknown_0x00000000.asm')
  })
})
