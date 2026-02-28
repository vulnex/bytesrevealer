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
import { computed } from 'vue'
import ByteFormatter from '../services/ByteFormatter'
import { createLogger } from '../utils/logger'
import { useExportFormat } from '../composables/useExportFormat'

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
    const {
      languages, selectedLanguage, selectedFormat,
      options, currentFormats, syntaxClass
    } = useExportFormat()

    // Dialog-level computed
    const bytesCount = computed(() => {
      return props.selectedBytes ? props.selectedBytes.length : 0
    })

    const formattedCode = computed(() => {
      if (!props.selectedBytes || props.selectedBytes.length === 0) {
        return '// No bytes selected'
      }

      try {
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
@import '../styles/export-bytes-dialog.css';
</style>