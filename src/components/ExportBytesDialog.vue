/**
 * VULNEX -Bytes Revealer-
 *
 * File: ExportBytesDialog.vue
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
          <h2>Export Bytes As Code</h2>
          <button class="close-btn" @click="close">×</button>
        </div>

        <div class="modal-body">
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
                {{ bytesCount }} byte{{ bytesCount !== 1 ? 's' : '' }} |
                {{ formatFileSize(bytesCount) }}
              </div>
            </div>
            <div class="code-preview" :class="syntaxClass">
              <pre><code>{{ formattedCode }}</code></pre>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="copyToClipboard">
            <span class="btn-icon">📋</span> Copy to Clipboard
          </button>
          <button class="btn btn-primary" @click="saveToFile">
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

const logger = createLogger('ExportBytesDialog')

export default {
  name: 'ExportBytesDialog',

  props: {
    visible: {
      type: Boolean,
      default: false
    },
    selectedBytes: {
      type: Uint8Array,
      default: () => new Uint8Array()
    }
  },

  emits: ['close', 'save', 'copy'],

  setup(props, { emit }) {
    // Language and format definitions
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

    // Computed
    const currentFormats = computed(() => {
      return formats[selectedLanguage.value] || []
    })

    const bytesCount = computed(() => {
      return props.selectedBytes ? props.selectedBytes.length : 0
    })

    const formattedCode = computed(() => {
      if (!props.selectedBytes || props.selectedBytes.length === 0) {
        return '// No bytes selected'
      }

      try {
        // Enhanced options for formatting
        const formatOptions = {
          ...options.value,
          lineWidth: options.value.bytesPerLine,
          addOffsetComments: options.value.includeOffset
        }

        return ByteFormatter.format(
          props.selectedBytes,
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

    // Watch for language changes
    watch(selectedLanguage, (newLang) => {
      // Auto-select first format when language changes
      const newFormats = formats[newLang]
      if (newFormats && newFormats.length > 0) {
        selectedFormat.value = newFormats[0].id
      }
    })

    // Methods
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
      try {
        await navigator.clipboard.writeText(formattedCode.value)

        emit('copy', {
          success: true,
          format: selectedFormat.value,
          bytesCount: bytesCount.value
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
        const filename = `${options.value.variableName || 'data'}.${ext}`

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
          bytesCount: bytesCount.value
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

    return {
      languages,
      selectedLanguage,
      selectedFormat,
      currentFormats,
      options,
      bytesCount,
      formattedCode,
      syntaxClass,
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

/* Format Section */
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

.btn-icon {
  font-size: 16px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
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
</style>