import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useExportRange } from './useExportRange'

describe('useExportRange', () => {
  const createRange = (size = 1024) => useExportRange(ref(size))

  describe('initial state', () => {
    it('range starts empty', () => {
      const { range } = createRange()
      expect(range.value).toEqual({ start: '', end: '' })
    })

    it('rangeValid is false', () => {
      const { rangeValid } = createRange()
      expect(rangeValid.value).toBe(false)
    })

    it('rangeError is empty', () => {
      const { rangeError } = createRange()
      expect(rangeError.value).toBe('')
    })

    it('parsedRange is zeroed', () => {
      const { parsedRange } = createRange()
      expect(parsedRange.value).toEqual({ start: 0, end: 0, length: 0 })
    })
  })

  describe('parseOffset', () => {
    it('returns NaN for empty value', () => {
      const { parseOffset } = createRange()
      expect(parseOffset('')).toBeNaN()
    })

    it('returns NaN for null', () => {
      const { parseOffset } = createRange()
      expect(parseOffset(null)).toBeNaN()
    })

    it('returns NaN for undefined', () => {
      const { parseOffset } = createRange()
      expect(parseOffset(undefined)).toBeNaN()
    })

    it('parses 0x-prefixed hex (lowercase)', () => {
      const { parseOffset } = createRange()
      expect(parseOffset('0xff')).toBe(255)
    })

    it('parses 0X-prefixed hex (uppercase prefix)', () => {
      const { parseOffset } = createRange()
      expect(parseOffset('0XFF')).toBe(255)
    })

    it('parses decimal strings', () => {
      const { parseOffset } = createRange()
      expect(parseOffset('256')).toBe(256)
    })

    it('parses zero', () => {
      const { parseOffset } = createRange()
      expect(parseOffset('0')).toBe(0)
    })

    it('falls back to hex without prefix', () => {
      const { parseOffset } = createRange()
      expect(parseOffset('ff')).toBe(255)
    })

    it('trims whitespace', () => {
      const { parseOffset } = createRange()
      expect(parseOffset('  0x10  ')).toBe(16)
    })

    it('parses large hex values', () => {
      const { parseOffset } = createRange()
      expect(parseOffset('0xFFFFF')).toBe(1048575)
    })
  })

  describe('formatOffset', () => {
    it('formats 0 with padding', () => {
      const { formatOffset } = createRange()
      expect(formatOffset(0)).toBe('0x0000')
    })

    it('formats small values with padding', () => {
      const { formatOffset } = createRange()
      expect(formatOffset(255)).toBe('0x00FF')
    })

    it('formats values that fill 4 chars', () => {
      const { formatOffset } = createRange()
      expect(formatOffset(0xabcd)).toBe('0xABCD')
    })

    it('formats values larger than 4 hex chars without truncation', () => {
      const { formatOffset } = createRange()
      expect(formatOffset(0x1abcde)).toBe('0x1ABCDE')
    })

    it('uses uppercase hex', () => {
      const { formatOffset } = createRange()
      expect(formatOffset(0xabcdef)).toBe('0xABCDEF')
    })
  })

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(500)).toBe('500 B')
    })

    it('formats 0 bytes', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(0)).toBe('0 B')
    })

    it('formats kilobytes', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(2048)).toBe('2.0 KB')
    })

    it('formats fractional kilobytes', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(1536)).toBe('1.5 KB')
    })

    it('formats megabytes', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
    })

    it('formats fractional megabytes', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
    })

    it('boundary: 1023 bytes stays in B', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(1023)).toBe('1023 B')
    })

    it('boundary: 1024 bytes becomes KB', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(1024)).toBe('1.0 KB')
    })

    it('boundary: 1MB - 1 stays in KB', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB')
    })

    it('boundary: exactly 1MB becomes MB', () => {
      const { formatFileSize } = createRange()
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    })
  })

  describe('validateRange', () => {
    it('valid decimal range sets rangeValid and parsedRange', () => {
      const { range, rangeValid, parsedRange, validateRange } = createRange(1024)
      range.value.start = '0'
      range.value.end = '256'
      validateRange()
      expect(rangeValid.value).toBe(true)
      expect(parsedRange.value).toEqual({ start: 0, end: 256, length: 256 })
    })

    it('valid hex range sets rangeValid and parsedRange', () => {
      const { range, rangeValid, parsedRange, validateRange } = createRange(1024)
      range.value.start = '0x00'
      range.value.end = '0x100'
      validateRange()
      expect(rangeValid.value).toBe(true)
      expect(parsedRange.value).toEqual({ start: 0, end: 256, length: 256 })
    })

    it('errors when fileSize is 0', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(0)
      range.value.start = '0'
      range.value.end = '10'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('File size is not available')
    })

    it('no error when fileSize is 0 and inputs are empty', () => {
      const { rangeError, validateRange } = createRange(0)
      validateRange()
      expect(rangeError.value).toBe('')
    })

    it('errors on invalid start offset', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(1024)
      range.value.start = 'zzz'
      range.value.end = '100'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('Invalid start offset')
    })

    it('errors on invalid end offset', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(1024)
      range.value.start = '0'
      range.value.end = 'zzz'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('Invalid end offset')
    })

    it('no error when only start is filled', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(1024)
      range.value.start = '10'
      range.value.end = ''
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('')
    })

    it('no error when only end is filled', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(1024)
      range.value.start = ''
      range.value.end = '10'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('')
    })

    it('errors when start >= end', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(1024)
      range.value.start = '100'
      range.value.end = '50'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('Start offset must be less than end offset')
    })

    it('errors when start equals end', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(1024)
      range.value.start = '100'
      range.value.end = '100'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('Start offset must be less than end offset')
    })

    it('errors when start exceeds file size', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(100)
      range.value.start = '200'
      range.value.end = '300'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toContain('Start offset exceeds file size')
    })

    it('errors when end exceeds file size', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(100)
      range.value.start = '0'
      range.value.end = '200'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toContain('End offset exceeds file size')
    })

    it('allows end equal to file size', () => {
      const { range, rangeValid, validateRange } = createRange(100)
      range.value.start = '0'
      range.value.end = '100'
      validateRange()
      expect(rangeValid.value).toBe(true)
    })

    it('warns for large ranges (>10MB) but still validates', () => {
      const bigSize = 20 * 1024 * 1024
      const { range, rangeValid, rangeError, validateRange } = createRange(bigSize)
      range.value.start = '0'
      range.value.end = String(15 * 1024 * 1024)
      validateRange()
      expect(rangeValid.value).toBe(true)
      expect(rangeError.value).toContain('Warning: Large range')
    })

    it('no warning for ranges exactly 10MB', () => {
      const bigSize = 20 * 1024 * 1024
      const { range, rangeValid, rangeError, validateRange } = createRange(bigSize)
      range.value.start = '0'
      range.value.end = String(10 * 1024 * 1024)
      validateRange()
      expect(rangeValid.value).toBe(true)
      expect(rangeError.value).toBe('')
    })

    it('reacts to dynamic fileSize changes', () => {
      const fileSize = ref(100)
      const { range, rangeValid, rangeError, validateRange } = useExportRange(fileSize)
      range.value.start = '0'
      range.value.end = '200'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toContain('End offset exceeds file size')

      fileSize.value = 500
      validateRange()
      expect(rangeValid.value).toBe(true)
    })

    it('errors on negative start offset', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(1024)
      range.value.start = '-1'
      range.value.end = '100'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('Start offset cannot be negative')
    })

    it('errors on negative end offset', () => {
      const { range, rangeValid, rangeError, validateRange } = createRange(1024)
      range.value.start = '0'
      range.value.end = '-1'
      validateRange()
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('End offset cannot be negative')
    })

    it('resets rangeValid on each call before checking', () => {
      const { range, rangeValid, validateRange } = createRange(1024)
      range.value.start = '0'
      range.value.end = '100'
      validateRange()
      expect(rangeValid.value).toBe(true)

      range.value.end = '2000'
      validateRange()
      expect(rangeValid.value).toBe(false)
    })
  })

  describe('setRange', () => {
    it('sets range from numbers in hex format and validates', () => {
      const { range, rangeValid, parsedRange, setRange } = createRange(1024)
      setRange(0, 256)
      expect(range.value.start).toBe('0x0')
      expect(range.value.end).toBe('0x100')
      expect(rangeValid.value).toBe(true)
      expect(parsedRange.value).toEqual({ start: 0, end: 256, length: 256 })
    })

    it('uses uppercase hex', () => {
      const { range, setRange } = createRange(1024)
      setRange(0, 0xff)
      expect(range.value.end).toBe('0xFF')
    })

    it('handles entire file range', () => {
      const { rangeValid, parsedRange, setRange } = createRange(4096)
      setRange(0, 4096)
      expect(rangeValid.value).toBe(true)
      expect(parsedRange.value.length).toBe(4096)
    })

    it('handles first-256 quick range', () => {
      const { rangeValid, parsedRange, setRange } = createRange(10000)
      setRange(0, 256)
      expect(rangeValid.value).toBe(true)
      expect(parsedRange.value.length).toBe(256)
    })
  })

  describe('clearRange', () => {
    it('resets all range state', () => {
      const { range, rangeValid, rangeError, parsedRange, setRange, clearRange } = createRange(1024)
      setRange(0, 256)
      expect(rangeValid.value).toBe(true)

      clearRange()
      expect(range.value).toEqual({ start: '', end: '' })
      expect(rangeValid.value).toBe(false)
      expect(rangeError.value).toBe('')
      expect(parsedRange.value).toEqual({ start: 0, end: 0, length: 0 })
    })

    it('can be called when already clear', () => {
      const { range, rangeValid, clearRange } = createRange(1024)
      clearRange()
      expect(range.value).toEqual({ start: '', end: '' })
      expect(rangeValid.value).toBe(false)
    })
  })
})
