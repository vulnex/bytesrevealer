/**
 * VULNEX -Bytes Revealer-
 *
 * File: StringAnalysisView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="string-analysis">
    <!-- Header Section -->
    <div class="header-section">
      <h2>String Analysis</h2>
      <p>Extracted ASCII and UTF-8 strings from the binary file</p>
    </div>

    <!-- Loading Progress -->
    <div v-if="isLoading" class="loading-section">
      <div class="progress-text">
        Extracting strings from large file... {{ progress.toFixed(1) }}%
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>

    <!-- Stats Section -->
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-label">Total Strings</div>
        <div class="stat-value">{{ strings.length }}</div>
      </div>
      <div class="stat-card ascii">
        <div class="stat-label">ASCII Strings</div>
        <div class="stat-value">
          {{ strings.filter(s => s.type === 'ASCII').length }}
        </div>
      </div>
      <div class="stat-card utf8">
        <div class="stat-label">UTF-8 Strings</div>
        <div class="stat-value">
          {{ strings.filter(s => s.type === 'UTF-8').length }}
        </div>
      </div>
      <div class="stat-card utf16">
        <div class="stat-label">UTF-16 Strings</div>
        <div class="stat-value">
          {{ strings.filter(s => s.type.includes('UTF-16')).length }}
        </div>
      </div>
    </div>

    <!-- Search and Filter Section -->
    <div class="filter-section">
      <div class="filter-controls">
        <div class="search-container">
          <input
            type="text"
            v-model="searchQuery"
            :placeholder="useRegex ? 'Enter regex pattern...' : 'Search strings...'"
            class="search-input"
            :class="{ 'regex-mode': useRegex, 'regex-error': regexError }"
          >
          <label class="regex-toggle" title="Enable regex search">
            <input type="checkbox" v-model="useRegex">
            <span>Regex</span>
          </label>
        </div>
        <select v-model="typeFilter" class="filter-select">
          <option value="all">All Types</option>
          <option value="ASCII">ASCII Only</option>
          <option value="UTF-8">UTF-8 Only</option>
          <option value="UTF-16">UTF-16 Only</option>
        </select>
        <select v-model="sortBy" class="filter-select">
          <option value="size">Sort by Size</option>
          <option value="type">Sort by Type</option>
          <option value="offset">Sort by Offset</option>
        </select>
      </div>
      <div v-if="regexError" class="regex-error-message">
        Invalid regex pattern: {{ regexError }}
      </div>
    </div>

    <!-- Table Section -->
    <div class="table-container">
      <table class="strings-table">
        <thead>
          <tr>
            <th class="th-offset">Offset</th>
            <th class="th-type">Type</th>
            <th class="th-size">Size</th>
            <th class="th-content">String Content</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(str, index) in paginatedStrings"
              :key="index"
              class="string-row">
            <td class="cell-offset">
              <code>0x{{ (str.offset || 0).toString(16).toUpperCase().padStart(8, '0') }}</code>
            </td>
            <td class="cell-type">
              <span class="type-badge" :class="getTypeClass(str.type)">
                {{ str.type }}
              </span>
            </td>
            <td class="cell-size">
              {{ str.size }} chars
            </td>
            <td class="cell-content">
              <div class="string-value" :title="str.value">
                {{ truncateString(str.value, 100) }}
              </div>
            </td>
            <td class="cell-actions">
              <button
                @click="copyString(str.value)"
                class="action-btn copy"
                title="Copy string"
              >
                📋
              </button>
              <button
                @click="showDetails(str)"
                class="action-btn details"
                title="View details"
              >
                🔍
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty state -->
      <div v-if="filteredAndSortedStrings.length === 0" class="empty-state">
        <p>No strings found matching your criteria</p>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        @click="currentPage = Math.max(1, currentPage - 1)"
        :disabled="currentPage === 1"
        class="page-btn"
      >
        Previous
      </button>
      <span class="page-info">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      <button
        @click="currentPage = Math.min(totalPages, currentPage + 1)"
        :disabled="currentPage === totalPages"
        class="page-btn"
      >
        Next
      </button>
    </div>

    <!-- String Details Modal -->
    <div v-if="selectedString" class="modal-overlay" @click="selectedString = null">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>String Details</h3>
          <button @click="selectedString = null" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <label>Offset:</label>
            <code>0x{{ (selectedString.offset || 0).toString(16).toUpperCase().padStart(8, '0') }}</code>
          </div>
          <div class="detail-row">
            <label>Type:</label>
            <span class="type-badge" :class="getTypeClass(selectedString.type)">
              {{ selectedString.type }}
            </span>
          </div>
          <div class="detail-row">
            <label>Length:</label>
            <span>{{ selectedString.size }} characters</span>
          </div>
          <div class="detail-row">
            <label>Content:</label>
            <div class="string-full-content">
              {{ selectedString.value }}
            </div>
          </div>
          <div class="modal-actions">
            <button @click="copyString(selectedString.value)" class="modal-btn primary">
              Copy String
            </button>
            <button @click="selectedString = null" class="modal-btn">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Copy notification -->
    <div v-if="showCopyNotification" class="copy-notification">
      String copied to clipboard!
    </div>
  </div>
</template>

<script>
export default {
  name: 'StringAnalysisView',

  props: {
    fileBytes: {
      type: [Array, Uint8Array],
      required: true
    }
  },

  data() {
    return {
      strings: [],
      searchQuery: '',
      typeFilter: 'all',
      sortBy: 'size',
      isLoading: false,
      progress: 0,
      worker: null,
      isLargeFile: false,
      currentPage: 1,
      itemsPerPage: 50,
      selectedString: null,
      showCopyNotification: false,
      useRegex: false,
      regexError: null
    }
  },

  computed: {
    filteredAndSortedStrings() {
      let result = [...this.strings];

      // Apply type filter
      if (this.typeFilter !== 'all') {
        if (this.typeFilter === 'UTF-16') {
          // Handle UTF-16 variants (UTF-16LE, UTF-16BE)
          result = result.filter(str => str.type.includes('UTF-16'));
        } else {
          result = result.filter(str => str.type === this.typeFilter);
        }
      }

      // Apply search filter
      if (this.searchQuery) {
        if (this.useRegex) {
          // Regex mode
          try {
            const regex = new RegExp(this.searchQuery, 'i');
            this.regexError = null;
            result = result.filter(str =>
              regex.test(str.value) || regex.test(str.type)
            );
          } catch (error) {
            this.regexError = error.message;
            // If regex is invalid, don't filter
            result = [...this.strings];
          }
        } else {
          // Normal string search
          const query = this.searchQuery.toLowerCase();
          result = result.filter(str =>
            str.value.toLowerCase().includes(query) ||
            str.type.toLowerCase().includes(query)
          );
        }
      } else {
        this.regexError = null;
      }

      // Apply sorting
      result.sort((a, b) => {
        if (this.sortBy === 'size') {
          return b.size - a.size;
        } else if (this.sortBy === 'offset') {
          return (a.offset || 0) - (b.offset || 0);
        } else {
          return a.type.localeCompare(b.type);
        }
      });

      return result;
    },

    totalPages() {
      return Math.ceil(this.filteredAndSortedStrings.length / this.itemsPerPage);
    },

    paginatedStrings() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredAndSortedStrings.slice(start, end);
    }
  },

  watch: {
    fileBytes: {
      immediate: true,
      handler: 'extractStrings'
    },

    filteredAndSortedStrings() {
      // Reset to first page when filters change
      this.currentPage = 1;
    },

    useRegex() {
      // Clear regex error when switching modes
      this.regexError = null;
    }
  },

  beforeUnmount() {
    // Clean up worker if it exists
    this.cleanupWorker();
  },

  methods: {
    getTypeClass(type) {
      if (type === 'ASCII') return 'type-ascii';
      if (type === 'UTF-8') return 'type-utf8';
      if (type.includes('UTF-16')) return 'type-utf16';
      return 'type-other';
    },

    truncateString(str, maxLength) {
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength) + '...';
    },

    async copyString(text) {
      try {
        await navigator.clipboard.writeText(text);
        this.showCopyNotification = true;
        setTimeout(() => {
          this.showCopyNotification = false;
        }, 2000);
      } catch (err) {
        // console.error('Failed to copy:', err);
      }
    },

    showDetails(str) {
      this.selectedString = str;
    },

    escapeString(str) {
      return str
        .replace(/[\x00-\x1F\x7F-\x9F]/g, (char) =>
          `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`
        );
    },

    async extractStrings() {
      this.strings = [];
      if (!this.fileBytes.length) return;

      // Check if it's a large file (>10MB)
      this.isLargeFile = this.fileBytes.length > 10 * 1024 * 1024;

      if (this.isLargeFile) {
        // Use Web Worker for large files
        await this.extractStringsWithWorker();
      } else {
        // Use synchronous extraction for small files
        this.extractStringsSynchronous();
      }
    },

    async extractStringsWithWorker() {
      this.isLoading = true;
      this.progress = 0;

      try {
        // Create worker using inline code for better compatibility
        this.worker = this.createStringAnalysisWorker();

        // Set up message handlers
        this.worker.addEventListener('message', (event) => {
          const { type, results, progress, error } = event.data;

          if (type === 'progress') {
            this.progress = progress;
          } else if (type === 'complete') {
            this.processWorkerResults(results);
            this.isLoading = false;
            this.cleanupWorker();
          } else if (type === 'error') {
            // console.error('Worker error:', error);
            this.isLoading = false;
            this.cleanupWorker();
            // Fallback to synchronous extraction
            this.extractStringsSynchronous();
          }
        });

        // Start analysis
        this.worker.postMessage({
          type: 'analyze',
          data: this.fileBytes,
          options: {
            minLength: 4,
            maxResults: 10000,
            encoding: 'all'
          }
        });
      } catch (error) {
        // console.error('Failed to create worker:', error);
        this.isLoading = false;
        // Fallback to synchronous extraction
        this.extractStringsSynchronous();
      }
    },

    processWorkerResults(results) {
      this.strings = [];

      // Process ASCII strings
      if (results.ascii && results.ascii.length > 0) {
        results.ascii.forEach(str => {
          this.strings.push({
            type: 'ASCII',
            size: str.length,
            value: this.escapeString(str.value),
            offset: str.offset
          });
        });
      }

      // Process UTF-16 strings
      const utf16le = results.utf16le || [];
      const utf16be = results.utf16be || [];
      [...utf16le, ...utf16be].forEach(str => {
        this.strings.push({
          type: str.encoding,
          size: str.length,
          value: this.escapeString(str.value),
          offset: str.offset
        });
      });

      // Add interesting strings at the top
      if (results.interesting && results.interesting.length > 0) {
        // console.log('Found interesting strings:', results.interesting);
      }
    },

    cleanupWorker() {
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
    },

    createStringAnalysisWorker() {
      // Inline worker code for production compatibility
      const workerCode = `
        self.addEventListener('message', async (event) => {
          const { type, data, options } = event.data;

          if (type === 'analyze') {
            try {
              const results = await analyzeStrings(data, options);
              self.postMessage({ type: 'complete', results });
            } catch (error) {
              self.postMessage({ type: 'error', error: error.message });
            }
          }
        });

        async function analyzeStrings(fileBytes, options = {}) {
          const {
            minLength = 4,
            maxResults = 10000,
            chunkSize = 1024 * 1024,
            encoding = 'all'
          } = options;

          const results = {
            ascii: [],
            utf16le: [],
            utf16be: [],
            totalFound: 0,
            processedBytes: 0
          };

          const totalBytes = fileBytes.length;
          let processedBytes = 0;

          for (let offset = 0; offset < totalBytes; offset += chunkSize) {
            const endOffset = Math.min(offset + chunkSize, totalBytes);
            const chunk = fileBytes.slice(offset, endOffset);

            if (encoding === 'ascii' || encoding === 'all') {
              extractAsciiStrings(chunk, offset, minLength, results.ascii, maxResults);
            }

            processedBytes = endOffset;

            if (processedBytes % (chunkSize * 10) === 0 || processedBytes === totalBytes) {
              self.postMessage({
                type: 'progress',
                progress: (processedBytes / totalBytes) * 100,
                found: results.ascii.length
              });
            }

            if (results.ascii.length >= maxResults) break;
          }

          results.totalFound = results.ascii.length;
          results.processedBytes = processedBytes;
          return results;
        }

        function extractAsciiStrings(bytes, baseOffset, minLength, results, maxResults) {
          let current = [];
          let startOffset = baseOffset;

          for (let i = 0; i < bytes.length && results.length < maxResults; i++) {
            const byte = bytes[i];

            if (byte >= 0x20 && byte <= 0x7E) {
              if (current.length === 0) {
                startOffset = baseOffset + i;
              }
              current.push(String.fromCharCode(byte));
            } else {
              if (current.length >= minLength) {
                results.push({
                  offset: startOffset,
                  length: current.length,
                  value: current.join(''),
                  encoding: 'ASCII'
                });
              }
              current = [];
            }
          }

          if (current.length >= minLength && results.length < maxResults) {
            results.push({
              offset: startOffset,
              length: current.length,
              value: current.join(''),
              encoding: 'ASCII'
            });
          }
        }
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      // Clean up blob URL after worker is created
      setTimeout(() => URL.revokeObjectURL(workerUrl), 1000);

      return worker;
    },

    extractStringsSynchronous() {
      this.strings = [];
      let currentString = '';
      let currentType = 'ASCII';
      let startOffset = 0;

      for (let i = 0; i < this.fileBytes.length; i++) {
        const byte = this.fileBytes[i];

        if (byte >= 0x20 && byte <= 0x7E) {
          if (currentString.length === 0) {
            startOffset = i;
          }
          currentString += String.fromCharCode(byte);
        } else {
          try {
            const utf8Bytes = this.fileBytes.slice(i, i + 4);
            const utf8String = new TextDecoder('utf-8').decode(new Uint8Array(utf8Bytes));

            if (utf8String.length > 0 && /^[\u0080-\uFFFF]/.test(utf8String)) {
              if (currentString) {
                this.addString(currentString, currentType, startOffset);
                currentString = '';
              }
              currentType = 'UTF-8';
              startOffset = i;
              currentString = utf8String;
              i += utf8String.length - 1;
              continue;
            }
          } catch {
            // Not a valid UTF-8 sequence
          }

          if (currentString) {
            this.addString(currentString, currentType, startOffset);
            currentString = '';
            currentType = 'ASCII';
          }
        }
      }

      if (currentString) {
        this.addString(currentString, currentType, startOffset);
      }
    },

    addString(str, type, offset = 0) {
      if (str.trim().length > 3) {  // Minimum 4 characters
        this.strings.push({
          type: type,
          size: str.length,
          value: this.escapeString(str),
          offset: offset
        });
      }
    }
  }
}
</script>

<style scoped>
.string-analysis {
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

.loading-section {
  padding: 20px;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 20px;
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.stat-card {
  padding: 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-primary));
  border: 1px solid var(--border-color);
}

.stat-card.total {
  background: linear-gradient(135deg, rgba(66, 153, 225, 0.1), rgba(66, 153, 225, 0.05));
}

.stat-card.ascii {
  background: linear-gradient(135deg, rgba(72, 187, 120, 0.1), rgba(72, 187, 120, 0.05));
}

.stat-card.utf8 {
  background: linear-gradient(135deg, rgba(237, 137, 54, 0.1), rgba(237, 137, 54, 0.05));
}

.stat-card.utf16 {
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

.filter-section {
  padding: 20px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.filter-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.search-container {
  flex: 1;
  min-width: 250px;
  display: flex;
  align-items: center;
  position: relative;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  padding-right: 70px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.search-input.regex-mode {
  border-color: #9f7aea;
  background-color: rgba(159, 122, 234, 0.05);
}

.search-input.regex-error {
  border-color: #f56565;
  background-color: rgba(245, 101, 101, 0.05);
}

.search-input:focus {
  outline: none;
  border-color: var(--link-color);
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.regex-toggle {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.regex-toggle:hover {
  background-color: var(--bg-hover);
}

.regex-toggle input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.regex-toggle input[type="checkbox"]:checked + span {
  color: #9f7aea;
  font-weight: 600;
}

.regex-error-message {
  color: #f56565;
  font-size: 0.85rem;
  margin-top: 8px;
  padding: 8px 12px;
  background-color: rgba(245, 101, 101, 0.1);
  border-radius: 4px;
  border-left: 3px solid #f56565;
}

.filter-select {
  padding: 8px 12px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--link-color);
}

.table-container {
  padding: 20px;
  overflow-x: auto;
}

.strings-table {
  width: 100%;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  border-collapse: separate;
  border-spacing: 0;
}

.strings-table thead {
  background-color: var(--bg-secondary);
}

.strings-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid var(--border-color);
}

.th-offset { width: 120px; }
.th-type { width: 100px; }
.th-size { width: 100px; }
.th-content { flex: 1; }
.th-actions { width: 100px; }

.string-row {
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s;
}

.string-row:hover {
  background-color: var(--bg-hover);
}

.string-row td {
  padding: 12px;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.cell-offset code {
  background-color: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.type-badge {
  display: inline-flex;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.type-ascii {
  background-color: rgba(72, 187, 120, 0.2);
  color: rgb(72, 187, 120);
}

.type-utf8 {
  background-color: rgba(237, 137, 54, 0.2);
  color: rgb(237, 137, 54);
}

.type-utf16 {
  background-color: rgba(159, 122, 234, 0.2);
  color: rgb(159, 122, 234);
}

.type-other {
  background-color: rgba(107, 114, 128, 0.2);
  color: rgb(107, 114, 128);
}

.cell-size {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.string-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-all;
  max-width: 500px;
  line-height: 1.4;
}

.cell-actions {
  white-space: nowrap;
}

.action-btn {
  padding: 4px 8px;
  margin-right: 4px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: var(--link-color);
  transform: translateY(-1px);
}

.action-btn.copy:hover {
  background-color: #48bb78;
}

.action-btn.details:hover {
  background-color: #4299e1;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-top: 1px solid var(--border-color);
}

.page-btn {
  padding: 8px 16px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background-color: var(--link-color);
  color: white;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--bg-primary);
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.detail-row {
  margin-bottom: 16px;
}

.detail-row label {
  display: block;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 4px;
}

.detail-row code {
  background-color: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.string-full-content {
  background-color: var(--bg-secondary);
  padding: 12px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}

.modal-actions {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid var(--border-color);
}

.modal-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.modal-btn.primary {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.modal-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.copy-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #48bb78;
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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

/* Dark mode support */
:root[class='dark-mode'] .string-analysis {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .strings-table {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .modal-content {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .action-btn {
  background-color: var(--bg-secondary);
}

/* Responsive design */
@media (max-width: 768px) {
  .filter-controls {
    flex-direction: column;
  }

  .search-input {
    width: 100%;
  }

  .th-offset,
  .th-size {
    display: none;
  }

  .cell-offset,
  .cell-size {
    display: none;
  }
}
</style>