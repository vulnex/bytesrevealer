/**
 * VULNEX -Bytes Revealer-
 *
 * File: ByteFormatter.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Service for formatting bytes into various programming language formats
 */

class ByteFormatter {
  constructor() {
    this.formatters = {
      // JavaScript formats
      'js-uint8': this.formatJSUint8Array,
      'js-uint8array': this.formatJSUint8Array,
      'js-array': this.formatJSArray,
      'js-hex': this.formatJSHexString,
      'js-base64': this.formatJSBase64,

      // Python formats
      'python-bytes': this.formatPythonBytes,
      'py-bytes': this.formatPythonBytes,
      'python-bytearray': this.formatPythonByteArray,
      'py-bytearray': this.formatPythonByteArray,
      'python-list': this.formatPythonList,
      'py-list': this.formatPythonList,
      'py-hex': this.formatPythonHexString,

      // C/C++ formats
      'c-array': this.formatCArray,
      'c-uint8': this.formatCUint8Array,
      'cpp-vector': this.formatCppVector,
      'c-hex': this.formatCHexString,

      // Java formats
      'java-array': this.formatJavaArray,
      'java-list': this.formatJavaList,
      'java-hex': this.formatJavaHexString,

      // C# formats
      'csharp-array': this.formatCSharpArray,
      'csharp-list': this.formatCSharpList,
      'csharp-hex': this.formatCSharpHexString,

      // Go formats
      'go-slice': this.formatGoSlice,
      'go-array': this.formatGoArray,
      'go-hex': this.formatGoHexString,

      // Rust formats
      'rust-vec': this.formatRustVec,
      'rust-array': this.formatRustArray,
      'rust-hex': this.formatRustHexString,

      // Assembler formats
      'asm-db': this.formatAsmDB,
      'asm-nasm': this.formatAsmNASM,
      'asm-masm': this.formatAsmMASM,
      'asm-gas': this.formatAsmGAS,

      // C Language formats
      'clang-array': this.formatCLangArray,
      'clang-init': this.formatCLangInit,
      'clang-string': this.formatCLangString,
      'clang-macro': this.formatCLangMacro,

      // Data formats
      'hex': this.formatHexString,
      'hex-spaced': this.formatHexStringSpaced,
      'base64': this.formatBase64,
      'binary': this.formatBinary,
      'decimal': this.formatDecimal,
      'escape': this.formatEscapeSequences,
      'escape-single': this.formatEscapeSequencesSingle,
      'escape-double': this.formatEscapeSequencesDouble,
      'csv': this.formatCSV,
    }
  }

  /**
   * Format bytes using specified format
   * @param {Uint8Array} bytes - The bytes to format
   * @param {string} format - The format identifier
   * @param {Object} options - Formatting options
   * @returns {string} - Formatted string
   */
  format(bytes, format, options = {}) {
    const formatter = this.formatters[format]
    if (!formatter) {
      throw new Error(`Unknown format: ${format}`)
    }

    return formatter.call(this, bytes, options)
  }

  /**
   * Get list of available formats grouped by category
   */
  getAvailableFormats() {
    return {
      javascript: [
        { id: 'js-uint8', name: 'Uint8Array', icon: '📦' },
        { id: 'js-array', name: 'Array', icon: '[]' },
        { id: 'js-hex', name: 'Hex String', icon: '""' }
      ],
      python: [
        { id: 'python-bytes', name: 'bytes()', icon: 'b' },
        { id: 'python-bytearray', name: 'bytearray()', icon: '[]' },
        { id: 'python-list', name: 'List', icon: '[]' }
      ],
      c: [
        { id: 'c-array', name: 'unsigned char[]', icon: '{}' },
        { id: 'c-uint8', name: 'uint8_t[]', icon: '{}' },
        { id: 'cpp-vector', name: 'std::vector', icon: '{}' }
      ],
      data: [
        { id: 'hex', name: 'Hex String', icon: '0x' },
        { id: 'hex-spaced', name: 'Hex (Spaced)', icon: '0x' },
        { id: 'base64', name: 'Base64', icon: '64' }
      ]
    }
  }

  // JavaScript formatters
  formatJSUint8Array(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `const ${variableName} = new Uint8Array();`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `const ${variableName} = new Uint8Array([${hex.join(', ')}]);`
    }

    // Split into multiple lines for readability
    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('  ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `const ${variableName} = new Uint8Array([\n${lines.join('\n')}\n]);`
  }

  formatJSArray(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `const ${variableName} = [];`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `const ${variableName} = [${hex.join(', ')}];`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('  ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `const ${variableName} = [\n${lines.join('\n')}\n];`
  }

  formatJSHexString(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return `const ${variableName} = "${hex}";`
  }

  // Python formatters
  formatPythonBytes(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `${variableName} = b""`
    }

    // Use hex notation for readability
    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '\\x' + b.toString(16).padStart(2, '0')).join('')
      return `${variableName} = b"${hex}"`
    }

    // For longer data, use bytes() constructor
    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('    ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `${variableName} = bytes([\n${lines.join('\n')}\n])`
  }

  formatPythonByteArray(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `${variableName} = bytearray()`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `${variableName} = bytearray([${hex.join(', ')}])`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('    ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `${variableName} = bytearray([\n${lines.join('\n')}\n])`
  }

  formatPythonList(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `${variableName} = []`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `${variableName} = [${hex.join(', ')}]`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('    ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `${variableName} = [\n${lines.join('\n')}\n]`
  }

  // C/C++ formatters
  formatCArray(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `unsigned char ${variableName}[] = {};`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `unsigned char ${variableName}[] = {${hex.join(', ')}};`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('    ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `unsigned char ${variableName}[] = {\n${lines.join('\n')}\n};`
  }

  formatCUint8Array(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `uint8_t ${variableName}[] = {};`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `uint8_t ${variableName}[] = {${hex.join(', ')}};`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('    ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `uint8_t ${variableName}[] = {\n${lines.join('\n')}\n};`
  }

  formatCppVector(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `std::vector<uint8_t> ${variableName};`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `std::vector<uint8_t> ${variableName} = {${hex.join(', ')}};`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('    ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `std::vector<uint8_t> ${variableName} = {\n${lines.join('\n')}\n};`
  }

  // Additional JavaScript formatters
  formatJSBase64(bytes, options) {
    const { variableName = 'data' } = options
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return `const ${variableName} = "${btoa(binary)}";`
  }

  // Additional Python formatters
  formatPythonHexString(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return `${variableName} = "${hex}"`
  }

  // Additional C/C++ formatters
  formatCHexString(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => '\\x' + b.toString(16).padStart(2, '0')).join('')
    return `const char* ${variableName} = "${hex}";`
  }

  // Java formatters
  formatJavaArray(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `byte[] ${variableName} = new byte[0];`
    }

    // Java bytes are signed (-128 to 127)
    const toSignedByte = (b) => b > 127 ? b - 256 : b

    if (bytes.length <= lineWidth || !splitLines) {
      const values = Array.from(bytes).map(b => toSignedByte(b))
      return `byte[] ${variableName} = {${values.join(', ')}};`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const values = Array.from(chunk).map(b => toSignedByte(b))
      lines.push('    ' + values.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `byte[] ${variableName} = {\n${lines.join('\n')}\n};`
  }

  formatJavaList(bytes, options) {
    const { variableName = 'data' } = options
    const toSignedByte = (b) => b > 127 ? `(byte)${b}` : String(b)
    const values = Array.from(bytes).map(b => toSignedByte(b))
    return `List<Byte> ${variableName} = Arrays.asList(${values.join(', ')});`
  }

  formatJavaHexString(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return `String ${variableName} = "${hex}";`
  }

  // C# formatters
  formatCSharpArray(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `byte[] ${variableName} = new byte[0];`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `byte[] ${variableName} = { ${hex.join(', ')} };`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('    ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `byte[] ${variableName} = {\n${lines.join('\n')}\n};`
  }

  formatCSharpList(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
    return `List<byte> ${variableName} = new List<byte> { ${hex.join(', ')} };`
  }

  formatCSharpHexString(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return `string ${variableName} = "${hex}";`
  }

  // Go formatters
  formatGoSlice(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `var ${variableName} []byte`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `${variableName} := []byte{${hex.join(', ')}}`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('\t' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `${variableName} := []byte{\n${lines.join('\n')}\n}`
  }

  formatGoArray(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
    return `var ${variableName} = [${bytes.length}]byte{${hex.join(', ')}}`
  }

  formatGoHexString(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return `${variableName} := "${hex}"`
  }

  // Rust formatters
  formatRustVec(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16 } = options

    if (bytes.length === 0) {
      return `let ${variableName}: Vec<u8> = vec![];`
    }

    if (bytes.length <= lineWidth || !splitLines) {
      const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
      return `let ${variableName} = vec![${hex.join(', ')}];`
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const hex = Array.from(chunk).map(b => '0x' + b.toString(16).padStart(2, '0'))
      lines.push('    ' + hex.join(', ') + (i + lineWidth < bytes.length ? ',' : ''))
    }

    return `let ${variableName} = vec![\n${lines.join('\n')}\n];`
  }

  formatRustArray(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0'))
    return `let ${variableName}: [u8; ${bytes.length}] = [${hex.join(', ')}];`
  }

  formatRustHexString(bytes, options) {
    const { variableName = 'data' } = options
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return `let ${variableName} = "${hex}";`
  }

  // Data formatters
  formatHexString(bytes, options) {
    const { uppercase = false } = options
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return uppercase ? hex.toUpperCase() : hex
  }

  formatHexStringSpaced(bytes, options) {
    const { uppercase = false } = options
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
    return uppercase ? hex.toUpperCase() : hex
  }

  formatBase64(bytes, options) {
    // Convert Uint8Array to base64
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  formatBinary(bytes, options) {
    const { splitLines = true, lineWidth = 4 } = options

    if (!splitLines || bytes.length <= lineWidth) {
      return Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join(' ')
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const binary = Array.from(chunk).map(b => b.toString(2).padStart(8, '0'))
      lines.push(binary.join(' '))
    }
    return lines.join('\n')
  }

  formatDecimal(bytes, options) {
    const { splitLines = true, lineWidth = 16 } = options

    if (!splitLines || bytes.length <= lineWidth) {
      return Array.from(bytes).map(b => b.toString().padStart(3, ' ')).join(' ')
    }

    const lines = []
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, i + lineWidth)
      const decimal = Array.from(chunk).map(b => b.toString().padStart(3, ' '))
      lines.push(decimal.join(' '))
    }
    return lines.join('\n')
  }

  // Assembler formats
  formatAsmDB(bytes, options) {
    const { splitLines = true, lineWidth = 16, uppercase = true } = options
    const lines = []

    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, Math.min(i + lineWidth, bytes.length))
      const hex = Array.from(chunk).map(b => {
        const h = b.toString(16).padStart(2, '0')
        return '0' + (uppercase ? h.toUpperCase() : h) + 'h'
      })
      lines.push('    db ' + hex.join(', '))
    }

    return lines.join('\n')
  }

  formatAsmNASM(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16, uppercase = true } = options
    const lines = [`${variableName}:`]

    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, Math.min(i + lineWidth, bytes.length))
      const hex = Array.from(chunk).map(b => {
        const h = b.toString(16).padStart(2, '0')
        return '0x' + (uppercase ? h.toUpperCase() : h)
      })
      lines.push('    db ' + hex.join(', '))
    }

    lines.push(`${variableName}_len equ $ - ${variableName}`)
    return lines.join('\n')
  }

  formatAsmMASM(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16, uppercase = true } = options
    const lines = [`${variableName} DB`]

    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, Math.min(i + lineWidth, bytes.length))
      const hex = Array.from(chunk).map(b => {
        const h = b.toString(16).padStart(2, '0')
        return (uppercase ? h.toUpperCase() : h) + 'h'
      })
      const prefix = i === 0 ? '    ' : '    DB '
      lines.push(prefix + hex.join(', '))
    }

    return lines.join('\n')
  }

  formatAsmGAS(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16, uppercase = true } = options
    const lines = [`${variableName}:`]

    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, Math.min(i + lineWidth, bytes.length))
      const hex = Array.from(chunk).map(b => {
        const h = b.toString(16).padStart(2, '0')
        return '0x' + (uppercase ? h.toUpperCase() : h)
      })
      lines.push('    .byte ' + hex.join(', '))
    }

    lines.push(`.equ ${variableName}_len, . - ${variableName}`)
    return lines.join('\n')
  }

  // C Language formats
  formatCLangArray(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16, uppercase = true } = options

    if (bytes.length === 0) {
      return `unsigned char ${variableName}[] = {};`
    }

    if (!splitLines || bytes.length <= lineWidth) {
      const hex = Array.from(bytes).map(b => {
        const h = b.toString(16).padStart(2, '0')
        return '0x' + (uppercase ? h.toUpperCase() : h)
      })
      return `unsigned char ${variableName}[] = { ${hex.join(', ')} };`
    }

    const lines = [`unsigned char ${variableName}[] = {`]
    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, Math.min(i + lineWidth, bytes.length))
      const hex = Array.from(chunk).map(b => {
        const h = b.toString(16).padStart(2, '0')
        return '0x' + (uppercase ? h.toUpperCase() : h)
      })
      const comma = i + lineWidth < bytes.length ? ',' : ''
      lines.push('    ' + hex.join(', ') + comma)
    }
    lines.push('};')

    return lines.join('\n')
  }

  formatCLangInit(bytes, options) {
    const { variableName = 'data', splitLines = true, lineWidth = 16, uppercase = true } = options
    const lines = []

    lines.push(`#define ${variableName.toUpperCase()}_SIZE ${bytes.length}`)
    lines.push(`unsigned char ${variableName}[${variableName.toUpperCase()}_SIZE] = {`)

    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, Math.min(i + lineWidth, bytes.length))
      const hex = Array.from(chunk).map(b => {
        const h = b.toString(16).padStart(2, '0')
        return '0x' + (uppercase ? h.toUpperCase() : h)
      })
      const comma = i + lineWidth < bytes.length ? ',' : ''
      lines.push('    ' + hex.join(', ') + comma)
    }
    lines.push('};')

    return lines.join('\n')
  }

  formatCLangString(bytes, options) {
    const { variableName = 'data' } = options
    let str = 'unsigned char ' + variableName + '[] = "'

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]
      if (byte >= 32 && byte <= 126 && byte !== 34 && byte !== 92) {
        str += String.fromCharCode(byte)
      } else {
        str += '\\x' + byte.toString(16).padStart(2, '0')
      }
    }

    str += '";'
    return str
  }

  formatCLangMacro(bytes, options) {
    const { variableName = 'DATA', lineWidth = 16, uppercase = true } = options
    const lines = []

    lines.push(`#define ${variableName}_SIZE ${bytes.length}`)
    lines.push(`#define ${variableName} { \\`)

    for (let i = 0; i < bytes.length; i += lineWidth) {
      const chunk = bytes.slice(i, Math.min(i + lineWidth, bytes.length))
      const hex = Array.from(chunk).map(b => {
        const h = b.toString(16).padStart(2, '0')
        return '0x' + (uppercase ? h.toUpperCase() : h)
      })
      const isLast = i + lineWidth >= bytes.length
      const suffix = isLast ? ' }' : ', \\'
      lines.push('    ' + hex.join(', ') + suffix)
    }

    return lines.join('\n')
  }

  // Additional data formats
  formatEscapeSequences(bytes, options) {
    const { uppercase = true } = options
    let result = ''

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]
      const hex = byte.toString(16).padStart(2, '0')
      result += '\\x' + (uppercase ? hex.toUpperCase() : hex)
    }

    return result
  }

  formatEscapeSequencesSingle(bytes, options) {
    const { uppercase = true } = options
    let result = "'"

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]
      const hex = byte.toString(16).padStart(2, '0')
      result += '\\x' + (uppercase ? hex.toUpperCase() : hex)
    }

    result += "'"
    return result
  }

  formatEscapeSequencesDouble(bytes, options) {
    const { uppercase = true } = options
    let result = '"'

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]
      const hex = byte.toString(16).padStart(2, '0')
      result += '\\x' + (uppercase ? hex.toUpperCase() : hex)
    }

    result += '"'
    return result
  }

  formatCSV(bytes, options) {
    const { splitLines = true, lineWidth = 16, header = true } = options
    const lines = []

    if (header) {
      // Add header row with offsets
      const headers = ['Offset']
      for (let i = 0; i < Math.min(lineWidth, bytes.length); i++) {
        headers.push(`Byte ${i}`)
      }
      lines.push(headers.join(','))
    }

    for (let i = 0; i < bytes.length; i += lineWidth) {
      const row = ['0x' + i.toString(16).padStart(8, '0').toUpperCase()]
      const chunk = bytes.slice(i, Math.min(i + lineWidth, bytes.length))

      for (let j = 0; j < chunk.length; j++) {
        row.push(chunk[j].toString())
      }

      // Pad with empty cells if needed
      while (row.length < lineWidth + 1) {
        row.push('')
      }

      lines.push(row.join(','))
    }

    return lines.join('\n')
  }
}

// Export singleton instance
export default new ByteFormatter()