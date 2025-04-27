/** 
 * VULNEX -Bytes Revealer-
 *
 * File: ExportOptions.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2025-04-27
 * Version: 0.2
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
        const exportData = {
          metadata: {
            timestamp: new Date().toISOString(),
            tool: 'VULNEX Bytes Revealer',
            version: '0.1'
          }
        };

        if (this.exportOptions.fileInfo) {
          exportData.fileInfo = {
            name: this.$parent.fileName,
            size: this.$parent.fileBytes.length
          };
          
          if (this.exportOptions.fileInfo_hashes) {
            exportData.fileInfo.hashes = this.$parent.hashes;
          }
          
          if (this.exportOptions.fileInfo_entropy) {
            exportData.fileInfo.entropy = this.$parent.entropy;
          }
        }

        if (this.exportOptions.signatures) {
          exportData.signatures = this.$parent.fileSignatures;
        }

        if (this.exportOptions.structure) {
          exportData.structure = this.$parent.fileStructure;
        }

        if (this.exportOptions.strings) {
          exportData.strings = await this.extractStrings();
        }

        // Create and download JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bytes-revealer-analysis.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Export error:', error);
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
      // Implement string extraction logic here
      return [];
    }
  }
}
</script> 