/** 
 * VULNEX -Bytes Revealer-
 *
 * File: App.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-03-19
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="container">
    <h1>VULNEX -Bytes Revealer (v0.1)-</h1>
    <p style="text-align:center">- Uncover the Secrets of Binary Files -</p>
    <p style="text-align:center">2025 &#169; <a href="https://www.vulnex.com" target="_blank">VULNEX</a></p>
    
<!-- Analysis Options -->
<div class="analysis-options bg-white p-4 rounded-lg shadow mb-4">
  <h3 class="text-lg font-medium mb-2">Select Analysis Features:</h3>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="analysisOptions.fileAnalysis"
        :disabled="loading.file || loading.analysis || (fileBytes.length && fileBytes.length > FILE_LIMITS.ANALYSIS_SIZE_LIMIT)"
        class="form-checkbox"
      >
      <span>File Analysis</span>
    </label>
    
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="analysisOptions.visualView"
        :disabled="loading.file || loading.analysis"
        class="form-checkbox"
      >
      <span>Visual View</span>
    </label>
    
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="analysisOptions.hexView"
        :disabled="loading.file || loading.analysis"
        class="form-checkbox"
      >
      <span>Hex View</span>
    </label>
    
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="analysisOptions.stringAnalysis"
        :disabled="loading.file || loading.analysis || (fileBytes.length && fileBytes.length > FILE_LIMITS.ANALYSIS_SIZE_LIMIT)"
        class="form-checkbox"
      >
      <span>String Analysis</span>
    </label>
  </div>
</div>

    <!-- File Input -->
    <div class="file-input mb-4">
      <input 
        type="file" 
        @change="handleFileUpload" 
        :disabled="loading.file || loading.analysis"
        class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
               file:rounded-full file:border-0 file:text-sm file:font-semibold
               file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      >
      <div v-if="progress > 0" class="mt-2">
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
        <span class="text-sm text-gray-600">{{ progress.toFixed(1) }}%</span>
      </div>
    </div>

    <!-- Search Bar -->
    <div v-if="fileBytes.length">
      <SearchBar
        v-model:searchType="searchType"
        v-model:searchPattern="searchPattern"
        @search="search"
        @clear="clearSearch"
      />
    </div>

    <!-- Error Message -->
    <div 
      v-if="error" 
      class="mb-4 p-4 bg-red-50 text-red-700 rounded"
    >
      {{ error }}
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">

      <button 
        class="tab" 
        :class="{ active: activeTab === 'info' }"
        @click="activeTab = 'info'"
        >Information</button>

      <button 
        v-if="fileBytes.length && analysisOptions.fileAnalysis"
        class="tab" 
        :class="{ active: activeTab === 'file' }"
        @click="activeTab = 'file'"
        :disabled="loading.analysis"
      >File View</button>
      
      <button 
        v-if="fileBytes.length && analysisOptions.visualView"
        class="tab" 
        :class="{ active: activeTab === 'visual' }"
        @click="activeTab = 'visual'"
        :disabled="loading.analysis"
      >Visual View</button>
      
      <button 
        v-if="fileBytes.length && analysisOptions.hexView"
        class="tab" 
        :class="{ active: activeTab === 'hex' }"
        @click="activeTab = 'hex'"
        :disabled="loading.analysis"
      >Hex View</button>
      
      <button 
        v-if="fileBytes.length && analysisOptions.stringAnalysis"
        class="tab" 
        :class="{ active: activeTab === 'strings' }"
        @click="activeTab = 'strings'"
        :disabled="loading.analysis"
      >String Analysis</button>
      
    </div>

    <!-- Content Views -->
    <div class="view-container mt-4">
      <!-- Loading Overlays -->
      <LoadingOverlay 
        :show="loading.file && !progress" 
        message="Loading file..." 
      />
      <LoadingOverlay 
        :show="loading.analysis" 
        message="Analyzing file..." 
      />

      <!-- File Analysis View -->
      <FileAnalysis
        v-if="activeTab === 'file' && analysisOptions.fileAnalysis && fileBytes.length"
        :fileBytes="fileBytes"
        :entropy="entropy"
        :fileSignatures="fileSignatures"
        :hashes="hashes"
        v-model:activeGraphTab="activeGraphTab"
      />

      <!-- Visual View -->
      <div v-if="activeTab === 'visual' && analysisOptions.visualView && fileBytes.length">
        <VisualView
          :fileBytes="fileBytes"
          :highlightedBytes="highlightedBytes"
          :coloredBytes="coloredBytes"
          @byte-selection="handleByteSelection"
        />
      </div>

      <!-- Hex View -->
      <div v-if="activeTab === 'hex' && analysisOptions.hexView && fileBytes.length">
        <HexView
          :fileBytes="fileBytes"
          :highlightedBytes="highlightedBytes"
          :coloredBytes="coloredBytes"
          @byte-selection="handleByteSelection"
        />
      </div>

      <!-- String Analysis View -->
      <StringAnalysisView
        v-if="activeTab === 'strings' && analysisOptions.stringAnalysis && fileBytes.length"
        :fileBytes="fileBytes"
      />

      <!-- New Information Tab Content -->
      <div v-if="activeTab === 'info'" class="p-4 bg-gray-100 rounded-lg">
        <h2 class="text-xl font-semibold">How to Use Bytes Revealer</h2>
        <p>Bytes Revealer is a powerful reverse engineering and binary analysis tool designed for security researchers, forensic analysts, and developers. With features like hex view, visual representation, string extraction, entropy calculation, and file signature detection, it helps users uncover hidden data inside files. Whether you are analyzing malware, debugging binaries, or investigating unknown file formats, Bytes Revealer makes it easy to explore, search, and extract valuable information from any binary file.</p>

        <p>Bytes Revealer do NOT store any file or data. All analysis is performed in your browser.</p>

        <p><u>Current Limitation:</u> Files less than 50MB can perform all analysis, files bigger up to 1.5GB will only do Visual View and Hex View analysis.</p>

        <p>Let us know if you like any modifications! 😊</p>

        <p class="mt-2">Follow these steps:</p>
        
        <ul class="list-disc ml-6 mt-2">
          <li>Upload a file by clicking the file input field.</li>
          <li>Select the type of analysis you want (File Analysis, Visual View, Hex View, or String Analysis).</li>
          <li>Navigate through the different tabs to explore the file structure.</li>
          <li>Use the search bar to find specific byte patterns or ASCII strings.</li>
          <li>Click on any color squares and highlight any byte. To delete, select the white square and click on the highlight bytes.</li>
        </ul>

      </div>

    </div>

  </div>

  <p style="text-align:center"><a href="https://github.com/vulnex/bytesrevealer" target="_blank" class="text-blue-600 underline">Download in Github</a></p>

</template>

<script>
import CryptoJS from 'crypto-js'
import FileAnalysis from './components/FileAnalysis.vue'
import VisualView from './components/VisualView.vue'
import HexView from './components/HexView.vue'
import SearchBar from './components/SearchBar.vue'
import LoadingOverlay from './components/LoadingOverlay.vue'
import AnalysisOptions from './components/AnalysisOptions.vue'
import ProgressTracking from './components/ProgressTracking.vue'
import StringAnalysisView from './components/StringAnalysisView.vue'
import ColorPalette from './components/ColorPalette.vue'
import { 
  processFileInChunks, 
  analyzeFileInChunks,
  validateFileSize,
  formatFileSize,
  calculateFileHashes,
  FILE_LIMITS 
} from './utils/fileHandler'

// File signatures database
const SIGNATURES = [
  { pattern: [0x50, 0x4B, 0x03, 0x04], name: 'ZIP Archive' },
  { pattern: [0x89, 0x50, 0x4E, 0x47], name: 'PNG Image' },
  { pattern: [0xFF, 0xD8, 0xFF], name: 'JPEG Image' },
  { pattern: [0x7F, 0x45, 0x4C, 0x46], name: 'ELF Binary' },
  { pattern: [0x4D, 0x5A], name: 'Windows Executable' },
  { pattern: [0x25, 0x50, 0x44, 0x46], name: 'PDF Document' },
  { pattern: [0x47, 0x49, 0x46, 0x38], name: 'GIF Image' }
]

export default {
  name: 'App',
  components: {
    FileAnalysis,
    VisualView,
    HexView,
    SearchBar,
    LoadingOverlay,
    AnalysisOptions,
    ProgressTracking,
    StringAnalysisView,
    ColorPalette
  },

  data() {
    return {
      fileBytes: new Uint8Array(),
      activeTab: 'info',
      searchPattern: '',
      searchType: 'hex',
      highlightedBytes: [],
      entropy: 0,
      fileSignatures: [],
      hashes: {
        md5: '',
        sha1: '',
        sha256: ''
      },
      activeGraphTab: 'entropy',
      loading: {
        file: false,
        analysis: false,
        search: false
      },
      error: null,
      progress: 0,
      analysisOptions: {
        fileAnalysis: true,
        visualView: true,
        hexView: true,
        stringAnalysis: true
      },
      coloredBytes: [],
      currentColor: null,
      isSelecting: false,
      FILE_LIMITS
    }
  },

  methods: {

    async handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    this.loading.file = true;
    this.error = null;
    this.resetProgress();
    this.coloredBytes = []; // Reset colored bytes
    
    // Basic file loading first
    const buffer = await file.arrayBuffer();
    this.fileBytes = new Uint8Array(buffer);
    
    // Check file size and adjust analysis options
    if (file.size > FILE_LIMITS.ANALYSIS_SIZE_LIMIT) {
      // Disable complex analysis for large files
      this.analysisOptions.fileAnalysis = false;
      this.analysisOptions.stringAnalysis = false;
      
      // Show warning to user
      this.error = `File size exceeds 50MB. Only Visual and Hex views are available for large files.`;
      
      // Set active tab to visual view since analysis is disabled
      this.activeTab = 'visual';
      return;
    }

    this.activeTab = 'file'; // Auto-switch to File View after successful upload

    // Validate file size for overall limit
    try {
      const showWarning = validateFileSize(file);
      if (showWarning) {
        const proceed = await this.showSizeWarning(file.size);
        if (!proceed) {
          this.error = 'File loading cancelled';
          return;
        }
      }
    } catch (error) {
      this.error = error.message;
      return;
    }

    // Only perform file analysis if selected AND file size is within limit
    if (this.analysisOptions.fileAnalysis && file.size <= FILE_LIMITS.ANALYSIS_SIZE_LIMIT) {
      this.loading.analysis = true;
      try {
        // First detect file signatures as this is faster
        await this.detectFileSignatures();
        this.progress = 20;

        // Then calculate hashes
        const hashes = await calculateFileHashes(
          file,
          (progress) => {
            this.progress = 20 + progress * 0.4;
          }
        );
        this.hashes = hashes;
        
        // Finally calculate entropy as it's most intensive
        const results = await analyzeFileInChunks(
          file, 
          { fileAnalysis: true },
          (progress) => {
            this.progress = 60 + progress * 0.4;
          }
        );
        this.entropy = results.entropy;
        
        this.progress = 100;

        // Set active tab to file analysis if all succeeded
        this.activeTab = 'file';

      } catch (error) {
        console.error('Analysis error:', error);
        this.error = `Analysis error: ${error.message}`;
        this.entropy = 0;
        this.fileSignatures = [];
        this.hashes = {
          md5: '',
          sha1: '',
          sha256: ''
        };
        
        // If analysis fails, set to visual view
        this.activeTab = 'visual';
      }
    } else {
      // If no analysis is selected, default to visual view
      this.activeTab = 'visual';
    }

  } catch (error) {
    console.error('File processing error:', error);
    this.error = error.message;
  } finally {
    this.loading.file = false;
    this.loading.analysis = false;
    this.progress = 0;
  }
},

    resetProgress() {
      this.progress = 0;
    },

    showSizeWarning(fileSize) {
      return new Promise((resolve) => {
        const size = formatFileSize(fileSize);
        const message = `The file is ${size}. Processing large files may cause performance issues. Continue?`;
        resolve(window.confirm(message));
      });
    },

    detectFileSignatures() {
  this.fileSignatures = [];
  
  // Make sure we have bytes to analyze
  if (!this.fileBytes || !this.fileBytes.length) {
    console.warn('No file bytes available for signature detection');
    return;
  }
  
  SIGNATURES.forEach(sig => {
    // Only check if we have enough bytes for the pattern
    if (this.fileBytes.length >= sig.pattern.length) {
      for (let i = 0; i <= this.fileBytes.length - sig.pattern.length; i++) {
        let match = true;
        for (let j = 0; j < sig.pattern.length; j++) {
          if (this.fileBytes[i + j] !== sig.pattern[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          console.log(`Found signature: ${sig.name} at offset ${i}`); // Debug log
          this.fileSignatures.push({
            name: sig.name,
            offset: i,
            pattern: sig.pattern.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
          });
          // Only find first occurrence of each signature
          break;
        }
      }
    }
  });
  
  console.log('Detected signatures:', this.fileSignatures); // Debug log
},

    handleByteSelection({ start, end, color }) {
      if (color === '#ffffff') {
        // Remove colors from selected range
        this.coloredBytes = this.coloredBytes.filter(range => 
          !(range.start >= start && range.end <= end)
        );
      } else {
        // Add new colored range
        this.coloredBytes.push({
          start,
          end,
          color
        });
      }
    },

    clearSearch() {
      this.searchPattern = '';
      this.highlightedBytes = [];
    },

    async search() {
      if (!this.searchPattern) return;
      
      try {
        this.loading.search = true;
        this.highlightedBytes = [];

        if (this.searchType === 'hex') {
          await this.searchHexPattern();
        } else {
          await this.searchAsciiPattern();
        }
      } catch (error) {
        this.error = 'Search error: ' + error.message;
        console.error('Search error:', error);
      } finally {
        this.loading.search = false;
      }
    },

    searchHexPattern() {
      const pattern = this.searchPattern.trim().split(/\s+/).map(hex => parseInt(hex, 16));
      if (pattern.some(isNaN)) {
        alert('Invalid hex pattern');
        return;
      }

      for (let i = 0; i <= this.fileBytes.length - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
          if (this.fileBytes[i + j] !== pattern[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          for (let j = 0; j < pattern.length; j++) {
            this.highlightedBytes.push(i + j);
          }
        }
      }
    },

    searchAsciiPattern() {
      const pattern = this.searchPattern;
      const patternBytes = Array.from(pattern).map(char => char.charCodeAt(0));

      for (let i = 0; i <= this.fileBytes.length - patternBytes.length; i++) {
        let match = true;
        for (let j = 0; j < patternBytes.length; j++) {
          if (this.fileBytes[i + j] !== patternBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          for (let j = 0; j < patternBytes.length; j++) {
            this.highlightedBytes.push(i + j);
          }
        }
      }
    },

    // Save analysis preferences to localStorage
    saveAnalysisPreferences() {
      try {
        localStorage.setItem('analysisOptions', JSON.stringify(this.analysisOptions));
      } catch (error) {
        console.error('Error saving analysis preferences:', error);
      }
    },

    // Load saved analysis preferences
    loadAnalysisPreferences() {
      try {
        const saved = localStorage.getItem('analysisOptions');
        if (saved) {
          this.analysisOptions = JSON.parse(saved);
        }
      } catch (error) {
        console.error('Error loading analysis preferences:', error);
      }
    }
  },

  // Load saved preferences when component is mounted
  mounted() {
    this.loadAnalysisPreferences();
  },

  // Save preferences when they change
  watch: {
    analysisOptions: {
      handler(newOptions) {
        this.saveAnalysisPreferences();
      },
      deep: true
    }
  }
}
</script>

<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  text-align: center;
}

.file-input {
  margin-bottom: 20px;
}

.error-message {
  color: red;
  margin-top: 10px;
}

.cancel-button {
  margin-left: 10px;
  padding: 5px 10px;
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-button:hover {
  background-color: #cc0000;
}

.tabs {
  display: flex;
  gap: 1px;
  background-color: #f1f5f9;
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.tab {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  background: transparent;
  color: #64748b;
  transition: all 0.2s ease;
}

.tab:hover:not(.active):not(:disabled) {
  background: rgba(255, 255, 255, 0.7);
  color: #334155;
}

.tab.active {
  background: white;
  color: #2563eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.view-container {
  position: relative;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  min-height: 400px;
  overflow: hidden;
}

.view-container > div {
  height: 100%;
  width: 100%;
}

/* Analysis Options Styles */
.analysis-options {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.form-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid #cbd5e0;
  cursor: pointer;
}

.form-checkbox:checked {
  background-color: #4a90e2;
  border-color: #4a90e2;
}

.form-checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

::selection {
  background: transparent;
}

.container {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Virtual Scrolling Container - Add to HexView.vue and VisualView.vue */
.virtual-scroll-container {
  height: 100%;
  overflow-y: auto;
  position: relative;
}

.virtual-scroll-content {
  position: absolute;
  width: 100%;
}

/* Update VisualView squares group */
.squares-group {
  display: grid;
  grid-template-columns: repeat(32, 12px);
  gap: 1px;
  margin-right: 16px;
}

</style>