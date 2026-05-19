/**
 * VULNEX -Bytes Revealer-
 *
 * File: disassembly.js
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Last Modified: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { defineStore } from 'pinia'
import { createLogger } from '../utils/logger'
import { buildXrefMap } from '../utils/disasmXref'

const logger = createLogger('DisassemblyStore')

const MAX_HIGHLIGHT_BYTES = 100000

export const useDisassemblyStore = defineStore('disassembly', {
  state: () => ({
    architecture: 'x86',
    mode: '64',
    syntaxStyle: 'intel',
    startOffset: 0,
    endOffset: null,
    instructions: [],
    isDisassembling: false,
    progress: 0,
    error: null,
    lastDuration: null,
    lastDisassembledAt: null,
    highlightInHex: false,
    // Address of the instruction the user has selected in the listing. UI
    // state only — not part of serializableState, cleared on reset.
    selectedAddress: null
  }),

  getters: {
    hasResults: (state) => state.instructions.length > 0,

    instructionCount: (state) => state.instructions.length,

    selectedInstruction: (state) => {
      if (state.selectedAddress == null) return null
      return state.instructions.find((i) => i.address === state.selectedAddress) || null
    },

    // Map<targetAddr, sourceAddr[]> — built once per instructions change.
    xrefMap: (state) => buildXrefMap(state.instructions),

    // Set<address> of every decoded instruction — used by the listing to
    // decide whether a branch target is in-range and therefore navigable.
    instructionAddressSet: (state) => {
      const set = new Set()
      for (const i of state.instructions) set.add(i.address)
      return set
    },

    instructionHighlightBytes: (state) => {
      if (!state.highlightInHex) return []
      const bytes = new Set()
      for (const insn of state.instructions) {
        for (let i = 0; i < insn.size; i++) {
          bytes.add(insn.address + i)
          if (bytes.size > MAX_HIGHLIGHT_BYTES) {
            return []
          }
        }
      }
      return Array.from(bytes)
    },

    serializableState: (state) => ({
      architecture: state.architecture,
      mode: state.mode,
      syntaxStyle: state.syntaxStyle,
      startOffset: state.startOffset,
      endOffset: state.endOffset,
      instructions: state.instructions,
      lastDuration: state.lastDuration,
      lastDisassembledAt: state.lastDisassembledAt,
      highlightInHex: state.highlightInHex
    })
  },

  actions: {
    setArchitecture(arch) {
      this.architecture = arch
    },

    setMode(mode) {
      this.mode = mode
    },

    setSyntaxStyle(style) {
      this.syntaxStyle = style
    },

    setRange(start, end) {
      this.startOffset = start
      this.endOffset = end
    },

    startDisassembly() {
      this.isDisassembling = true
      this.progress = 0
      this.error = null
    },

    setProgress(progress) {
      this.progress = progress
    },

    setResults({ instructions, duration }) {
      this.instructions = instructions || []
      this.lastDuration = duration ?? null
      this.lastDisassembledAt = new Date().toISOString()
      this.isDisassembling = false
      this.progress = 100
      this.error = null
      logger.info(
        `Disassembly complete: ${this.instructions.length} instructions in ${duration ?? '?'} ms`
      )
    },

    setError(error) {
      this.error = error
      this.isDisassembling = false
      this.progress = 0
    },

    clearResults() {
      this.instructions = []
      this.lastDuration = null
      this.lastDisassembledAt = null
      this.progress = 0
      this.error = null
      this.selectedAddress = null
    },

    toggleHexHighlight() {
      this.highlightInHex = !this.highlightInHex
    },

    selectInstruction(address) {
      this.selectedAddress = address
    },

    clearSelectedInstruction() {
      this.selectedAddress = null
    },

    reset() {
      logger.debug('Resetting Disassembly store')
      this.architecture = 'x86'
      this.mode = '64'
      this.syntaxStyle = 'intel'
      this.startOffset = 0
      this.endOffset = null
      this.instructions = []
      this.isDisassembling = false
      this.progress = 0
      this.error = null
      this.lastDuration = null
      this.lastDisassembledAt = null
      this.highlightInHex = false
      this.selectedAddress = null
    },

    restoreFromSession(savedState) {
      if (!savedState) return
      logger.debug('Restoring Disassembly state from session')
      this.architecture = savedState.architecture || 'x86'
      this.mode = savedState.mode || '64'
      this.syntaxStyle = savedState.syntaxStyle || 'intel'
      this.startOffset = savedState.startOffset ?? 0
      this.endOffset = savedState.endOffset ?? null
      this.instructions = savedState.instructions || []
      this.lastDuration = savedState.lastDuration ?? null
      this.lastDisassembledAt = savedState.lastDisassembledAt ?? null
      this.highlightInHex = !!savedState.highlightInHex
    }
  }
})
