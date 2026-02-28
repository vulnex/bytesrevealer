import { ref, computed, watch } from 'vue'

export function useExportFormat() {
  const languages = [
    { id: 'javascript', name: 'JavaScript' },
    { id: 'python', name: 'Python' },
    { id: 'c', name: 'C/C++' },
    { id: 'java', name: 'Java' },
    { id: 'csharp', name: 'C#' },
    { id: 'go', name: 'Go' },
    { id: 'rust', name: 'Rust' },
    { id: 'assembler', name: 'Assembler (x86)' },
    { id: 'clang', name: 'C Language' },
    { id: 'data', name: 'Data' }
  ]

  const formats = {
    javascript: [
      { id: 'js-uint8array', name: 'Uint8Array' },
      { id: 'js-array', name: 'Array' },
      { id: 'js-hex', name: 'Hex String' },
      { id: 'js-base64', name: 'Base64 String' }
    ],
    python: [
      { id: 'py-bytes', name: 'bytes()' },
      { id: 'py-bytearray', name: 'bytearray()' },
      { id: 'py-list', name: 'List' },
      { id: 'py-hex', name: 'Hex String' }
    ],
    c: [
      { id: 'c-array', name: 'unsigned char[]' },
      { id: 'c-uint8', name: 'uint8_t[]' },
      { id: 'cpp-vector', name: 'std::vector<uint8_t>' },
      { id: 'c-hex', name: 'Hex String' }
    ],
    java: [
      { id: 'java-array', name: 'byte[]' },
      { id: 'java-list', name: 'List<Byte>' },
      { id: 'java-hex', name: 'Hex String' }
    ],
    csharp: [
      { id: 'csharp-array', name: 'byte[]' },
      { id: 'csharp-list', name: 'List<byte>' },
      { id: 'csharp-hex', name: 'Hex String' }
    ],
    go: [
      { id: 'go-slice', name: '[]byte' },
      { id: 'go-array', name: '[N]byte' },
      { id: 'go-hex', name: 'Hex String' }
    ],
    rust: [
      { id: 'rust-vec', name: 'Vec<u8>' },
      { id: 'rust-array', name: '[u8; N]' },
      { id: 'rust-hex', name: 'Hex String' }
    ],
    assembler: [
      { id: 'asm-db', name: 'DB (Define Byte)' },
      { id: 'asm-nasm', name: 'NASM Format' },
      { id: 'asm-masm', name: 'MASM Format' },
      { id: 'asm-gas', name: 'GAS/AT&T Format' }
    ],
    clang: [
      { id: 'clang-array', name: 'unsigned char[]' },
      { id: 'clang-init', name: 'Array Initializer' },
      { id: 'clang-string', name: 'String Literal' },
      { id: 'clang-macro', name: 'Macro Definition' }
    ],
    data: [
      { id: 'hex', name: 'Hex' },
      { id: 'hex-spaced', name: 'Hex (Spaced)' },
      { id: 'base64', name: 'Base64' },
      { id: 'binary', name: 'Binary' },
      { id: 'decimal', name: 'Decimal' },
      { id: 'escape', name: 'Escape Sequences (Unquoted)' },
      { id: 'escape-single', name: 'Escape Sequences (Single Quotes)' },
      { id: 'escape-double', name: 'Escape Sequences (Double Quotes)' },
      { id: 'csv', name: 'Comma-Separated Values (CSV)' }
    ]
  }

  const selectedLanguage = ref('javascript')
  const selectedFormat = ref('js-uint8array')
  const options = ref({
    variableName: 'data',
    splitLines: true,
    bytesPerLine: 16,
    includeOffset: false,
    uppercase: true
  })

  const currentFormats = computed(() => {
    return formats[selectedLanguage.value] || []
  })

  const syntaxClass = computed(() => {
    const lang = selectedLanguage.value
    if (lang === 'data') return 'syntax-plain'
    if (lang === 'assembler') return 'syntax-asm'
    if (lang === 'clang') return 'syntax-c'
    return `syntax-${lang}`
  })

  // Auto-select first format when language changes
  watch(selectedLanguage, (newLang) => {
    const newFormats = formats[newLang]
    if (newFormats && newFormats.length > 0) {
      selectedFormat.value = newFormats[0].id
    }
  })

  return {
    languages,
    formats,
    selectedLanguage,
    selectedFormat,
    options,
    currentFormats,
    syntaxClass
  }
}
