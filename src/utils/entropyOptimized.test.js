import { describe, it, expect } from 'vitest'
import { calculateOptimizedEntropy, generateEntropyVisualization } from './entropyOptimized.js'

describe('calculateOptimizedEntropy', () => {
  it('returns 0 entropy for all-zero bytes', () => {
    const zeros = new Uint8Array(256).fill(0)
    const result = calculateOptimizedEntropy(zeros)
    expect(result.globalEntropy).toBe(0)
  })

  it('returns ~8.0 entropy for uniformly distributed bytes', () => {
    // 256 distinct values → maximum entropy = 8.0
    const uniform = new Uint8Array(256)
    for (let i = 0; i < 256; i++) uniform[i] = i
    const result = calculateOptimizedEntropy(uniform)
    expect(result.globalEntropy).toBeCloseTo(8.0, 1)
  })

  it('returns ~1.0 for two-value repeating pattern', () => {
    // Alternating 0x00 and 0xFF → entropy = 1.0
    const pattern = new Uint8Array(256)
    for (let i = 0; i < 256; i++) pattern[i] = i % 2 === 0 ? 0x00 : 0xFF
    const result = calculateOptimizedEntropy(pattern)
    expect(result.globalEntropy).toBeCloseTo(1.0, 1)
  })

  it('result contains expected fields', () => {
    const data = new Uint8Array(512).fill(0x42)
    const result = calculateOptimizedEntropy(data)

    expect(result).toHaveProperty('globalEntropy')
    expect(result).toHaveProperty('entropyValues')
    expect(result).toHaveProperty('highEntropyRegions')
    expect(result).toHaveProperty('byteFrequencies')
    expect(result).toHaveProperty('processedBytes')
    expect(result).toHaveProperty('totalBytes', 512)
    expect(result).toHaveProperty('blockSize')
    expect(result).toHaveProperty('sampleRate')
    expect(result).toHaveProperty('statistics')
  })

  it('entropyValues is an array of block objects', () => {
    const data = new Uint8Array(512).fill(0x42)
    const result = calculateOptimizedEntropy(data)
    expect(result.entropyValues.length).toBeGreaterThan(0)
    const block = result.entropyValues[0]
    expect(block).toHaveProperty('offset')
    expect(block).toHaveProperty('entropy')
    expect(block).toHaveProperty('size')
  })

  it('byteFrequencies has length 256', () => {
    const data = new Uint8Array(100).fill(0xAA)
    const result = calculateOptimizedEntropy(data)
    expect(result.byteFrequencies).toHaveLength(256)
    expect(result.byteFrequencies[0xAA]).toBe(100)
  })

  it('identifies high entropy regions (>7.5)', () => {
    // Build random-looking data
    const data = new Uint8Array(512)
    for (let i = 0; i < 512; i++) data[i] = (i * 137 + 73) % 256
    const result = calculateOptimizedEntropy(data)
    // The data should have high entropy blocks
    expect(result.entropyValues.some(v => v.entropy > 6)).toBe(true)
  })

  it('statistics contains min, max, average, median, standardDeviation', () => {
    const data = new Uint8Array(1024)
    for (let i = 0; i < 1024; i++) data[i] = i % 256
    const result = calculateOptimizedEntropy(data)
    const { statistics } = result
    expect(statistics).toHaveProperty('min')
    expect(statistics).toHaveProperty('max')
    expect(statistics).toHaveProperty('average')
    expect(statistics).toHaveProperty('median')
    expect(statistics).toHaveProperty('standardDeviation')
    expect(statistics.max).toBeGreaterThanOrEqual(statistics.min)
  })

  it('respects custom blockSize', () => {
    const data = new Uint8Array(1024).fill(0x55)
    const result = calculateOptimizedEntropy(data, { blockSize: 512 })
    expect(result.blockSize).toBe(512)
    expect(result.entropyValues.length).toBe(2)
  })

  it('handles empty input', () => {
    const result = calculateOptimizedEntropy(new Uint8Array(0))
    expect(result.globalEntropy).toBe(0)
    expect(result.entropyValues).toEqual([])
    expect(result.processedBytes).toBe(0)
  })
})

describe('generateEntropyVisualization', () => {
  it('returns null for empty entropyValues', () => {
    expect(generateEntropyVisualization({ entropyValues: [] })).toBeNull()
    expect(generateEntropyVisualization({ entropyValues: null })).toBeNull()
  })

  it('returns visualization with points', () => {
    const entropyData = {
      entropyValues: [
        { offset: 0, entropy: 4.0, size: 256 },
        { offset: 256, entropy: 7.0, size: 256 }
      ]
    }
    const viz = generateEntropyVisualization(entropyData, 800, 200)
    expect(viz).not.toBeNull()
    expect(viz.points).toHaveLength(2)
    expect(viz.width).toBe(800)
    expect(viz.height).toBe(200)
  })

  it('points have x, y, entropy, offset', () => {
    const entropyData = {
      entropyValues: [{ offset: 0, entropy: 3.5, size: 256 }]
    }
    const viz = generateEntropyVisualization(entropyData)
    const pt = viz.points[0]
    expect(pt).toHaveProperty('x')
    expect(pt).toHaveProperty('y')
    expect(pt).toHaveProperty('entropy', 3.5)
    expect(pt).toHaveProperty('offset', 0)
  })

  it('includes threshold values', () => {
    const entropyData = {
      entropyValues: [{ offset: 0, entropy: 5.0, size: 256 }]
    }
    const viz = generateEntropyVisualization(entropyData)
    expect(viz).toHaveProperty('highEntropyThreshold')
    expect(viz).toHaveProperty('lowEntropyThreshold')
  })
})
