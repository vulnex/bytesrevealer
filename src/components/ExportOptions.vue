/** 
 * VULNEX -Bytes Revealer-
 *
 * File: ExportOptions.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2025-04-27
 * Version: 0.3
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
      }
    }
  },
  computed: {
    canExport() {
      return Object.values(this.exportOptions).some(value => value === true);
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
            version: '0.3'  // Updated to current version
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
    resetOptions() {
      this.exportOptions = {
        fileInfo: true,
        fileInfo_hashes: true,
        fileInfo_entropy: true,
        signatures: true,
        structure: true,
        strings: false
      };
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