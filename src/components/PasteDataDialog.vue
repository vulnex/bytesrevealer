<!--
  VULNEX -Bytes Revealer-

  File: PasteDataDialog.vue
  Author: Simon Roses Femerling
  Created: 2026-05-08
  Last Modified: 2026-05-08
  Version: 0.1
  License: Apache-2.0
  Copyright (c) 2026 VULNEX. All rights reserved.
  https://www.vulnex.com
-->

<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
      <div
        ref="dialogRef"
        class="modal-container paste-dialog-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-dialog-title"
        tabindex="-1"
        @click.stop
        @keydown="handleKeydown"
      >
        <div class="modal-header">
          <h2 id="paste-dialog-title">Paste Data</h2>
          <button class="close-btn" aria-label="Close dialog" @click="close">×</button>
        </div>

        <div class="modal-body">
          <div class="form-row">
            <label class="form-label" for="paste-format-select">Format</label>
            <select
              id="paste-format-select"
              v-model="format"
              :disabled="disabled"
              class="form-select"
            >
              <option v-for="f in FORMATS" :key="f.id" :value="f.id">{{ f.label }}</option>
            </select>
          </div>

          <div class="form-row">
            <label class="form-label" for="paste-textarea">Bytes</label>
            <textarea
              id="paste-textarea"
              ref="textareaRef"
              v-model="rawText"
              class="paste-textarea"
              rows="12"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              :disabled="disabled"
              :placeholder="placeholder"
              aria-describedby="paste-status"
            />
          </div>

          <div class="form-row">
            <label class="form-label" for="paste-name">Name</label>
            <input
              id="paste-name"
              v-model="name"
              type="text"
              class="form-input"
              :disabled="disabled"
            />
          </div>

          <div id="paste-status" class="paste-status" :class="statusClass" aria-live="polite">
            <template v-if="!rawText">
              <span class="status-hint">Paste data above to see a preview.</span>
            </template>
            <template v-else-if="parseResult.ok">
              <div class="status-line">
                <span class="status-icon">✓</span>
                Parsed
                <strong>{{ byteCount.toLocaleString() }}</strong>
                byte{{ byteCount === 1 ? '' : 's' }} as
                <strong>{{ formatLabel }}</strong>
              </div>
              <div v-if="byteCount > 0" class="status-preview">
                First {{ Math.min(16, byteCount) }}: <code>{{ preview }}</code>
              </div>
              <div v-for="w in parseResult.warnings" :key="w" class="status-warning">⚠ {{ w }}</div>
              <div v-if="oversized" class="status-line status-error-line">
                <span class="status-icon">✗</span>
                Exceeds 50MB paste limit ({{ formatPasteSize(byteCount) }})
              </div>
              <div v-else-if="largePaste" class="status-warning">
                ⚠ Large paste: {{ formatPasteSize(byteCount) }} — analysis may take a moment
              </div>
            </template>
            <template v-else>
              <div class="status-line status-error-line">
                <span class="status-icon">✗</span> {{ parseResult.error }}
              </div>
            </template>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-cancel" @click="close">Cancel</button>
          <button class="btn btn-primary" :disabled="!canSubmit || disabled" @click="onSubmit">
            Analyze
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { usePasteDataDialog, formatPasteSize } from '../composables/usePasteDataDialog'

const PLACEHOLDER = `Paste shellcode, hex, base64, escaped strings, or hexdump output...

Examples:
  90 90 31 c0 50 68 2f 2f 73 68
  \\x90\\x90\\x31\\xc0
  0x90, 0x90, 0x31, 0xc0
  kJAxwFBoLy8=
  00000000: 9090 31c0 5068 2f2f  ..1.Ph//`

export default {
  name: 'PasteDataDialog',

  props: {
    visible: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },

  emits: ['close', 'submit'],

  setup(props, { emit }) {
    const state = usePasteDataDialog()

    const dialogRef = ref(null)
    const textareaRef = ref(null)
    let previouslyFocused = null

    const getFocusable = () => {
      if (!dialogRef.value) return []
      return Array.from(
        dialogRef.value.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.disabled && el.offsetParent !== null)
    }

    const close = () => emit('close')

    const handleOverlayClick = (event) => {
      if (event.target === event.currentTarget) close()
    }

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key === 'Tab') {
        const focusable = getFocusable()
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    const onSubmit = () => {
      if (!state.canSubmit.value) return
      const bytes = state.parseResult.value.bytes
      const name =
        state.name.value && state.name.value.trim() ? state.name.value.trim() : 'pasted.bin'
      emit('submit', bytes, name)
    }

    watch(
      () => props.visible,
      (newVal) => {
        if (newVal) {
          state.reset()
          previouslyFocused = document.activeElement
          nextTick(() => {
            if (textareaRef.value) textareaRef.value.focus()
            else if (dialogRef.value) dialogRef.value.focus()
          })
        } else if (previouslyFocused && previouslyFocused.focus) {
          previouslyFocused.focus()
          previouslyFocused = null
        }
      }
    )

    onBeforeUnmount(() => {
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus()
      }
    })

    return {
      dialogRef,
      textareaRef,
      placeholder: PLACEHOLDER,
      formatPasteSize,
      // From composable
      rawText: state.rawText,
      format: state.format,
      name: state.name,
      parseResult: state.parseResult,
      byteCount: state.byteCount,
      preview: state.preview,
      formatLabel: state.formatLabel,
      statusClass: state.statusClass,
      canSubmit: state.canSubmit,
      oversized: state.oversized,
      largePaste: state.largePaste,
      FORMATS: state.FORMATS,
      // Methods
      close,
      handleOverlayClick,
      handleKeydown,
      onSubmit
    }
  }
}
</script>

<style scoped>
@import '../styles/paste-data-dialog.css';
</style>
