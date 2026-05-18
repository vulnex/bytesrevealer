/**
 * VULNEX -Bytes Revealer-
 *
 * File: DisasmWorker.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-18
 * Last Modified: 2026-05-18
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Web Worker for code disassembly via capstone-wasm.
 * Lazily initializes WASM on first scan and keeps the instance warm.
 */

let capstoneReady = false
let capstoneModule = null

async function initCapstone() {
  if (!capstoneReady) {
    capstoneModule = await import('capstone-wasm')
    await capstoneModule.loadCapstone()
    capstoneReady = true
  }
  return capstoneModule
}

// Stable Capstone v5 API constants. Hardcoded here so this map can be
// unit-tested without loading the WASM module.
const ARCH = { x86: 3, arm: 0, arm64: 1, mips: 2, ppc: 4 }
const MODE = {
  16: 1 << 1,
  32: 1 << 2,
  64: 1 << 3,
  arm: 0,
  thumb: 1 << 4,
  mips32: 1 << 2,
  mips64: 1 << 3
}
const SYNTAX = { intel: 1, att: 2 }

export function resolveArchMode(arch, mode) {
  const archConst = ARCH[arch]
  if (archConst === undefined) {
    throw new Error(`Unsupported architecture: ${arch}`)
  }
  const modeConst = MODE[mode]
  if (modeConst === undefined) {
    throw new Error(`Unsupported mode for ${arch}: ${mode}`)
  }
  return { archConst, modeConst }
}

export function resolveSyntax(syntax) {
  return SYNTAX[syntax] ?? null
}

/**
 * Convert a capstone-wasm Insn into a plain, postMessage-cloneable object.
 * Coerces bigint address to Number — file offsets fit safely in MAX_SAFE_INTEGER.
 */
export function serializeInstruction(insn) {
  return {
    id: insn.id,
    address: Number(insn.address),
    size: insn.size,
    bytes: insn.bytes,
    mnemonic: insn.mnemonic,
    opStr: insn.opStr
  }
}

self.onmessage = async function (event) {
  if (!event.data || typeof event.data.type !== 'string') {
    self.postMessage({ type: 'error', error: 'Invalid message format' })
    return
  }

  const { type, data } = event.data

  switch (type) {
    case 'disassemble':
      try {
        if (
          !data ||
          !data.bytes ||
          typeof data.arch !== 'string' ||
          typeof data.mode !== 'string'
        ) {
          self.postMessage({
            type: 'error',
            error: 'Invalid disassemble message: missing bytes, arch, or mode'
          })
          return
        }

        self.postMessage({ type: 'progress', progress: 5 })
        const startTime = performance.now()

        const { Capstone, Const } = await initCapstone()
        self.postMessage({ type: 'progress', progress: 20 })

        const { archConst, modeConst } = resolveArchMode(data.arch, data.mode)
        const cs = new Capstone(archConst, modeConst)

        if (data.arch === 'x86' && data.syntax) {
          const syntaxConst = resolveSyntax(data.syntax)
          if (syntaxConst !== null) {
            cs.setOption(Const.CS_OPT_SYNTAX, syntaxConst)
          }
        }

        const rawInstructions = cs.disasm(data.bytes, {
          address: data.baseAddress ?? 0,
          count: data.count
        })
        cs.close()

        self.postMessage({ type: 'progress', progress: 90 })

        const instructions = rawInstructions.map(serializeInstruction)
        const duration = Math.round(performance.now() - startTime)

        self.postMessage({ type: 'complete', instructions, duration })
      } catch (error) {
        self.postMessage({ type: 'error', error: error.message || String(error) })
      }
      break

    default:
      break
  }
}
