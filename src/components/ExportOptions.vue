/**
 * VULNEX -Bytes Revealer-
 *
 * File: ExportOptions.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2026-02-09
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="export-options p-4">
    <h3 class="text-xl font-semibold mb-4">Export Options</h3>

    <div class="export-sections space-y-4">
      <!-- File Information -->
      <div class="section">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="exportOptions.fileInfo"
            class="form-checkbox"
          >
          <span>Basic File Information</span>
        </label>
        <div class="ml-6 mt-2 space-y-2" v-if="exportOptions.fileInfo">
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              v-model="exportOptions.fileInfo_hashes"
              class="form-checkbox"
            >
            <span>File Hashes</span>
          </label>
          <label class="flex items-center space-x-2">
            <input
              type="checkbox"
              v-model="exportOptions.fileInfo_entropy"
              class="form-checkbox"
            >
            <span>Entropy Analysis</span>
          </label>
        </div>
      </div>

      <!-- Signatures -->
      <div class="section">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="exportOptions.signatures"
            class="form-checkbox"
          >
          <span>File Signatures</span>
        </label>
      </div>

      <!-- Structure Analysis -->
      <div class="section">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="exportOptions.structure"
            class="form-checkbox"
          >
          <span>Structure Analysis</span>
        </label>
      </div>

      <!-- Strings -->
      <div class="section">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="exportOptions.strings"
            class="form-checkbox"
          >
          <span>Extracted Strings</span>
        </label>
      </div>
    </div>

    <div class="mt-6 flex space-x-4">
      <button
        @click="exportData"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        :disabled="!canExport"
      >
        Export to JSON
      </button>
      <button
        @click="resetOptions"
        class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
      >
        Reset Options
      </button>
    </div>

    <!-- USecVisLib Export Section -->
    <div class="export-divider"></div>
    <h3 class="text-xl font-semibold mb-4">
      USecVisLib Export
      <a href="https://github.com/vulnex/usecvislib" target="_blank" rel="noopener noreferrer" class="info-icon" title="Learn more about USecVisLib">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </a>
    </h3>

    <div class="export-sections space-y-4">
      <!-- Binary Visualization Data (JSON) -->
      <div class="section">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="usecvisOptions.binVisJson"
            class="form-checkbox"
            :disabled="!hasFileData"
          >
          <span>Binary Visualization Data (JSON)</span>
        </label>
        <div class="ml-6 mt-2" v-if="usecvisOptions.binVisJson">
          <button
            @click="exportBinVisJson"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            :disabled="!hasFileData"
          >
            Export BinVis JSON
          </button>
        </div>
      </div>

      <!-- Attack Graph Config (TOML) -->
      <div class="section">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="usecvisOptions.attackGraph"
            class="form-checkbox"
            :disabled="!isExecutableBinary"
          >
          <span>Attack Graph Config (TOML)</span>
          <span v-if="!isExecutableBinary" class="text-sm" style="color: var(--text-muted, #888);">(PE/ELF/Mach-O only)</span>
        </label>
        <div class="ml-6 mt-2" v-if="usecvisOptions.attackGraph">
          <button
            @click="exportAttackGraph"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            :disabled="!isExecutableBinary"
          >
            Export Attack Graph
          </button>
        </div>
      </div>

      <!-- Direct API Visualization -->
      <div class="section">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="usecvisOptions.useApi"
            class="form-checkbox"
          >
          <span>Direct API Visualization</span>
        </label>
        <div class="api-section ml-6 mt-2 space-y-3" v-if="usecvisOptions.useApi">
          <div class="flex items-center space-x-2">
            <input
              type="text"
              v-model="apiUrl"
              class="api-url-input"
              placeholder="http://localhost:8003"
            >
            <input
              type="password"
              v-model="apiKey"
              class="api-url-input"
              placeholder="API Key (optional)"
              style="max-width: 180px;"
            >
            <button
              @click="testApiConnection"
              class="btn-test-api"
              :disabled="apiTesting"
            >
              {{ apiTesting ? 'Testing...' : 'Test' }}
            </button>
            <span v-if="apiStatus === 'ok'" class="api-status-ok">Connected ({{ apiVersion }})</span>
            <span v-else-if="apiStatus === 'fail'" class="api-status-fail">Unavailable</span>
          </div>
          <div v-if="apiStatus === 'fail' && apiError" class="api-error-detail">{{ apiError }}</div>

          <div v-if="apiStatus === 'ok'" class="space-y-3">
            <div class="flex items-center space-x-3">
              <label class="text-sm">Type:</label>
              <select v-model="usecvisOptions.visType" class="form-select">
                <option value="entropy">Entropy</option>
                <option value="distribution">Distribution</option>
                <option value="windrose">Wind Rose</option>
                <option value="heatmap">Heatmap</option>
                <option value="all">All</option>
              </select>
            </div>

            <div class="flex items-center space-x-3">
              <label class="text-sm">Style:</label>
              <select v-model="usecvisOptions.style" class="form-select">
                <option value="bv_default">Default</option>
                <option value="bv_dark">Dark</option>
                <option value="bv_security">Security</option>
                <option value="bv_ocean">Ocean</option>
                <option value="bv_forest">Forest</option>
                <option value="bv_sunset">Sunset</option>
                <option value="bv_cyber">Cyber</option>
                <option value="bv_minimal">Minimal</option>
                <option value="bv_corporate">Corporate</option>
              </select>
            </div>

            <div class="flex items-center space-x-3">
              <label class="text-sm">Format:</label>
              <select v-model="usecvisOptions.format" class="form-select">
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
                <option value="pdf">PDF</option>
              </select>
            </div>

            <button
              @click="generateApiVisualization"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              :disabled="apiGenerating || !hasFileData"
            >
              {{ apiGenerating ? 'Generating...' : 'Generate Visualization' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { createLogger } from '../utils/logger'

const logger = createLogger('ExportOptions')

export default {
  name: 'ExportOptions',
  data() {
    return {
      exportOptions: {
        fileInfo: true,
        fileInfo_hashes: true,
        fileInfo_entropy: true,
        signatures: true,
        structure: true,
        strings: false
      },
      usecvisOptions: {
        binVisJson: false,
        attackGraph: false,
        useApi: false,
        visType: 'entropy',
        style: 'bv_default',
        format: 'png'
      },
      apiUrl: 'http://localhost:8003',
      apiKey: '',
      apiStatus: null,
      apiVersion: null,
      apiError: null,
      apiTesting: false,
      apiGenerating: false,
      availableStyles: []
    }
  },
  computed: {
    canExport() {
      return Object.values(this.exportOptions).some(value => value === true);
    },
    isExecutableBinary() {
      const sigs = this.$parent.fileSignatures;
      if (!sigs || sigs.length === 0) return false;
      const name = sigs[0].name || '';
      return name.includes('PE') || name.includes('ELF') || name.includes('Mach-O');
    },
    hasFileData() {
      const parent = this.$parent;
      return parent && parent.fileBytes && parent.fileBytes.length > 0;
    }
  },
  methods: {
    async exportData() {
      try {
        const timestamp = new Date();
        const exportData = {
          metadata: {
            timestamp: timestamp.toISOString(),
            tool: 'VULNEX Bytes Revealer',
            version: '0.4'
          }
        };

        // Always include comprehensive file information
        if (this.exportOptions.fileInfo) {
          const parent = this.$parent;
          exportData.fileInfo = {
            name: parent.fileName,
            size: parent.fileBytes.length,
            sizeFormatted: this.formatFileSize(parent.fileBytes.length)
          };

          if (this.exportOptions.fileInfo_hashes && parent.hashes) {
            exportData.fileInfo.hashes = parent.hashes;
          }

          if (this.exportOptions.fileInfo_entropy) {
            exportData.fileInfo.entropy = parent.entropy;
            // Include byte frequency if available
            if (parent.byteFrequency) {
              exportData.fileInfo.byteFrequency = parent.byteFrequency;
            }
          }

          // Include detected file type if available
          if (parent.detectedFileType) {
            exportData.fileInfo.detectedFileType = parent.detectedFileType;
          }
        }

        // Include all signature information
        if (this.exportOptions.signatures && this.$parent.fileSignatures) {
          exportData.signatures = this.$parent.fileSignatures.map(sig => ({
            name: sig.name,
            extension: sig.extension,
            confidence: sig.confidence,
            offset: sig.offset,
            details: sig.details || {},
            characteristics: sig.characteristics || [],
            subsystem: sig.subsystem || null,
            timestamp: sig.timestamp || null,
            sections: sig.sections || null,
            imports: sig.imports || null,
            nestedFiles: sig.nestedFiles || []
          }));
        }

        if (this.exportOptions.structure) {
          exportData.structure = this.$parent.fileStructure || {};
        }

        // Always include string analysis summary
        const stringSummary = await this.getStringAnalysisSummary();
        exportData.stringAnalysisSummary = stringSummary;

        // Include full strings data if selected
        if (this.exportOptions.strings) {
          exportData.strings = await this.extractStrings();
        }

        // Generate filename with timestamp
        const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `bytes-revealer-analysis_${dateStr}.json`;

        // Create and download JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        logger.error('Export error:', error);
        this.$emit('error', 'Failed to export data: ' + error.message);
      }
    },

    async exportBinVisJson() {
      try {
        const { usecvislibExporter } = await import('../services/UsecvislibExporter.js');
        const parent = this.$parent;
        const data = usecvislibExporter.generateBinVisData({
          fileBytes: parent.fileBytes,
          entropy: parent.entropy,
          hashes: parent.hashes,
          detectedFileType: parent.detectedFileType,
          fileSignatures: parent.fileSignatures,
          coloredBytes: parent.coloredBytes,
          fileName: parent.fileName
        });
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        usecvislibExporter.downloadJson(data, `binvis-${parent.fileName || 'binary'}_${dateStr}.json`);
      } catch (error) {
        logger.error('BinVis JSON export error:', error);
        this.$emit('error', 'Failed to export BinVis JSON: ' + error.message);
      }
    },

    async exportAttackGraph() {
      try {
        const { usecvislibExporter } = await import('../services/UsecvislibExporter.js');
        const parent = this.$parent;
        const result = usecvislibExporter.generateAttackGraphConfig({
          fileSignatures: parent.fileSignatures,
          detectedFileType: parent.detectedFileType,
          fileName: parent.fileName,
          hashes: parent.hashes,
          entropy: parent.entropy
        });
        if (!result.toml) {
          this.$emit('error', result.error || 'Could not generate attack graph.');
          return;
        }
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        usecvislibExporter.downloadToml(result.toml, `attack-graph-${parent.fileName || 'binary'}_${dateStr}.toml`);
      } catch (error) {
        logger.error('Attack graph export error:', error);
        this.$emit('error', 'Failed to export attack graph: ' + error.message);
      }
    },

    async testApiConnection() {
      this.apiTesting = true;
      this.apiStatus = null;
      this.apiVersion = null;
      this.apiError = null;
      this.availableStyles = [];
      try {
        const { usecvislibExporter } = await import('../services/UsecvislibExporter.js');
        usecvislibExporter.setApiUrl(this.apiUrl);
        usecvislibExporter.setApiKey(this.apiKey);
        const result = await usecvislibExporter.testConnection();
        if (result.available) {
          this.apiStatus = 'ok';
          this.apiVersion = result.version;
          this.availableStyles = result.styles.filter(s => s !== 'default');
        } else {
          this.apiStatus = 'fail';
          this.apiError = result.error;
        }
      } catch (error) {
        logger.error('API connection test error:', error);
        this.apiStatus = 'fail';
        this.apiError = error.message;
      } finally {
        this.apiTesting = false;
      }
    },

    async generateApiVisualization() {
      this.apiGenerating = true;
      try {
        const { usecvislibExporter } = await import('../services/UsecvislibExporter.js');
        const parent = this.$parent;
        usecvislibExporter.setApiUrl(this.apiUrl);
        usecvislibExporter.setApiKey(this.apiKey);

        const blob = await usecvislibExporter.requestVisualization(parent.fileBytes, {
          visType: this.usecvisOptions.visType,
          style: this.usecvisOptions.style,
          format: this.usecvisOptions.format
        });

        const ext = this.usecvisOptions.format;
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        usecvislibExporter.downloadBlob(blob, `visualization-${parent.fileName || 'binary'}_${dateStr}.${ext}`);
      } catch (error) {
        logger.error('API visualization error:', error);
        this.$emit('error', 'Failed to generate visualization: ' + error.message);
      } finally {
        this.apiGenerating = false;
      }
    },

    resetOptions() {
      this.exportOptions = {
        fileInfo: true,
        fileInfo_hashes: true,
        fileInfo_entropy: true,
        signatures: true,
        structure: true,
        strings: false
      };
      this.usecvisOptions = {
        binVisJson: false,
        attackGraph: false,
        useApi: false,
        visType: 'entropy',
        style: 'bv_default',
        format: 'png'
      };
      this.apiStatus = null;
      this.apiVersion = null;
      this.apiError = null;
      this.availableStyles = [];
    },
    async extractStrings() {
      try {
        // Get the StringAnalysisView component if it exists
        const stringAnalysisView = this.$parent.$refs.stringAnalysisView;
        if (stringAnalysisView && stringAnalysisView.strings) {
          return stringAnalysisView.strings.map(str => ({
            offset: str.offset,
            type: str.type,
            length: str.length,
            value: str.value,
            printable: str.printable
          }));
        }

        // Fallback: Extract strings directly from fileBytes
        const fileBytes = this.$parent.fileBytes;
        if (!fileBytes || fileBytes.length === 0) {
          return [];
        }

        // Use the string analyzer utility if available
        const { analyzeStrings } = await import('../utils/stringAnalyzer');
        const strings = await analyzeStrings(fileBytes);
        return strings;
      } catch (error) {
        logger.error('Failed to extract strings:', error);
        return [];
      }
    },

    async getStringAnalysisSummary() {
      try {
        // Try to get data from StringAnalysisView component
        const stringAnalysisView = this.$parent.$refs.stringAnalysisView;
        if (stringAnalysisView && stringAnalysisView.strings) {
          const strings = stringAnalysisView.strings;
          return {
            totalStrings: strings.length,
            asciiStrings: strings.filter(s => s.type === 'ASCII').length,
            utf8Strings: strings.filter(s => s.type === 'UTF-8').length,
            utf16Strings: strings.filter(s => s.type && s.type.includes('UTF-16')).length,
            averageLength: strings.length > 0
              ? Math.round(strings.reduce((sum, s) => sum + s.length, 0) / strings.length)
              : 0,
            longestString: strings.length > 0
              ? Math.max(...strings.map(s => s.length))
              : 0
          };
        }

        // Fallback: Calculate summary from fileBytes
        const fileBytes = this.$parent.fileBytes;
        if (!fileBytes || fileBytes.length === 0) {
          return {
            totalStrings: 0,
            asciiStrings: 0,
            utf8Strings: 0,
            utf16Strings: 0,
            averageLength: 0,
            longestString: 0
          };
        }

        // Quick string analysis for summary
        const { analyzeStrings } = await import('../utils/stringAnalyzer');
        const strings = await analyzeStrings(fileBytes);

        return {
          totalStrings: strings.length,
          asciiStrings: strings.filter(s => s.type === 'ASCII').length,
          utf8Strings: strings.filter(s => s.type === 'UTF-8').length,
          utf16Strings: strings.filter(s => s.type && s.type.includes('UTF-16')).length,
          averageLength: strings.length > 0
            ? Math.round(strings.reduce((sum, s) => sum + s.length, 0) / strings.length)
            : 0,
          longestString: strings.length > 0
            ? Math.max(...strings.map(s => s.length))
            : 0
        };
      } catch (error) {
        logger.error('Failed to get string analysis summary:', error);
        return {
          totalStrings: 0,
          asciiStrings: 0,
          utf8Strings: 0,
          utf16Strings: 0,
          averageLength: 0,
          longestString: 0
        };
      }
    },

    formatFileSize(bytes) {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;

      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }

      return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
  }
}
</script>

<style scoped>
.export-divider {
  border-top: 1px solid var(--border-color, #444);
  margin: 1.5rem 0;
}

.api-url-input {
  flex: 1;
  padding: 0.375rem 0.75rem;
  border-radius: 0.25rem;
  border: 1px solid var(--border-color, #555);
  background: var(--input-bg, #2a2a2a);
  color: var(--text-primary, #e0e0e0);
  font-size: 0.875rem;
}

.btn-test-api {
  padding: 0.375rem 0.75rem;
  border-radius: 0.25rem;
  border: 1px solid var(--border-color, #555);
  background: var(--bg-primary, #333);
  color: var(--text-primary, #e0e0e0);
  cursor: pointer;
  font-size: 0.875rem;
  white-space: nowrap;
}

.btn-test-api:hover {
  background: var(--bg-hover, #444);
}

.btn-test-api:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.api-status-ok {
  color: #4ade80;
  font-size: 0.875rem;
  white-space: nowrap;
}

.api-status-fail {
  color: #f87171;
  font-size: 0.875rem;
  white-space: nowrap;
}

.form-select {
  padding: 0.375rem 0.75rem;
  border-radius: 0.25rem;
  border: 1px solid var(--border-color, #555);
  background: var(--input-bg, #2a2a2a);
  color: var(--text-primary, #e0e0e0);
  font-size: 0.875rem;
}

.api-error-detail {
  color: #f87171;
  font-size: 0.8rem;
  margin-top: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: rgba(248, 113, 113, 0.1);
  border-radius: 0.25rem;
  border-left: 3px solid #f87171;
}

.info-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  margin-left: 0.375rem;
  color: var(--text-muted, #888);
  transition: color 0.2s;
}

.info-icon:hover {
  color: #60a5fa;
}

.api-section {
  padding: 0.75rem;
  border: 1px solid var(--border-color, #444);
  border-radius: 0.375rem;
  background: var(--bg-primary, #1e1e1e);
}
</style>
