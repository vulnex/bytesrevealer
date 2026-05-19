import { describe, it, expect } from 'vitest'
import { ADDRESS_HEX_WIDTH, formatDisasmAddress, formatDisasmBytes } from './disasmDisplay.js'

describe('formatDisasmAddress', () => {
  it('pads to the configured width', () => {
    expect(formatDisasmAddress(0x2a9f)).toBe('00002A9F')
    expect(formatDisasmAddress(0x2a9f)).toHaveLength(ADDRESS_HEX_WIDTH)
  })

  it('uppercases hex digits', () => {
    expect(formatDisasmAddress(0xabcd)).toBe('0000ABCD')
  })

  it('returns 0 string for null/undefined input', () => {
    expect(formatDisasmAddress(null)).toBe('00000000')
    expect(formatDisasmAddress(undefined)).toBe('00000000')
  })

  it('does not truncate values larger than the pad width', () => {
    expect(formatDisasmAddress(0x123456789)).toBe('123456789')
  })
})

describe('formatDisasmBytes', () => {
  it('joins bytes with single spaces, two-char hex', () => {
    expect(formatDisasmBytes([0x55])).toBe('55')
    expect(formatDisasmBytes([0x48, 0x89, 0xe5])).toBe('48 89 e5')
    expect(formatDisasmBytes(new Uint8Array([0x0f, 0x00, 0xff]))).toBe('0f 00 ff')
  })

  it('returns empty string for empty / null input', () => {
    expect(formatDisasmBytes([])).toBe('')
    expect(formatDisasmBytes(null)).toBe('')
    expect(formatDisasmBytes(undefined)).toBe('')
  })
})
