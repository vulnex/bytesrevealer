/** 
 * VULNEX -Bytes Revealer-
 *
 * File: App.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-09-29
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="container">
    <h1 class="title">VULNEX -Bytes Revealer (v0.3)-</h1>
    <p class="subtitle">- Uncover the Secrets of Binary Files -</p>
    <p class="copyright">2025 &#169; <a href="https://www.vulnex.com" target="_blank">VULNEX</a></p>
    
<!-- Analysis Options -->
<div class="analysis-options bg-white p-4 rounded-lg shadow mb-4">
  <h3 class="text-lg font-medium mb-2">Select Analysis Features:</h3>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="features.fileAnalysis"
        :disabled="loading.file || loading.analysis"
        class="form-checkbox"
        checked
      >
      <span>File Analysis</span>
    </label>
    
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="features.visualView"
        :disabled="loading.file || loading.analysis"
        class="form-checkbox"
        checked
      >
      <span>Visual View</span>
    </label>
    
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="features.hexView"
        :disabled="loading.file || loading.analysis"
        class="form-checkbox"
        checked
      >
      <span>Hex View</span>
    </label>
    
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="features.stringAnalysis"
        :disabled="loading.file || loading.analysis"
        class="form-checkbox"
        checked
      >
      <span>String Analysis</span>
    </label>
  </div>
</div>

    <!-- File Input -->
    <div class="file-input mb-4">
      <div class="flex items-center gap-2">
        <!-- Custom file input wrapper -->
        <div class="custom-file-input">
          <label class="file-label">
            <input
              ref="fileInput"
              type="file"
              @change="handleFileUpload"
              :disabled="loading.file || loading.analysis"
              class="hidden-file-input"
            >
            <span class="file-button">
              Choose File
            </span>
          </label>
          <span class="file-name">
            {{ fileName || 'No file selected' }}
          </span>
          <button
            v-if="fileName"
            @click="resetFile"
            class="reset-btn"
            title="Clear file and reset"
          >
            ✕
          </button>
          <!-- Help button with separator -->
          <div class="help-section">
            <button
              @click="showHelpDialog = true"
              class="help-btn"
              title="Help & Information"
            >
              ?
            </button>
          </div>
        </div>
      </div>
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
        :isSearching="isSearching"
        :progress="searchProgress"
        :results="searchResults"
        @search="search"
        @clear="clearSearch"
        @cancel="cancelSearch"
        @navigateToMatch="navigateToMatch"
      />
    </div>

    <!-- Error Message -->
    <div 
      v-if="error" 
      class="mb-4 p-4 bg-red-50 text-red-700 rounded"
    >
      {{ error }}
    </div>

    <!-- Performance Indicator for Large Files -->
    <div v-if="chunkManager && chunkManager.isLargeFile" class="performance-indicator">
      <span class="indicator-icon">⚡</span>
      <span>Optimized mode for large file ({{ formatFileSize(fileBytes.length) }})</span>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">

      <button 
        class="tab" 
        :class="{ active: activeTab === 'info' }"
        @click="activeTab = 'info'"
        >Information</button>

      <button 
        v-if="fileBytes.length && features.fileAnalysis"
        class="tab" 
        :class="{ active: activeTab === 'file' }"
        @click="activeTab = 'file'"
        :disabled="loading.analysis"
      >File View</button>
      
      <button 
        v-if="fileBytes.length && features.visualView"
        class="tab" 
        :class="{ active: activeTab === 'visual' }"
        @click="activeTab = 'visual'"
        :disabled="loading.analysis"
      >Visual View</button>
      
      <button 
        v-if="fileBytes.length && features.hexView"
        class="tab" 
        :class="{ active: activeTab === 'hex' }"
        @click="activeTab = 'hex'"
        :disabled="loading.analysis"
      >Hex View</button>
      
      <button 
        v-if="fileBytes.length && features.stringAnalysis"
        class="tab" 
        :class="{ active: activeTab === 'strings' }"
        @click="activeTab = 'strings'"
        :disabled="loading.analysis"
      >String Analysis</button>
      
      <button 
        v-if="fileBytes.length && (features.fileAnalysis || features.stringAnalysis)"
        class="tab" 
        :class="{ active: activeTab === 'export' }"
        @click="activeTab = 'export'"
      >Export</button>
      
      <button 
        class="tab" 
        :class="{ active: activeTab === 'settings' }"
        @click="activeTab = 'settings'"
      >Settings</button>
      
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
      <template v-if="features.fileAnalysis && fileBytes.length">
        <FileAnalysis
          v-show="activeTab === 'file'"
          :fileBytes="fileBytes"
          :entropy="entropy"
          :fileSignatures="fileSignatures"
          :hashes="hashes"
          :detectedFileType="detectedFileType"
          v-model:activeGraphTab="activeGraphTab"
        />
      </template>

      <!-- Visual View -->
      <template v-if="features.visualView && fileBytes.length">
        <div v-show="activeTab === 'visual'">
          <VisualView
            :fileBytes="fileBytes"
            :highlightedBytes="highlightedBytes"
            :coloredBytes="coloredBytes"
            :chunkManager="chunkManager"
            @byte-selection="handleByteSelection"
          />
        </div>
      </template>

      <!-- Hex View -->
      <template v-if="features.hexView && fileBytes.length">
        <div v-show="activeTab === 'hex'">
          <HexView
            :fileBytes="fileBytes"
            :fileName="fileName"
            :highlightedBytes="highlightedBytes"
            :coloredBytes="coloredBytes"
            :chunkManager="chunkManager"
            @byte-selection="handleByteSelection"
          />
        </div>
      </template>

      <!-- String Analysis View -->
      <template v-if="features.stringAnalysis && fileBytes.length">
        <StringAnalysisView
          v-show="activeTab === 'strings'"
          :fileBytes="fileBytes"
          ref="stringAnalysisView"
        />
      </template>

      <!-- New Information Tab Content -->
      <div v-if="activeTab === 'info'" class="p-4 bg-gray-100 rounded-lg">
        <h2 class="text-xl font-semibold">Welcome to Bytes Revealer v0.3</h2>

        <p class="mt-3"><strong>About:</strong> Bytes Revealer is a comprehensive binary analysis and reverse engineering tool designed for security researchers, forensic analysts, malware analysts, and developers. It provides powerful features for examining, searching, and understanding binary files of any type.</p>

        <p class="mt-3"><strong>Key Features:</strong></p>
        <ul class="list-disc ml-6 mt-2">
          <li><strong>Multiple Analysis Views:</strong> File analysis, Visual representation, Hex editor, and String extraction</li>
          <li><strong>Advanced File Support:</strong> Handles files up to 1.5GB with progressive loading</li>
          <li><strong>Kaitai Struct Integration:</strong> Parse and analyze 100+ binary formats automatically</li>
          <li><strong>Security & Privacy:</strong> All processing happens locally in your browser - no data is uploaded or stored</li>
          <li><strong>Export Capabilities:</strong> Export analysis results to JSON with timestamps and comprehensive data</li>
        </ul>

        <p class="mt-3"><strong>Performance Modes:</strong></p>
        <ul class="list-disc ml-6 mt-2">
          <li><strong>Files under 50MB:</strong> Full analysis including hashes, entropy, signatures, and string extraction</li>
          <li><strong>Files 50MB-1.5GB:</strong> Optimized analysis with Visual and Hex views, progressive chunk loading</li>
        </ul>

        <p class="mt-3"><strong>Getting Started:</strong></p>
        <ol class="list-decimal ml-6 mt-2">
          <li><strong>Choose a file:</strong> Click "Choose File" or drag and drop a binary file</li>
          <li><strong>Select analysis features:</strong> Check which analysis types you want to perform</li>
          <li><strong>Navigate views:</strong> Use the tabs to switch between different analysis perspectives</li>
          <li><strong>Search and explore:</strong> Use the search bar for hex patterns or ASCII/UTF-8 strings</li>
          <li><strong>Export results:</strong> Save your analysis to JSON format with comprehensive metadata</li>
        </ol>

        <p class="mt-3"><strong>Pro Tips:</strong></p>
        <ul class="list-disc ml-6 mt-2">
          <li>Press <kbd style="padding: 2px 6px; background: #e5e7eb; border: 1px solid #9ca3af; border-radius: 3px;">L</kbd> to lock the data inspector on a specific byte</li>
          <li>Use the color palette in Visual/Hex views to highlight and annotate interesting bytes</li>
          <li>Right-click in Hex View to access the context menu for copying bytes in various formats</li>
          <li>Toggle between blue and categorized color schemes in Visual View using the 🎨 button</li>
          <li>Click the <strong>?</strong> button in the header for detailed help, changelog, and documentation</li>
        </ul>

        <p class="mt-3"><strong>Need Help?</strong> Click the help button (?) next to the file selector for the user manual, changelog, and more information.</p>

        <p class="mt-3 text-sm text-gray-600">Version 0.3 | © 2025 VULNEX | <a href="https://github.com/vulnex/bytesrevealer" target="_blank" class="text-blue-600 underline">GitHub</a> | <a href="https://bytesrevealer.online" target="_blank" class="text-blue-600 underline">Website</a></p>
      </div>

      <!-- Export Options View -->
      <ExportOptions
        v-if="activeTab === 'export'"
        @error="handleError"
      />

      <!-- Settings Panel View -->
      <SettingsPanel
        v-if="activeTab === 'settings'"
        @settings-updated="handleSettingsUpdate"
      />

    </div>

  </div>

  <!-- Format Loading Indicator -->
  <FormatLoadingIndicator ref="formatLoadingIndicator" />

  <!-- Help Dialog -->
  <HelpDialog
    v-if="showHelpDialog"
    @close="showHelpDialog = false"
  />

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
import ExportOptions from './components/ExportOptions.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import FormatLoadingIndicator from './components/FormatLoadingIndicator.vue'
import HelpDialog from './components/HelpDialog.vue'
import {
  processFileInChunks,
  analyzeFileInChunks,
  validateFileSize,
  formatFileSize,
  calculateFileHashes,
  detectFileType,
  FILE_LIMITS
} from './utils/fileHandler'
import { FILE_SIGNATURES, detectFileTypes, isFileType } from './utils/fileSignatures'
import { 
  findPEHeaderOffset,
  analyzePEStructure,
  detectSpecificFileType,
  detectNestedFiles 
} from './utils/advancedFileDetection'
import { useSettingsStore } from './stores/settings'
import { useFormatStore } from './stores/format'
import { createLogger } from './utils/logger'
import fileChunkManager from './utils/FileChunkManager'
import { calculateOptimizedEntropy } from './utils/entropyOptimized'

const logger = createLogger('App')

// Initialize search worker
let searchWorker = null

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
    ColorPalette,
    ExportOptions,
    SettingsPanel,
    FormatLoadingIndicator,
    HelpDialog
  },

  data() {
    return {
      fileBytes: new Uint8Array(),
      fileName: null,
      activeTab: 'info',
      searchPattern: '',
      searchType: 'hex',
      highlightedBytes: [],
      searchProgress: 0,
      isSearching: false,
      searchResults: [],
      showHelpDialog: false,
      entropy: 0,
      fileSignatures: [],
      hashes: {
        md5: '',
        sha1: '',
        sha256: ''
      },
      detectedFileType: null,
      activeGraphTab: 'entropy',
      loading: {
        file: false,
        analysis: false,
        search: false
      },
      error: null,
      progress: 0,
      features: {
        fileAnalysis: true,
        visualView: true,
        hexView: true,
        stringAnalysis: true
      },
      coloredBytes: [],
      currentColor: null,
      isSelecting: false,
      FILE_LIMITS,
      chunkManager: null
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
    this.fileName = file.name; // Store the filename

    // Reset format store for new file
    const formatStore = useFormatStore()
    formatStore.resetForFile()

    // Clear any previous chunk data
    if (this.chunkManager) {
      await fileChunkManager.clear()
      this.chunkManager = null
    }

    // Basic file loading first
    logger.info(`Loading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // For very large files, show a warning
    if (file.size > 100 * 1024 * 1024) { // > 100MB
      this.error = `Loading large file (${(file.size / 1024 / 1024).toFixed(0)}MB). This may take a moment...`;
    }

    // Give UI time to update before blocking operation
    await new Promise(resolve => setTimeout(resolve, 10));

    // Use chunk manager for large files (>50MB)
    if (file.size > 50 * 1024 * 1024) {
      logger.info('Using chunk manager for large file');

      // Use V1 FileChunkManager which is stable
      this.fileBytes = await fileChunkManager.initialize(file);

      // Check if it's a chunked array
      if (this.fileBytes.isChunked) {
        logger.info('File loaded with chunking enabled');
        // Store chunk manager reference for components
        this.chunkManager = fileChunkManager;
      }
    } else {
      // Standard loading for smaller files
      const buffer = await file.arrayBuffer();
      this.fileBytes = new Uint8Array(buffer);
      this.chunkManager = null;
    }

    logger.info(`File loaded: ${this.fileBytes.length} bytes`);
    
    // Clear the loading message
    if (file.size > 100 * 1024 * 1024) {
      this.error = null;
    }
    
    // Check file size for analysis mode
    const isLargeFile = file.size > FILE_LIMITS.ANALYSIS_SIZE_LIMIT;

    // Detect file type (works for both large and small files)
    try {
      // Try to detect from the file object first
      this.detectedFileType = await detectFileType(file);

      // If detected as ZIP and filename ends with .app.zip, update description
      if (this.detectedFileType && this.detectedFileType.ext === 'zip' &&
          file.name.toLowerCase().endsWith('.app.zip')) {
        this.detectedFileType.description = 'macOS Application Bundle (ZIP)';
      }
    } catch (err) {
      logger.warn('File type detection from File object failed, trying from loaded bytes:', err);

      // If that fails and we have bytes, try detecting from the loaded bytes
      if (this.fileBytes && this.fileBytes.length > 0) {
        try {
          // For progressive files, get first chunk
          const firstBytes = this.fileBytes.isProgressive
            ? await this.fileBytes.slice(0, Math.min(1024 * 1024, this.fileBytes.length))
            : this.fileBytes;

          this.detectedFileType = await detectFileType(firstBytes);
        } catch (err2) {
          logger.error('File type detection from bytes also failed:', err2);
          this.detectedFileType = {
            detected: false,
            ext: 'unknown',
            mime: 'application/octet-stream',
            description: 'Unable to detect file type',
            confidence: 'none'
          };
        }
      }
    }

    if (isLargeFile) {
      // For large files, keep all features enabled (optimized for performance)
      // Don't change the features state - keep user's selection
      // this.features are already set by user via checkboxes

      // Show info to user about optimized mode
      this.error = `File size exceeds 50MB. Using optimized analysis mode.`;
    }

    // Set active tab based on features
    if (this.features.fileAnalysis) {
      this.activeTab = 'file'; // Auto-switch to File View after successful upload
    } else {
      this.activeTab = 'visual';
    }

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

    // Perform file analysis if selected
    if (this.features.fileAnalysis) {
      this.loading.analysis = true;
      try {
        // Always detect file signatures (fast, works for any size)
        await this.detectFileSignatures();
        this.progress = 20;

        if (isLargeFile) {
          // Limited analysis for large files
          // Skip full hashes for performance, but calculate entropy on a sample
          this.hashes = {
            md5: 'N/A (file > 50MB)',
            sha1: 'N/A (file > 50MB)',
            sha256: 'N/A (file > 50MB)'
          };

          // Use optimized entropy calculation for large files
          const entropyResult = calculateOptimizedEntropy(this.fileBytes, {
            blockSize: 256,
            maxBlocks: 1000,
            sampleRate: 0.1 // Sample 10% of blocks for very large files
          })
          this.entropy = entropyResult.globalEntropy
          logger.info(`Calculated entropy using optimized sampling: ${this.entropy.toFixed(4)}`)
          logger.info(`Processed ${this.formatFileSize(entropyResult.processedBytes)} of ${this.formatFileSize(entropyResult.totalBytes)}`)

          this.progress = 100;
        } else {
          // Full analysis for smaller files
          // Calculate hashes
          const hashes = await calculateFileHashes(
            file,
            (progress) => {
              this.progress = 20 + progress * 0.4;
            }
          );
          this.hashes = hashes;

          // Detect file type
          this.detectedFileType = await detectFileType(file);

          // Calculate entropy
          const results = await analyzeFileInChunks(
            file, 
            { fileAnalysis: true },
            (progress) => {
              this.progress = 60 + progress * 0.4;
            }
          );
          this.entropy = results.entropy;
          
          this.progress = 100;
        }

        // Set active tab to file analysis if all succeeded
        this.activeTab = 'file';

      } catch (error) {
        logger.error('Analysis error:', error);
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
      } finally {
        this.loading.analysis = false;
      }
    } else if (!this.features.fileAnalysis) {
      // If file analysis is not selected, default to visual view
      this.activeTab = 'visual';
    }

  } catch (error) {
    logger.error('File processing error:', error);
    this.error = error.message;
  } finally {
    this.loading.file = false;
    this.loading.analysis = false;
    this.resetProgress();
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

    async detectFileSignatures() {
      if (!this.fileBytes || !this.fileBytes.length) {
        logger.warn('No file bytes available for signature detection');
        return;
      }

      try {
        // Get basic and enhanced file type information
        const enhancedTypes = await detectSpecificFileType(this.fileBytes);
        
        // Detect nested files
        const nestedFiles = await detectNestedFiles(this.fileBytes);
        
        // Combine the results
        this.fileSignatures = enhancedTypes.map(type => ({
          ...type,
          nestedFiles: nestedFiles.filter(nested => 
            nested.offset >= type.offset && 
            nested.offset < (type.offset + (type.size || this.fileBytes.length))
          )
        }));
        
        if (this.fileSignatures.length > 0) {
          logger.debug('Detected signatures:', this.fileSignatures);
        } else {
          logger.debug('No known file signatures detected');
        }
      } catch (error) {
        logger.error('Error detecting file signatures:', error);
        this.error = `Failed to detect file signatures: ${error.message}`;
        this.fileSignatures = []; // Reset signatures on error
      }
    },

    isSpecificFileType(format) {
      return isFileType(this.fileBytes, format);
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
      this.searchResults = [];
      this.searchProgress = 0;
      this.cancelSearch();
    },

    async search() {
      if (!this.searchPattern) return;
      if (this.isSearching) return;

      try {
        this.loading.search = true;
        this.isSearching = true;
        this.highlightedBytes = [];
        this.searchResults = [];
        this.searchProgress = 0;

        // Initialize worker if needed
        if (!searchWorker) {
          searchWorker = new Worker(
            new URL('./workers/SearchWorker.js', import.meta.url),
            { type: 'module' }
          );
        }

        // Set up worker message handler
        const searchPromise = new Promise((resolve, reject) => {
          searchWorker.onmessage = (event) => {
            const { type, ...data } = event.data;

            switch (type) {
              case 'searchStarted':
                logger.debug('Search started, total bytes:', data.totalBytes);
                break;

              case 'progress':
                this.searchProgress = data.progress;
                break;

              case 'searchComplete':
                this.highlightedBytes = data.highlightedBytes;
                this.searchResults = data.results;
                this.searchProgress = 100;
                logger.info(`Search complete: ${data.matchCount} matches found`);
                resolve();
                break;

              case 'searchCancelled':
                logger.info('Search cancelled');
                resolve();
                break;

              case 'error':
                reject(new Error(data.error));
                break;
            }
          };

          searchWorker.onerror = (error) => {
            reject(error);
          };
        });

        // Send search request to worker
        searchWorker.postMessage({
          type: 'search',
          data: {
            fileData: this.fileBytes,
            searchType: this.searchType,
            pattern: this.searchPattern,
            options: {
              caseInsensitive: false,
              regexFlags: 'g'
            }
          }
        });

        await searchPromise;

      } catch (error) {
        this.error = 'Search error: ' + error.message;
        logger.error('Search error:', error);
      } finally {
        this.loading.search = false;
        this.isSearching = false;
        this.searchProgress = 0;
      }
    },

    cancelSearch() {
      if (searchWorker && this.isSearching) {
        searchWorker.postMessage({ type: 'cancel' });
        this.isSearching = false;
        this.searchProgress = 0;
      }
    },

    navigateToMatch(match) {
      if (!match || typeof match.offset !== 'number') return;

      // Switch to hex view to show the match
      if (this.activeTab !== 'hex') {
        this.activeTab = 'hex';
      }

      // DON'T clear highlightedBytes - keep all matches highlighted
      // The highlightedBytes should already contain all match positions from the search

      // Emit event for hex view to scroll to this specific match
      this.$nextTick(() => {
        const hexViewEvent = new CustomEvent('scrollToOffset', {
          detail: {
            offset: match.offset,
            length: match.length
          }
        });
        window.dispatchEvent(hexViewEvent);
      });
    },


    // Save analysis preferences to localStorage
    saveAnalysisPreferences() {
      try {
        localStorage.setItem('analysisOptions', JSON.stringify(this.features));
      } catch (error) {
        logger.error('Error saving analysis preferences:', error);
      }
    },

    // Load saved analysis preferences
    loadAnalysisPreferences() {
      try {
        const saved = localStorage.getItem('analysisOptions');
        if (saved) {
          const savedFeatures = JSON.parse(saved);
          // Merge saved features with defaults, ensuring all are defined
          this.features = {
            fileAnalysis: savedFeatures.fileAnalysis !== false,
            visualView: savedFeatures.visualView !== false,
            hexView: savedFeatures.hexView !== false,
            stringAnalysis: savedFeatures.stringAnalysis !== false
          };
        }
      } catch (error) {
        logger.error('Error loading analysis preferences:', error);
      }
    },

    handleError(message) {
      this.error = message;
    },
    
    handleSettingsUpdate(newSettings) {
      const settingsStore = useSettingsStore()
      
      // Update base offset
      if (typeof newSettings.baseOffset === 'number') {
        settingsStore.setBaseOffset(newSettings.baseOffset)
      }
      
      // Handle other settings...
    },
    
    applySettings(settings) {
      // Apply settings to the application
      if (settings.hexUppercase) {
        // Update hex display format
      }
      
      if (settings.bytesPerRow) {
        // Update bytes per row in hex view
      }
      
      // Update other settings as needed
    },

    formatFileSize(bytes) {
      const units = ['B', 'KB', 'MB', 'GB']
      let size = bytes
      let unitIndex = 0

      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }

      return `${size.toFixed(1)} ${units[unitIndex]}`
    },

    calculateEntropy(bytes) {
      if (!bytes || bytes.length === 0) return 0

      // Count byte frequencies
      const frequencies = new Array(256).fill(0)
      for (const byte of bytes) {
        frequencies[byte]++
      }

      // Calculate Shannon entropy
      let entropy = 0
      const len = bytes.length

      for (let i = 0; i < 256; i++) {
        if (frequencies[i] > 0) {
          const probability = frequencies[i] / len
          entropy -= probability * Math.log2(probability)
        }
      }

      return entropy
    },

    initializeTheme() {
      // Check if theme is already saved in localStorage
      const savedTheme = localStorage.getItem('theme')

      if (!savedTheme) {
        // No saved theme, set dark mode as default
        const defaultTheme = 'dark'
        document.documentElement.classList.add('dark-mode')
        localStorage.setItem('theme', defaultTheme)
        logger.info('Initialized with dark mode as default')
      } else {
        // Apply saved theme
        document.documentElement.classList.add(`${savedTheme}-mode`)
        logger.info(`Applied saved theme: ${savedTheme}`)
      }
    },

    resetFile() {
      // Clear all file-related data
      this.fileBytes = new Uint8Array()
      this.fileName = null
      this.entropy = 0
      this.fileSignatures = []
      this.hashes = {
        md5: '',
        sha1: '',
        sha256: ''
      }

      // Clean up search worker
      if (searchWorker) {
        searchWorker.terminate();
        searchWorker = null;
      }

      this.highlightedBytes = []
      this.coloredBytes = []
      this.searchPattern = ''
      this.error = null
      this.progress = 0
      this.activeTab = 'info'

      // Clear chunk manager if exists
      if (this.chunkManager) {
        fileChunkManager.clear()
        this.chunkManager = null
      }

      // Reset file input
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }

      // Reset loading states
      this.loading.file = false
      this.loading.analysis = false
      this.loading.search = false

      // Enable all analysis features
      this.features.fileAnalysis = true
      this.features.visualView = true
      this.features.hexView = true
      this.features.stringAnalysis = true

      // Reset format store
      const formatStore = useFormatStore()
      formatStore.resetForFile()

      logger.info('File and analysis data cleared, all features enabled')
    }
  },

  // Load saved preferences when component is mounted
  mounted() {
    // Set defaults first
    this.features = {
      fileAnalysis: true,
      visualView: true,
      hexView: true,
      stringAnalysis: true
    };

    // Then load any saved preferences (which will override defaults if present)
    this.loadAnalysisPreferences();
    this.initializeTheme();
  },

  // Clean up resources on unmount
  beforeUnmount() {
    if (searchWorker) {
      searchWorker.terminate();
      searchWorker = null;
    }
  },

  // Save preferences when they change
  watch: {
    features: {
      handler(newOptions) {
        this.saveAnalysisPreferences();
      },
      deep: true
    }
  }
}
</script>

<style>
/* ... existing styles ... */

/* Performance indicator for large files */
.performance-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin: 8px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Help button styles */
.help-section {
  display: inline-flex;
  align-items: center;
  margin-left: 10px;
  padding-left: 15px;
  border-left: 1px solid var(--border-color);
  height: 32px;
}

.help-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
}

.help-btn:hover {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

:root[class='dark-mode'] .help-btn {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .help-btn:hover {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.indicator-icon {
  font-size: 18px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Title and header styles */
.title {
  color: #2c3e50;
  text-align: center;
  margin-bottom: 10px;
}

.subtitle {
  text-align: center;
  color: #4a5568;
  margin-bottom: 5px;
}

.copyright {
  text-align: center;
  color: #4a5568;
  margin-bottom: 20px;
}

.copyright a {
  color: #3b82f6;
  text-decoration: none;
}

.copyright a:hover {
  text-decoration: underline;
}

/* Dark mode overrides */
.dark-mode .title {
  color: #f7fafc;
}

.dark-mode .subtitle {
  color: #cbd5e0;
}

.dark-mode .copyright {
  color: #cbd5e0;
}

.dark-mode .copyright a {
  color: #60a5fa;
}

/* Custom file input styles */
.custom-file-input {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.hidden-file-input {
  display: none;
}

.file-button {
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
  white-space: nowrap;
  display: inline-block;
}

.file-button:hover {
  background-color: #2563eb;
}

.file-name {
  color: var(--text-primary);
  font-size: 14px;
  white-space: nowrap;
}

.reset-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  margin-left: 8px;
}

.reset-btn:hover {
  background-color: #ef4444;
  color: white;
  border-color: #ef4444;
}

:root[class='dark-mode'] .reset-btn:hover {
  background-color: #dc2626;
  border-color: #dc2626;
}

/* Dark mode for custom file input */
.dark-mode .file-button {
  background-color: #60a5fa;
  color: #1e293b;
}

.dark-mode .file-button:hover {
  background-color: #93c5fd;
}

.dark-mode .file-name {
  color: var(--text-primary);
}

/* Theme Variables */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --text-primary: #1a1a1a;
  --text-secondary: #4a5568;
  --border-color: #e2e8f0;
  --link-color: #3b82f6;
  --tab-active-color: #48bb78; /* Green color for active tabs */
  --error-bg: #fee2e2;
  --error-text: #dc2626;
  --checkbox-bg: #ffffff;
  --input-bg: #ffffff;
  --input-text: #1a1a1a;
  --hover-bg: #f3f4f6;
  --text-muted: #9ca3af;
}

:root[class='dark-mode'] {
  --bg-primary: #1a202c;
  --bg-secondary: #2d3748;
  --text-primary: #f7fafc;
  --text-secondary: #cbd5e0;
  --border-color: #4a5568;
  --link-color: #60a5fa;
  --tab-active-color: #68d391; /* Green color for active tabs in dark mode */
  --error-bg: #7f1d1d;
  --error-text: #fecaca;
  --checkbox-bg: #374151;
  --input-bg: #374151;
  --input-text: #f7fafc;
  --hex-text: #f7fafc;
  --hex-offset: #cbd5e0;
  --hover-bg: #374151;
  --text-muted: #6b7280;
  --hex-ascii: #60a5fa;
  --graph-text: #f7fafc;
  --graph-line: #60a5fa;
  --graph-bg: #2d3748;
}

/* Apply theme to main elements */
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.container {
  background-color: var(--bg-primary);
}

.view-container {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.tab {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.tab:hover:not(.active):not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.tab.active {
  background: var(--bg-primary);
  color: var(--tab-active-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.container {
  max-width: 95%; /* Use percentage for responsive width */
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
  background-color: var(--error-bg);
  color: var(--error-text);
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
  background-color: var(--bg-secondary);
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
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.tab:hover:not(.active):not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.tab.active {
  background: var(--bg-primary);
  color: var(--tab-active-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
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
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.analysis-options span {
  color: var(--text-primary);
}

.form-checkbox {
  background-color: var(--checkbox-bg);
  border-color: var(--border-color);
  width: 16px;
  height: 16px;
  border-radius: 4px;
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

/* Add dark mode specific styles */
.analysis-options {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

.analysis-options span {
  color: var(--text-primary);
}

.form-checkbox {
  background-color: var(--checkbox-bg);
  border-color: var(--border-color);
}

.file-input {
  color: var(--text-primary) !important;
}

.file-input input[type="file"] {
  color: var(--text-primary);
}

.file-input input[type="file"]::file-selector-button {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.error-message {
  background-color: var(--error-bg);
  color: var(--error-text);
}

.tabs {
  background-color: var(--bg-secondary);
}

.tab {
  color: var(--text-secondary);
}

.tab.active {
  background-color: var(--bg-primary);
  color: var(--link-color);
}

.view-container {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

/* Info tab specific styles */
.view-container .bg-gray-100 {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

/* Links */
a {
  color: var(--link-color);
}

/* Search bar */
input[type="text"],
input[type="search"] {
  background-color: var(--input-bg);
  color: var(--input-text);
  border-color: var(--border-color);
}

/* Progress bar */
.bg-gray-200 {
  background-color: var(--bg-secondary);
}

/* Add at the top of your style section */
* {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

/* Add specific dark mode styles for tabs */
:root[class='dark-mode'] .tab {
  color: var(--text-secondary);
}

:root[class='dark-mode'] .tab:hover:not(.active):not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

:root[class='dark-mode'] .tab.active {
  background-color: var(--bg-primary);
  color: var(--tab-active-color);
}

/* Add specific styles for File View */
:root[class='dark-mode'] .file-analysis {
  color: var(--text-primary);
}

:root[class='dark-mode'] .entropy-graph {
  background-color: var(--graph-bg);
  color: var(--graph-text);
}

:root[class='dark-mode'] .entropy-graph path {
  stroke: var(--graph-line);
}

:root[class='dark-mode'] .graph-tabs button {
  color: var(--text-primary);
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .graph-tabs button.active {
  background-color: var(--link-color);
  color: white;
}

/* Add specific styles for Hex View */
.hex-view {
  width: 100% !important;
}
:root[class='dark-mode'] .hex-view {
  color: var(--hex-text);
}

:root[class='dark-mode'] .hex-offset {
  color: var(--hex-offset);
}

:root[class='dark-mode'] .hex-ascii {
  color: var(--hex-ascii);
}

:root[class='dark-mode'] .hex-byte {
  color: var(--hex-text);
}

/* Update the tab styles to ensure visibility */
:root[class='dark-mode'] .tabs {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .tab {
  color: var(--text-secondary);
}

:root[class='dark-mode'] .tab:hover:not(.active):not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

:root[class='dark-mode'] .tab.active {
  background-color: var(--bg-primary);
  color: var(--tab-active-color);
}

/* Add styles for the byte frequency graph */
:root[class='dark-mode'] .byte-frequency {
  background-color: var(--graph-bg);
  color: var(--graph-text);
}

:root[class='dark-mode'] .byte-frequency .bar {
  background-color: var(--link-color);
}

/* Add styles for any tooltips or overlays */
:root[class='dark-mode'] .tooltip {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

/* Ensure text visibility in all views */
:root[class='dark-mode'] .view-container {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

:root[class='dark-mode'] .view-container > div {
  color: var(--text-primary);
}

</style>