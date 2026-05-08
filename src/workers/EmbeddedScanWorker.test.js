import { describe, it, expect, vi } from 'vitest'
import { createScanState, processChunk, VALIDATION_LOOKAHEAD } from './EmbeddedScanWorker.js'

// Minimal ELF64 LE x86-64 fixture (64-byte header, all section-table fields zero).
function buildELF() {
  const buf = new Uint8Array(64)
  buf[0] = 0x7f
  buf[1] = 0x45
  buf[2] = 0x4c
  buf[3] = 0x46
  buf[4] = 2 // EI_CLASS = 64-bit
  buf[5] = 1 // EI_DATA = LE
  buf[6] = 1 // EI_VERSION
  // e_machine x86_64 (0x3e) at 0x12 LE
  buf[0x12] = 0x3e
  buf[0x13] = 0x00
  return buf
}

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrays) {
    out.set(a, off)
    off += a.length
  }
  return out
}

describe('EmbeddedScanWorker.processChunk', () => {
  it('detects an embedded ELF in a single chunk', () => {
    const elf = buildELF()
    const data = concat(new Uint8Array(1000).fill(0xaa), elf, new Uint8Array(500))
    const findings = []
    const state = createScanState(data.length)
    const result = processChunk(state, 0, data, {
      onFinding: (f) => findings.push(f),
      isFinal: true
    })
    expect(result.done).toBe(true)
    expect(findings).toHaveLength(1)
    expect(findings[0].format).toBe('ELF')
    expect(findings[0].offset).toBe(1000)
  })

  it('detects an ELF that straddles a chunk boundary', () => {
    const elf = buildELF()
    // Place ELF magic so its first 2 bytes are in chunk 0, rest in chunk 1
    const prefix = new Uint8Array(98).fill(0xaa)
    const full = concat(prefix, elf, new Uint8Array(200))

    const split = 100 // ELF magic is 98..101, splits between chunks
    const chunk0 = full.subarray(0, split)
    const chunk1 = full.subarray(split)

    const findings = []
    const state = createScanState(full.length)
    processChunk(state, 0, chunk0, { onFinding: (f) => findings.push(f) })
    processChunk(state, split, chunk1, { onFinding: (f) => findings.push(f), isFinal: true })

    expect(findings).toHaveLength(1)
    expect(findings[0].offset).toBe(98)
  })

  it('throws on chunk gap or overlap', () => {
    const state = createScanState(10000)
    processChunk(state, 0, new Uint8Array(1000))
    expect(() => processChunk(state, 500, new Uint8Array(500), { isFinal: true })).toThrow(
      /gap or overlap/
    )
  })

  it('honors cancel signal between chunks', () => {
    const state = createScanState(1024 * 1024)
    let cancel = false
    const r1 = processChunk(state, 0, new Uint8Array(256 * 1024), {
      shouldCancel: () => cancel
    })
    expect(r1.done).toBe(false)
    cancel = true
    const r2 = processChunk(state, 256 * 1024, new Uint8Array(256 * 1024), {
      shouldCancel: () => cancel
    })
    expect(r2.cancelled).toBe(true)
    expect(r2.done).toBe(true)
  })

  it('reports progress with absolute scanned/total', () => {
    const data = new Uint8Array(3 * 1024 * 1024)
    const state = createScanState(data.length)
    const onProgress = vi.fn()
    processChunk(state, 0, data, { onProgress, isFinal: true })
    expect(onProgress).toHaveBeenCalled()
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]
    expect(lastCall[1]).toBe(data.length)
    expect(lastCall[0]).toBeLessThanOrEqual(data.length)
  })

  it('caps total findings at maxFindings across chunks', () => {
    const elf = buildELF()
    const gap = new Uint8Array(8192)
    // 5 ELFs spread out
    const data = concat(elf, gap, elf, gap, elf, gap, elf, gap, elf)
    const findings = []
    const state = createScanState(data.length, { maxFindings: 2 })
    // skipFirstMatch is on at offset 0 → first ELF is skipped, but we want to count
    // findings, not test skip. Place a prefix to disable skipFirstMatch.
    const prefixed = concat(new Uint8Array(100).fill(0xaa), data)
    const state2 = createScanState(prefixed.length, { maxFindings: 2 })
    const result = processChunk(state2, 0, prefixed, {
      onFinding: (f) => findings.push(f),
      isFinal: true
    })
    expect(findings).toHaveLength(2)
    expect(result.truncated).toBe(true)
    expect(state.findingCount).toBe(0)
  })

  it('defers trailing bytes for validation lookahead on non-final chunks', () => {
    // Build a buffer where ELF magic is positioned in the trailing reserve
    // window of chunk 0, so the worker should defer detection until chunk 1.
    const elf = buildELF()
    const chunkSize = 256 * 1024
    const elfPos = chunkSize - 100 // inside the VALIDATION_LOOKAHEAD reserve of chunk 0
    const data = new Uint8Array(chunkSize + 1024)
    data.set(elf, elfPos)

    const chunk0 = data.subarray(0, chunkSize)
    const chunk1 = data.subarray(chunkSize)

    const findings = []
    const state = createScanState(data.length)

    const r1 = processChunk(state, 0, chunk0, { onFinding: (f) => findings.push(f) })
    expect(r1.done).toBe(false)
    // Should still be detected after chunk1 arrives — the deferred bytes carry over.
    processChunk(state, chunkSize, chunk1, {
      onFinding: (f) => findings.push(f),
      isFinal: true
    })

    expect(findings).toHaveLength(1)
    expect(findings[0].offset).toBe(elfPos)
  })

  it('sets isFinal automatically when chunk reaches totalSize', () => {
    const elf = buildELF()
    const data = concat(new Uint8Array(50).fill(0xaa), elf, new Uint8Array(50))
    const findings = []
    const state = createScanState(data.length)
    // No explicit isFinal — but chunkStart + chunk.length === totalSize, so worker treats it as final.
    const r = processChunk(state, 0, data, { onFinding: (f) => findings.push(f) })
    expect(r.done).toBe(true)
    expect(findings).toHaveLength(1)
  })

  it('exposes VALIDATION_LOOKAHEAD as a positive number', () => {
    expect(VALIDATION_LOOKAHEAD).toBeGreaterThan(0)
  })

  it('clears state after second processChunk call when truncated', () => {
    const elf = buildELF()
    const data = concat(new Uint8Array(100), elf, new Uint8Array(8192), elf)
    const state = createScanState(data.length, { maxFindings: 1 })
    const findings = []
    const r = processChunk(state, 0, data, {
      onFinding: (f) => findings.push(f),
      isFinal: true
    })
    expect(findings).toHaveLength(1)
    expect(r.truncated).toBe(true)
    // Subsequent call should short-circuit
    const r2 = processChunk(state, 0, data, {
      onFinding: (f) => findings.push(f)
    })
    expect(r2.done).toBe(true)
    expect(findings).toHaveLength(1)
  })
})
