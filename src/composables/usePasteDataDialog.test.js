import { describe, it, expect } from 'vitest'
import { usePasteDataDialog, getDefaultName, formatPasteSize } from './usePasteDataDialog.js'
import { MAX_PASTE_SIZE, LARGE_PASTE_WARNING } from '../utils/bytesParser.js'

describe('usePasteDataDialog', () => {
  describe('initial state', () => {
    it('starts with empty text, auto format, default name', () => {
      const { rawText, format, name } = usePasteDataDialog()
      expect(rawText.value).toBe('')
      expect(format.value).toBe('auto')
      expect(name.value).toMatch(/^pasted-\d{4}-\d{2}-\d{2}-\d{6}\.bin$/)
    })

    it('canSubmit is false when text is empty', () => {
      const { canSubmit } = usePasteDataDialog()
      expect(canSubmit.value).toBe(false)
    })

    it('reports idle statusClass when text is empty', () => {
      const { statusClass } = usePasteDataDialog()
      expect(statusClass.value).toBe('idle')
    })
  })

  describe('parsing reactivity', () => {
    it('parses valid hex when text is set', () => {
      const { rawText, parseResult, byteCount, canSubmit } = usePasteDataDialog()
      rawText.value = '90 90 31 c0'
      expect(parseResult.value.ok).toBe(true)
      expect(byteCount.value).toBe(4)
      expect(canSubmit.value).toBe(true)
    })

    it('reports error for invalid hex with explicit format hint', () => {
      const { rawText, format, parseResult, canSubmit, statusClass } = usePasteDataDialog()
      format.value = 'hex'
      rawText.value = '90zz'
      expect(parseResult.value.ok).toBe(false)
      expect(canSubmit.value).toBe(false)
      expect(statusClass.value).toBe('error')
    })

    it('re-parses when format changes', () => {
      const { rawText, format, parseResult } = usePasteDataDialog()
      rawText.value = 'hello'
      format.value = 'auto'
      expect(parseResult.value.ok).toBe(true)
      expect(parseResult.value.format).toBe('text')
      format.value = 'hex'
      expect(parseResult.value.ok).toBe(false) // 'hello' has 'h', 'l' — invalid hex
    })

    it('preview shows first 16 bytes as hex', () => {
      const { rawText, preview } = usePasteDataDialog()
      rawText.value = '90 90 31 c0'
      expect(preview.value).toBe('90 90 31 c0')
    })

    it('preview ellipsizes long results', () => {
      const { rawText, preview } = usePasteDataDialog()
      // 20 bytes of hex
      rawText.value = '00'.repeat(20)
      expect(preview.value).toMatch(/\.\.\.$/)
    })

    it('formatLabel reflects detected format under auto', () => {
      const { rawText, formatLabel } = usePasteDataDialog()
      rawText.value = '\\x90\\x90'
      expect(formatLabel.value).toMatch(/escaped/i)
    })
  })

  describe('size gating', () => {
    it('rejects pastes over MAX_PASTE_SIZE via oversized flag', () => {
      const { rawText, oversized, canSubmit, statusClass } = usePasteDataDialog()
      // Synthesize a hex string that decodes to > MAX_PASTE_SIZE bytes.
      // Each hex pair = 1 byte, so we need MAX_PASTE_SIZE * 2 + 2 hex chars.
      rawText.value = '00'.repeat(MAX_PASTE_SIZE + 1)
      expect(oversized.value).toBe(true)
      expect(canSubmit.value).toBe(false)
      expect(statusClass.value).toBe('error')
    })

    it('flags large pastes (>10MB, ≤50MB) but still allows submit', () => {
      const { rawText, largePaste, canSubmit, statusClass } = usePasteDataDialog()
      // 11MB worth of bytes = 22MB of hex chars
      rawText.value = '00'.repeat(LARGE_PASTE_WARNING + 1024)
      expect(largePaste.value).toBe(true)
      expect(canSubmit.value).toBe(true)
      expect(statusClass.value).toBe('warning')
    })

    it('small pastes report success statusClass', () => {
      const { rawText, statusClass } = usePasteDataDialog()
      rawText.value = '90 90 31 c0'
      expect(statusClass.value).toBe('success')
    })
  })

  describe('reset()', () => {
    it('clears text and resets format/name to defaults', () => {
      const { rawText, format, name, reset } = usePasteDataDialog()
      rawText.value = 'some text'
      format.value = 'hex'
      name.value = 'custom.bin'
      reset()
      expect(rawText.value).toBe('')
      expect(format.value).toBe('auto')
      expect(name.value).toMatch(/^pasted-\d{4}-\d{2}-\d{2}-\d{6}\.bin$/)
    })
  })
})

describe('getDefaultName', () => {
  it('produces a timestamped name with .bin extension', () => {
    const fixed = new Date('2026-05-08T18:14:32')
    expect(getDefaultName(fixed)).toBe('pasted-2026-05-08-181432.bin')
  })

  it('zero-pads single-digit components', () => {
    const fixed = new Date('2026-01-02T03:04:05')
    expect(getDefaultName(fixed)).toBe('pasted-2026-01-02-030405.bin')
  })

  it('uses current time when called with no argument', () => {
    expect(getDefaultName()).toMatch(/^pasted-\d{4}-\d{2}-\d{2}-\d{6}\.bin$/)
  })
})

describe('formatPasteSize', () => {
  it('formats bytes', () => {
    expect(formatPasteSize(512)).toBe('512 B')
  })

  it('formats KB with one decimal', () => {
    expect(formatPasteSize(1536)).toBe('1.5 KB')
  })

  it('formats MB with one decimal', () => {
    expect(formatPasteSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})
