/** * VULNEX -Bytes Revealer- * * File: App.vue * Author: Simon Roses Femerling * Created:
2025-02-12 * Last Modified: 2026-01-03 * Version: 0.5 * License: Apache-2.0 * Copyright (c)
2025-2026 VULNEX. All rights reserved. * https://www.vulnex.com */

<template>
  <div class="container">
    <h1 class="title">VULNEX -Bytes Revealer (v0.5)-</h1>
    <p class="subtitle">- Uncover the Secrets of Binary Files -</p>
    <p class="copyright">
      2025-{{ currentYear }} &#169; <a href="https://www.vulnex.com" target="_blank">VULNEX</a>
    </p>

    <!-- Analysis Options -->
    <div class="analysis-options bg-white p-4 rounded-lg shadow mb-4">
      <h3 class="text-lg font-medium mb-2">Select Analysis Features:</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <label class="flex items-center space-x-2">
          <input
            v-model="features.fileAnalysis"
            type="checkbox"
            :disabled="loading.file || loading.analysis"
            class="form-checkbox"
            checked
          />
          <span>File Analysis</span>
        </label>

        <label class="flex items-center space-x-2">
          <input
            v-model="features.visualView"
            type="checkbox"
            :disabled="loading.file || loading.analysis"
            class="form-checkbox"
            checked
          />
          <span>Visual View</span>
        </label>

        <label class="flex items-center space-x-2">
          <input
            v-model="features.hexView"
            type="checkbox"
            :disabled="loading.file || loading.analysis"
            class="form-checkbox"
            checked
          />
          <span>Hex View</span>
        </label>

        <label class="flex items-center space-x-2">
          <input
            v-model="features.stringAnalysis"
            type="checkbox"
            :disabled="loading.file || loading.analysis"
            class="form-checkbox"
            checked
          />
          <span>String Analysis</span>
        </label>

        <label class="flex items-center space-x-2">
          <input
            v-model="features.yaraScanning"
            type="checkbox"
            :disabled="loading.file || loading.analysis"
            class="form-checkbox"
            checked
          />
          <span>YARA Scanning</span>
        </label>

        <label class="flex items-center space-x-2">
          <input
            v-model="features.disassembly"
            type="checkbox"
            :disabled="loading.file || loading.analysis"
            class="form-checkbox"
            checked
          />
          <span>Disassembly</span>
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
              :disabled="loading.file || loading.analysis"
              class="hidden-file-input"
              @change="handleFileUpload"
            />
            <span class="file-button"> Choose File </span>
          </label>
          <button
            class="paste-data-btn"
            type="button"
            :disabled="loading.file || loading.analysis"
            title="Paste hex, escaped bytes, base64, or hexdump output"
            aria-label="Open paste data dialog"
            @click="showPasteDialog = true"
          >
            Paste Data
          </button>
          <span class="file-name">
            {{ fileName || 'No file selected' }}
          </span>
          <button
            v-if="fileName"
            class="reset-btn"
            title="Clear file and reset"
            aria-label="Clear file and reset"
            @click="resetFile"
          >
            ✕
          </button>
          <!-- Help button with separator -->
          <div class="help-section">
            <button
              class="help-btn"
              title="Help & Information"
              aria-label="Help and information"
              @click="showHelpDialog = true"
            >
              ?
            </button>
          </div>
        </div>
      </div>
      <div v-if="progress > 0" class="mt-2">
        <div
          class="w-full bg-gray-200 rounded-full h-2.5"
          role="progressbar"
          :aria-valuenow="Math.round(progress)"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="File loading progress"
        >
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
        v-model:search-type="searchType"
        v-model:search-pattern="searchPattern"
        :is-searching="isSearching"
        :progress="searchProgress"
        :results="searchResults"
        @search="search"
        @clear="clearSearch"
        @cancel="cancelSearch"
        @navigate-to-match="navigateToMatch"
      />
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mb-4 p-4 bg-red-50 text-red-700 rounded">
      {{ error }}
    </div>

    <!-- Performance Indicator for Large Files -->
    <div v-if="chunkManager && chunkManager.isLargeFile" class="performance-indicator">
      <span class="indicator-icon">⚡</span>
      <span>Optimized mode for large file ({{ formatFileSize(fileBytes.length) }})</span>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs" role="tablist" aria-label="Analysis views">
      <button
        id="tab-info"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'info' }"
        :aria-selected="activeTab === 'info'"
        :tabindex="activeTab === 'info' ? 0 : -1"
        @click="activeTab = 'info'"
      >
        Information
      </button>

      <button
        v-if="(fileBytes.length || hasSessionData) && features.fileAnalysis"
        id="tab-file"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'file' }"
        :aria-selected="activeTab === 'file'"
        :tabindex="activeTab === 'file' ? 0 : -1"
        :disabled="loading.analysis"
        @click="activeTab = 'file'"
      >
        File View
      </button>

      <button
        v-if="!loading.file && fileBytes.length && features.visualView"
        id="tab-visual"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'visual' }"
        :aria-selected="activeTab === 'visual'"
        :tabindex="activeTab === 'visual' ? 0 : -1"
        :disabled="loading.analysis"
        @click="activeTab = 'visual'"
      >
        Visual View
      </button>

      <button
        v-if="!loading.file && fileBytes.length && features.hexView"
        id="tab-hex"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'hex' }"
        :aria-selected="activeTab === 'hex'"
        :tabindex="activeTab === 'hex' ? 0 : -1"
        :disabled="loading.analysis"
        @click="activeTab = 'hex'"
      >
        Hex View
      </button>

      <button
        v-if="!loading.file && fileBytes.length && features.stringAnalysis"
        id="tab-strings"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'strings' }"
        :aria-selected="activeTab === 'strings'"
        :tabindex="activeTab === 'strings' ? 0 : -1"
        :disabled="loading.analysis"
        @click="activeTab = 'strings'"
      >
        String Analysis
      </button>

      <button
        v-if="!loading.file && fileBytes.length && features.yaraScanning"
        id="tab-yara"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'yara' }"
        :aria-selected="activeTab === 'yara'"
        :tabindex="activeTab === 'yara' ? 0 : -1"
        :disabled="loading.analysis"
        @click="activeTab = 'yara'"
      >
        YARA
      </button>

      <button
        v-if="!loading.file && fileBytes.length && features.disassembly"
        id="tab-disasm"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'disasm' }"
        :aria-selected="activeTab === 'disasm'"
        :tabindex="activeTab === 'disasm' ? 0 : -1"
        :disabled="loading.analysis"
        @click="activeTab = 'disasm'"
      >
        Disassembly
      </button>

      <button
        v-if="
          (fileBytes.length || hasSessionData) && (features.fileAnalysis || features.stringAnalysis)
        "
        id="tab-export"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'export' }"
        :aria-selected="activeTab === 'export'"
        :tabindex="activeTab === 'export' ? 0 : -1"
        @click="activeTab = 'export'"
      >
        Export
      </button>

      <button
        id="tab-settings"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'settings' }"
        :aria-selected="activeTab === 'settings'"
        :tabindex="activeTab === 'settings' ? 0 : -1"
        @click="activeTab = 'settings'"
      >
        Settings
      </button>

      <button
        id="tab-sessions"
        class="tab"
        role="tab"
        :class="{ active: activeTab === 'sessions' }"
        :aria-selected="activeTab === 'sessions'"
        :tabindex="activeTab === 'sessions' ? 0 : -1"
        @click="activeTab = 'sessions'"
      >
        Sessions
      </button>
    </div>

    <!-- Content Views -->
    <div class="view-container mt-4">
      <!-- Loading Overlays -->
      <LoadingOverlay :show="loading.file && !progress" message="Loading file..." />
      <LoadingOverlay :show="loading.analysis" message="Analyzing file..." />

      <!-- File Analysis View -->
      <template
        v-if="features.fileAnalysis && (fileBytes.length || hasSessionData) && visitedTabs.file"
      >
        <!-- Session restore banner -->
        <div
          v-if="hasSessionData && !fileBytes.length && activeTab === 'file'"
          class="session-restore-banner"
        >
          <div class="banner-content">
            <span class="banner-icon">📂</span>
            <div class="banner-text">
              <strong>Session Restored: {{ pendingSessionFile?.name || 'Unknown file' }}</strong>
              <p>
                Showing cached analysis data. Upload the original file to enable Hex View, Visual
                View, and String Analysis.
              </p>
            </div>
          </div>
          <div v-if="pendingSessionFile" class="banner-file-info">
            <span
              >Expected: {{ pendingSessionFile.name }} ({{
                formatFileSize(pendingSessionFile.size)
              }})</span
            >
            <span v-if="pendingSessionFile.sha256" class="hash-preview"
              >SHA-256: {{ pendingSessionFile.sha256.substring(0, 16) }}...</span
            >
          </div>
        </div>
        <FileAnalysis
          v-show="activeTab === 'file'"
          v-model:active-graph-tab="activeGraphTab"
          role="tabpanel"
          aria-labelledby="tab-file"
          :file-bytes="fileBytes"
          :entropy="entropy"
          :file-signatures="fileSignatures"
          :hashes="hashes"
          :detected-file-type="detectedFileType"
          :has-session-data="hasSessionData"
          :session-file-size="pendingSessionFile?.size || 0"
          :embedded-executables="embeddedExecutables"
          :embedded-scan="embeddedScan"
          :embedded-extraction-states="embeddedExtractionStates"
          :disasm-enabled="features.disassembly"
          @cancel-embedded-scan="cancelEmbeddedScan"
          @jump-to-embedded="jumpToEmbeddedOffset"
          @extract-embedded="handleExtractEmbedded"
          @cancel-extract-embedded="handleCancelExtractEmbedded"
          @disassemble-embedded="disassembleEmbedded"
        />
      </template>

      <!-- Visual View -->
      <!-- Gated on !loading.file so the component (and its workers) doesn't
           mount during the critical-path file analysis. Mounting non-critical
           feature components early floods the main-thread microtask queue with
           worker init messages, which slows every `await` in the analysis path
           (file-type detection, WebCrypto hashes) by seconds. -->
      <template
        v-if="!loading.file && features.visualView && fileBytes.length && visitedTabs.visual"
      >
        <div v-show="activeTab === 'visual'" role="tabpanel" aria-labelledby="tab-visual">
          <VisualView
            :file-bytes="fileBytes"
            :highlighted-bytes="mergedHighlightedBytes"
            :colored-bytes="coloredBytes"
            :chunk-manager="chunkManager"
            :bookmarks="bookmarks"
            :annotations="annotations"
            @byte-selection="handleByteSelection"
          />
        </div>
      </template>

      <!-- Hex View -->
      <template v-if="!loading.file && features.hexView && fileBytes.length && visitedTabs.hex">
        <div v-show="activeTab === 'hex'" role="tabpanel" aria-labelledby="tab-hex">
          <HexView
            :file-bytes="fileBytes"
            :file-name="fileName"
            :highlighted-bytes="mergedHighlightedBytes"
            :colored-bytes="coloredBytes"
            :chunk-manager="chunkManager"
            :bookmarks="bookmarks"
            :annotations="annotations"
            :embedded-executables="embeddedExecutables"
            :disassembly-enabled="features.disassembly"
            @byte-selection="handleByteSelection"
            @add-bookmark="addBookmark"
            @add-annotation="addAnnotation"
            @update-bookmark="updateBookmark"
            @remove-bookmark="removeBookmark"
            @update-annotation="updateAnnotation"
            @remove-annotation="removeAnnotation"
            @disassemble-from-here="disassembleFromHexOffset"
          />
        </div>
      </template>

      <!-- String Analysis View -->
      <template
        v-if="!loading.file && features.stringAnalysis && fileBytes.length && visitedTabs.strings"
      >
        <StringAnalysisView
          v-show="activeTab === 'strings'"
          ref="stringAnalysisView"
          role="tabpanel"
          aria-labelledby="tab-strings"
          :file-bytes="fileBytes"
        />
      </template>

      <!-- YARA Panel -->
      <template
        v-if="!loading.file && features.yaraScanning && fileBytes.length && visitedTabs.yara"
      >
        <YaraPanel
          v-show="activeTab === 'yara'"
          role="tabpanel"
          aria-labelledby="tab-yara"
          :file-bytes="fileBytes"
          @navigate-to-offset="navigateToYaraMatch"
        />
      </template>

      <!-- Disassembly Panel -->
      <template
        v-if="!loading.file && features.disassembly && fileBytes.length && visitedTabs.disasm"
      >
        <DisassemblyView
          v-show="activeTab === 'disasm'"
          role="tabpanel"
          aria-labelledby="tab-disasm"
          :file-bytes="fileBytes"
          @navigate-to-offset="navigateToYaraMatch"
        />
      </template>

      <!-- New Information Tab Content -->
      <div
        v-if="activeTab === 'info'"
        class="p-4 bg-gray-100 rounded-lg"
        role="tabpanel"
        aria-labelledby="tab-info"
      >
        <h2 class="text-xl font-semibold">Welcome to Bytes Revealer v0.5</h2>

        <p class="mt-3">
          <strong>About:</strong> Bytes Revealer is a comprehensive binary analysis and reverse
          engineering tool designed for security researchers, forensic analysts, malware analysts,
          and developers. It provides powerful features for examining, searching, and understanding
          binary files of any type.
        </p>

        <p class="mt-3"><strong>Key Features:</strong></p>
        <ul class="list-disc ml-6 mt-2">
          <li>
            <strong>Multiple Analysis Views:</strong> File analysis, Visual representation, Hex
            editor, and String extraction
          </li>
          <li>
            <strong>Advanced File Support:</strong> Handles files up to 1.5GB with progressive
            loading
          </li>
          <li>
            <strong>Kaitai Struct Integration:</strong> Parse and analyze 100+ binary formats
            automatically
          </li>
          <li>
            <strong>Security & Privacy:</strong> All processing happens locally in your browser - no
            data is uploaded or stored
          </li>
          <li>
            <strong>Export Capabilities:</strong> Export analysis results to JSON with timestamps
            and comprehensive data
          </li>
        </ul>

        <p class="mt-3"><strong>Performance Modes:</strong></p>
        <ul class="list-disc ml-6 mt-2">
          <li>
            <strong>Files under 50MB:</strong> Full analysis including hashes, entropy, signatures,
            and string extraction
          </li>
          <li>
            <strong>Files 50MB-1.5GB:</strong> Optimized analysis with Visual and Hex views,
            progressive chunk loading
          </li>
        </ul>

        <p class="mt-3"><strong>Getting Started:</strong></p>
        <ol class="list-decimal ml-6 mt-2">
          <li>
            <strong>Choose a file:</strong> Click "Choose File" or drag and drop a binary file
          </li>
          <li>
            <strong>Select analysis features:</strong> Check which analysis types you want to
            perform
          </li>
          <li>
            <strong>Navigate views:</strong> Use the tabs to switch between different analysis
            perspectives
          </li>
          <li>
            <strong>Search and explore:</strong> Use the search bar for hex patterns or ASCII/UTF-8
            strings
          </li>
          <li>
            <strong>Export results:</strong> Save your analysis to JSON format with comprehensive
            metadata
          </li>
        </ol>

        <p class="mt-3"><strong>Pro Tips:</strong></p>
        <ul class="list-disc ml-6 mt-2">
          <li>
            Press
            <kbd
              style="
                padding: 2px 6px;
                background: #e5e7eb;
                border: 1px solid #9ca3af;
                border-radius: 3px;
              "
              >L</kbd
            >
            to lock the data inspector on a specific byte
          </li>
          <li>
            Use the color palette in Visual/Hex views to highlight and annotate interesting bytes
          </li>
          <li>
            Right-click in Hex View to access the context menu for copying bytes in various formats
          </li>
          <li>
            Toggle between blue and categorized color schemes in Visual View using the 🎨 button
          </li>
          <li>
            Click the <strong>?</strong> button in the header for detailed help, changelog, and
            documentation
          </li>
        </ul>

        <p class="mt-3">
          <strong>Need Help?</strong> Click the help button (?) next to the file selector for the
          user manual, changelog, and more information.
        </p>

        <p class="mt-3 text-sm text-gray-600">
          Version 0.5 | © 2025-{{ currentYear }} VULNEX |
          <a
            href="https://github.com/vulnex/bytesrevealer"
            target="_blank"
            class="text-blue-600 underline"
            >GitHub</a
          >
          |
          <a href="https://bytesrevealer.online" target="_blank" class="text-blue-600 underline"
            >Website</a
          >
        </p>
      </div>

      <!-- Export Options View -->
      <ExportOptions
        v-if="activeTab === 'export'"
        role="tabpanel"
        aria-labelledby="tab-export"
        @error="handleError"
      />

      <!-- Settings Panel View -->
      <SettingsPanel
        v-if="activeTab === 'settings'"
        role="tabpanel"
        aria-labelledby="tab-settings"
        @settings-updated="handleSettingsUpdate"
      />

      <!-- Sessions Panel View -->
      <SessionControls
        v-if="activeTab === 'sessions'"
        role="tabpanel"
        aria-labelledby="tab-sessions"
        :app-state="currentAppState"
        :has-file-loaded="fileBytes.length > 0"
        @session-loaded="handleSessionLoaded"
        @session-saved="handleSessionSaved"
        @error="handleError"
      />
    </div>
  </div>

  <!-- Format Loading Indicator -->
  <FormatLoadingIndicator ref="formatLoadingIndicator" />

  <!-- Help Dialog -->
  <HelpDialog v-if="showHelpDialog" @close="showHelpDialog = false" />

  <!-- Paste Data Dialog -->
  <PasteDataDialog
    :visible="showPasteDialog"
    :disabled="loading.file || loading.analysis"
    @close="showPasteDialog = false"
    @submit="handlePastedBytes"
  />
</template>

<script>
import { ref, reactive, computed, nextTick, watch } from 'vue'
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
import DisassemblyView from './components/DisassemblyView.vue'
import PasteDataDialog from './components/PasteDataDialog.vue'
import { useAppPreferences } from './composables/useAppPreferences'
import { useAnnotations } from './composables/useAnnotations'
import { useFileProcessing } from './composables/useFileProcessing'
import { useSearch } from './composables/useSearch'
import { useSessionRestore } from './composables/useSessionRestore'
import { useDisassemblyStore } from './stores/disassembly'
import { detectDisasmArch } from './utils/disasmArchDetect'
import { extractEmbedded, suggestFilename } from './services/EmbeddedExecutableExtractor'

// Above this on-disk size, prompt the user before extracting *in Blob mode*.
// Extraction materializes the embed in memory as a Blob, so very large embeds
// are worth confirming. The File System Access streaming path skips this
// gate because peak memory is one slice (~1 MB) regardless of fileSize.
const EXTRACT_CONFIRM_THRESHOLD = 1024 * 1024 * 1024

const SUPPORTS_FSA_SAVE =
  typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'

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
    YaraPanel,
    DisassemblyView,
    PasteDataDialog
  },

  setup() {
    // Template refs
    const fileInput = ref(null)
    const stringAnalysisView = ref(null)

    // Paste Data dialog
    const showPasteDialog = ref(false)

    // 1. Standalone composables
    const preferences = useAppPreferences()
    const annotationsComposable = useAnnotations()

    // Track which tabs the user has visited so panels mount lazily on first
    // click rather than all at once when fileBytes is set. Without this, every
    // tab switch pays layout cost for every other panel's hidden DOM tree.
    const visitedTabs = reactive({})
    watch(
      preferences.activeTab,
      (tab) => {
        visitedTabs[tab] = true
      },
      { immediate: true }
    )

    // 2. File processing (standalone)
    const fp = useFileProcessing()

    // 3. Search (depends on fileBytes)
    const searchComposable = useSearch(fp.fileBytes)

    const disasmStore = useDisassemblyStore()
    const mergedHighlightedBytes = computed(() => {
      const search = searchComposable.highlightedBytes.value || []
      const disasm = disasmStore.instructionHighlightBytes
      if (!disasm.length) return search
      if (!search.length) return disasm
      return [...search, ...disasm]
    })

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

    function handlePastedBytes(bytes, name) {
      showPasteDialog.value = false
      const syntheticFile = new File([bytes], name, { type: 'application/octet-stream' })
      handleFileUpload({ target: { files: [syntheticFile] } })
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

    function jumpToEmbeddedOffset(offset) {
      if (typeof offset !== 'number') return
      if (preferences.activeTab.value !== 'hex') {
        preferences.activeTab.value = 'hex'
      }
      nextTick(() => {
        window.dispatchEvent(new CustomEvent('scrollToOffset', { detail: { offset, length: 4 } }))
      })
    }

    function disassembleFromHexOffset(offset) {
      if (typeof offset !== 'number' || offset < 0) return
      disasmStore.clearResults()
      disasmStore.setRange(offset, null)
      preferences.activeTab.value = 'disasm'
    }

    function disassembleEmbedded(finding) {
      if (!finding || typeof finding.offset !== 'number') return
      const bytes = fp.fileBytes.value
      if (!bytes || !bytes.length) return
      const size = finding.fileSize || finding.size || 0
      if (size <= 0) return
      const start = finding.offset
      const end = Math.min(start + size, bytes.length)
      if (end <= start) return

      // Slice the embed and feed it to the same arch detector the main file
      // load path uses. Its startOffset is relative to the slice; add the
      // finding's offset to land on the embed's entry point in file coords.
      const slice = bytes.subarray(start, end)
      const detected = detectDisasmArch(slice)

      preferences.activeTab.value = 'disasm'
      // Wait for DisassemblyView's own auto-detect (which sees the host file's
      // headers, not the embed's) to finish before we overwrite the store.
      nextTick(() => {
        disasmStore.clearResults()
        if (detected) {
          disasmStore.setArchitecture(detected.arch)
          disasmStore.setMode(detected.mode)
          const embedStart = start + (detected.startOffset || 0)
          disasmStore.setRange(embedStart, end)
        } else {
          disasmStore.setRange(start, end)
        }
      })
    }

    // Reactive map: finding.offset → { bytesRead, totalBytes } while extraction
    // is in flight. Bound to EmbeddedExecutables via :extraction-states so the
    // table can render per-row spinners.
    const embeddedExtractionStates = reactive({})
    // Non-reactive: AbortController per active extraction, for cancel events.
    const embeddedExtractionControllers = new Map()

    function triggerDownload(blob, filename) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    async function handleExtractEmbedded(finding) {
      if (!finding || finding.extractable === false) return

      const offsetKey = finding.offset
      // Guard re-entry: if an extraction is already in flight at this offset, no-op.
      if (embeddedExtractionStates[offsetKey]) return

      const fileSize = finding.fileSize || 0
      const suggestedName = suggestFilename(finding)

      // Try the File System Access save picker first. Streaming directly to
      // disk avoids the Blob-build memory doubling for large embeds. Must
      // happen synchronously enough that the user-activation token survives;
      // showSaveFilePicker awaits, but the activation is not consumed.
      let writer = null
      if (SUPPORTS_FSA_SAVE) {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName })
          writer = await handle.createWritable()
        } catch (err) {
          // User cancelled the picker — treat as silent no-op.
          if (err && err.name === 'AbortError') return
          // Other failures (browser quirk, permission denied) — fall back to
          // the Blob path; let the user retry if it matters.
          writer = null
        }
      }

      // Memory-pressure confirm only matters for the Blob path. The streaming
      // path holds one slice (~1 MB) regardless of the embed's total size.
      if (!writer && fileSize > EXTRACT_CONFIRM_THRESHOLD) {
        const sizeStr = fp.formatFileSize(fileSize)
        const ok = window.confirm(
          `This embedded file is ${sizeStr}. Extracting will use memory equal to its size. Continue?`
        )
        if (!ok) return
      }

      const controller = new AbortController()
      embeddedExtractionControllers.set(offsetKey, controller)
      embeddedExtractionStates[offsetKey] = { bytesRead: 0, totalBytes: fileSize }

      try {
        const result = await extractEmbedded({
          fileBytes: fp.fileBytes.value,
          finding,
          onProgress: (bytesRead, totalBytes) => {
            const state = embeddedExtractionStates[offsetKey]
            if (state) {
              state.bytesRead = bytesRead
              state.totalBytes = totalBytes
            }
          },
          signal: controller.signal,
          writer
        })
        if (!result.streamed) {
          // Blob fallback path — trigger a browser download.
          triggerDownload(result.blob, result.filename)
        }
        if (result.validationWarning) {
          const verb = result.streamed ? 'Saved' : 'Downloaded'
          fp.error.value = `Warning: ${result.validationWarning}. ${verb} as ${result.filename} — verify before use.`
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          fp.error.value = `Extraction failed: ${err.message || err}`
        }
      } finally {
        delete embeddedExtractionStates[offsetKey]
        embeddedExtractionControllers.delete(offsetKey)
      }
    }

    function handleCancelExtractEmbedded(offset) {
      const controller = embeddedExtractionControllers.get(offset)
      if (controller) controller.abort()
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
      visitedTabs,

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
      embeddedExecutables: fp.embeddedExecutables,
      embeddedScan: fp.embeddedScan,
      embeddedExtractionStates,
      cancelEmbeddedScan: fp.cancelEmbeddedScan,
      jumpToEmbeddedOffset,
      handleExtractEmbedded,
      handleCancelExtractEmbedded,
      formatFileSize: fp.formatFileSize,

      // Search
      searchPattern: searchComposable.searchPattern,
      searchType: searchComposable.searchType,
      highlightedBytes: searchComposable.highlightedBytes,
      mergedHighlightedBytes,
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
      handlePastedBytes,
      showPasteDialog,
      resetFile,
      navigateToMatch,
      navigateToYaraMatch,
      disassembleFromHexOffset,
      disassembleEmbedded,
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
