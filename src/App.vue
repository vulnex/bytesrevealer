/**
 * VULNEX -Bytes Revealer-
 *
 * File: App.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2026-01-03
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="container">
    <h1 class="title">VULNEX -Bytes Revealer (v0.4)-</h1>
    <p class="subtitle">- Uncover the Secrets of Binary Files -</p>
    <p class="copyright">2025-{{ currentYear }} &#169; <a href="https://www.vulnex.com" target="_blank">VULNEX</a></p>
    
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

    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        v-model="features.yaraScanning"
        :disabled="loading.file || loading.analysis"
        class="form-checkbox"
        checked
      >
      <span>YARA Scanning</span>
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
        v-if="(fileBytes.length || hasSessionData) && features.fileAnalysis"
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
        v-if="fileBytes.length && features.yaraScanning"
        class="tab"
        :class="{ active: activeTab === 'yara' }"
        @click="activeTab = 'yara'"
        :disabled="loading.analysis"
      >YARA</button>

      <button
        v-if="(fileBytes.length || hasSessionData) && (features.fileAnalysis || features.stringAnalysis)"
        class="tab"
        :class="{ active: activeTab === 'export' }"
        @click="activeTab = 'export'"
      >Export</button>
      
      <button
        class="tab"
        :class="{ active: activeTab === 'settings' }"
        @click="activeTab = 'settings'"
      >Settings</button>

      <button
        class="tab"
        :class="{ active: activeTab === 'sessions' }"
        @click="activeTab = 'sessions'"
      >Sessions</button>

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
      <template v-if="features.fileAnalysis && (fileBytes.length || hasSessionData)">
        <!-- Session restore banner -->
        <div v-if="hasSessionData && !fileBytes.length && activeTab === 'file'" class="session-restore-banner">
          <div class="banner-content">
            <span class="banner-icon">📂</span>
            <div class="banner-text">
              <strong>Session Restored: {{ pendingSessionFile?.name || 'Unknown file' }}</strong>
              <p>Showing cached analysis data. Upload the original file to enable Hex View, Visual View, and String Analysis.</p>
            </div>
          </div>
          <div class="banner-file-info" v-if="pendingSessionFile">
            <span>Expected: {{ pendingSessionFile.name }} ({{ formatFileSize(pendingSessionFile.size) }})</span>
            <span v-if="pendingSessionFile.sha256" class="hash-preview">SHA-256: {{ pendingSessionFile.sha256.substring(0, 16) }}...</span>
          </div>
        </div>
        <FileAnalysis
          v-show="activeTab === 'file'"
          :fileBytes="fileBytes"
          :entropy="entropy"
          :fileSignatures="fileSignatures"
          :hashes="hashes"
          :detectedFileType="detectedFileType"
          :hasSessionData="hasSessionData"
          :sessionFileSize="pendingSessionFile?.size || 0"
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
            :bookmarks="bookmarks"
            :annotations="annotations"
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
            :bookmarks="bookmarks"
            :annotations="annotations"
            @byte-selection="handleByteSelection"
            @add-bookmark="addBookmark"
            @add-annotation="addAnnotation"
            @update-bookmark="updateBookmark"
            @remove-bookmark="removeBookmark"
            @update-annotation="updateAnnotation"
            @remove-annotation="removeAnnotation"
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

      <!-- YARA Panel -->
      <template v-if="features.yaraScanning && fileBytes.length">
        <YaraPanel
          v-show="activeTab === 'yara'"
          :fileBytes="fileBytes"
          @navigate-to-offset="navigateToYaraMatch"
        />
      </template>

      <!-- New Information Tab Content -->
      <div v-if="activeTab === 'info'" class="p-4 bg-gray-100 rounded-lg">
        <h2 class="text-xl font-semibold">Welcome to Bytes Revealer v0.4</h2>

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

        <p class="mt-3 text-sm text-gray-600">Version 0.4 | © 2025-{{ currentYear }} VULNEX | <a href="https://github.com/vulnex/bytesrevealer" target="_blank" class="text-blue-600 underline">GitHub</a> | <a href="https://bytesrevealer.online" target="_blank" class="text-blue-600 underline">Website</a></p>
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

      <!-- Sessions Panel View -->
      <SessionControls
        v-if="activeTab === 'sessions'"
        :appState="currentAppState"
        :hasFileLoaded="fileBytes.length > 0"
        @session-loaded="handleSessionLoaded"
        @session-saved="handleSessionSaved"
        @error="handleError"
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
import { ref } from 'vue'
import FileAnalysis from './components/FileAnalysis.vue'
import VisualView from './components/VisualView.vue'
import HexView from './components/HexView.vue'
import SearchBar from './components/SearchBar.vue'
import LoadingOverlay from './components/LoadingOverlay.vue'
import StringAnalysisView from './components/StringAnalysisView.vue'
import ExportOptions from './components/ExportOptions.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import FormatLoadingIndicator from './components/FormatLoadingIndicator.vue'
import HelpDialog from './components/HelpDialog.vue'
import SessionControls from './components/SessionControls.vue'
import YaraPanel from './components/YaraPanel.vue'
import { useAppPreferences } from './composables/useAppPreferences'
import { useAnnotations } from './composables/useAnnotations'
import { useFileProcessing } from './composables/useFileProcessing'
import { useSearch } from './composables/useSearch'
import { useSessionRestore } from './composables/useSessionRestore'

export default {
  name: 'App',
  components: {
    FileAnalysis,
    VisualView,
    HexView,
    SearchBar,
    LoadingOverlay,
    StringAnalysisView,
    ExportOptions,
    SettingsPanel,
    FormatLoadingIndicator,
    HelpDialog,
    SessionControls,
    YaraPanel
  },

  setup() {
    // Template refs
    const fileInput = ref(null)
    const stringAnalysisView = ref(null)

    // 1. Standalone composables
    const preferences = useAppPreferences()
    const annotationsComposable = useAnnotations()

    // 2. File processing (standalone)
    const fp = useFileProcessing()

    // 3. Search (depends on fileBytes)
    const searchComposable = useSearch(fp.fileBytes)

    // 4. Session restore (depends on all refs)
    const session = useSessionRestore({
      fileName: fp.fileName,
      fileBytes: fp.fileBytes,
      entropy: fp.entropy,
      hashes: fp.hashes,
      fileSignatures: fp.fileSignatures,
      detectedFileType: fp.detectedFileType,
      searchPattern: searchComposable.searchPattern,
      searchType: searchComposable.searchType,
      highlightedBytes: searchComposable.highlightedBytes,
      coloredBytes: annotationsComposable.coloredBytes,
      notes: annotationsComposable.notes,
      bookmarks: annotationsComposable.bookmarks,
      annotations: annotationsComposable.annotations,
      tags: annotationsComposable.tags,
      features: preferences.features,
      activeTab: preferences.activeTab,
      activeGraphTab: preferences.activeGraphTab
    })

    // Cross-composable wrappers

    function handleFileUpload(event) {
      fp.handleFileUpload(event, {
        features: preferences.features,
        hasSessionData: session.hasSessionData,
        pendingSessionFile: session.pendingSessionFile,
        coloredBytes: annotationsComposable.coloredBytes,
        activeTab: preferences.activeTab,
        onSessionClear: session.clearSessionState
      })
    }

    function resetFile() {
      // Clear session state
      session.clearSessionState()
      annotationsComposable.resetAnnotations()
      searchComposable.cleanup()
      searchComposable.resetSearch()
      fp.resetFile(fileInput, {
        resetSearch: searchComposable.resetSearch,
        resetAnnotations: annotationsComposable.resetAnnotations,
        resetFeatures: preferences.resetFeatures
      })
      preferences.activeTab.value = 'info'
    }

    function navigateToMatch(match) {
      searchComposable.navigateToMatch(match, preferences.activeTab)
    }

    function navigateToYaraMatch(payload) {
      searchComposable.navigateToYaraMatch(payload, preferences.activeTab)
    }

    function handleError(message) {
      fp.error.value = message
    }

    function handleSessionLoaded(sessionData) {
      fp.error.value = null
      session.handleSessionLoaded(sessionData)
    }

    return {
      // Template refs
      fileInput,
      stringAnalysisView,

      // Preferences
      features: preferences.features,
      activeTab: preferences.activeTab,
      activeGraphTab: preferences.activeGraphTab,
      showHelpDialog: preferences.showHelpDialog,
      currentYear: preferences.currentYear,
      handleSettingsUpdate: preferences.handleSettingsUpdate,

      // Annotations
      bookmarks: annotationsComposable.bookmarks,
      annotations: annotationsComposable.annotations,
      coloredBytes: annotationsComposable.coloredBytes,
      notes: annotationsComposable.notes,
      tags: annotationsComposable.tags,
      addBookmark: annotationsComposable.addBookmark,
      updateBookmark: annotationsComposable.updateBookmark,
      removeBookmark: annotationsComposable.removeBookmark,
      addAnnotation: annotationsComposable.addAnnotation,
      updateAnnotation: annotationsComposable.updateAnnotation,
      removeAnnotation: annotationsComposable.removeAnnotation,
      handleByteSelection: annotationsComposable.handleByteSelection,

      // File processing
      fileBytes: fp.fileBytes,
      fileName: fp.fileName,
      entropy: fp.entropy,
      fileSignatures: fp.fileSignatures,
      hashes: fp.hashes,
      detectedFileType: fp.detectedFileType,
      loading: fp.loading,
      progress: fp.progress,
      error: fp.error,
      chunkManager: fp.chunkManager,
      formatFileSize: fp.formatFileSize,

      // Search
      searchPattern: searchComposable.searchPattern,
      searchType: searchComposable.searchType,
      highlightedBytes: searchComposable.highlightedBytes,
      searchProgress: searchComposable.searchProgress,
      isSearching: searchComposable.isSearching,
      searchResults: searchComposable.searchResults,
      search: searchComposable.search,
      clearSearch: searchComposable.clearSearch,
      cancelSearch: searchComposable.cancelSearch,

      // Session
      hasSessionData: session.hasSessionData,
      pendingSessionFile: session.pendingSessionFile,
      currentAppState: session.currentAppState,

      // Cross-composable wrappers
      handleFileUpload,
      resetFile,
      navigateToMatch,
      navigateToYaraMatch,
      handleError,
      handleSessionLoaded,
      handleSessionSaved: session.handleSessionSaved
    }
  }
}
</script>

<style>
@import './styles/app.css';
</style>