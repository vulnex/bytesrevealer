/** * VULNEX -Bytes Revealer- * * File: EmbeddedExecutables.vue * Author: Simon Roses Femerling *
Created: 2026-05-08 * Version: 0.5 * License: Apache-2.0 * Copyright (c) 2025 VULNEX. */

<template>
  <section
    v-if="shouldRender"
    class="embedded-executables"
    aria-labelledby="embedded-executables-title"
  >
    <div class="header-row">
      <h3 id="embedded-executables-title">Embedded Executables</h3>
      <div v-if="scan.inProgress" class="scan-status" role="status" aria-live="polite">
        <span class="loading-spinner" aria-hidden="true"></span>
        <span class="scan-progress-text">{{ progressLabel }}</span>
        <button
          type="button"
          class="cancel-button"
          aria-label="Cancel embedded-executable scan"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
      </div>
      <span v-else-if="scan.cancelled" class="status-tag status-tag-warning">Cancelled</span>
      <span v-else-if="findings.length === 0 && scan.hasRun" class="status-tag status-tag-muted"
        >No embedded executables detected</span
      >
    </div>

    <div v-if="scan.truncated" class="warning-banner" role="alert">
      Scan stopped at the maximum of {{ findings.length }} hits — file may be a binary collection or
      repacking artifact.
    </div>

    <div v-if="findings.length > 0" class="findings-table-wrapper">
      <table class="findings-table">
        <thead>
          <tr>
            <th scope="col">Format</th>
            <th scope="col">Offset</th>
            <th scope="col">Size</th>
            <th scope="col">Details</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(f, i) in findings" :key="i">
            <td>
              <span class="format-badge" :class="badgeClass(f.format)">{{ f.format }}</span>
            </td>
            <td>
              <button
                type="button"
                class="offset-link"
                :aria-label="`Jump to offset ${formatOffset(f.offset)} in hex view`"
                @click="$emit('jump-to-offset', f.offset)"
              >
                {{ formatOffset(f.offset) }}
              </button>
            </td>
            <td>
              <span v-if="f.fileSize">{{ formatSize(f.fileSize) }}</span>
              <span v-else-if="f.size">{{ formatSize(f.size) }}</span>
              <span v-else class="muted">—</span>
              <span
                v-if="f.overlayBytes > 0"
                class="overlay-badge"
                :title="overlayTooltip(f)"
                aria-label="Includes overlay payload"
                >+overlay</span
              >
            </td>
            <td class="details-cell">{{ formatDetails(f) }}</td>
            <td class="actions-cell">
              <template v-if="getExtractionProgress(f.offset)">
                <span class="extract-progress" role="status" aria-live="polite">
                  <span class="loading-spinner-small" aria-hidden="true"></span>
                  <span class="extract-progress-text">{{ extractionProgressLabel(f.offset) }}</span>
                  <button
                    type="button"
                    class="extract-cancel"
                    :aria-label="`Cancel extraction at offset ${formatOffset(f.offset)}`"
                    @click="$emit('cancel-extract', f.offset)"
                  >
                    ×
                  </button>
                </span>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="extract-button"
                  :disabled="!f.extractable"
                  :title="extractButtonTitle(f)"
                  :aria-label="extractButtonAriaLabel(f)"
                  @click="$emit('extract', f)"
                >
                  Extract
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
import { PE_MACHINE_NAMES, ELF_MACHINE_NAMES, MACHO_CPU_NAMES } from '../utils/architectureNames.js'

export default {
  name: 'EmbeddedExecutables',

  props: {
    findings: {
      type: Array,
      default: () => []
    },
    scan: {
      type: Object,
      required: true
    },
    // Map keyed by finding offset → { bytesRead, totalBytes }. Presence of an
    // entry indicates an extraction is currently in flight for that offset.
    extractionStates: {
      type: Object,
      default: () => ({})
    }
  },

  emits: ['cancel', 'jump-to-offset', 'extract', 'cancel-extract'],

  computed: {
    shouldRender() {
      return this.scan.inProgress || this.scan.hasRun
    },
    progressLabel() {
      if (!this.scan.total) return 'Scanning…'
      const pct = Math.min(100, Math.floor((this.scan.scanned / this.scan.total) * 100))
      return `Scanning… ${pct}%`
    }
  },

  methods: {
    formatOffset(offset) {
      const hex = offset.toString(16).toUpperCase()
      const width = hex.length <= 8 ? 8 : 16
      return `0x${hex.padStart(width, '0')}`
    },
    formatSize(bytes) {
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
      return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
    },
    formatDetails(f) {
      const d = f.details || {}
      const parts = []
      if (f.format === 'PE') {
        const name = PE_MACHINE_NAMES[d.machine]
        if (name) parts.push(name)
        else if (typeof d.machine === 'number') parts.push(`machine 0x${d.machine.toString(16)}`)
        if (d.is64bit !== undefined) parts.push(d.is64bit ? '64-bit' : '32-bit')
      } else if (f.format === 'ELF') {
        const name = ELF_MACHINE_NAMES[d.machine]
        if (name) parts.push(name)
        else if (typeof d.machine === 'number') parts.push(`machine 0x${d.machine.toString(16)}`)
        if (d.is64bit !== undefined) parts.push(d.is64bit ? '64-bit' : '32-bit')
        if (d.isLittleEndian !== undefined) parts.push(d.isLittleEndian ? 'LE' : 'BE')
      } else if (f.format === 'Mach-O') {
        const name = MACHO_CPU_NAMES[d.cputype]
        if (name) parts.push(name)
        if (d.is64bit !== undefined) parts.push(d.is64bit ? '64-bit' : '32-bit')
        if (typeof d.ncmds === 'number') parts.push(`${d.ncmds} cmds`)
      } else if (f.format === 'Mach-O Fat') {
        if (typeof d.nfatArch === 'number') parts.push(`${d.nfatArch} arch`)
      }
      return parts.join(' · ')
    },
    badgeClass(format) {
      switch (format) {
        case 'PE':
          return 'badge-pe'
        case 'ELF':
          return 'badge-elf'
        case 'Mach-O':
        case 'Mach-O Fat':
          return 'badge-macho'
        default:
          return ''
      }
    },
    getExtractionProgress(offset) {
      return this.extractionStates[offset] || null
    },
    extractionProgressLabel(offset) {
      const state = this.extractionStates[offset]
      if (!state || !state.totalBytes) return 'Extracting…'
      const pct = Math.min(100, Math.floor((state.bytesRead / state.totalBytes) * 100))
      return `Extracting… ${pct}%`
    },
    extractButtonTitle(f) {
      if (f.extractable) return `Extract this ${f.format} as a separate file`
      return f.extractError || 'This executable cannot be extracted'
    },
    extractButtonAriaLabel(f) {
      const offsetText = this.formatOffset(f.offset)
      if (f.extractable) return `Extract ${f.format} at offset ${offsetText}`
      return `Cannot extract ${f.format} at offset ${offsetText}: ${f.extractError || 'unknown reason'}`
    },
    overlayTooltip(f) {
      const strict =
        typeof f.strictFileSize === 'number' ? f.strictFileSize : f.fileSize - f.overlayBytes
      return `${this.formatSize(strict)} headers + sections, plus ${this.formatSize(f.overlayBytes)} of appended overlay payload (typical for installers like NSIS / Inno Setup / 7z SFX). Extraction includes the full bundle.`
    }
  }
}
</script>

<style scoped>
.embedded-executables {
  margin-bottom: 24px;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.embedded-executables h3 {
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.scan-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top-color: var(--link-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.cancel-button {
  background-color: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.cancel-button:hover {
  background-color: var(--bg-secondary);
}

.cancel-button:focus-visible {
  outline: 2px solid var(--link-color);
  outline-offset: 2px;
}

.status-tag {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.status-tag-warning {
  background-color: rgba(237, 137, 54, 0.2);
  color: rgb(237, 137, 54);
}

.status-tag-muted {
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
}

.warning-banner {
  background-color: rgba(237, 137, 54, 0.15);
  border-left: 4px solid rgb(237, 137, 54);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.findings-table-wrapper {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow-x: auto;
}

.findings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.findings-table th,
.findings-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.findings-table th {
  background-color: var(--bg-secondary);
  font-weight: 600;
  color: var(--text-primary);
}

.findings-table tr:last-child td {
  border-bottom: none;
}

.format-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.badge-pe {
  background-color: rgba(66, 153, 225, 0.2);
  color: rgb(66, 153, 225);
}

.badge-elf {
  background-color: rgba(72, 187, 120, 0.2);
  color: rgb(72, 187, 120);
}

.badge-macho {
  background-color: rgba(160, 105, 245, 0.2);
  color: rgb(160, 105, 245);
}

.offset-link {
  background: none;
  border: none;
  padding: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--link-color);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.offset-link:hover {
  text-decoration-style: solid;
}

.offset-link:focus-visible {
  outline: 2px solid var(--link-color);
  outline-offset: 2px;
  border-radius: 2px;
}

.details-cell {
  color: var(--text-secondary);
}

.muted {
  color: var(--text-secondary);
}

.overlay-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  background-color: rgba(237, 137, 54, 0.18);
  color: rgb(237, 137, 54);
  cursor: help;
  vertical-align: middle;
}

.actions-cell {
  white-space: nowrap;
}

.extract-button {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.extract-button:hover:not(:disabled) {
  background-color: var(--bg-primary);
  border-color: var(--link-color);
  color: var(--link-color);
}

.extract-button:focus-visible {
  outline: 2px solid var(--link-color);
  outline-offset: 2px;
}

.extract-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.extract-progress {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.loading-spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-color);
  border-top-color: var(--link-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.extract-progress-text {
  font-variant-numeric: tabular-nums;
}

.extract-cancel {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  width: 20px;
  height: 20px;
  line-height: 1;
  padding: 0;
  border-radius: 50%;
  font-size: 0.9rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.extract-cancel:hover {
  color: rgb(237, 137, 54);
  border-color: rgb(237, 137, 54);
}

.extract-cancel:focus-visible {
  outline: 2px solid var(--link-color);
  outline-offset: 2px;
}
</style>
