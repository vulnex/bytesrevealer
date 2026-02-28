/** * VULNEX -Bytes Revealer- * * File: ExportBytesRangeDialog.vue * Author: Simon Roses Femerling *
Created: 2025-09-24 * Last Modified: 2025-09-27 * Version: 0.3 * License: Apache-2.0 * Copyright (c)
2025 VULNEX. All rights reserved. * https://www.vulnex.com */

<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
      <div
        ref="dialogRef"
        class="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-range-dialog-title"
        @click.stop
        @keydown="handleKeydown"
      >
        <div class="modal-header">
          <h2 id="export-range-dialog-title">Export Bytes From Range</h2>
          <button class="close-btn" aria-label="Close dialog" @click="close">×</button>
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
                <button class="clear-btn" title="Clear range" @click="clearRange">Clear</button>
              </div>
              <div class="range-info">
                <span v-if="rangeValid" class="info-text success">
                  ✓ Range: {{ formatOffset(parsedRange.start) }} to
                  {{ formatOffset(parsedRange.end) }} ({{ parsedRange.length }} bytes)
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
                  title="First 256 bytes"
                  @click="setRange(0, Math.min(256, fileSize))"
                >
                  First 256B
                </button>
                <button
                  class="quick-btn"
                  title="First 1KB"
                  @click="setRange(0, Math.min(1024, fileSize))"
                >
                  First 1KB
                </button>
                <button
                  class="quick-btn"
                  title="First 4KB"
                  @click="setRange(0, Math.min(4096, fileSize))"
                >
                  First 4KB
                </button>
                <button class="quick-btn" title="Entire file" @click="setRange(0, fileSize)">
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
                <option v-for="format in currentFormats" :key="format.id" :value="format.id">
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
                <input v-model="options.splitLines" type="checkbox" />
                Split into multiple lines
              </label>
            </div>
            <div v-if="options.splitLines" class="option-row">
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
                <input v-model="options.includeOffset" type="checkbox" />
                Include offset comments
              </label>
            </div>
            <div class="option-row">
              <label>
                <input v-model="options.uppercase" type="checkbox" />
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
                <span v-else class="warning"> Select a valid range to preview </span>
              </div>
            </div>
            <div class="code-preview" :class="syntaxClass">
              <pre><code>{{ formattedCode }}</code></pre>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" :disabled="!rangeValid" @click="copyToClipboard">
            <span class="btn-icon">📋</span> Copy to Clipboard
          </button>
          <button class="btn btn-primary" :disabled="!rangeValid" @click="saveToFile">
            <span class="btn-icon">💾</span> Save to File
          </button>
          <button class="btn btn-cancel" @click="close">Cancel</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import ByteFormatter from '../services/ByteFormatter'
import { createLogger } from '../utils/logger'
import { useExportRange } from '../composables/useExportRange'
import { useExportFormat } from '../composables/useExportFormat'

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
    const fileSize = computed(() => props.fileSize || 0)

    // Composables
    const {
      range,
      rangeValid,
      rangeError,
      parsedRange,
      parseOffset,
      formatOffset,
      formatFileSize,
      validateRange,
      setRange,
      clearRange
    } = useExportRange(fileSize)

    const { languages, selectedLanguage, selectedFormat, options, currentFormats, syntaxClass } =
      useExportFormat()

    // Focus trap
    const dialogRef = ref(null)
    let previouslyFocused = null

    const getFocusableElements = () => {
      if (!dialogRef.value) return []
      return Array.from(
        dialogRef.value.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled && el.offsetParent !== null)
    }

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        close()
        return
      }

      if (event.key === 'Tab') {
        const focusable = getFocusableElements()
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
      }
    }

    onBeforeUnmount(() => {
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus()
      }
    })

    // Dialog-level computed
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
        const formatOptions = {
          ...options.value,
          lineWidth: options.value.bytesPerLine,
          addOffsetComments: options.value.includeOffset,
          startOffset: parsedRange.value.start
        }

        return ByteFormatter.format(selectedBytes.value, selectedFormat.value, formatOptions)
      } catch (error) {
        logger.error('Error formatting bytes:', error)
        return `// Error: ${error.message}`
      }
    })

    // Dialog methods
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
        const extensions = {
          javascript: 'js',
          python: 'py',
          c: 'c',
          java: 'java',
          csharp: 'cs',
          go: 'go',
          rust: 'rs',
          data: 'txt'
        }

        const ext = extensions[selectedLanguage.value] || 'txt'
        const rangeStr = `${formatOffset(parsedRange.value.start)}_${formatOffset(parsedRange.value.end)}`
        const filename = `${options.value.variableName || 'data'}_${rangeStr}.${ext}`

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

        setTimeout(() => close(), 500)
      } catch (error) {
        logger.error('Failed to save file:', error)
        emit('save', {
          success: false,
          error: error.message
        })
      }
    }

    // Auto-set initial range and manage focus when dialog opens
    watch(
      () => props.visible,
      (newVal) => {
        if (newVal) {
          previouslyFocused = document.activeElement
          if (props.initialStart !== undefined && props.initialEnd !== undefined) {
            range.value.start = '0x' + props.initialStart.toString(16).toUpperCase()
            range.value.end = '0x' + props.initialEnd.toString(16).toUpperCase()
            validateRange()
          } else {
            range.value.start = ''
            range.value.end = ''
          }
          nextTick(() => {
            if (dialogRef.value) {
              dialogRef.value.focus()
            }
          })
        } else if (previouslyFocused && previouslyFocused.focus) {
          previouslyFocused.focus()
          previouslyFocused = null
        }
      }
    )

    return {
      dialogRef,
      languages,
      selectedLanguage,
      selectedFormat,
      currentFormats,
      options,
      range,
      rangeValid,
      rangeError,
      parsedRange,
      fileSize, // eslint-disable-line vue/no-dupe-keys -- computed wraps prop with default
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
      handleKeydown,
      close,
      copyToClipboard,
      saveToFile
    }
  }
}
</script>

<style scoped>
@import '../styles/export-bytes-range-dialog.css';
</style>
