import { describe, it, expect } from 'vitest'
import { formatFileSize, validateFileSize, FILE_LIMITS } from './fileHandler.js'

describe('FILE_LIMITS', () => {
  it('has expected constants', () => {
    expect(FILE_LIMITS.WARNING_SIZE).toBe(100 * 1024 * 1024)
    expect(FILE_LIMITS.MAX_SIZE).toBe(500 * 1024 * 1024)
    expect(FILE_LIMITS.CHUNK_SIZE).toBe(256 * 1024)
    expect(FILE_LIMITS.WORKER_TIMEOUT).toBe(30000)
  })
})

describe('formatFileSize()', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0.0 B')
    expect(formatFileSize(512)).toBe('512.0 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB')
  })

  it('does not exceed GB unit', () => {
    // 2 TB should display as GB
    const result = formatFileSize(2 * 1024 * 1024 * 1024 * 1024)
    expect(result).toContain('GB')
  })
})

describe('validateFileSize()', () => {
  it('returns false for file under warning size', () => {
    const file = { size: 50 * 1024 * 1024 }
    expect(validateFileSize(file)).toBe(false)
  })

  it('returns true for file above warning but under max', () => {
    const file = { size: 200 * 1024 * 1024 }
    expect(validateFileSize(file)).toBe(true)
  })

  it('throws for file above max size', () => {
    const file = { size: 600 * 1024 * 1024 }
    expect(() => validateFileSize(file)).toThrow('File too large')
  })

  it('returns false at exactly warning threshold', () => {
    const file = { size: FILE_LIMITS.WARNING_SIZE }
    expect(validateFileSize(file)).toBe(false)
  })
})
