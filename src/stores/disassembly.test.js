import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDisassemblyStore } from './disassembly.js'

describe('DisassemblyStore', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useDisassemblyStore()
  })

  // ── Initial state ──

  it('starts with default state', () => {
    expect(store.architecture).toBe('x86')
    expect(store.mode).toBe('64')
    expect(store.syntaxStyle).toBe('intel')
    expect(store.startOffset).toBe(0)
    expect(store.endOffset).toBeNull()
    expect(store.instructions).toEqual([])
    expect(store.isDisassembling).toBe(false)
    expect(store.progress).toBe(0)
    expect(store.error).toBeNull()
    expect(store.lastDuration).toBeNull()
    expect(store.lastDisassembledAt).toBeNull()
    expect(store.highlightInHex).toBe(false)
  })

  // ── Getters ──

  describe('getters', () => {
    it('hasResults returns false when no instructions', () => {
      expect(store.hasResults).toBe(false)
    })

    it('hasResults returns true once instructions are present', () => {
      store.instructions = [
        { address: 0x1000, size: 1, mnemonic: 'ret', opStr: '', bytes: new Uint8Array([0xc3]) }
      ]
      expect(store.hasResults).toBe(true)
    })

    it('instructionCount reflects instructions length', () => {
      expect(store.instructionCount).toBe(0)
      store.instructions = [
        { address: 0, size: 1, mnemonic: 'a', opStr: '', bytes: new Uint8Array(1) },
        { address: 1, size: 1, mnemonic: 'b', opStr: '', bytes: new Uint8Array(1) }
      ]
      expect(store.instructionCount).toBe(2)
    })

    it('instructionHighlightBytes is empty when highlight disabled', () => {
      store.instructions = [
        { address: 0x1000, size: 3, mnemonic: 'mov', opStr: '', bytes: new Uint8Array(3) }
      ]
      expect(store.highlightInHex).toBe(false)
      expect(store.instructionHighlightBytes).toEqual([])
    })

    it('instructionHighlightBytes spans every instruction byte when enabled', () => {
      store.highlightInHex = true
      store.instructions = [
        { address: 0x1000, size: 3, mnemonic: 'mov', opStr: '', bytes: new Uint8Array(3) },
        { address: 0x1003, size: 2, mnemonic: 'jmp', opStr: '', bytes: new Uint8Array(2) }
      ]
      const offsets = store.instructionHighlightBytes
      expect(offsets).toEqual(expect.arrayContaining([0x1000, 0x1001, 0x1002, 0x1003, 0x1004]))
      expect(offsets).toHaveLength(5)
    })

    it('instructionHighlightBytes returns [] when over the cap', () => {
      store.highlightInHex = true
      // 1 instruction of 100,001 bytes — over MAX_HIGHLIGHT_BYTES (100,000)
      store.instructions = [
        { address: 0, size: 100001, mnemonic: 'fake', opStr: '', bytes: new Uint8Array(100001) }
      ]
      expect(store.instructionHighlightBytes).toEqual([])
    })

    it('serializableState includes all relevant fields', () => {
      store.architecture = 'arm64'
      store.mode = 'arm'
      store.startOffset = 0x4000
      store.instructions = [
        { address: 0x4000, size: 4, mnemonic: 'ret', opStr: '', bytes: new Uint8Array(4) }
      ]
      store.lastDuration = 12
      const state = store.serializableState
      expect(state.architecture).toBe('arm64')
      expect(state.mode).toBe('arm')
      expect(state.startOffset).toBe(0x4000)
      expect(state.instructions).toHaveLength(1)
      expect(state.lastDuration).toBe(12)
    })
  })

  // ── Actions ──

  describe('actions', () => {
    it('setArchitecture / setMode / setSyntaxStyle update state', () => {
      store.setArchitecture('arm64')
      store.setMode('arm')
      store.setSyntaxStyle('att')
      expect(store.architecture).toBe('arm64')
      expect(store.mode).toBe('arm')
      expect(store.syntaxStyle).toBe('att')
    })

    it('setRange updates startOffset and endOffset together', () => {
      store.setRange(0x2000, 0x3000)
      expect(store.startOffset).toBe(0x2000)
      expect(store.endOffset).toBe(0x3000)
    })

    it('startDisassembly flips the in-progress flags and clears error', () => {
      store.error = 'previous failure'
      store.progress = 42
      store.startDisassembly()
      expect(store.isDisassembling).toBe(true)
      expect(store.progress).toBe(0)
      expect(store.error).toBeNull()
    })

    it('setProgress updates only the progress percentage', () => {
      store.setProgress(50)
      expect(store.progress).toBe(50)
    })

    it('setResults stores instructions, duration, timestamp, and clears progress/error', () => {
      store.startDisassembly()
      store.error = null
      const instructions = [
        { address: 0, size: 1, mnemonic: 'ret', opStr: '', bytes: new Uint8Array([0xc3]) }
      ]
      store.setResults({ instructions, duration: 8 })
      expect(store.instructions).toEqual(instructions)
      expect(store.lastDuration).toBe(8)
      expect(store.lastDisassembledAt).not.toBeNull()
      expect(store.isDisassembling).toBe(false)
      expect(store.progress).toBe(100)
      expect(store.error).toBeNull()
    })

    it('setResults handles missing instructions/duration safely', () => {
      store.setResults({})
      expect(store.instructions).toEqual([])
      expect(store.lastDuration).toBeNull()
    })

    it('setError captures the error and stops the in-progress flag', () => {
      store.startDisassembly()
      store.setError('disasm failed')
      expect(store.error).toBe('disasm failed')
      expect(store.isDisassembling).toBe(false)
      expect(store.progress).toBe(0)
    })

    it('clearResults wipes results but preserves config (arch/mode/syntax/range)', () => {
      store.architecture = 'arm64'
      store.startOffset = 0x2000
      store.instructions = [
        { address: 0x2000, size: 4, mnemonic: 'ret', opStr: '', bytes: new Uint8Array(4) }
      ]
      store.lastDuration = 5
      store.lastDisassembledAt = '2026-05-19T00:00:00Z'
      store.error = 'oops'

      store.clearResults()

      expect(store.instructions).toEqual([])
      expect(store.lastDuration).toBeNull()
      expect(store.lastDisassembledAt).toBeNull()
      expect(store.error).toBeNull()
      expect(store.progress).toBe(0)
      // config preserved
      expect(store.architecture).toBe('arm64')
      expect(store.startOffset).toBe(0x2000)
    })

    it('toggleHexHighlight flips the highlight flag', () => {
      expect(store.highlightInHex).toBe(false)
      store.toggleHexHighlight()
      expect(store.highlightInHex).toBe(true)
      store.toggleHexHighlight()
      expect(store.highlightInHex).toBe(false)
    })

    it('reset returns store to its default state', () => {
      store.architecture = 'arm64'
      store.mode = 'thumb'
      store.instructions = [
        { address: 0, size: 2, mnemonic: 'b', opStr: '#0', bytes: new Uint8Array(2) }
      ]
      store.highlightInHex = true
      store.error = 'something'

      store.reset()

      expect(store.architecture).toBe('x86')
      expect(store.mode).toBe('64')
      expect(store.syntaxStyle).toBe('intel')
      expect(store.instructions).toEqual([])
      expect(store.highlightInHex).toBe(false)
      expect(store.error).toBeNull()
    })

    it('restoreFromSession populates store from a saved snapshot', () => {
      const saved = {
        architecture: 'arm64',
        mode: 'arm',
        syntaxStyle: 'att',
        startOffset: 0x8000,
        endOffset: 0x9000,
        instructions: [
          { address: 0x8000, size: 4, mnemonic: 'ret', opStr: '', bytes: new Uint8Array(4) }
        ],
        lastDuration: 21,
        lastDisassembledAt: '2026-05-19T01:23:45Z',
        highlightInHex: true
      }
      store.restoreFromSession(saved)
      expect(store.architecture).toBe('arm64')
      expect(store.mode).toBe('arm')
      expect(store.syntaxStyle).toBe('att')
      expect(store.startOffset).toBe(0x8000)
      expect(store.endOffset).toBe(0x9000)
      expect(store.instructions).toEqual(saved.instructions)
      expect(store.lastDuration).toBe(21)
      expect(store.highlightInHex).toBe(true)
    })

    it('restoreFromSession is a no-op when given null/undefined', () => {
      const before = { ...store.$state }
      store.restoreFromSession(null)
      expect(store.$state).toEqual(before)
      store.restoreFromSession(undefined)
      expect(store.$state).toEqual(before)
    })

    it('restoreFromSession falls back to defaults for missing keys', () => {
      store.restoreFromSession({})
      expect(store.architecture).toBe('x86')
      expect(store.mode).toBe('64')
      expect(store.startOffset).toBe(0)
      expect(store.instructions).toEqual([])
    })
  })
})
