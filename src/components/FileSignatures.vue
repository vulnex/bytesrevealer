/**
 * VULNEX -Bytes Revealer-
 *
 * File: FileSignatures.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-01
 * Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 */

<template>
  <div v-if="signatures.length" class="file-signatures">
    <h3>File Signatures</h3>
    <div class="signatures-container">
      <div v-for="(sig, index) in signatures" :key="index" class="signature-card">
        <div class="signature-header">
          <div class="signature-title">
            <span class="signature-name">{{ sig.name }}</span>
            <span class="signature-ext">.{{ sig.extension }}</span>
          </div>
          <div class="confidence-badge" :class="getConfidenceClass(sig.confidence)">
            {{ sig.confidence }}
          </div>
        </div>

        <div class="signature-body">
          <table class="info-table" v-if="sig.pattern">
            <tbody>
              <tr>
                <td class="info-label">Pattern:</td>
                <td class="info-value">
                  <code class="copyable" @click="copyToClipboard(formatPattern(sig.pattern))">
                    {{ formatPattern(sig.pattern) }}
                    <span class="copy-icon">📋</span>
                  </code>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="sig.details" class="details-section">
            <div class="section-title">Details</div>
            <table class="details-table">
              <tbody>
                <tr v-for="(value, key) in sig.details" :key="key">
                  <td class="detail-label">{{ formatKey(key) }}:</td>
                  <td class="detail-value">
                    <span class="copyable-text" @click="copyToClipboard(formatValue(value))">
                      {{ formatValue(value) }}
                      <span class="copy-icon-small">📋</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="sig.nestedFiles && sig.nestedFiles.length" class="nested-section">
            <div class="section-title">Nested Files</div>
            <table class="nested-table">
              <tbody>
                <tr v-for="(nested, nIndex) in sig.nestedFiles" :key="nIndex">
                  <td class="nested-type">{{ nested.type }}</td>
                  <td class="nested-name">{{ nested.name }}</td>
                  <td class="nested-offset">
                    <code class="copyable-text" @click="copyToClipboard(nested.offset.toString(16).toUpperCase().padStart(8, '0'))">
                      0x{{ nested.offset.toString(16).toUpperCase().padStart(8, '0') }}
                      <span class="copy-icon-small">📋</span>
                    </code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="sig.metadata" class="metadata-section">
            <div class="section-title">Metadata</div>
            <div v-if="sig.metadata.error" class="error-message">
              {{ sig.metadata.error }}
            </div>
            <table v-else class="metadata-table">
              <tbody>
                <tr v-for="(value, key) in flattenMetadata(sig.metadata)" :key="key">
                  <td class="metadata-label">{{ formatKey(key) }}:</td>
                  <td class="metadata-value">
                    <span class="copyable-text" @click="copyToClipboard(formatValue(value))">
                      {{ formatValue(value) }}
                      <span class="copy-icon-small">📋</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Copy notification -->
    <div v-if="showCopyNotification" class="copy-notification">
      Copied to clipboard!
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileSignatures',

  props: {
    signatures: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      showCopyNotification: false
    }
  },

  methods: {
    getConfidenceClass(confidence) {
      const classes = {
        'High': 'confidence-high',
        'Medium': 'confidence-medium',
        'Low': 'confidence-low'
      };
      return classes[confidence] || classes['Medium'];
    },

    formatPattern(pattern) {
      if (Array.isArray(pattern)) {
        return pattern.map(byte =>
          byte.toString(16).padStart(2, '0').toUpperCase()
        ).join(' ');
      }
      return pattern;
    },

    formatKey(key) {
      const formattedKey = key.replace(/_/g, ' ');
      return formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
    },

    formatValue(value) {
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    },

    flattenMetadata(metadata, prefix = '') {
      const result = {};

      for (const [key, value] of Object.entries(metadata)) {
        if (value === null || value === undefined) continue;

        if (typeof value === 'object' && !Array.isArray(value)) {
          const nested = this.flattenMetadata(value, `${prefix}${key}.`);
          Object.assign(result, nested);
        } else {
          result[`${prefix}${key}`] = value;
        }
      }

      return result;
    },

    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        this.showCopyNotification = true;
        setTimeout(() => {
          this.showCopyNotification = false;
        }, 2000);
      } catch (err) {
        // console.error('Failed to copy:', err);
      }
    }
  }
}
</script>

<style scoped>
.file-signatures {
  margin-bottom: 24px;
}

.file-signatures h3 {
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.signatures-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.signature-card {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.signature-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.signature-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.signature-name {
  font-weight: 600;
  color: var(--link-color);
  font-size: 1rem;
}

.signature-ext {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.confidence-badge {
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.confidence-high {
  background-color: rgba(72, 187, 120, 0.2);
  color: rgb(72, 187, 120);
}

.confidence-medium {
  background-color: rgba(237, 137, 54, 0.2);
  color: rgb(237, 137, 54);
}

.confidence-low {
  background-color: rgba(239, 68, 68, 0.2);
  color: rgb(239, 68, 68);
}

.signature-body {
  padding: 16px;
}

/* Table styles */
.info-table,
.details-table,
.nested-table,
.metadata-table {
  width: 100%;
  border-collapse: collapse;
}

.info-table td,
.details-table td,
.nested-table td,
.metadata-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.info-table tr:last-child td,
.details-table tr:last-child td,
.nested-table tr:last-child td,
.metadata-table tr:last-child td {
  border-bottom: none;
}

.info-label,
.detail-label,
.metadata-label {
  color: var(--text-secondary);
  font-weight: 500;
  width: 150px;
  font-size: 0.9rem;
}

.info-value,
.detail-value,
.metadata-value {
  color: var(--text-primary);
}

.info-value code {
  background-color: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.copyable {
  cursor: pointer;
  transition: opacity 0.2s;
}

.copyable:hover {
  opacity: 0.8;
}

.copy-icon {
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 12px;
}

.copyable:hover .copy-icon {
  opacity: 1;
}

.copyable-text {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.copyable-text:hover {
  color: var(--link-color);
}

.copy-icon-small {
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.copyable-text:hover .copy-icon-small {
  opacity: 1;
}

.section-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 16px;
  margin-bottom: 12px;
  font-size: 0.95rem;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color);
}

.nested-type {
  color: var(--link-color);
  font-weight: 500;
  width: 120px;
}

.nested-name {
  color: var(--text-primary);
}

.nested-offset {
  width: 150px;
  text-align: right;
}

.nested-offset code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--text-secondary);
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.error-message {
  color: rgb(239, 68, 68);
  font-size: 0.9rem;
  padding: 8px 12px;
  background-color: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
  margin-top: 8px;
}

.copy-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: var(--link-color);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Dark mode adjustments */
:root[class='dark-mode'] .signature-card {
  background-color: var(--bg-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .signature-header {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .info-value code {
  background-color: rgba(45, 55, 72, 0.5);
}

:root[class='dark-mode'] .nested-offset code {
  background-color: transparent;
}

:root[class='dark-mode'] td {
  border-bottom-color: rgba(74, 85, 104, 0.3);
}
</style>