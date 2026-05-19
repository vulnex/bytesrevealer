/**
 * VULNEX -Bytes Revealer-
 *
 * File: disasmFormatter.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Render a disassembly result (capstone-style instructions) as plain
 * objdump-style .asm text suitable for download / clipboard.
 */

const ADDR_PAD = 16
const BYTES_COLUMN_WIDTH = 24
const MNEMONIC_COLUMN_WIDTH = 8

function formatAddress(addr) {
  return addr.toString(16).padStart(ADDR_PAD, '0')
}

function formatBytes(bytes) {
  if (!bytes || !bytes.length) return ''
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}

function padRight(s, width) {
  return s.length >= width ? s + ' ' : s + ' '.repeat(width - s.length)
}

export function formatAsAsm(instructions, options = {}) {
  const { architecture, mode, syntaxStyle, startOffset, endOffset, generatedAt } = options

  const lines = []
  lines.push('; Bytes Revealer disassembly')
  if (architecture) {
    const archLine = mode
      ? `; Architecture: ${architecture}/${mode}`
      : `; Architecture: ${architecture}`
    lines.push(archLine)
  }
  if (syntaxStyle) lines.push(`; Syntax: ${syntaxStyle}`)
  if (Number.isFinite(startOffset)) {
    const range =
      endOffset != null && Number.isFinite(endOffset)
        ? `0x${startOffset.toString(16)} - 0x${endOffset.toString(16)}`
        : `0x${startOffset.toString(16)} (default range)`
    lines.push(`; Range: ${range}`)
  }
  lines.push(`; Generated: ${generatedAt || new Date().toISOString()}`)
  lines.push(`; Instructions: ${instructions ? instructions.length : 0}`)
  lines.push('')

  if (!instructions || !instructions.length) {
    lines.push('; (no instructions)')
    return lines.join('\n') + '\n'
  }

  for (const ins of instructions) {
    const addr = formatAddress(ins.address ?? 0)
    const bytes = padRight(formatBytes(ins.bytes), BYTES_COLUMN_WIDTH)
    const mnemonic = padRight(ins.mnemonic || '', MNEMONIC_COLUMN_WIDTH)
    const operands = ins.opStr || ''
    lines.push(`${addr}:  ${bytes}${mnemonic}${operands}`.trimEnd())
  }

  return lines.join('\n') + '\n'
}

export function suggestAsmFilename(options = {}) {
  const { architecture = 'unknown', mode = '', startOffset = 0 } = options
  const archToken = mode ? `${architecture}-${mode}` : architecture
  const addr = startOffset.toString(16).padStart(8, '0')
  return `disassembly_${archToken}_0x${addr}.asm`
}
