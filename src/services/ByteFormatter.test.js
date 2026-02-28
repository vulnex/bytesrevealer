import { describe, it, expect } from 'vitest'
import formatter from './ByteFormatter.js'

const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
const empty = new Uint8Array([])

describe('ByteFormatter', () => {
  // ── format() dispatch ──

  describe('format()', () => {
    it('dispatches to the correct formatter', () => {
      const result = formatter.format(bytes, 'hex')
      expect(result).toBe('deadbeef')
    })

    it('throws on unknown format', () => {
      expect(() => formatter.format(bytes, 'nope')).toThrow('Unknown format: nope')
    })
  })

  // ── getAvailableFormats() ──

  describe('getAvailableFormats()', () => {
    it('returns categories with format entries', () => {
      const formats = formatter.getAvailableFormats()
      expect(formats).toHaveProperty('javascript')
      expect(formats).toHaveProperty('python')
      expect(formats).toHaveProperty('c')
      expect(formats).toHaveProperty('data')
      expect(formats.javascript[0]).toHaveProperty('id')
      expect(formats.javascript[0]).toHaveProperty('name')
    })
  })

  // ── JavaScript formats ──

  describe('JavaScript formatters', () => {
    it('formatJSUint8Array - empty', () => {
      expect(formatter.format(empty, 'js-uint8')).toBe('const data = new Uint8Array();')
    })

    it('formatJSUint8Array - small', () => {
      const result = formatter.format(bytes, 'js-uint8')
      expect(result).toContain('new Uint8Array([')
      expect(result).toContain('0xde')
      expect(result).toContain('0xef')
    })

    it('formatJSArray - empty', () => {
      expect(formatter.format(empty, 'js-array')).toBe('const data = [];')
    })

    it('formatJSArray - small', () => {
      const result = formatter.format(bytes, 'js-array')
      expect(result).toContain('const data = [')
      expect(result).toContain('0xde')
    })

    it('formatJSHexString', () => {
      const result = formatter.format(bytes, 'js-hex')
      expect(result).toBe('const data = "deadbeef";')
    })

    it('formatJSBase64', () => {
      const result = formatter.format(bytes, 'js-base64')
      expect(result).toContain('const data = "')
      expect(result).toContain('";')
      // The base64 of 0xDE 0xAD 0xBE 0xEF
      expect(result).toContain('3q2+7w==')
    })

    it('custom variable name', () => {
      const result = formatter.format(bytes, 'js-hex', { variableName: 'buf' })
      expect(result).toContain('const buf')
    })
  })

  // ── Python formats ──

  describe('Python formatters', () => {
    it('formatPythonBytes - empty', () => {
      expect(formatter.format(empty, 'python-bytes')).toBe('data = b""')
    })

    it('formatPythonBytes - small', () => {
      const result = formatter.format(bytes, 'python-bytes')
      expect(result).toContain('data = b"')
      expect(result).toContain('\\xde')
    })

    it('formatPythonByteArray - empty', () => {
      expect(formatter.format(empty, 'python-bytearray')).toBe('data = bytearray()')
    })

    it('formatPythonByteArray - small', () => {
      const result = formatter.format(bytes, 'python-bytearray')
      expect(result).toContain('bytearray([')
    })

    it('formatPythonList - empty', () => {
      expect(formatter.format(empty, 'python-list')).toBe('data = []')
    })

    it('formatPythonHexString', () => {
      const result = formatter.format(bytes, 'py-hex')
      expect(result).toBe('data = "deadbeef"')
    })
  })

  // ── C/C++ formats ──

  describe('C/C++ formatters', () => {
    it('formatCArray - empty', () => {
      expect(formatter.format(empty, 'c-array')).toBe('unsigned char data[] = {};')
    })

    it('formatCArray - small', () => {
      const result = formatter.format(bytes, 'c-array')
      expect(result).toContain('unsigned char data[]')
      expect(result).toContain('0xde')
    })

    it('formatCUint8Array - empty', () => {
      expect(formatter.format(empty, 'c-uint8')).toBe('uint8_t data[] = {};')
    })

    it('formatCppVector - empty', () => {
      expect(formatter.format(empty, 'cpp-vector')).toBe('std::vector<uint8_t> data;')
    })

    it('formatCppVector - small', () => {
      const result = formatter.format(bytes, 'cpp-vector')
      expect(result).toContain('std::vector<uint8_t> data = {')
    })

    it('formatCHexString', () => {
      const result = formatter.format(bytes, 'c-hex')
      expect(result).toContain('const char* data = "')
      expect(result).toContain('\\xde')
    })
  })

  // ── Java formats ──

  describe('Java formatters', () => {
    it('formatJavaArray - empty', () => {
      expect(formatter.format(empty, 'java-array')).toBe('byte[] data = new byte[0];')
    })

    it('formatJavaArray - signed byte conversion', () => {
      const result = formatter.format(new Uint8Array([0, 127, 128, 255]), 'java-array')
      expect(result).toContain('0, 127, -128, -1')
    })

    it('formatJavaList', () => {
      const result = formatter.format(bytes, 'java-list')
      expect(result).toContain('List<Byte>')
      expect(result).toContain('Arrays.asList(')
    })

    it('formatJavaHexString', () => {
      const result = formatter.format(bytes, 'java-hex')
      expect(result).toBe('String data = "deadbeef";')
    })
  })

  // ── C# formats ──

  describe('C# formatters', () => {
    it('formatCSharpArray - empty', () => {
      expect(formatter.format(empty, 'csharp-array')).toBe('byte[] data = new byte[0];')
    })

    it('formatCSharpList', () => {
      const result = formatter.format(bytes, 'csharp-list')
      expect(result).toContain('List<byte>')
      expect(result).toContain('0xde')
    })

    it('formatCSharpHexString', () => {
      const result = formatter.format(bytes, 'csharp-hex')
      expect(result).toBe('string data = "deadbeef";')
    })
  })

  // ── Go formats ──

  describe('Go formatters', () => {
    it('formatGoSlice - empty', () => {
      expect(formatter.format(empty, 'go-slice')).toBe('var data []byte')
    })

    it('formatGoSlice - small', () => {
      const result = formatter.format(bytes, 'go-slice')
      expect(result).toContain('[]byte{')
      expect(result).toContain('0xde')
    })

    it('formatGoArray', () => {
      const result = formatter.format(bytes, 'go-array')
      expect(result).toContain(`[${bytes.length}]byte{`)
    })

    it('formatGoHexString', () => {
      expect(formatter.format(bytes, 'go-hex')).toBe('data := "deadbeef"')
    })
  })

  // ── Rust formats ──

  describe('Rust formatters', () => {
    it('formatRustVec - empty', () => {
      expect(formatter.format(empty, 'rust-vec')).toBe('let data: Vec<u8> = vec![];')
    })

    it('formatRustVec - small', () => {
      const result = formatter.format(bytes, 'rust-vec')
      expect(result).toContain('vec![')
      expect(result).toContain('0xde')
    })

    it('formatRustArray', () => {
      const result = formatter.format(bytes, 'rust-array')
      expect(result).toContain(`[u8; ${bytes.length}]`)
    })

    it('formatRustHexString', () => {
      expect(formatter.format(bytes, 'rust-hex')).toBe('let data = "deadbeef";')
    })
  })

  // ── Data formats ──

  describe('Data formatters', () => {
    it('hex lowercase', () => {
      expect(formatter.format(bytes, 'hex')).toBe('deadbeef')
    })

    it('hex uppercase', () => {
      expect(formatter.format(bytes, 'hex', { uppercase: true })).toBe('DEADBEEF')
    })

    it('hex-spaced', () => {
      expect(formatter.format(bytes, 'hex-spaced')).toBe('de ad be ef')
    })

    it('base64', () => {
      expect(formatter.format(bytes, 'base64')).toBe('3q2+7w==')
    })

    it('binary', () => {
      const result = formatter.format(new Uint8Array([0xff, 0x00]), 'binary')
      expect(result).toContain('11111111')
      expect(result).toContain('00000000')
    })

    it('decimal', () => {
      const result = formatter.format(bytes, 'decimal')
      expect(result).toContain('222')
      expect(result).toContain('173')
    })

    it('escape sequences', () => {
      const result = formatter.format(bytes, 'escape')
      expect(result).toContain('\\xDE')
    })

    it('escape-single', () => {
      const result = formatter.format(bytes, 'escape-single')
      expect(result).toMatch(/^'.*'$/)
    })

    it('escape-double', () => {
      const result = formatter.format(bytes, 'escape-double')
      expect(result).toMatch(/^".*"$/)
    })

    it('csv with header', () => {
      const result = formatter.format(bytes, 'csv')
      const lines = result.split('\n')
      expect(lines[0]).toContain('Offset')
      expect(lines[1]).toContain('0x00000000')
    })
  })

  // ── Assembler formats ──

  describe('Assembler formatters', () => {
    it('asm-db', () => {
      const result = formatter.format(bytes, 'asm-db')
      expect(result).toContain('db ')
      expect(result).toContain('0DEh')
    })

    it('asm-nasm', () => {
      const result = formatter.format(bytes, 'asm-nasm')
      expect(result).toContain('data:')
      expect(result).toContain('db ')
      expect(result).toContain('data_len equ $ - data')
    })

    it('asm-masm', () => {
      const result = formatter.format(bytes, 'asm-masm')
      expect(result).toContain('data DB')
    })

    it('asm-gas', () => {
      const result = formatter.format(bytes, 'asm-gas')
      expect(result).toContain('data:')
      expect(result).toContain('.byte ')
      expect(result).toContain('.equ data_len, . - data')
    })
  })

  // ── C Language formats ──

  describe('C Language formatters', () => {
    it('clang-array - empty', () => {
      expect(formatter.format(empty, 'clang-array')).toBe('unsigned char data[] = {};')
    })

    it('clang-init', () => {
      const result = formatter.format(bytes, 'clang-init')
      expect(result).toContain('#define DATA_SIZE 4')
      expect(result).toContain('unsigned char data[DATA_SIZE]')
    })

    it('clang-string', () => {
      const result = formatter.format(new Uint8Array([0x41, 0x42, 0x00, 0xff]), 'clang-string')
      expect(result).toContain('AB')
      expect(result).toContain('\\x00')
      expect(result).toContain('\\xff')
    })

    it('clang-macro', () => {
      const result = formatter.format(bytes, 'clang-macro')
      expect(result).toContain('#define DATA_SIZE 4')
      expect(result).toContain('#define DATA { \\')
    })
  })

  // ── Multi-line splitting ──

  describe('Multi-line splitting', () => {
    const big = new Uint8Array(32).fill(0xaa)

    it('JS Uint8Array splits across lines', () => {
      const result = formatter.format(big, 'js-uint8', { lineWidth: 16 })
      expect(result.split('\n').length).toBeGreaterThan(2)
    })

    it('splitLines: false keeps single line', () => {
      const result = formatter.format(big, 'js-uint8', { splitLines: false })
      expect(result.split('\n')).toHaveLength(1)
    })
  })
})
