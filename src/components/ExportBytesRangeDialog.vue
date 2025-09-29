/**
 * VULNEX -Bytes Revealer-
 *
 * File: ExportBytesRangeDialog.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-24
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h2>Export Bytes From Range</h2>
          <button class="close-btn" @click="close">×</button>
        </div>

        <div class="modal-body">
          <!-- Range Selection Section -->
          <div class="range-section">
            <h3>Select Byte Range</h3>
            <div class="range-inputs">
              <div class="range-row">
                <div class="range-field">
                  <label>Start Offset:</label>
                  <input
                    v-model="range.start"
                    type="text"
                    class="range-input"
                    placeholder="0x0000 or 0"
                    @input="validateRange"
                  />
                </div>
                <div class="range-field">
                  <label>End Offset:</label>
                  <input
                    v-model="range.end"
                    type="text"
                    class="range-input"
                    placeholder="0xFFFF or 65535"
                    @input="validateRange"
                  />
                </div>
                <button
                  class="clear-btn"
                  @click="clearRange"
                  title="Clear range"
                >
                  Clear
                </button>
              </div>
              <div class="range-info">
                <span v-if="rangeValid" class="info-text success">
                  ✓ Range: {{ formatOffset(parsedRange.start) }} to {{ formatOffset(parsedRange.end) }}
                  ({{ parsedRange.length }} bytes)
                </span>
                <span v-else-if="range.start || range.end" class="info-text error">
                  ✗ {{ rangeError }}
                </span>
                <span v-else class="info-text">
                  Enter start and end offsets in hex (0x...) or decimal
                </span>
              </div>
              <div class="quick-ranges">
                <button
                  class="quick-btn"
                  @click="setRange(0, Math.min(256, fileSize))"
                  title="First 256 bytes"
                >
                  First 256B
                </button>
                <button
                  class="quick-btn"
                  @click="setRange(0, Math.min(1024, fileSize))"
                  title="First 1KB"
                >
                  First 1KB
                </button>
                <button
                  class="quick-btn"
                  @click="setRange(0, Math.min(4096, fileSize))"
                  title="First 4KB"
                >
                  First 4KB
                </button>
                <button
                  class="quick-btn"
                  @click="setRange(0, fileSize)"
                  title="Entire file"
                >
                  Entire File
                </button>
              </div>
            </div>
          </div>

          <!-- Format Selection -->
          <div class="format-section">
            <h3>Select Format</h3>
            <div class="format-tabs">
              <button
                v-for="lang in languages"
                :key="lang.id"
                class="format-tab"
                :class="{ active: selectedLanguage === lang.id }"
                @click="selectedLanguage = lang.id"
              >
                {{ lang.name }}
              </button>
            </div>

            <div class="format-options">
              <select v-model="selectedFormat" class="format-select">
                <option
                  v-for="format in currentFormats"
                  :key="format.id"
                  :value="format.id"
                >
                  {{ format.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Options Section -->
          <div class="options-section">
            <h3>Options</h3>
            <div class="option-row">
              <label>
                Variable Name:
                <input
                  v-model="options.variableName"
                  type="text"
                  class="option-input"
                  placeholder="data"
                />
              </label>
            </div>
            <div class="option-row">
              <label>
                <input
                  v-model="options.splitLines"
                  type="checkbox"
                />
                Split into multiple lines
              </label>
            </div>
            <div class="option-row" v-if="options.splitLines">
              <label>
                Bytes per line:
                <input
                  v-model.number="options.bytesPerLine"
                  type="number"
                  class="option-input small"
                  min="8"
                  max="32"
                />
              </label>
            </div>
            <div class="option-row">
              <label>
                <input
                  v-model="options.includeOffset"
                  type="checkbox"
                />
                Include offset comments
              </label>
            </div>
            <div class="option-row">
              <label>
                <input
                  v-model="options.uppercase"
                  type="checkbox"
                />
                Uppercase hex values
              </label>
            </div>
          </div>

          <!-- Preview Section -->
          <div class="preview-section">
            <div class="preview-header">
              <h3>Preview</h3>
              <div class="preview-info">
                <span v-if="rangeValid">
                  {{ parsedRange.length }} byte{{ parsedRange.length !== 1 ? 's' : '' }} |
                  {{ formatFileSize(parsedRange.length) }}
                </span>
                <span v-else class="warning">
                  Select a valid range to preview
                </span>
              </div>
            </div>
            <div class="code-preview" :class="syntaxClass">
              <pre><code>{{ formattedCode }}</code></pre>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            class="btn btn-secondary"
            @click="copyToClipboard"
            :disabled="!rangeValid"
          >
            <span class="btn-icon">📋</span> Copy to Clipboard
          </button>
          <button
            class="btn btn-primary"
            @click="saveToFile"
            :disabled="!rangeValid"
          >
            <span class="btn-icon">💾</span> Save to File
          </button>
          <button class="btn btn-cancel" @click="close">Cancel</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, computed, watch } from 'vue'
import ByteFormatter from '../services/ByteFormatter'
import { createLogger } from '../utils/logger'

const logger = createLogger('ExportBytesRangeDialog')

export default {
  name: 'ExportBytesRangeDialog',

  props: {
    visible: {
      type: Boolean,
      default: false
    },
    fileData: {
      type: Uint8Array,
      default: () => new Uint8Array()
    },
    fileSize: {
      type: Number,
      default: 0
    },
    initialStart: {
      type: Number,
      default: 0
    },
    initialEnd: {
      type: Number,
      default: 0
    }
  },

  emits: ['close', 'save', 'copy'],

  setup(props, { emit }) {
    // Language and format definitions (same as ExportBytesDialog)
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

    // State
    const selectedLanguage = ref('javascript')
    const selectedFormat = ref('js-uint8array')
    const options = ref({
      variableName: 'data',
      splitLines: true,
      bytesPerLine: 16,
      includeOffset: false,
      uppercase: true
    })

    // Range state
    const range = ref({
      start: '',
      end: ''
    })
    const rangeValid = ref(false)
    const rangeError = ref('')
    const parsedRange = ref({
      start: 0,
      end: 0,
      length: 0
    })

    // Computed
    const currentFormats = computed(() => {
      return formats[selectedLanguage.value] || []
    })

    const fileSize = computed(() => {
      return props.fileSize || 0
    })

    const selectedBytes = computed(() => {
      if (!rangeValid.value || !props.fileData) {
        return new Uint8Array()
      }
      return props.fileData.slice(parsedRange.value.start, parsedRange.value.end)
    })

    const formattedCode = computed(() => {
      if (!rangeValid.value) {
        return '// Select a valid range to preview'
      }

      if (selectedBytes.value.length === 0) {
        return '// No bytes in selected range'
      }

      try {
        // Enhanced options for formatting
        const formatOptions = {
          ...options.value,
          lineWidth: options.value.bytesPerLine,
          addOffsetComments: options.value.includeOffset,
          startOffset: parsedRange.value.start
        }

        return ByteFormatter.format(
          selectedBytes.value,
          selectedFormat.value,
          formatOptions
        )
      } catch (error) {
        logger.error('Error formatting bytes:', error)
        return `// Error: ${error.message}`
      }
    })

    const syntaxClass = computed(() => {
      const lang = selectedLanguage.value
      if (lang === 'data') return 'syntax-plain'
      if (lang === 'assembler') return 'syntax-asm'
      if (lang === 'clang') return 'syntax-c'
      return `syntax-${lang}`
    })

    // Methods
    const parseOffset = (value) => {
      if (!value) return NaN

      const trimmed = value.trim()

      // Handle hex format (0x prefix)
      if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
        return parseInt(trimmed.substring(2), 16)
      }

      // Try decimal
      const decimal = parseInt(trimmed, 10)
      if (!isNaN(decimal)) {
        return decimal
      }

      // Try as hex without prefix
      return parseInt(trimmed, 16)
    }

    const formatOffset = (offset) => {
      return '0x' + offset.toString(16).toUpperCase().padStart(4, '0')
    }

    const validateRange = () => {
      const start = parseOffset(range.value.start)
      const end = parseOffset(range.value.end)

      rangeValid.value = false
      rangeError.value = ''

      // Check if fileSize is valid
      if (!fileSize.value || fileSize.value === 0) {
        if (range.value.start || range.value.end) {
          rangeError.value = 'File size is not available'
        }
        return
      }

      if (isNaN(start) && range.value.start) {
        rangeError.value = 'Invalid start offset'
        return
      }

      if (isNaN(end) && range.value.end) {
        rangeError.value = 'Invalid end offset'
        return
      }

      if (!range.value.start || !range.value.end) {
        return
      }

      if (start < 0) {
        rangeError.value = 'Start offset cannot be negative'
        return
      }

      if (end < 0) {
        rangeError.value = 'End offset cannot be negative'
        return
      }

      if (start >= fileSize.value) {
        rangeError.value = `Start offset exceeds file size (${fileSize.value} bytes)`
        return
      }

      if (end > fileSize.value) {
        rangeError.value = `End offset exceeds file size (${fileSize.value} bytes)`
        return
      }

      if (start >= end) {
        rangeError.value = 'Start offset must be less than end offset'
        return
      }

      const length = end - start
      if (length > 10 * 1024 * 1024) { // Warn for >10MB
        rangeError.value = `Warning: Large range (${formatFileSize(length)})`
      }

      parsedRange.value = { start, end, length }
      rangeValid.value = true
    }

    const setRange = (start, end) => {
      range.value.start = '0x' + start.toString(16).toUpperCase()
      range.value.end = '0x' + end.toString(16).toUpperCase()
      validateRange()
    }

    const clearRange = () => {
      range.value.start = ''
      range.value.end = ''
      parsedRange.value = { start: 0, end: 0, length: 0 }
      rangeValid.value = false
      rangeError.value = ''
    }


    const formatFileSize = (bytes) => {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const handleOverlayClick = (event) => {
      if (event.target === event.currentTarget) {
        close()
      }
    }

    const close = () => {
      emit('close')
    }

    const copyToClipboard = async () => {
      if (!rangeValid.value) return

      try {
        await navigator.clipboard.writeText(formattedCode.value)

        emit('copy', {
          success: true,
          format: selectedFormat.value,
          bytesCount: parsedRange.value.length,
          range: { ...parsedRange.value }
        })

        // Auto-close after successful copy
        setTimeout(() => close(), 500)
      } catch (error) {
        logger.error('Failed to copy to clipboard:', error)
        emit('copy', {
          success: false,
          error: error.message
        })
      }
    }

    const saveToFile = () => {
      if (!rangeValid.value) return

      try {
        // Determine file extension based on format
        const extensions = {
          'javascript': 'js',
          'python': 'py',
          'c': 'c',
          'java': 'java',
          'csharp': 'cs',
          'go': 'go',
          'rust': 'rs',
          'data': 'txt'
        }

        const ext = extensions[selectedLanguage.value] || 'txt'
        const rangeStr = `${formatOffset(parsedRange.value.start)}_${formatOffset(parsedRange.value.end)}`
        const filename = `${options.value.variableName || 'data'}_${rangeStr}.${ext}`

        // Create blob and download
        const blob = new Blob([formattedCode.value], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)

        emit('save', {
          success: true,
          filename,
          format: selectedFormat.value,
          bytesCount: parsedRange.value.length,
          range: { ...parsedRange.value }
        })

        // Auto-close after successful save
        setTimeout(() => close(), 500)
      } catch (error) {
        logger.error('Failed to save file:', error)
        emit('save', {
          success: false,
          error: error.message
        })
      }
    }

    // Watch for language changes
    watch(selectedLanguage, (newLang) => {
      // Auto-select first format when language changes
      const newFormats = formats[newLang]
      if (newFormats && newFormats.length > 0) {
        selectedFormat.value = newFormats[0].id
      }
    })

    // Auto-set initial range when dialog opens
    watch(() => props.visible, (newVal) => {
      if (newVal) {
        // Initialize with the provided range
        if (props.initialStart !== undefined && props.initialEnd !== undefined) {
          range.value.start = '0x' + props.initialStart.toString(16).toUpperCase()
          range.value.end = '0x' + props.initialEnd.toString(16).toUpperCase()
          validateRange()
        } else {
          // Clear range if no initial values
          range.value.start = ''
          range.value.end = ''
        }
      }
    })

    return {
      languages,
      selectedLanguage,
      selectedFormat,
      currentFormats,
      options,
      range,
      rangeValid,
      rangeError,
      parsedRange,
      fileSize,
      selectedBytes,
      formattedCode,
      syntaxClass,
      parseOffset,
      formatOffset,
      validateRange,
      setRange,
      clearRange,
      formatFileSize,
      handleOverlayClick,
      close,
      copyToClipboard,
      saveToFile
    }
  }
}
</script>

<style scoped>
/* Inherit most styles from ExportBytesDialog */
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.modal-container {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

/* Modal Header */
.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

/* Modal Body */
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

/* Range Section */
.range-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.range-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.range-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.range-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.range-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-field label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.range-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 13px;
}

.range-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.clear-btn {
  padding: 8px 16px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
  height: 36px;
  white-space: nowrap;
}

.clear-btn:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color);
}

.range-info {
  display: flex;
  align-items: center;
  min-height: 24px;
  margin-top: 8px;
}

.info-text {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-text.success {
  color: #10b981;
}

.info-text.error {
  color: #ef4444;
}

.info-text.warning {
  color: #f59e0b;
}

.quick-ranges {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.quick-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  border-color: #3b82f6;
}

/* Format Section (reuse existing styles) */
.format-section {
  margin-bottom: 24px;
}

.format-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.format-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.format-tab {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.format-tab:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.format-tab.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.format-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
}

/* Options Section */
.options-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.options-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.option-row {
  margin-bottom: 12px;
}

.option-row:last-child {
  margin-bottom: 0;
}

.option-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}

.option-input {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
}

.option-input.small {
  width: 80px;
}

/* Preview Section */
.preview-section {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.preview-header {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.preview-info {
  font-size: 12px;
  color: var(--text-secondary);
}

.preview-info .warning {
  color: #f59e0b;
}

.code-preview {
  max-height: 300px;
  overflow: auto;
  background: #1e1e1e;
  padding: 16px;
}

.code-preview pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #d4d4d4;
}

.code-preview code {
  display: block;
  white-space: pre;
}

/* Modal Footer */
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 16px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--hover-bg);
}

.btn-cancel {
  background: transparent;
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9);
}

/* Dark mode adjustments */
:root[class='dark-mode'] .modal-container {
  background: #1a202c;
}

:root[class='dark-mode'] .code-preview {
  background: #0d1117;
}

:root[class='dark-mode'] .format-tab.active {
  background: #2563eb;
}

:root[class='dark-mode'] .range-section {
  background: #2d3748;
  border-color: #4a5568;
}

:root[class='dark-mode'] .quick-btn {
  background: #2d3748;
  border-color: #4a5568;
}

:root[class='dark-mode'] .quick-btn:hover {
  background: #374151;
  border-color: #60a5fa;
}
</style>