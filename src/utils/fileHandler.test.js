import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatFileSize,
  validateFileSize,
  FILE_LIMITS,
  processFileInChunks,
  analyzeFileInChunks,
  calculateFileHashes,
  detectFileType
} from './fileHandler.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal File-like object backed by a Uint8Array */
function createMockFile(bytes, name = 'test.bin') {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return {
    name,
    size: bytes.length,
    arrayBuffer: vi.fn().mockResolvedValue(buffer),
    slice(start, end) {
      const sliced = bytes.slice(start, end)
      const slicedBuf = sliced.buffer.slice(
        sliced.byteOffset,
        sliced.byteOffset + sliced.byteLength
      )
      return {
        size: sliced.length,
        arrayBuffer: vi.fn().mockResolvedValue(slicedBuf)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// FILE_LIMITS
// ---------------------------------------------------------------------------

describe('FILE_LIMITS', () => {
  it('has expected constants', () => {
    expect(FILE_LIMITS.WARNING_SIZE).toBe(100 * 1024 * 1024)
    expect(FILE_LIMITS.MAX_SIZE).toBe(500 * 1024 * 1024)
    expect(FILE_LIMITS.CHUNK_SIZE).toBe(256 * 1024)
    expect(FILE_LIMITS.WORKER_TIMEOUT).toBe(30000)
  })

  it('has ANALYSIS_SIZE_LIMIT of 50MB', () => {
    expect(FILE_LIMITS.ANALYSIS_SIZE_LIMIT).toBe(50 * 1024 * 1024)
  })
})

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

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

  it('formats 1 byte', () => {
    expect(formatFileSize(1)).toBe('1.0 B')
  })

  it('formats 1023 bytes without jumping to KB', () => {
    expect(formatFileSize(1023)).toBe('1023.0 B')
  })

  it('formats fractional KB correctly', () => {
    // 2560 = 2.5 KB
    expect(formatFileSize(2560)).toBe('2.5 KB')
  })

  it('formats exactly 1 GB', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB')
  })
})

// ---------------------------------------------------------------------------
// validateFileSize
// ---------------------------------------------------------------------------

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

  it('returns false for zero-length file', () => {
    const file = { size: 0 }
    expect(validateFileSize(file)).toBe(false)
  })

  it('returns true at exactly MAX_SIZE (boundary)', () => {
    // size > WARNING_SIZE but not > MAX_SIZE, so returns true (warning)
    const file = { size: FILE_LIMITS.MAX_SIZE }
    expect(validateFileSize(file)).toBe(true)
  })

  it('throws at MAX_SIZE + 1', () => {
    const file = { size: FILE_LIMITS.MAX_SIZE + 1 }
    expect(() => validateFileSize(file)).toThrow('File too large')
  })

  it('error message includes formatted max size', () => {
    const file = { size: FILE_LIMITS.MAX_SIZE + 1 }
    expect(() => validateFileSize(file)).toThrow('500.0 MB')
  })

  it('returns true at WARNING_SIZE + 1', () => {
    const file = { size: FILE_LIMITS.WARNING_SIZE + 1 }
    expect(validateFileSize(file)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// processFileInChunks
// ---------------------------------------------------------------------------

describe('processFileInChunks()', () => {
  it('returns Uint8Array of file contents', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const file = createMockFile(data)
    const result = await processFileInChunks(file)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([1, 2, 3, 4, 5])
  })

  it('calls onProgress with 100 when provided', async () => {
    const data = new Uint8Array([10, 20])
    const file = createMockFile(data)
    const onProgress = vi.fn()
    await processFileInChunks(file, {}, onProgress)
    expect(onProgress).toHaveBeenCalledWith(100)
  })

  it('works without onProgress callback', async () => {
    const data = new Uint8Array([0xff])
    const file = createMockFile(data)
    const result = await processFileInChunks(file)
    expect(result.length).toBe(1)
    expect(result[0]).toBe(0xff)
  })

  it('handles empty file', async () => {
    const data = new Uint8Array([])
    const file = createMockFile(data)
    const result = await processFileInChunks(file)
    expect(result.length).toBe(0)
  })

  it('accepts options parameter without error', async () => {
    const data = new Uint8Array([42])
    const file = createMockFile(data)
    const result = await processFileInChunks(file, { someOption: true })
    expect(Array.from(result)).toEqual([42])
  })
})

// ---------------------------------------------------------------------------
// analyzeFileInChunks
// ---------------------------------------------------------------------------

describe('analyzeFileInChunks()', () => {
  beforeEach(() => {
    // happy-dom provides FileReader, but we need to polyfill readAsArrayBuffer
    // so readChunk works inside analyzeFileInChunks.
    if (typeof globalThis.FileReader === 'undefined') {
      globalThis.FileReader = class {
        readAsArrayBuffer(blob) {
          blob.arrayBuffer().then((buf) => {
            this.result = buf
            if (this.onload) this.onload()
          })
        }
      }
    } else {
      const OrigFR = globalThis.FileReader
      // Patch prototype if readAsArrayBuffer doesn't work with our mock blobs
      const origRead = OrigFR.prototype.readAsArrayBuffer
      OrigFR.prototype.readAsArrayBuffer = function (blob) {
        if (blob && typeof blob.arrayBuffer === 'function' && !(blob instanceof Blob)) {
          blob.arrayBuffer().then((buf) => {
            Object.defineProperty(this, 'result', {
              value: buf,
              writable: true,
              configurable: true
            })
            if (this.onload) this.onload()
          })
        } else {
          origRead.call(this, blob)
        }
      }
    }
  })

  it('returns empty results when fileAnalysis option is false', async () => {
    const data = new Uint8Array([1, 2, 3])
    const file = createMockFile(data)
    const result = await analyzeFileInChunks(file, { fileAnalysis: false })
    expect(result.entropy).toBe(0)
    expect(result.strings).toEqual([])
    expect(result.counts).toBeInstanceOf(Uint32Array)
    expect(result.counts.length).toBe(256)
  })

  it('returns empty results when options is empty (no fileAnalysis)', async () => {
    const data = new Uint8Array([1, 2, 3])
    const file = createMockFile(data)
    const result = await analyzeFileInChunks(file, {})
    expect(result.entropy).toBe(0)
  })

  it('returns empty results when options is not provided', async () => {
    const data = new Uint8Array([1, 2, 3])
    const file = createMockFile(data)
    const result = await analyzeFileInChunks(file)
    expect(result.entropy).toBe(0)
  })

  it('counts byte frequencies correctly for uniform bytes', async () => {
    const data = new Uint8Array(100).fill(0x42)
    const file = createMockFile(data)
    const result = await analyzeFileInChunks(file, { fileAnalysis: true })
    expect(result.counts[0x42]).toBe(100)
    // All other counts should be 0
    const nonZeroCounts = Array.from(result.counts).filter((v, i) => i !== 0x42 && v !== 0)
    expect(nonZeroCounts).toEqual([])
  })

  it('calculates entropy of 0 for single-value data', async () => {
    const data = new Uint8Array(256).fill(0xaa)
    const file = createMockFile(data)
    const result = await analyzeFileInChunks(file, { fileAnalysis: true })
    expect(result.entropy).toBe(0)
  })

  it('calculates entropy of ~1.0 for two equally-distributed values', async () => {
    const data = new Uint8Array(256)
    for (let i = 0; i < 256; i++) data[i] = i % 2 === 0 ? 0x00 : 0xff
    const file = createMockFile(data)
    const result = await analyzeFileInChunks(file, { fileAnalysis: true })
    expect(result.entropy).toBeCloseTo(1.0, 1)
  })

  it('calculates entropy of ~8.0 for uniformly distributed bytes', async () => {
    // Need 256*N bytes with each byte value appearing N times
    const data = new Uint8Array(256 * 4)
    for (let rep = 0; rep < 4; rep++) {
      for (let i = 0; i < 256; i++) {
        data[rep * 256 + i] = i
      }
    }
    const file = createMockFile(data)
    const result = await analyzeFileInChunks(file, { fileAnalysis: true })
    expect(result.entropy).toBeCloseTo(8.0, 1)
  })

  it('calls onProgress during analysis', async () => {
    const data = new Uint8Array(100).fill(0)
    const file = createMockFile(data)
    const onProgress = vi.fn()
    await analyzeFileInChunks(file, { fileAnalysis: true }, onProgress)
    expect(onProgress).toHaveBeenCalled()
    // Should reach 100
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
    expect(lastCall).toBe(100)
  })

  it('returns counts as Uint32Array with length 256', async () => {
    const data = new Uint8Array(10).fill(0)
    const file = createMockFile(data)
    const result = await analyzeFileInChunks(file, { fileAnalysis: true })
    expect(result.counts).toBeInstanceOf(Uint32Array)
    expect(result.counts.length).toBe(256)
  })
})

// ---------------------------------------------------------------------------
// calculateFileHashes
// ---------------------------------------------------------------------------

describe('calculateFileHashes()', () => {
  it('returns md5, sha1, sha256 for a simple buffer', async () => {
    const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
    const file = createMockFile(data)
    const hashes = await calculateFileHashes(file)
    expect(hashes).toHaveProperty('md5')
    expect(hashes).toHaveProperty('sha1')
    expect(hashes).toHaveProperty('sha256')
    // Each hash should be a hex string
    expect(hashes.md5).toMatch(/^[0-9a-f]+$/)
    expect(hashes.sha1).toMatch(/^[0-9a-f]+$/)
    expect(hashes.sha256).toMatch(/^[0-9a-f]+$/)
  })

  it('returns consistent hashes for the same data', async () => {
    const data = new Uint8Array([1, 2, 3, 4])
    const file1 = createMockFile(data)
    const file2 = createMockFile(new Uint8Array([1, 2, 3, 4]))
    const h1 = await calculateFileHashes(file1)
    const h2 = await calculateFileHashes(file2)
    expect(h1.md5).toBe(h2.md5)
    expect(h1.sha1).toBe(h2.sha1)
    expect(h1.sha256).toBe(h2.sha256)
  })

  it('returns different hashes for different data', async () => {
    const file1 = createMockFile(new Uint8Array([1, 2, 3]))
    const file2 = createMockFile(new Uint8Array([4, 5, 6]))
    const h1 = await calculateFileHashes(file1)
    const h2 = await calculateFileHashes(file2)
    expect(h1.md5).not.toBe(h2.md5)
    expect(h1.sha256).not.toBe(h2.sha256)
  })

  it('md5 is 32 hex chars', async () => {
    const file = createMockFile(new Uint8Array([0]))
    const hashes = await calculateFileHashes(file)
    expect(hashes.md5.length).toBe(32)
  })

  it('sha1 is 40 hex chars', async () => {
    const file = createMockFile(new Uint8Array([0]))
    const hashes = await calculateFileHashes(file)
    expect(hashes.sha1.length).toBe(40)
  })

  it('sha256 is 64 hex chars', async () => {
    const file = createMockFile(new Uint8Array([0]))
    const hashes = await calculateFileHashes(file)
    expect(hashes.sha256.length).toBe(64)
  })

  it('handles empty file', async () => {
    const file = createMockFile(new Uint8Array([]))
    const hashes = await calculateFileHashes(file)
    expect(hashes.md5).toMatch(/^[0-9a-f]+$/)
    expect(hashes.sha1).toMatch(/^[0-9a-f]+$/)
    expect(hashes.sha256).toMatch(/^[0-9a-f]+$/)
  })

  it('handles file whose length is not a multiple of 4', async () => {
    // 5 bytes - tests the (bytes[i+1] || 0) etc. padding paths
    const file = createMockFile(new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]))
    const hashes = await calculateFileHashes(file)
    expect(hashes.md5).toMatch(/^[0-9a-f]{32}$/)
  })

  it('handles file with length 1', async () => {
    const file = createMockFile(new Uint8Array([0xff]))
    const hashes = await calculateFileHashes(file)
    expect(hashes.sha256.length).toBe(64)
  })

  it('handles file with length 2', async () => {
    const file = createMockFile(new Uint8Array([0xab, 0xcd]))
    const hashes = await calculateFileHashes(file)
    expect(hashes.sha256.length).toBe(64)
  })

  it('handles file with length 3', async () => {
    const file = createMockFile(new Uint8Array([0xab, 0xcd, 0xef]))
    const hashes = await calculateFileHashes(file)
    expect(hashes.sha256.length).toBe(64)
  })
})

// ---------------------------------------------------------------------------
// detectFileType
// ---------------------------------------------------------------------------

describe('detectFileType()', () => {
  describe('with Uint8Array input', () => {
    it('detects PNG from magic bytes', async () => {
      const png = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...Array(20).fill(0)
      ])
      const result = await detectFileType(png)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('png')
      expect(result.mime).toBe('image/png')
      expect(result.confidence).toBe('high')
    })

    it('detects JPEG from magic bytes', async () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(20).fill(0)])
      const result = await detectFileType(jpeg)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('jpg')
      expect(result.confidence).toBe('high')
    })

    it('detects GIF87a', async () => {
      // "GIF87a"
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, ...Array(20).fill(0)])
      const result = await detectFileType(gif)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('gif')
      expect(result.mime).toBe('image/gif')
    })

    it('detects GIF89a', async () => {
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...Array(20).fill(0)])
      const result = await detectFileType(gif)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('gif')
    })

    it('detects ZIP from PK magic bytes (PK\\x03\\x04)', async () => {
      const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...Array(20).fill(0)])
      const result = await detectFileType(zip)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('zip')
      expect(result.mime).toBe('application/zip')
    })

    it('detects ZIP from PK\\x05\\x06 (empty archive)', async () => {
      const zip = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...Array(20).fill(0)])
      const result = await detectFileType(zip)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('zip')
    })

    it('detects ZIP from PK\\x07\\x08 (spanned archive)', async () => {
      const zip = new Uint8Array([0x50, 0x4b, 0x07, 0x08, ...Array(20).fill(0)])
      const result = await detectFileType(zip)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('zip')
    })

    it('detects RAR from magic bytes', async () => {
      // Rar!
      const rar = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, ...Array(20).fill(0)])
      const result = await detectFileType(rar)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('rar')
      expect(result.mime).toBe('application/x-rar-compressed')
    })

    it('detects 7-Zip from magic bytes', async () => {
      const sevenZ = new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, ...Array(20).fill(0)])
      const result = await detectFileType(sevenZ)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('7z')
      expect(result.mime).toBe('application/x-7z-compressed')
    })

    it('detects PDF from magic bytes', async () => {
      // %PDF
      const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...Array(20).fill(0)])
      const result = await detectFileType(pdf)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('pdf')
      expect(result.mime).toBe('application/pdf')
    })

    it('detects EXE (MZ header)', async () => {
      const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, ...Array(20).fill(0)])
      const result = await detectFileType(exe)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('exe')
      expect(result.mime).toBe('application/x-msdownload')
    })

    it('detects ELF executable', async () => {
      // \x7fELF
      const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, ...Array(20).fill(0)])
      const result = await detectFileType(elf)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('elf')
      expect(result.mime).toBe('application/x-elf')
    })

    it('detects Mach-O big-endian 64-bit (FEEDFACF)', async () => {
      const macho = new Uint8Array([0xfe, 0xed, 0xfa, 0xcf, ...Array(24).fill(0)])
      const result = await detectFileType(macho)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('macho')
      expect(result.mime).toBe('application/x-mach-binary')
    })

    it('detects Mach-O big-endian 32-bit (FEEDFACE)', async () => {
      const macho = new Uint8Array([0xfe, 0xed, 0xfa, 0xce, ...Array(24).fill(0)])
      const result = await detectFileType(macho)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('macho')
    })

    it('detects Mach-O little-endian 64-bit (CFFAEDFE)', async () => {
      const macho = new Uint8Array([0xcf, 0xfa, 0xed, 0xfe, ...Array(24).fill(0)])
      const result = await detectFileType(macho)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('macho')
    })

    it('detects Mach-O little-endian 32-bit (CEFAEDFE)', async () => {
      const macho = new Uint8Array([0xce, 0xfa, 0xed, 0xfe, ...Array(24).fill(0)])
      const result = await detectFileType(macho)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('macho')
    })

    it('returns unknown for unrecognized binary', async () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, ...Array(20).fill(0x80)])
      const result = await detectFileType(data)
      expect(result.detected).toBe(false)
      expect(result.ext).toBe('unknown')
      expect(result.mime).toBe('application/octet-stream')
      expect(result.confidence).toBe('none')
    })

    it('returns unknown for data shorter than 4 bytes', async () => {
      const data = new Uint8Array([0x01, 0x02, 0x80])
      const result = await detectFileType(data)
      // Too short for most magic + binary bytes -> unknown
      expect(result.ext).toBe('unknown')
    })

    it('slices input to at most 1MB', async () => {
      // Create a 2MB array filled with zeros (not text-like: use 0x80)
      const bigData = new Uint8Array(2 * 1024 * 1024).fill(0x80)
      const result = await detectFileType(bigData)
      // Should not throw; just returns a result
      expect(result).toHaveProperty('ext')
    })
  })

  describe('text file detection', () => {
    function textBytes(str) {
      return new TextEncoder().encode(str)
    }

    it('detects XML files', async () => {
      const xml = textBytes('<?xml version="1.0" encoding="UTF-8"?>\n<root></root>')
      const result = await detectFileType(xml)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('xml')
      expect(result.mime).toBe('application/xml')
    })

    it('detects HTML files with DOCTYPE', async () => {
      const html = textBytes('<!DOCTYPE html>\n<html><body>Hello</body></html>')
      const result = await detectFileType(html)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('html')
      expect(result.mime).toBe('text/html')
    })

    it('detects HTML files with <html> tag', async () => {
      const html = textBytes('<html lang="en"><body>test</body></html>')
      const result = await detectFileType(html)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('html')
    })

    it('detects JSON objects', async () => {
      const json = textBytes('{"key": "value", "num": 42}')
      const result = await detectFileType(json)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('json')
      expect(result.mime).toBe('application/json')
    })

    it('detects JSON arrays', async () => {
      const json = textBytes('[1, 2, 3]')
      const result = await detectFileType(json)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('json')
    })

    it('detects plain text files', async () => {
      const text = textBytes('This is a plain text file with some content.\nLine 2.\n')
      const result = await detectFileType(text)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('txt')
      expect(result.mime).toBe('text/plain')
      expect(result.confidence).toBe('medium')
    })

    it('does not detect binary data as text', async () => {
      // Mostly non-printable bytes
      const binary = new Uint8Array(200)
      for (let i = 0; i < 200; i++) binary[i] = i % 256 < 32 ? i % 256 : 0x80 + (i % 128)
      const result = await detectFileType(binary)
      expect(result.ext).not.toBe('txt')
    })

    it('detects text that starts with { but is not valid JSON as txt', async () => {
      const text = textBytes('{ this is not json, it is just text content }')
      const result = await detectFileType(text)
      expect(result.detected).toBe(true)
      // Should fall through to plain text since JSON.parse fails
      expect(result.ext).toBe('txt')
    })
  })

  describe('with invalid input', () => {
    it('returns error result for non-File non-Uint8Array input', async () => {
      const result = await detectFileType('not a file')
      expect(result.detected).toBe(false)
      expect(result.ext).toBe('unknown')
      expect(result.error).toBeDefined()
    })

    it('returns error result for null input', async () => {
      const result = await detectFileType(null)
      expect(result.detected).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error result for number input', async () => {
      const result = await detectFileType(42)
      expect(result.detected).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error result for plain object input', async () => {
      const result = await detectFileType({ data: [1, 2, 3] })
      expect(result.detected).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('with File input', () => {
    it('detects PNG from a File object', async () => {
      const pngBytes = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...Array(20).fill(0)
      ])
      const blob = new Blob([pngBytes], { type: 'image/png' })
      const file = new File([blob], 'image.png', { type: 'image/png' })
      const result = await detectFileType(file)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('png')
    })

    it('detects EXE from a File object', async () => {
      const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, ...Array(60).fill(0)])
      const blob = new Blob([exeBytes])
      const file = new File([blob], 'program.exe')
      const result = await detectFileType(file)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('exe')
    })

    it('handles empty File gracefully', async () => {
      const blob = new Blob([])
      const file = new File([blob], 'empty.bin')
      const result = await detectFileType(file)
      // Should not throw; returns some result
      expect(result).toHaveProperty('ext')
    })
  })

  describe('Mach-O fat binary (CAFEBABE) detection', () => {
    /**
     * Build a valid Mach-O Universal Binary header.
     * fat_header: CA FE BA BE + nfat_arch (4 bytes big-endian)
     * Each fat_arch: cputype(4) + cpusubtype(4) + offset(4) + size(4) + align(4) = 20 bytes
     */
    function buildFatMachO(nfat, cputype) {
      const size = 8 + nfat * 20
      const bytes = new Uint8Array(size)
      // Magic: CA FE BA BE
      bytes[0] = 0xca
      bytes[1] = 0xfe
      bytes[2] = 0xba
      bytes[3] = 0xbe
      // nfat_arch big-endian
      bytes[4] = (nfat >>> 24) & 0xff
      bytes[5] = (nfat >>> 16) & 0xff
      bytes[6] = (nfat >>> 8) & 0xff
      bytes[7] = nfat & 0xff
      // First fat_arch cputype big-endian
      bytes[8] = (cputype >>> 24) & 0xff
      bytes[9] = (cputype >>> 16) & 0xff
      bytes[10] = (cputype >>> 8) & 0xff
      bytes[11] = cputype & 0xff
      return bytes
    }

    it('detects Mach-O fat binary with x86_64 architecture', async () => {
      const bytes = buildFatMachO(2, 0x01000007) // x86_64
      const result = await detectFileType(bytes)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('macho')
      expect(result.mime).toBe('application/x-mach-binary')
      expect(result.description).toContain('Universal Binary')
      expect(result.description).toContain('2')
      expect(result.confidence).toBe('high')
    })

    it('detects Mach-O fat binary with ARM architecture', async () => {
      const bytes = buildFatMachO(1, 12) // ARM
      const result = await detectFileType(bytes)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('macho')
    })

    it('detects Mach-O fat binary with x86 architecture', async () => {
      const bytes = buildFatMachO(3, 7) // x86
      const result = await detectFileType(bytes)
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('macho')
      expect(result.description).toContain('3')
    })

    it('does not detect CAFEBABE as Mach-O when nfat_arch is invalid (too large)', async () => {
      // nfat_arch = 100 -> invalid, isMachOFatBinary returns false
      const bytes = new Uint8Array(28)
      bytes[0] = 0xca
      bytes[1] = 0xfe
      bytes[2] = 0xba
      bytes[3] = 0xbe
      bytes[7] = 100 // nfat_arch = 100 (>20, invalid)
      const result = await detectFileType(bytes)
      // Should NOT be detected as macho; file-type library may detect as class
      // or it falls through to unknown
      expect(result).toHaveProperty('ext')
      if (result.ext === 'macho') {
        // This should not happen for an invalid fat binary
        throw new Error('Should not detect invalid fat binary as Mach-O')
      }
    })

    it('does not detect CAFEBABE with nfat_arch=0 as Mach-O', async () => {
      const bytes = new Uint8Array(28)
      bytes[0] = 0xca
      bytes[1] = 0xfe
      bytes[2] = 0xba
      bytes[3] = 0xbe
      // nfat_arch = 0
      const result = await detectFileType(bytes)
      expect(result.ext).not.toBe('macho')
    })
  })

  describe('empty / edge-case Uint8Arrays', () => {
    it('handles empty Uint8Array', async () => {
      const result = await detectFileType(new Uint8Array([]))
      expect(result).toHaveProperty('ext')
      expect(result.detected).toBe(true)
      // Empty data: 0/0 textRatio is NaN, NaN < 0.85 is false,
      // so it falls through to text detection which returns txt
      expect(result.ext).toBe('txt')
    })

    it('handles single-byte Uint8Array', async () => {
      const result = await detectFileType(new Uint8Array([0x00]))
      expect(result).toHaveProperty('ext')
    })

    it('handles two-byte Uint8Array', async () => {
      const result = await detectFileType(new Uint8Array([0x4d, 0x5a]))
      // MZ header (EXE) requires only 2 bytes
      expect(result.detected).toBe(true)
      expect(result.ext).toBe('exe')
    })
  })

  describe('PK bytes that do not match any ZIP variant', () => {
    it('PK with non-matching third/fourth bytes is not detected as zip', async () => {
      // PK\x01\x02 is not a recognized zip start signature
      const data = new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...Array(20).fill(0x80)])
      const result = await detectFileType(data)
      // Should NOT be zip (may be unknown or other)
      expect(result.ext).not.toBe('zip')
    })
  })

  describe('getFileTypeDescription coverage via file-type library', () => {
    it('returns description with ext name for uncommon extension', async () => {
      // The file-type library detects various formats. Test that the
      // description fallback works for known extensions.
      // We can verify this via the description field on detected types.
      const png = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...Array(20).fill(0)
      ])
      const result = await detectFileType(png)
      expect(result.description).toBe('PNG Image')
    })
  })
})

// ---------------------------------------------------------------------------
// calculateFileHashes error handling
// ---------------------------------------------------------------------------

describe('calculateFileHashes() error handling', () => {
  it('throws when arrayBuffer fails', async () => {
    const file = {
      size: 10,
      arrayBuffer: vi.fn().mockRejectedValue(new Error('Read error'))
    }
    await expect(calculateFileHashes(file)).rejects.toThrow('Read error')
  })
})

// ---------------------------------------------------------------------------
// analyzeFileInChunks error handling
// ---------------------------------------------------------------------------

describe('analyzeFileInChunks() error handling', () => {
  it('throws when readChunk fails', async () => {
    // Create a mock file where slice returns a blob that triggers FileReader error
    const failFile = {
      size: 100,
      slice() {
        return {
          size: 100,
          arrayBuffer: vi.fn().mockRejectedValue(new Error('Chunk read failed'))
        }
      }
    }

    // Patch FileReader to call onerror for our mock blobs
    const OrigFR = globalThis.FileReader
    const origRead = OrigFR.prototype.readAsArrayBuffer
    OrigFR.prototype.readAsArrayBuffer = function (blob) {
      if (blob && typeof blob.arrayBuffer === 'function' && !(blob instanceof Blob)) {
        // Simulate error
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('Chunk read failed'))
        }, 0)
      } else {
        origRead.call(this, blob)
      }
    }

    await expect(analyzeFileInChunks(failFile, { fileAnalysis: true })).rejects.toThrow()

    // Restore
    OrigFR.prototype.readAsArrayBuffer = origRead
  })

  it('works without onProgress when fileAnalysis is enabled', async () => {
    // Patch FileReader for mock files
    const OrigFR = globalThis.FileReader
    const origRead = OrigFR.prototype.readAsArrayBuffer
    OrigFR.prototype.readAsArrayBuffer = function (blob) {
      if (blob && typeof blob.arrayBuffer === 'function' && !(blob instanceof Blob)) {
        blob.arrayBuffer().then((buf) => {
          Object.defineProperty(this, 'result', {
            value: buf,
            writable: true,
            configurable: true
          })
          if (this.onload) this.onload()
        })
      } else {
        origRead.call(this, blob)
      }
    }

    const data = new Uint8Array(50).fill(0x10)
    const file = createMockFile(data)
    // No onProgress callback
    const result = await analyzeFileInChunks(file, { fileAnalysis: true })
    expect(result.counts[0x10]).toBe(50)
    expect(result.entropy).toBe(0) // single value -> 0 entropy

    OrigFR.prototype.readAsArrayBuffer = origRead
  })
})

// ---------------------------------------------------------------------------
// detectFileType with mocked file-type library (manual fallback paths)
// ---------------------------------------------------------------------------

describe('detectFileType() manual fallback paths', () => {
  // These tests use vi.hoisted + vi.mock to test the detectCommonFormats
  // and detectTextFileType fallback paths that only run when
  // fileTypeFromBuffer returns null.
  // Since vi.mock must be at the top level, we use a separate describe
  // block with dynamic imports to get a version with mocked file-type.

  let detectFileTypeFallback

  beforeEach(async () => {
    vi.resetModules()

    // Mock file-type to always return null (simulate library not detecting)
    vi.doMock('file-type', () => ({
      fileTypeFromBuffer: vi.fn().mockResolvedValue(null)
    }))

    // Mock logger to avoid noise
    vi.doMock('./logger', () => ({
      createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      })
    }))

    const mod = await import('./fileHandler.js')
    detectFileTypeFallback = mod.detectFileType
  })

  it('fallback detects ZIP via PK\\x03\\x04', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(zip)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('zip')
    expect(result.description).toBe('ZIP Archive')
  })

  it('fallback detects ZIP via PK\\x05\\x06', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(zip)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('zip')
  })

  it('fallback detects ZIP via PK\\x07\\x08', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x07, 0x08, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(zip)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('zip')
  })

  it('fallback detects RAR', async () => {
    const rar = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(rar)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('rar')
    expect(result.mime).toBe('application/x-rar-compressed')
    expect(result.description).toBe('RAR Archive')
  })

  it('fallback detects 7-Zip', async () => {
    const sevenZ = new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(sevenZ)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('7z')
    expect(result.mime).toBe('application/x-7z-compressed')
    expect(result.description).toBe('7-Zip Archive')
  })

  it('fallback detects PDF', async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(pdf)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('pdf')
    expect(result.mime).toBe('application/pdf')
    expect(result.description).toBe('PDF Document')
  })

  it('fallback detects PNG', async () => {
    const png = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...Array(20).fill(0)
    ])
    const result = await detectFileTypeFallback(png)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('png')
    expect(result.mime).toBe('image/png')
    expect(result.description).toBe('PNG Image')
  })

  it('fallback detects JPEG', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(jpeg)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('jpg')
    expect(result.mime).toBe('image/jpeg')
    expect(result.description).toBe('JPEG Image')
  })

  it('fallback detects GIF87a', async () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(gif)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('gif')
    expect(result.mime).toBe('image/gif')
    expect(result.description).toBe('GIF Image')
  })

  it('fallback detects GIF89a', async () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(gif)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('gif')
  })

  it('fallback detects EXE (MZ header)', async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(exe)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('exe')
    expect(result.mime).toBe('application/x-msdownload')
    expect(result.description).toBe('Windows Executable')
  })

  it('fallback detects ELF executable', async () => {
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, ...Array(20).fill(0)])
    const result = await detectFileTypeFallback(elf)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('elf')
    expect(result.mime).toBe('application/x-elf')
    expect(result.description).toBe('ELF Executable')
  })

  it('fallback detects Mach-O big-endian 64-bit', async () => {
    const macho = new Uint8Array([0xfe, 0xed, 0xfa, 0xcf, ...Array(24).fill(0)])
    const result = await detectFileTypeFallback(macho)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('macho')
    expect(result.description).toBe('Mach-O Binary')
  })

  it('fallback detects Mach-O little-endian 32-bit', async () => {
    const macho = new Uint8Array([0xce, 0xfa, 0xed, 0xfe, ...Array(24).fill(0)])
    const result = await detectFileTypeFallback(macho)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('macho')
  })

  it('fallback detects Mach-O fat binary (CAFEBABE)', async () => {
    // Build valid fat binary header: 1 arch with x86_64 CPU type
    const size = 8 + 1 * 20
    const bytes = new Uint8Array(size)
    bytes[0] = 0xca
    bytes[1] = 0xfe
    bytes[2] = 0xba
    bytes[3] = 0xbe
    bytes[7] = 1 // nfat_arch = 1
    // cputype = 0x01000007 (x86_64)
    bytes[8] = 0x01
    bytes[9] = 0x00
    bytes[10] = 0x00
    bytes[11] = 0x07
    const result = await detectFileTypeFallback(bytes)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('macho')
    expect(result.description).toContain('Universal Binary')
  })

  it('fallback detects XML text file', async () => {
    const xml = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?>\n<root></root>')
    const result = await detectFileTypeFallback(xml)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('xml')
  })

  it('fallback detects HTML text file', async () => {
    const html = new TextEncoder().encode('<!DOCTYPE html>\n<html><body>Hello</body></html>')
    const result = await detectFileTypeFallback(html)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('html')
  })

  it('fallback detects JSON text file', async () => {
    const json = new TextEncoder().encode('{"key": "value"}')
    const result = await detectFileTypeFallback(json)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('json')
  })

  it('fallback detects plain text', async () => {
    const text = new TextEncoder().encode('This is a plain text file.\n')
    const result = await detectFileTypeFallback(text)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('txt')
  })

  it('fallback returns unknown for unrecognized binary', async () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, ...Array(20).fill(0x80)])
    const result = await detectFileTypeFallback(data)
    expect(result.detected).toBe(false)
    expect(result.ext).toBe('unknown')
  })

  it('fallback returns null from detectCommonFormats for data shorter than 4 bytes', async () => {
    const data = new Uint8Array([0x01, 0x02, 0x80])
    const result = await detectFileTypeFallback(data)
    // 3 bytes binary -> detectCommonFormats returns null, detectTextFileType returns null
    expect(result.ext).toBe('unknown')
  })

  it('fallback does not detect PK with unrecognized sub-signature', async () => {
    const data = new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...Array(20).fill(0x80)])
    const result = await detectFileTypeFallback(data)
    expect(result.ext).not.toBe('zip')
  })
})

// ---------------------------------------------------------------------------
// detectFileType - file-type lib returns 'class' for CAFEBABE (Mach-O override)
// ---------------------------------------------------------------------------

describe('detectFileType() Mach-O override when file-type returns class', () => {
  let detectFileTypeMachoOverride

  beforeEach(async () => {
    vi.resetModules()

    // Mock file-type to return ext:'class' for CAFEBABE bytes (simulates
    // the misidentification of Mach-O fat binaries as Java class files)
    vi.doMock('file-type', () => ({
      fileTypeFromBuffer: vi.fn().mockResolvedValue({ ext: 'class', mime: 'application/java-vm' })
    }))

    vi.doMock('./logger', () => ({
      createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      })
    }))

    const mod = await import('./fileHandler.js')
    detectFileTypeMachoOverride = mod.detectFileType
  })

  it('overrides class detection for valid Mach-O fat binary with x86_64', async () => {
    // Build valid fat binary: 2 arches, cputype x86_64 = 0x01000007
    const size = 8 + 2 * 20
    const bytes = new Uint8Array(size)
    bytes[0] = 0xca
    bytes[1] = 0xfe
    bytes[2] = 0xba
    bytes[3] = 0xbe
    bytes[7] = 2 // nfat_arch = 2
    bytes[8] = 0x01
    bytes[9] = 0x00
    bytes[10] = 0x00
    bytes[11] = 0x07 // x86_64
    const result = await detectFileTypeMachoOverride(bytes)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('macho')
    expect(result.mime).toBe('application/x-mach-binary')
    expect(result.description).toContain('Universal Binary')
    expect(result.description).toContain('2')
  })

  it('overrides class detection for valid Mach-O fat binary with ARM', async () => {
    const size = 8 + 1 * 20
    const bytes = new Uint8Array(size)
    bytes[0] = 0xca
    bytes[1] = 0xfe
    bytes[2] = 0xba
    bytes[3] = 0xbe
    bytes[7] = 1
    bytes[11] = 12 // ARM cputype = 12
    const result = await detectFileTypeMachoOverride(bytes)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('macho')
  })

  it('does not override for non-CAFEBABE bytes when file-type returns class', async () => {
    // Not CAFEBABE, but file-type says class
    const bytes = new Uint8Array(28)
    bytes[0] = 0x00
    bytes[1] = 0x00
    bytes[2] = 0x00
    bytes[3] = 0x00
    const result = await detectFileTypeMachoOverride(bytes)
    // Should keep the class detection, mapped to getFileTypeDescription('class')
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('class')
  })

  it('does not override when CAFEBABE but nfat_arch is invalid', async () => {
    // CAFEBABE but nfat_arch = 0 (invalid)
    const bytes = new Uint8Array(48)
    bytes[0] = 0xca
    bytes[1] = 0xfe
    bytes[2] = 0xba
    bytes[3] = 0xbe
    bytes[7] = 0 // nfat_arch = 0 -> first condition fails (nfat < 1)
    const result = await detectFileTypeMachoOverride(bytes)
    // The inline check: nfat >= 1 && nfat <= 20 fails, so no override
    expect(result.ext).toBe('class')
  })

  it('does not override when CAFEBABE but unknown CPU type', async () => {
    const size = 8 + 1 * 20
    const bytes = new Uint8Array(size)
    bytes[0] = 0xca
    bytes[1] = 0xfe
    bytes[2] = 0xba
    bytes[3] = 0xbe
    bytes[7] = 1
    // cputype = 0xFF (not in the known list)
    bytes[8] = 0x00
    bytes[9] = 0x00
    bytes[10] = 0x00
    bytes[11] = 0xff
    const result = await detectFileTypeMachoOverride(bytes)
    // Unknown CPU type -> no override, stays as class
    expect(result.ext).toBe('class')
  })
})

// ---------------------------------------------------------------------------
// detectFileType with file-type library throwing error
// ---------------------------------------------------------------------------

describe('detectFileType() when file-type library throws', () => {
  let detectFileTypeErrorLib

  beforeEach(async () => {
    vi.resetModules()

    vi.doMock('file-type', () => ({
      fileTypeFromBuffer: vi.fn().mockRejectedValue(new Error('Library error'))
    }))

    vi.doMock('./logger', () => ({
      createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      })
    }))

    const mod = await import('./fileHandler.js')
    detectFileTypeErrorLib = mod.detectFileType
  })

  it('falls through to manual detection when file-type throws', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...Array(20).fill(0)])
    const result = await detectFileTypeErrorLib(zip)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('zip')
  })

  it('falls through to text detection when file-type throws for text', async () => {
    const text = new TextEncoder().encode('Hello world, this is a plain text.\n')
    const result = await detectFileTypeErrorLib(text)
    expect(result.detected).toBe(true)
    expect(result.ext).toBe('txt')
  })

  it('returns unknown when file-type throws and no manual match', async () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, ...Array(20).fill(0x80)])
    const result = await detectFileTypeErrorLib(data)
    expect(result.detected).toBe(false)
    expect(result.ext).toBe('unknown')
  })
})
