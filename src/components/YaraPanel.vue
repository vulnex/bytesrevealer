/** * VULNEX -Bytes Revealer- * * File: YaraPanel.vue * Author: Simon Roses Femerling * Created:
2026-02-10 * Last Modified: 2026-02-10 * Version: 0.4 * License: Apache-2.0 * Copyright (c)
2025-2026 VULNEX. All rights reserved. * https://www.vulnex.com */

<template>
  <div class="yara-panel">
    <!-- Header Section -->
    <div class="header-section">
      <h2>YARA Rule Scanner</h2>
      <p>Run YARA pattern matching rules against the loaded binary (powered by libyara-wasm)</p>
    </div>

    <!-- Large file warning -->
    <div v-if="isLargeFile" class="warning-banner">
      <span class="warning-icon">!</span>
      <span
        >File is larger than 50 MB. YARA scanning may be slow and could cause browser performance
        issues.</span
      >
    </div>

    <!-- Rule Editor Section -->
    <div class="editor-section">
      <div class="editor-controls">
        <div class="control-row">
          <label class="control-label">Rule Set:</label>
          <select
            v-model="selectedBuiltIn"
            aria-label="YARA rule set"
            class="rule-select"
            @change="onBuiltInChange"
          >
            <option value="">-- Custom / Manual --</option>
            <option v-for="rs in builtinRuleSets" :key="rs.id" :value="rs.id">
              {{ rs.name }}
            </option>
          </select>
          <button class="import-btn" title="Import .yar file from disk" @click="triggerImport">
            Import .yar
          </button>
          <input
            ref="fileImport"
            type="file"
            accept=".yar,.yara,.txt"
            class="hidden-input"
            @change="handleImport"
          />
        </div>
        <div v-if="yaraStore.importedFileName" class="imported-info">
          Imported: {{ yaraStore.importedFileName }}
        </div>
      </div>

      <textarea
        v-model="rulesText"
        class="rules-editor"
        aria-label="YARA rules editor"
        placeholder="Enter YARA rules here, or select a built-in rule set above..."
        spellcheck="false"
        rows="12"
      ></textarea>
    </div>

    <!-- Action Bar -->
    <div class="action-bar">
      <button
        class="scan-btn"
        :disabled="yaraStore.isScanning || !rulesText.trim()"
        @click="runScan"
      >
        {{ yaraStore.isScanning ? 'Scanning...' : 'Scan' }}
      </button>
      <button
        v-if="yaraStore.hasResults || yaraStore.hasCompileErrors"
        class="clear-btn"
        @click="yaraStore.clearResults()"
      >
        Clear Results
      </button>
      <label class="highlight-toggle">
        <input v-model="highlightInHex" type="checkbox" />
        <span>Highlight matches in Hex View</span>
      </label>
    </div>

    <!-- Progress Bar -->
    <div v-if="yaraStore.isScanning" class="progress-section" role="status" aria-live="polite">
      <div class="progress-text">Scanning... {{ yaraStore.scanProgress }}%</div>
      <div
        class="progress-bar"
        role="progressbar"
        :aria-valuenow="yaraStore.scanProgress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="YARA scan progress"
      >
        <div class="progress-fill" :style="{ width: `${yaraStore.scanProgress}%` }"></div>
      </div>
    </div>

    <!-- Compile Errors -->
    <div v-if="yaraStore.hasCompileErrors" class="errors-section">
      <h3>Compile Errors</h3>
      <div
        v-for="(err, idx) in yaraStore.compileErrors"
        :key="idx"
        class="error-item"
        :class="err.type === 'warning' ? 'warning' : 'error'"
      >
        <span class="error-type">{{ err.type || 'error' }}</span>
        <span v-if="err.lineNumber"> line {{ err.lineNumber }}:</span>
        {{ err.message }}
      </div>
    </div>

    <!-- Console Logs -->
    <div v-if="yaraStore.consoleLogs.length > 0" class="console-section">
      <h3>Console Output</h3>
      <pre class="console-output">{{ yaraStore.consoleLogs.join('\n') }}</pre>
    </div>

    <!-- Error message -->
    <div v-if="yaraStore.error" class="scan-error">
      {{ yaraStore.error }}
    </div>

    <!-- Results Summary -->
    <div v-if="yaraStore.hasResults" class="results-section">
      <div class="stats-grid">
        <div class="stat-card matched-rules">
          <div class="stat-label">Matched Rules</div>
          <div class="stat-value">{{ yaraStore.matchedRules.length }}</div>
        </div>
        <div class="stat-card total-matches">
          <div class="stat-label">Total Matches</div>
          <div class="stat-value">{{ yaraStore.totalMatches }}</div>
        </div>
        <div class="stat-card duration">
          <div class="stat-label">Duration</div>
          <div class="stat-value">{{ formatDuration(yaraStore.lastScanDuration) }}</div>
        </div>
      </div>

      <!-- Results Detail -->
      <div class="results-detail">
        <div v-for="(rule, rIdx) in yaraStore.matchedRules" :key="rIdx" class="rule-card">
          <div class="rule-header" @click="toggleRule(rIdx)">
            <span class="collapse-icon">{{ expandedRules[rIdx] ? '&#9660;' : '&#9654;' }}</span>
            <span class="rule-name">{{ rule.ruleName }}</span>
            <span class="match-count"
              >{{ rule.matches ? rule.matches.length : 0 }} match{{
                rule.matches && rule.matches.length !== 1 ? 'es' : ''
              }}</span
            >
          </div>

          <div v-if="expandedRules[rIdx]" class="rule-body">
            <div v-if="rule.matches && rule.matches.length > 0" class="match-table-wrapper">
              <table class="match-table">
                <thead>
                  <tr>
                    <th>Offset</th>
                    <th>String ID</th>
                    <th>Length</th>
                    <th>Data</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(match, mIdx) in rule.matches" :key="mIdx">
                    <td class="cell-offset">
                      <code>0x{{ match.offset.toString(16).toUpperCase().padStart(8, '0') }}</code>
                    </td>
                    <td class="cell-stringid">{{ match.stringIdentifier }}</td>
                    <td class="cell-length">{{ match.length }}</td>
                    <td class="cell-data">
                      <code class="match-data">{{ truncateData(match.data, 40) }}</code>
                    </td>
                    <td class="cell-action">
                      <button
                        class="go-btn"
                        :aria-label="'Go to offset 0x' + match.offset.toString(16).toUpperCase()"
                        @click="goToOffset(match)"
                      >
                        Go
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="no-matches">
              Rule matched (condition true) but no string matches to display.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No matches found after scan -->
    <div
      v-if="
        !yaraStore.hasResults &&
        !yaraStore.hasCompileErrors &&
        !yaraStore.isScanning &&
        !yaraStore.error &&
        yaraStore.lastScanTimestamp
      "
      class="no-results-banner"
    >
      <div class="no-results-icon">0</div>
      <div class="no-results-text">
        <strong>No matches found</strong>
        <p>
          The scan completed in {{ formatDuration(yaraStore.lastScanDuration) }} with no rule
          matches.
        </p>
      </div>
    </div>

    <!-- Empty state (never scanned yet) -->
    <div
      v-if="
        !yaraStore.hasResults &&
        !yaraStore.hasCompileErrors &&
        !yaraStore.isScanning &&
        !yaraStore.error &&
        !yaraStore.lastScanTimestamp
      "
      class="empty-state"
    >
      <p>
        Enter or select YARA rules above, then click <strong>Scan</strong> to analyze the loaded
        file.
      </p>
    </div>
  </div>
</template>

<script>
import { useYaraStore } from '../stores/yara'
import { BUILTIN_RULE_SETS } from '../yara/builtinRules'

export default {
  name: 'YaraPanel',

  props: {
    fileBytes: {
      type: [Array, Uint8Array],
      required: true
    }
  },

  emits: ['navigate-to-offset'],

  data() {
    return {
      rulesText: '',
      selectedBuiltIn: '',
      builtinRuleSets: BUILTIN_RULE_SETS,
      worker: null,
      expandedRules: {},
      yaraStore: null,
      scanId: 0
    }
  },

  computed: {
    isLargeFile() {
      return this.fileBytes && this.fileBytes.length > 50 * 1024 * 1024
    },
    highlightInHex: {
      get() {
        return this.yaraStore ? this.yaraStore.highlightMatchesInHex : false
      },
      set(val) {
        if (this.yaraStore && val !== this.yaraStore.highlightMatchesInHex) {
          this.yaraStore.toggleHexHighlight()
        }
      }
    }
  },

  watch: {
    'yaraStore.currentRules'(val) {
      if (val !== this.rulesText) {
        this.rulesText = val
      }
    }
  },

  created() {
    this.yaraStore = useYaraStore()
    // Sync initial rules from store
    if (this.yaraStore.currentRules) {
      this.rulesText = this.yaraStore.currentRules
    }
  },

  beforeUnmount() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  },

  methods: {
    onBuiltInChange() {
      if (!this.selectedBuiltIn) {
        this.yaraStore.setRules('')
        this.rulesText = ''
        return
      }
      const ruleSet = this.builtinRuleSets.find((rs) => rs.id === this.selectedBuiltIn)
      if (ruleSet) {
        this.yaraStore.selectBuiltInRuleSet(ruleSet.id, ruleSet.rules)
        this.rulesText = ruleSet.rules
      }
    },

    triggerImport() {
      this.$refs.fileImport.click()
    },

    handleImport(event) {
      const file = event.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target.result
        this.yaraStore.setImportedRules(file.name, content)
        this.rulesText = content
        this.selectedBuiltIn = ''
      }
      reader.readAsText(file)

      // Reset input so the same file can be imported again
      event.target.value = ''
    },

    async runScan() {
      if (!this.rulesText.trim() || !this.fileBytes || !this.fileBytes.length) return

      // Increment scanId and capture for this invocation
      const currentScanId = ++this.scanId

      // If a scan is already in progress, terminate and recreate the worker
      if (this.yaraStore.isScanning && this.worker) {
        this.worker.terminate()
        this.worker = null
      }

      // Sync rules text to store
      this.yaraStore.setRules(this.rulesText)
      this.yaraStore.isScanning = true
      this.yaraStore.scanProgress = 0
      this.yaraStore.error = null
      this.yaraStore.clearResults()

      // Lazily create worker
      if (!this.worker) {
        this.worker = new Worker(new URL('../workers/YaraWorker.js', import.meta.url), {
          type: 'module'
        })
      }

      // Get file data as Uint8Array
      const fileData =
        this.fileBytes instanceof Uint8Array ? this.fileBytes : new Uint8Array(this.fileBytes)

      try {
        await new Promise((resolve) => {
          this.worker.onmessage = (event) => {
            // Ignore stale results from a previous scan
            if (currentScanId !== this.scanId) {
              resolve()
              return
            }

            const { type, ...data } = event.data

            switch (type) {
              case 'progress':
                this.yaraStore.scanProgress = data.progress
                break

              case 'complete':
                this.yaraStore.setScanResults(data.results)
                // Auto-expand first rule
                if (this.yaraStore.matchedRules.length > 0) {
                  this.expandedRules = { 0: true }
                }
                resolve()
                break

              case 'error':
                this.yaraStore.error = data.error
                resolve()
                break
            }
          }

          this.worker.onerror = (err) => {
            if (currentScanId !== this.scanId) {
              resolve()
              return
            }
            this.yaraStore.error = err.message || 'Worker error'
            resolve()
          }

          this.worker.postMessage({
            type: 'scan',
            data: {
              fileData,
              rules: this.rulesText
            }
          })
        })
      } finally {
        // Only reset isScanning if this is still the active scan
        if (currentScanId === this.scanId) {
          this.yaraStore.isScanning = false
        }
      }
    },

    toggleRule(index) {
      this.expandedRules = {
        ...this.expandedRules,
        [index]: !this.expandedRules[index]
      }
    },

    goToOffset(match) {
      this.$emit('navigate-to-offset', {
        offset: match.offset,
        length: match.length
      })
    },

    truncateData(data, maxLen) {
      if (!data) return ''
      if (data.length <= maxLen) return data
      return data.substring(0, maxLen) + '...'
    },

    formatDuration(ms) {
      if (ms == null) return '-'
      if (ms < 1000) return `${ms}ms`
      return `${(ms / 1000).toFixed(2)}s`
    }
  }
}
</script>

<style scoped>
.yara-panel {
  background-color: var(--bg-primary);
  min-height: 100vh;
}

.header-section {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 24px;
}

.header-section h2 {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.header-section p {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* Warning banner */
.warning-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background-color: rgba(237, 137, 54, 0.15);
  border-bottom: 1px solid rgba(237, 137, 54, 0.3);
  color: #ed8936;
  font-size: 0.9rem;
}

.warning-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #ed8936;
  color: white;
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
}

/* Editor section */
.editor-section {
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.editor-controls {
  margin-bottom: 12px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.control-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
}

.rule-select {
  padding: 6px 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
  min-width: 200px;
}

.import-btn {
  padding: 6px 14px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn:hover {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.hidden-input {
  display: none;
}

.imported-info {
  margin-top: 8px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
}

.rules-editor {
  width: 100%;
  padding: 12px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.rules-editor:focus {
  outline: none;
  border-color: var(--link-color);
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

/* Action bar */
.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.scan-btn {
  padding: 8px 24px;
  background-color: #48bb78;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.scan-btn:hover:not(:disabled) {
  background-color: #38a169;
}

.scan-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-btn {
  padding: 8px 16px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.highlight-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  margin-left: auto;
}

.highlight-toggle input[type='checkbox'] {
  cursor: pointer;
}

/* Progress */
.progress-section {
  padding: 16px 20px;
  background-color: rgba(66, 153, 225, 0.1);
  border-bottom: 1px solid rgba(66, 153, 225, 0.2);
}

.progress-text {
  color: var(--link-color);
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 8px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: rgba(66, 153, 225, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--link-color);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Errors */
.errors-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.errors-section h3 {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 10px;
}

.error-item {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  margin-bottom: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.error-item.error {
  background-color: rgba(245, 101, 101, 0.15);
  color: #f56565;
  border-left: 3px solid #f56565;
}

.error-item.warning {
  background-color: rgba(237, 137, 54, 0.15);
  color: #ed8936;
  border-left: 3px solid #ed8936;
}

.error-type {
  font-weight: 600;
  text-transform: uppercase;
  margin-right: 4px;
}

/* Console output */
.console-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.console-section h3 {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 10px;
}

.console-output {
  padding: 10px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  max-height: 150px;
  overflow-y: auto;
}

/* Scan error */
.scan-error {
  padding: 12px 20px;
  background-color: rgba(245, 101, 101, 0.1);
  color: #f56565;
  border-bottom: 1px solid rgba(245, 101, 101, 0.2);
  font-size: 0.9rem;
}

/* Results */
.results-section {
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.stat-card.matched-rules {
  background: linear-gradient(135deg, rgba(72, 187, 120, 0.1), rgba(72, 187, 120, 0.05));
}

.stat-card.total-matches {
  background: linear-gradient(135deg, rgba(66, 153, 225, 0.1), rgba(66, 153, 225, 0.05));
}

.stat-card.duration {
  background: linear-gradient(135deg, rgba(159, 122, 234, 0.1), rgba(159, 122, 234, 0.05));
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 4px;
}

.stat-value {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
}

/* Rule cards */
.results-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background-color: var(--bg-secondary);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.rule-header:hover {
  background-color: var(--hover-bg, var(--bg-secondary));
}

.collapse-icon {
  color: var(--text-secondary);
  font-size: 0.75rem;
  width: 16px;
  text-align: center;
}

.rule-name {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.95rem;
}

.match-count {
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-left: auto;
}

.rule-body {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.match-table-wrapper {
  overflow-x: auto;
}

.match-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.85rem;
}

.match-table th {
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
}

.match-table td {
  padding: 8px 12px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.match-table tr:last-child td {
  border-bottom: none;
}

.cell-offset code {
  background-color: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.cell-stringid {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #9f7aea;
}

.cell-length {
  color: var(--text-secondary);
}

.match-data {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  word-break: break-all;
  background-color: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}

.go-btn {
  padding: 4px 12px;
  background-color: var(--link-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.go-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

.no-matches {
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-style: italic;
  padding: 8px 0;
}

/* No results banner */
.no-results-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  margin: 20px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(66, 153, 225, 0.1), rgba(66, 153, 225, 0.05));
  border: 1px solid var(--border-color);
}

.no-results-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 1.25rem;
  font-weight: 700;
  flex-shrink: 0;
}

.no-results-text strong {
  display: block;
  color: var(--text-primary);
  font-size: 1rem;
  margin-bottom: 4px;
}

.no-results-text p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty-state strong {
  color: var(--text-primary);
}

/* =============================================
   RESPONSIVE / MOBILE SUPPORT
   ============================================= */

/* --- Tablet breakpoint (768px) --- */
@media (max-width: 768px) {
  .control-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .rule-select {
    width: 100%;
    min-width: unset;
  }

  .highlight-toggle {
    margin-left: 0;
  }

  .header-section {
    padding: 16px;
  }

  .header-section h2 {
    font-size: 1.25rem;
  }

  .editor-section {
    padding: 14px;
  }

  .action-bar {
    padding: 12px 14px;
  }

  .results-section {
    padding: 14px;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
  }

  .no-results-banner {
    padding: 16px;
    margin: 12px;
  }

  .match-table th,
  .match-table td {
    padding: 6px 8px;
    font-size: 0.8rem;
  }
}

/* --- Phone breakpoint (480px) --- */
@media (max-width: 480px) {
  .header-section {
    padding: 12px;
  }

  .header-section h2 {
    font-size: 1.1rem;
  }

  .header-section p {
    font-size: 0.85rem;
  }

  .editor-section {
    padding: 10px;
  }

  .rules-editor {
    font-size: 0.8rem;
    padding: 8px;
  }

  .action-bar {
    padding: 10px;
    gap: 8px;
  }

  .scan-btn {
    padding: 6px 16px;
    font-size: 0.85rem;
  }

  .clear-btn {
    padding: 6px 12px;
    font-size: 0.8rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-card {
    padding: 10px;
  }

  .stat-value {
    font-size: 1.25rem;
  }

  .results-section {
    padding: 10px;
  }

  .rule-header {
    padding: 10px 12px;
    gap: 6px;
  }

  .rule-body {
    padding: 8px 12px;
  }

  .no-results-banner {
    flex-direction: column;
    text-align: center;
    padding: 16px;
    margin: 10px;
  }

  .empty-state {
    padding: 30px 12px;
  }

  .import-btn {
    width: 100%;
    text-align: center;
  }

  .warning-banner {
    padding: 10px 14px;
    font-size: 0.85rem;
  }
}
</style>
