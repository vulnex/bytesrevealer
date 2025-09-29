/** 
 * VULNEX -Bytes Revealer-
 *
 * File: HexView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-17
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="hex-view-container">
    <div class="main-panel">
      <div class="controls-bar">
        <div class="jump-control">
          <input
            type="text"
            v-model="jumpOffset"
            placeholder="Jump to offset (hex/dec)"
            @keyup.enter="handleJump"
            class="jump-input"
          />
          <button class="jump-button" @click="handleJump">Jump</button>
        </div>
        <div class="toolbar-buttons">
          <button
            class="capitalize-button"
            :class="{ 'uppercase-mode': useUppercase }"
            @click="toggleCapitalization"
            :title="useUppercase ? 'Switch to lowercase (aa)' : 'Switch to uppercase (AA)'"
          >
            <span class="case-icon">{{ useUppercase ? 'AA' : 'aa' }}</span>
          </button>
          <button
            class="color-toggle-button"
            :class="{ 'colors-disabled': !useColors }"
            @click="toggleColors"
            :title="useColors ? 'Disable byte coloring' : 'Enable byte coloring'"
          >
            <span class="color-icon">🎨</span>
          </button>
        </div>
        <div v-if="baseOffset" class="base-offset-indicator">
          Base Offset: 0x{{ formatOffset(baseOffset) }}
        </div>
      </div>
      <div class="content-area">
        <ColorPalette @color-selected="handleColorSelected" />
        <div
          ref="containerRef"
          class="hex-content"
          @mousedown="startSelection"
          @mousemove="updateSelection"
          @mouseup="endSelection"
          @contextmenu.prevent="handleContextMenu"
        >
          <!-- Column Headers -->
          <div class="hex-header">
            <div class="hex-grid-row">
              <div class="grid-offset">Address</div>
              <div class="grid-hex-byte" v-for="i in 16" :key="i">{{ (i-1).toString(16).toUpperCase().padStart(2, '0') }}</div>
              <div class="grid-ascii">ASCII</div>
            </div>
          </div>
          <!-- Virtual scrolling viewport -->
          <div
            class="virtual-scroll-content"
            :style="{ height: `${totalHeight}px` }"
          >
            <!-- Visible row window -->
            <div
              class="visible-window"
              :style="{ transform: `translateY(${startOffset}px)` }"
            >
              <!-- Individual hex rows -->
              <div
                v-for="row in visibleData"
                :key="row.offset"
                class="hex-row"
                :data-offset="row.offset"
              >
                <div class="hex-grid-row">
                  <!-- Offset column -->
                  <div class="grid-offset">{{ formatOffset(row.offset) }}</div>

                  <!-- Hex bytes -->
                  <template v-for="(byte, index) in 16" :key="index">
                    <div
                      v-if="index < row.bytes.length"
                      :data-byte-index="row.offset + index"
                      class="grid-hex-byte"
                      :class="[
                        getByteClass(row.bytes[index]),
                        {
                          'highlighted': isHighlighted(row.offset + index),
                          'hovered': !inspectorLocked && hoveredByte === (row.offset + index),
                          'selected': isSelected(row.offset + index),
                          'locked': inspectorLocked && lockedByte === (row.offset + index)
                        }
                      ]"
                      :style="getByteStyles(row.offset + index)"
                      @mouseenter="onByteHover(row.offset + index)"
                      @mouseleave="onByteLeave"
                      @dblclick="lockInspector(row.offset + index)"
                    >{{ formatByte(row.bytes[index]) }}</div>
                    <div v-else class="grid-hex-byte empty">  </div>
                  </template>

                  <!-- ASCII representation -->
                  <div class="grid-ascii">
                    |<template v-for="(byte, index) in row.bytes" :key="index">
                      <span
                        :data-byte-index="row.offset + index"
                        class="ascii-char"
                        :class="{
                          'highlighted': isHighlighted(row.offset + index),
                          'hovered': !inspectorLocked && hoveredByte === (row.offset + index),
                          'selected': isSelected(row.offset + index),
                          'locked': inspectorLocked && lockedByte === (row.offset + index)
                        }"
                        :style="getByteStyles(row.offset + index)"
                        @mouseenter="onByteHover(row.offset + index)"
                        @mouseleave="onByteLeave"
                        @dblclick="lockInspector(row.offset + index)"
                      >{{ byteToAscii(byte) }}</span>
                    </template>|
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- File Format Panel -->
    <!-- Right panel with tabs -->
    <div class="right-panel">
      <div class="tabs">
        <button 
          class="tab"
          :class="{ active: activeTab === 'inspector' }"
          @click="activeTab = 'inspector'"
        >
          Data Inspector
        </button>
        <button 
          v-if="kaitaiRuntime"
          class="tab"
          :class="{ active: activeTab === 'kaitai' }"
          @click="activeTab = 'kaitai'"
        >
          File Format
        </button>
      </div>
      
      <div class="tab-content">
        <!-- Data Inspector Tab -->
        <div v-show="activeTab === 'inspector'" class="tab-pane">
          <DataInspector
            :offset="getDisplayOffset(inspectorLocked ? lockedByte : (hoveredByte ?? 0))"
            :value="inspectorLocked ? (fileBytes[lockedByte] ?? 0) : (hoveredByte !== null ? fileBytes[hoveredByte] : 0)"
            :fileBytes="fileBytes"
            :isLocked="inspectorLocked"
            :actualOffset="inspectorLocked ? lockedByte : (hoveredByte ?? 0)"
          />
        </div>
        
        <!-- File Format Tab -->
        <div v-show="activeTab === 'kaitai'" class="tab-pane">
          <KaitaiStructureView
            :structures="kaitaiStructures"
            :formatName="detectedFormat"
            :loading="kaitaiLoading"
            :error="kaitaiError"
            :currentOffset="lockedByte !== null ? lockedByte : 0"
            :fileBytes="fileBytes"
            :fileName="fileName"
            @hover="handleStructureHover"
            @select="handleStructureSelect"
            @highlight="handleStructureHighlight"
            @format-changed="handleFormatChanged"
          />
        </div>
      </div>
    </div>

    <!-- Chunk Loading Indicator -->
    <ChunkLoadingIndicator
      :chunk-manager="chunkManager"
      :file-bytes="fileBytes"
    />

    <!-- Context Menu -->
    <HexContextMenu
      :visible="contextMenu.visible"
      :position="contextMenu.position"
      :selected-bytes="contextMenu.selectedBytes"
      @close="closeContextMenu"
      @copy="handleCopyResult"
      @export="openExportDialog"
      @export-range="openExportRangeDialog"
    />

    <!-- Export Dialog -->
    <ExportBytesDialog
      :visible="exportDialog.visible"
      :selected-bytes="exportDialog.selectedBytes"
      @close="closeExportDialog"
      @save="handleExportSave"
      @copy="handleExportCopy"
    />

    <!-- Export Range Dialog -->
    <ExportBytesRangeDialog
      :visible="exportRangeDialog.visible"
      :file-data="fileData"
      :file-size="totalSize"
      :initial-start="exportRangeDialog.initialStart"
      :initial-end="exportRangeDialog.initialEnd"
      @close="closeExportRangeDialog"
      @save="handleExportRangeSave"
      @copy="handleExportRangeCopy"
    />

    <!-- Toast Notification -->
    <ToastNotification
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      :duration="3000"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, defineAsyncComponent } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useFormatStore } from '../stores/format'
import ColorPalette from './ColorPalette.vue'
import DataInspector from './shared/DataInspector.vue'
import ChunkLoadingIndicator from './ChunkLoadingIndicator.vue'
import HexContextMenu from './HexContextMenu.vue'
import ExportBytesDialog from './ExportBytesDialog.vue'
import ExportBytesRangeDialog from './ExportBytesRangeDialog.vue'
import ToastNotification from './ToastNotification.vue'
import { createLogger } from '../utils/logger'

// Lazy load Kaitai components to reduce bundle size
const KaitaiStructureView = defineAsyncComponent(() =>
  import('./KaitaiStructureView.vue')
)

const logger = createLogger('HexView')

export default {
  name: 'HexView',
  components: {
    ColorPalette,
    DataInspector,
    KaitaiStructureView,
    ChunkLoadingIndicator,
    HexContextMenu,
    ExportBytesDialog,
    ExportBytesRangeDialog,
    ToastNotification
  },
  computed: {
    // Create a Set for O(1) highlight lookups
    highlightSet() {
      if (!this.highlightedBytes || this.highlightedBytes.length === 0) {
        return new Set()
      }
      return new Set(this.highlightedBytes)
    }
  },
  props: {
    fileBytes: {
      type: Object,
      validator: (value) => value instanceof Uint8Array,
      required: true
    },
    fileName: {
      type: String,
      default: null
    },
    highlightedBytes: {
      type: Array,
      default: () => []
    },
    coloredBytes: {
      type: Array,
      default: () => []
    },
    chunkManager: {
      type: Object,
      default: null
    }
  },

  setup(props, { emit }) {
    const settingsStore = useSettingsStore()
    const formatStore = useFormatStore()

    // Get baseOffset from store
    const baseOffset = computed(() => settingsStore.baseOffset)
    
    // Refs for DOM elements and state
    const containerRef = ref(null)
    const hoveredByte = ref(null)
    const selectedColor = ref(null)
    const isSelecting = ref(false)
    const selectionStart = ref(null)
    const selectionEnd = ref(null)
    const useUppercase = ref(true) // Default to uppercase
    const useColors = ref(true) // Default to colored bytes

    // Context menu state
    const contextMenu = ref({
      visible: false,
      position: { x: 0, y: 0 },
      selectedBytes: new Uint8Array()
    })

    // Toast notification state
    const toast = ref({
      show: false,
      message: '',
      type: 'success'
    })

    // Export dialog state
    const exportDialog = ref({
      visible: false,
      selectedBytes: new Uint8Array()
    })

    // Export range dialog state
    const exportRangeDialog = ref({
      visible: false,
      initialStart: 0,
      initialEnd: 0
    })

    // Kaitai Struct state
    const kaitaiRuntime = ref(null)
    const activeTab = ref('inspector') // Default to Data Inspector tab
    const hasKsyFormat = computed(() => {
      // Show Kaitai tab only when a KSY format is loaded
      const hasStructures = kaitaiStructures.value && kaitaiStructures.value.length > 0
      return hasStructures
    })
    const kaitaiSupported = ref(false)
    const kaitaiStructures = computed(() => formatStore.kaitaiStructures)
    const kaitaiLoading = ref(false)
    const kaitaiError = ref(null)
    const detectedFormat = computed(() => formatStore.formatName)
    const structureHighlight = ref(null)
    
    // Virtual scrolling constants
    const ROW_HEIGHT = 24 // pixels
    const BYTES_PER_ROW = 16 // Standard hex view shows 16 bytes per row
    const BUFFER_ROWS = 200 // Extra large buffer for very large files

    // Scrolling state
    const visibleRows = ref(0)
    const scrollTop = ref(0)

    // Virtual navigation state for very large files
    const virtualOffset = ref(0) // The actual file offset we want to view
    const useVirtualNavigation = ref(false) // Flag to enable virtual navigation
    const navigationInProgress = ref(false) // Prevent concurrent navigations
    const forceViewRow = ref(null) // Force view to show specific row

    // Computed properties for virtual scrolling
    const totalRows = computed(() =>
      Math.ceil((props.fileBytes.length - baseOffset.value) / BYTES_PER_ROW)
    )

    // Computed properties for export range dialog
    const totalSize = computed(() => props.fileBytes ? props.fileBytes.length : 0)
    const fileData = computed(() => props.fileBytes)

    const totalHeight = computed(() => {
      // In virtual navigation mode, use a fixed height
      if (useVirtualNavigation.value) {
        // Just show the viewport height, no scrolling
        return 600 // Match container height
      }
      // Normal mode shows full scrollable height
      return totalRows.value * ROW_HEIGHT
    })

    const visibleRange = computed(() => {
      // If we're forcing a specific view, use that
      if (forceViewRow.value !== null) {
        const targetRow = forceViewRow.value
        const viewportHeight = 30 // Show 30 rows

        const start = Math.max(0, targetRow - 15)
        const end = Math.min(totalRows.value, targetRow + 15)

        // console.debug(`Force view range: rows ${start} to ${end}, centered on row ${targetRow}`)
        return { start, end }
      }

      // For very large files with virtual navigation, calculate range based on virtual offset
      if (useVirtualNavigation.value && virtualOffset.value !== null) {
        const targetRow = Math.floor(virtualOffset.value / BYTES_PER_ROW)
        const viewportHeight = 30 // Show 30 rows

        const start = Math.max(0, targetRow - 15)
        const end = Math.min(totalRows.value, targetRow + 15)

        // console.debug(`Virtual range: rows ${start} to ${end} for offset ${virtualOffset.value}`)
        return { start, end }
      }

      // Normal scrolling for smaller files
      const currentRow = Math.floor(scrollTop.value / ROW_HEIGHT)
      const visibleRowCount = Math.ceil((visibleRows.value * ROW_HEIGHT) / ROW_HEIGHT)

      const start = Math.max(0, currentRow - BUFFER_ROWS)
      const end = Math.min(
        totalRows.value,
        currentRow + visibleRowCount + BUFFER_ROWS
      )

      return { start, end }
    })

    const startOffset = computed(() => {
      // In virtual navigation mode, we don't use translateY since scroll is at top
      if (useVirtualNavigation.value) {
        return 0
      }
      // Normal mode uses translateY for performance
      return visibleRange.value.start * ROW_HEIGHT
    })

    // Update visibleData computed to correctly handle base offset and progressive loading
    const visibleData = computed(() => {
      const { start, end } = visibleRange.value
      const rows = []

      // Debug log for virtual navigation
      if (useVirtualNavigation.value && rows.length === 0) {
        // console.debug(`Building visible data for rows ${start} to ${end}`)
        // console.debug(`Virtual offset: ${virtualOffset.value}, Base offset: ${baseOffset.value}`)

        // Log highlights for debugging
        if (props.highlightedBytes && props.highlightedBytes.length > 0) {
          const relevantHighlights = props.highlightedBytes.filter(h =>
            h >= start * BYTES_PER_ROW && h < end * BYTES_PER_ROW
          )
          // console.debug(`Highlights in range: ${relevantHighlights.slice(0, 5).join(', ')}`)
        }
      }

      for (let i = start; i < end; i++) {
        const actualOffset = i * BYTES_PER_ROW // Actual position in file
        const displayOffset = actualOffset + baseOffset.value // Display offset

        if (actualOffset >= props.fileBytes.length) break

        // Debug first row in virtual navigation
        if (useVirtualNavigation.value && i === start) {
          // console.debug(`First row: actualOffset=${actualOffset}, displayOffset=${displayOffset}`)
        }

        // Get bytes for this row
        const bytes = Array.from(props.fileBytes.slice(actualOffset, Math.min(actualOffset + BYTES_PER_ROW, props.fileBytes.length)))

        rows.push({
          offset: displayOffset, // For display purposes only
          actualOffset, // Actual position in file
          bytes: bytes
        })
      }

      return rows
    })

    // Optimized scroll handler using requestAnimationFrame
    let scrollTimeout
    const handleScroll = (immediate = false) => {
      // Don't handle normal scrolling if in virtual navigation mode
      if (useVirtualNavigation.value) {
        return
      }

      if (immediate) {
        // For navigation, update immediately
        if (containerRef.value) {
          scrollTop.value = containerRef.value.scrollTop
        }
      } else {
        // For user scrolling, use RAF for performance
        if (scrollTimeout) {
          window.cancelAnimationFrame(scrollTimeout)
        }

        scrollTimeout = window.requestAnimationFrame(() => {
          if (containerRef.value) {
            scrollTop.value = containerRef.value.scrollTop
          }
        })
      }
    }

    // Update visible rows calculation
    const updateVisibleRows = () => {
      if (containerRef.value) {
        visibleRows.value = Math.ceil(containerRef.value.clientHeight / ROW_HEIGHT)
      }
    }

    // Lifecycle hooks
    onMounted(async () => {
      updateVisibleRows()
      containerRef.value?.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', updateVisibleRows)
      window.addEventListener('keydown', handleKeyDown)

      // Initialize Kaitai manager
      await initializeKaitai()

      // Check if we have a format in store but no structures - restore them
      if (formatStore.currentFormat && formatStore.kaitaiStructures.length === 0) {
        logger.debug('Restoring format structures on mount')
        const formatId = formatStore.currentFormat.id || formatStore.currentFormat.name
        if (formatId && kaitaiRuntime.value) {
          await parseViewport(formatId)
        }
      }
    })

    onUnmounted(() => {
      containerRef.value?.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateVisibleRows)
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout)
      }
      window.removeEventListener('keydown', handleKeyDown)
      
      // Don't destroy the Kaitai runtime singleton on unmount
      // It should persist across component lifecycles
      // Only set the ref to null
      kaitaiRuntime.value = null
    })

    // Add these new refs
    const inspectorLocked = ref(false)
    const lockedByte = ref(null)

    // Move handleKeyDown inside setup
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() === 'l') {
        if (!inspectorLocked.value && hoveredByte.value !== null) {
          inspectorLocked.value = true
          lockedByte.value = hoveredByte.value
        } else {
          inspectorLocked.value = false
          lockedByte.value = null
        }
      }
    }

    // Update byte handling methods to use actualOffset
    const onByteHover = (displayOffset, event) => {
      const actualOffset = displayOffset - baseOffset.value
      if (!inspectorLocked.value) {
        hoveredByte.value = actualOffset
      }
      if (isSelecting.value) {
        selectionEnd.value = actualOffset
      }
    }

    const showJumpInput = ref(false)
    const jumpOffset = ref('')

    const showJumpDialog = () => {
      showJumpInput.value = true
    }

    const cancelJump = () => {
      showJumpInput.value = false
      jumpOffset.value = ''
    }

    const handleJump = () => {
      const input = jumpOffset.value.trim()
      let offset
      
      // Handle hex input
      if (input.startsWith('0x')) {
        offset = parseInt(input.substring(2), 16)
      } else {
        // Try parsing as decimal, then as hex
        offset = /^\d+$/.test(input) ? parseInt(input, 10) : parseInt(input, 16)
      }

      if (isNaN(offset) || offset < 0 || offset >= props.fileBytes.length) {
        alert('Invalid offset. Please enter a valid offset within file bounds.')
        return
      }

      // Calculate row and scroll
      const row = Math.floor(offset / BYTES_PER_ROW)
      if (containerRef.value) {
        containerRef.value.scrollTop = row * ROW_HEIGHT
      }

      // Highlight the byte briefly
      const actualOffset = offset - baseOffset.value
      hoveredByte.value = actualOffset
      setTimeout(() => {
        if (hoveredByte.value === actualOffset) {
          hoveredByte.value = null
        }
      }, 1500)

      showJumpInput.value = false
      jumpOffset.value = ''
    }
    
    // Kaitai Struct methods
    const initializeKaitai = async () => {
      try {
        // Lazy load Kaitai runtime
        const { getKaitaiRuntime } = await import('../kaitai/runtime/KaitaiRuntime')
        kaitaiRuntime.value = getKaitaiRuntime()

        // Check if runtime is valid
        if (!kaitaiRuntime.value || !kaitaiRuntime.value.formatRegistry) {
          throw new Error('KaitaiRuntime not properly initialized')
        }
        
        await kaitaiRuntime.value.formatRegistry.initialize()
        
        // Allow Kaitai for files up to 500MB with viewport parsing
        const MAX_KAITAI_SIZE = 500 * 1024 * 1024 // 500MB
        if (props.fileBytes && props.fileBytes.length > MAX_KAITAI_SIZE) {
          logger.warn('File too large for Kaitai structure parsing (>500MB)')
          kaitaiSupported.value = false
          kaitaiError.value = 'File too large for structure parsing (>500MB)'
          return
        }
        
        // Don't auto-detect format - wait for user to load a KSY file
        formatStore.clearFormat()
        kaitaiSupported.value = true // Enable structure view for manual KSY loading
      } catch (error) {
        logger.error('Failed to initialize Kaitai:', error)
        kaitaiError.value = 'Failed to initialize structure parser'
        kaitaiSupported.value = false
      }
    }
    
    const parseViewport = async (formatId = null) => {
      if (!kaitaiRuntime.value) {
        logger.warn('No Kaitai runtime available')
        return
      }
      
      // Allow larger files but warn about complex formats
      const COMPLEX_FORMAT_SIZE_LIMIT = 100 * 1024 * 1024 // 100MB for complex formats
      const complexFormats = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']
      const currentFormat = formatId || detectedFormat.value
      
      if (props.fileBytes && 
          props.fileBytes.length > COMPLEX_FORMAT_SIZE_LIMIT && 
          currentFormat && 
          complexFormats.some(f => currentFormat.toLowerCase().includes(f))) {
        logger.warn(`Large ${currentFormat} file (>${COMPLEX_FORMAT_SIZE_LIMIT/1024/1024}MB) - parsing may be slow`)
        // Don't block, just warn - viewport parsing should handle it
      }
      
      try {
        kaitaiLoading.value = true
        kaitaiError.value = null
        
        logger.debug('parseViewport called with formatId:', formatId)
        
        // Parse visible viewport with a maximum window size for performance
        const MAX_VIEWPORT_SIZE = 1024 * 1024 // 1MB max viewport for parsing
        
        // For structured formats, always parse from the beginning to maintain header information
        // This ensures fields like DOS MZ headers don't disappear when scrolling
        const startByte = 0 // Always start from beginning for complete structure
        const visibleStart = visibleRange.value.start * BYTES_PER_ROW
        const requestedEndByte = visibleRange.value.end * BYTES_PER_ROW
        
        // Parse from beginning to at least the visible area
        const maxEndByte = Math.max(visibleStart + MAX_VIEWPORT_SIZE, MAX_VIEWPORT_SIZE)
        const endByte = Math.min(
          Math.max(requestedEndByte, MAX_VIEWPORT_SIZE),
          maxEndByte,
          props.fileBytes.length
        )
        
        logger.debug(`Parsing bytes ${startByte} to ${endByte} (max viewport: ${MAX_VIEWPORT_SIZE/1024}KB) with format: ${formatId}`)
        
        const fields = await kaitaiRuntime.value.parseViewport(
          props.fileBytes,
          startByte,
          endByte,
          formatId
        )
        
        // parseViewport returns fields with offset and size information
        // Convert to structure format expected by UI
        if (Array.isArray(fields)) {
          const structures = fields.map(field => {
            const structure = {
              name: field.name,
              value: field.value,
              offset: field.offset,
              size: field.size,
              fields: field.fields || []
            }
            logger.debug(`Creating structure for ${field.name}: offset=${structure.offset}, size=${structure.size}`)
            return structure
          })
          formatStore.setStructures(structures)
          logger.debug('kaitaiStructures set to:', structures)
        } else {
          formatStore.setStructures([])
        }
      } catch (error) {
        logger.error('Parse error:', error)
        kaitaiError.value = 'Failed to parse file structure'
      } finally {
        kaitaiLoading.value = false
      }
    }
    
    
    const handleStructureHover = (structure) => {
      logger.debug('handleStructureHover called with:', structure)
      if (structure && structure.offset !== undefined && structure.size !== undefined) {
        // Set highlight range for the field
        const range = {
          start: structure.offset,
          end: structure.offset + (structure.size || 1)
        }
        logger.debug('Setting highlight range:', range)
        structureHighlight.value = range
        hoveredByte.value = structure.offset
      } else {
        // Clear highlight when not hovering
        logger.debug('Clearing highlight')
        structureHighlight.value = null
      }
    }
    
    const handleStructureSelect = (structure) => {
      if (structure && structure.offset !== undefined) {
        // Jump to the structure offset
        const row = Math.floor(structure.offset / BYTES_PER_ROW)
        if (containerRef.value) {
          containerRef.value.scrollTop = row * ROW_HEIGHT
        }
        hoveredByte.value = structure.offset
      }
    }
    
    const handleStructureHighlight = (range) => {
      structureHighlight.value = range
    }
    
    // Watch for scroll changes to parse new viewport
    // Disabled for now - structures should remain stable when scrolling
    // Re-parsing on scroll causes structure fields to disappear
    /*
    watch([visibleRange], async () => {
      if (hasKsyFormat.value && kaitaiRuntime.value) {
        await parseViewport()
      }
    })
    */
    
    // Handle format change from FormatSelector
    const handleFormatChanged = async (event) => {
      try {
        kaitaiLoading.value = true
        kaitaiError.value = null
        
        // Check if format is being cleared
        if (event.cleared || !event.format) {
          // Clear the structure view
          formatStore.clearFormat()
          logger.debug('Format cleared - structure view reset')
          return
        }
        
        // Extract format info from event
        const format = event.format

        // Update detected format - ensure we have a proper name (clone to avoid reactivity warnings)
        formatStore.setFormat({ ...format })
        logger.debug(`Format changed to: ${formatStore.formatName}`, format)
        
        // Ensure kaitai runtime is initialized
        if (!kaitaiRuntime.value) {
          logger.debug('Initializing Kaitai runtime...')
          await initializeKaitai()
        }
        
        // Determine the format ID to use
        let formatId = format.id
        let registerId = format.id
        
        // Handle ksy_ prefix for generated formats
        if (formatId && formatId.startsWith('ksy_')) {
          // Register with the simplified ID, parse with the same
          formatId = formatId.substring(4) // Remove ksy_ prefix
          registerId = formatId // Use the same simplified ID for registration
        }
        
        // Register the format in runtime if it has a parser
        if (format.parser && kaitaiRuntime.value) {
          logger.debug('Registering parser with ID:', registerId)
          await kaitaiRuntime.value.formatRegistry.registerFormat({
            id: registerId,  // Use the simplified ID
            name: format.name,
            parser: format.parser,
            metadata: format.metadata || {}
          })
        } else if (kaitaiRuntime.value) {
          // Even without a parser, register the format metadata
          logger.debug('Registering format metadata with ID:', registerId)
          await kaitaiRuntime.value.formatRegistry.registerFormat({
            id: registerId,  // Use the simplified ID
            name: format.name,
            parser: null,
            metadata: format.metadata || {}
          })
        }
        
        logger.debug('Parsing viewport with format ID:', formatId)
        await parseViewport(formatId)
      } catch (error) {
        logger.error('Format change error:', error)
        kaitaiError.value = `Failed to apply format: ${error.message}`
      } finally {
        kaitaiLoading.value = false
      }
    }
    
    // Watch for file changes
    watch(() => props.fileBytes, async () => {
      if (kaitaiRuntime.value) {
        await initializeKaitai()
      }
    })

    // Context menu handlers
    const handleContextMenu = (event) => {
      event.preventDefault()

      logger.debug(`Context menu opened. Selection: start=${selectionStart.value}, end=${selectionEnd.value}`)

      // Get selected bytes
      let selectedBytes = new Uint8Array()

      if (selectionStart.value !== null && selectionEnd.value !== null) {
        // Use current selection - these values are already display offsets
        // We need to convert them back to actual file offsets
        const start = Math.min(selectionStart.value, selectionEnd.value) - baseOffset.value
        const end = Math.max(selectionStart.value, selectionEnd.value) - baseOffset.value + 1

        // Validate range
        if (start >= 0 && end <= props.fileBytes.length) {
          // Get the bytes from the file
          selectedBytes = props.fileBytes.slice(start, end)
          logger.info(`Context menu: selected ${end - start} bytes from offset ${start} to ${end}`)
          // console.log(`Selected bytes for copy: ${Array.from(selectedBytes).slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' ')}...`)
        } else {
          logger.warn(`Invalid selection range: ${start} to ${end}`)
        }
      } else {
        // Try to get byte at mouse position
        const element = event.target.closest('[data-byte-index]')
        if (element) {
          // data-byte-index contains the display offset (includes baseOffset)
          const displayOffset = parseInt(element.dataset.byteIndex)
          const actualOffset = displayOffset - baseOffset.value

          if (actualOffset >= 0 && actualOffset < props.fileBytes.length) {
            selectedBytes = props.fileBytes.slice(actualOffset, actualOffset + 1)
            logger.debug(`Context menu: selected single byte at offset ${actualOffset}`)
          }
        }
      }

      // Show context menu with selected bytes
      logger.info(`Opening context menu with ${selectedBytes.length} bytes selected`)
      contextMenu.value = {
        visible: true,
        position: { x: event.clientX, y: event.clientY },
        selectedBytes: selectedBytes
      }
    }

    const closeContextMenu = () => {
      contextMenu.value.visible = false
    }

    const handleCopyResult = (result) => {
      if (result.success) {
        logger.info(`Copied ${result.bytesCount} bytes as ${result.format}`)
        // Show success toast
        toast.value = {
          show: true,
          message: `Copied ${result.bytesCount} byte${result.bytesCount !== 1 ? 's' : ''} as ${result.format}`,
          type: 'success'
        }
        // Reset after a moment to allow re-triggering
        setTimeout(() => {
          toast.value.show = false
        }, 100)
      } else {
        logger.error(`Failed to copy: ${result.error}`)
        // Show error toast
        toast.value = {
          show: true,
          message: result.error || 'Failed to copy bytes',
          type: 'error'
        }
        // Reset after a moment to allow re-triggering
        setTimeout(() => {
          toast.value.show = false
        }, 100)
      }
    }

    // Export dialog methods
    const openExportDialog = () => {
      exportDialog.value = {
        visible: true,
        selectedBytes: contextMenu.value.selectedBytes
      }
    }

    const closeExportDialog = () => {
      exportDialog.value.visible = false
    }

    const handleExportSave = (result) => {
      if (result.success) {
        toast.value = {
          show: true,
          message: `Saved ${result.bytesCount} bytes to ${result.filename}`,
          type: 'success'
        }
      } else {
        toast.value = {
          show: true,
          message: result.error || 'Failed to save file',
          type: 'error'
        }
      }
      setTimeout(() => {
        toast.value.show = false
      }, 100)
    }

    const handleExportCopy = (result) => {
      handleCopyResult(result) // Reuse the same copy handler
    }

    const openExportRangeDialog = () => {
      // If there's a selection, use it as initial range
      let initialStart = 0
      let initialEnd = totalSize.value - 1

      if (selectionStart.value !== null && selectionEnd.value !== null) {
        const start = Math.min(selectionStart.value, selectionEnd.value)
        const end = Math.max(selectionStart.value, selectionEnd.value)
        initialStart = start - baseOffset.value
        initialEnd = end - baseOffset.value
      }

      exportRangeDialog.value = {
        visible: true,
        initialStart,
        initialEnd
      }
    }

    const closeExportRangeDialog = () => {
      exportRangeDialog.value.visible = false
    }

    const handleExportRangeSave = (result) => {
      if (result.success) {
        toast.value = {
          show: true,
          message: `Saved ${result.bytesCount} bytes to ${result.filename}`,
          type: 'success'
        }
      } else {
        toast.value = {
          show: true,
          message: result.error || 'Failed to save file',
          type: 'error'
        }
      }
      setTimeout(() => {
        toast.value.show = false
      }, 100)
    }

    const handleExportRangeCopy = (result) => {
      handleCopyResult(result) // Reuse the same copy handler
    }

    // Store refs in variables that can be accessed from methods
    const scrollTopRef = scrollTop

    return {
      containerRef,
      hoveredByte,
      selectedColor,
      isSelecting,
      selectionStart,
      selectionEnd,
      useUppercase,
      toggleCapitalization: () => {
        useUppercase.value = !useUppercase.value
      },
      useColors,
      toggleColors: () => {
        useColors.value = !useColors.value
      },
      visibleData,
      totalHeight,
      startOffset,
      inspectorLocked,
      lockedByte,
      handleKeyDown,
      totalRows,
      baseOffset,
      onByteHover,
      showJumpInput,
      jumpOffset,
      showJumpDialog,
      handleJump,
      cancelJump,
      // Kaitai properties
      activeTab,
      hasKsyFormat,
      kaitaiRuntime,
      kaitaiSupported,
      kaitaiStructures,
      kaitaiLoading,
      kaitaiError,
      detectedFormat,
      handleStructureHover,
      handleStructureSelect,
      handleStructureHighlight,
      handleFormatChanged,
      structureHighlight,
      // Exposed refs for methods
      scrollTop,
      handleScroll,
      nextTick,
      visibleRange,
      fileBytes: props.fileBytes,
      chunkManager: props.chunkManager,
      useVirtualNavigation,
      virtualOffset,
      totalRows,
      navigationInProgress,
      forceViewRow,
      // Context menu
      contextMenu,
      handleContextMenu,
      closeContextMenu,
      handleCopyResult,
      // Export dialog
      exportDialog,
      openExportDialog,
      closeExportDialog,
      handleExportSave,
      handleExportCopy,
      // Export range dialog
      exportRangeDialog,
      openExportRangeDialog,
      closeExportRangeDialog,
      handleExportRangeSave,
      handleExportRangeCopy,
      // Computed properties for range dialog
      totalSize,
      fileData,
      // Toast notification
      toast
    }
  },

  methods: {
    formatOffset(offset) {
      const hex = offset.toString(16).padStart(8, '0')
      return this.useUppercase ? hex.toUpperCase() : hex.toLowerCase()
    },

    formatByte(byte) {
      const hex = byte.toString(16).padStart(2, '0')
      return this.useUppercase ? hex.toUpperCase() : hex.toLowerCase()
    },

    getByteClass(byte) {
      // Always gray out null bytes
      if (byte === 0x00) return 'byte-null'

      // If colors are disabled, return white class for all non-null bytes
      if (!this.useColors) return 'byte-white'

      // Categorize bytes for better visibility when colors are enabled
      if (byte >= 0x20 && byte <= 0x7E) return 'byte-printable'  // Printable ASCII
      if (byte === 0xFF) return 'byte-ff'
      if (byte >= 0x01 && byte <= 0x1F) return 'byte-control'    // Control characters
      if (byte >= 0x7F && byte <= 0xFE) return 'byte-extended'   // Extended ASCII
      return 'byte-default'
    },

    byteToAscii(byte) {
      return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
    },

    isHighlighted(displayOffset) {
      // displayOffset is what's shown in the UI (includes baseOffset)
      // actualOffset is the real position in the file
      const actualOffset = displayOffset - this.baseOffset

      // Debug: Log first few highlight checks to understand the issue
      if (this.highlightSet.size > 0 && !window._highlightDebugLogged) {
        const firstHighlights = Array.from(this.highlightSet).slice(0, 5)
        // console.debug(`Highlight debug - displayOffset: ${displayOffset}, actualOffset: ${actualOffset}, baseOffset: ${this.baseOffset}`)
        // console.debug(`First highlights in set: ${firstHighlights.join(', ')}`)
        window._highlightDebugLogged = true
      }

      // Check if byte is in the structure highlight range
      if (this.structureHighlight) {
        const { start, end } = this.structureHighlight
        if (actualOffset >= start && actualOffset < end) {
          return true
        }
      }

      // Use the Set for O(1) lookup performance
      return this.highlightSet.has(actualOffset)
    },

    isSelected(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset
      // Show selection if we have a range selected (even after mouse up)
      if (this.selectionStart === null || this.selectionStart === undefined) return false
      const start = Math.min(this.selectionStart, this.selectionEnd || this.selectionStart)
      const end = Math.max(this.selectionStart, this.selectionEnd || this.selectionStart)
      return actualOffset >= start && actualOffset <= end
    },

    handleColorSelected(color) {
      this.selectedColor = color
    },

    onByteHover(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset
      if (!this.inspectorLocked) {
        this.hoveredByte = actualOffset
      }
      if (this.isSelecting) {
        this.selectionEnd = actualOffset
      }
    },

    onByteLeave() {
      this.hoveredByte = null
    },

    getByteStyles(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset

      // Only apply colored backgrounds if not highlighted
      // This allows CSS classes to handle highlighting and hovering
      const colorRange = this.coloredBytes.find(range =>
        actualOffset >= range.start && actualOffset <= range.end
      )

      // Don't apply inline styles if the byte is highlighted or hovered
      // Let CSS classes handle those states
      if (this.isHighlighted(displayOffset) || this.hoveredByte === actualOffset) {
        return {}
      }

      return colorRange ? { backgroundColor: colorRange.color } : {}
    },

    startSelection(event) {
      // Ignore right-click (button 2) to preserve selection for context menu
      if (event.button === 2) {
        return
      }

      // Allow selection for context menu (right-click copy) even without color
      const element = event.target.closest('[data-byte-index]')
      if (element) {
        const byteIndex = parseInt(element.dataset.byteIndex)
        this.isSelecting = true
        this.selectionStart = byteIndex
        this.selectionEnd = byteIndex
      } else {
        // Clear selection when clicking outside of bytes
        this.selectionStart = null
        this.selectionEnd = null
      }
    },

    updateSelection(event) {
      if (!this.isSelecting) return
      const element = event.target.closest('[data-byte-index]')
      if (element) {
        this.selectionEnd = parseInt(element.dataset.byteIndex)
      }
    },

    endSelection(event) {
      // Ignore right-click (button 2) to preserve selection for context menu
      if (event && event.button === 2) {
        return
      }

      if (!this.isSelecting) return
      this.isSelecting = false

      // Only emit color event if a color is selected
      if (this.selectedColor) {
        const start = Math.min(this.selectionStart, this.selectionEnd)
        const end = Math.max(this.selectionStart, this.selectionEnd)
        this.$emit('byte-selection', { start, end, color: this.selectedColor })

        // Clear selection after coloring
        this.selectionStart = null
        this.selectionEnd = null
      }
      // Otherwise keep the selection for context menu use - don't clear selectionStart/End
    },

    lockInspector(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset
      this.inspectorLocked = true
      this.lockedByte = actualOffset
    },

    handleGlobalClick(event) {
      // Only unlock if clicking outside of a byte element
      if (this.inspectorLocked && !event.target.closest('.hex-byte') && !event.target.closest('.data-inspector')) {
        this.inspectorLocked = false
        this.lockedByte = null
      }
    },

    getDisplayOffset(actualOffset) {
      return actualOffset + this.baseOffset
    },

    async navigateToOffset(offset) {
      // Prevent concurrent navigations
      if (this.navigationInProgress) {
        // console.warn(`Navigation already in progress, skipping navigation to offset ${offset}`)
        return false
      }

      this.navigationInProgress = true

      try {
        // Debug navigation
        // console.log(`navigateToOffset called with offset: ${offset}, baseOffset: ${this.baseOffset}`)

        // Clear debug flag for fresh debugging
        window._highlightDebugLogged = false

        // Wait a tick to ensure DOM is ready
        await this.$nextTick()

      // CRITICAL: Pre-update scrollTop to trigger visibleRange recalculation
      // This ensures the virtual scrolling loads the correct rows
      const BYTES_PER_ROW = 16
      const ROW_HEIGHT = 24
      const targetRow = Math.floor(offset / BYTES_PER_ROW)

      // For progressive loading, ensure the target chunk is loaded
      if (this.fileBytes.isProgressive && this.chunkManager) {
        const CHUNK_SIZE = this.chunkManager.CHUNK_SIZE
        const targetChunkIndex = Math.floor(offset / CHUNK_SIZE)

        // Pre-load the chunk and surrounding chunks
        const startChunk = Math.max(0, targetChunkIndex - 1)
        const endChunk = Math.min(this.chunkManager.totalChunks - 1, targetChunkIndex + 1)

        // console.debug(`Pre-loading chunks ${startChunk} to ${endChunk} for navigation to offset ${offset}`)

        // Load chunks in parallel
        const loadPromises = []
        for (let i = startChunk; i <= endChunk; i++) {
          const chunkStart = i * CHUNK_SIZE
          const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, this.fileBytes.length)
          loadPromises.push(this.chunkManager.getRange(chunkStart, chunkEnd))
        }

        try {
          await Promise.all(loadPromises)
          // console.debug('Chunks loaded successfully')

          // After chunks are loaded, wait for Vue to update
          await this.nextTick()

          // For progressive files, the fileBytes array may need a moment to update
          // Force a small delay to ensure data is available
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          // console.error('Failed to load chunks for navigation:', error)
        }
      }

      // Get the container element - when returned from setup(), Vue auto-unwraps refs in methods
      const container = this.containerRef

      if (!container) {
        // Fallback: try to find the element by query selector
        const fallbackContainer = this.$el?.querySelector('.hex-content')
        if (!fallbackContainer) {
          // console.error('navigateToOffset: Unable to find container element')
          return false
        }
        // Use the fallback
        return this.scrollContainerToOffset(fallbackContainer, offset)
      }

      // Pre-calculate expected scroll position for immediate state update
      const containerHeight = container.clientHeight || 600
      const viewportRows = Math.floor(containerHeight / ROW_HEIGHT)
      const centeredRow = Math.max(0, targetRow - Math.floor(viewportRows / 2))
      const expectedScrollTop = centeredRow * ROW_HEIGHT

      // Update scrollTop immediately to trigger visibleRange recalculation
      this.scrollTop = expectedScrollTop

      const result = await this.scrollContainerToOffset(container, offset)
      return result
    } finally {
      // Always clear the flag
      this.navigationInProgress = false
    }
  },

    async scrollContainerToOffset(container, offset) {
      const BYTES_PER_ROW = 16
      const ROW_HEIGHT = 24

      // Calculate the target row
      const rowIndex = Math.floor(offset / BYTES_PER_ROW)
      // console.log(`Navigation to offset ${offset}, row ${rowIndex}`)

      // For large files, use force view instead of scrolling
      const MAX_SAFE_SCROLL = 30000000
      const totalHeight = this.totalRows * ROW_HEIGHT

      if (totalHeight > MAX_SAFE_SCROLL) {
        // console.warn(`Using forced view for large file (${totalHeight}px)`)

        // Set force view to target row
        this.forceViewRow = rowIndex
        this.useVirtualNavigation = true
        this.virtualOffset = offset

        // Reset scroll
        container.scrollTop = 0
        this.scrollTop = 0

        // Wait for chunks to load if progressive
        if (this.fileBytes.isProgressive) {
          const CHUNK_SIZE = this.chunkManager.CHUNK_SIZE
          const chunkIndex = Math.floor(offset / CHUNK_SIZE)

          // console.debug(`Loading chunk ${chunkIndex} for offset ${offset}`)

          try {
            // Load the chunk containing the target offset
            const chunkStart = chunkIndex * CHUNK_SIZE
            const chunkEnd = Math.min((chunkIndex + 1) * CHUNK_SIZE, this.fileBytes.length)
            await this.chunkManager.getRange(chunkStart, chunkEnd)

            // Also load surrounding chunks for context
            if (chunkIndex > 0) {
              const prevStart = (chunkIndex - 1) * CHUNK_SIZE
              const prevEnd = chunkIndex * CHUNK_SIZE
              this.chunkManager.getRange(prevStart, prevEnd) // Don't await, just trigger
            }
            if (chunkIndex < this.chunkManager.totalChunks - 1) {
              const nextStart = (chunkIndex + 1) * CHUNK_SIZE
              const nextEnd = Math.min((chunkIndex + 2) * CHUNK_SIZE, this.fileBytes.length)
              this.chunkManager.getRange(nextStart, nextEnd) // Don't await, just trigger
            }

            // console.debug(`Chunk ${chunkIndex} loaded`)
          } catch (error) {
            // console.error(`Failed to load chunk: ${error}`)
          }
        }

        // Force multiple updates to ensure rendering
        await this.nextTick()
        this.$forceUpdate()

        await new Promise(resolve => setTimeout(resolve, 100))
        this.$forceUpdate()

        return true
      }

      // For normal-sized files, use regular scrolling
      this.forceViewRow = null
      this.useVirtualNavigation = false
      this.virtualOffset = 0

      // Calculate centered scroll position
      const containerHeight = container.clientHeight || 600
      const viewportRows = Math.floor(containerHeight / ROW_HEIGHT)
      const centeredRow = Math.max(0, rowIndex - Math.floor(viewportRows / 2))
      const centeredScrollTop = centeredRow * ROW_HEIGHT

      // Update scroll
      this.scrollTop = centeredScrollTop
      container.scrollTop = centeredScrollTop
      this.handleScroll(true)

      await this.nextTick()
      this.$forceUpdate()

      return true
    },

    async scrollToOffset(offset, length = 1) {
      // Use the navigateToOffset method
      const success = await this.navigateToOffset(offset)
      if (!success) {
        // console.warn(`Failed to navigate to offset ${offset}`)
      }
    }
  },

  mounted() {
    // Listen for scroll events from search
    this.handleScrollToOffset = (event) => {
      if (event.detail && typeof event.detail.offset === 'number') {
        const length = event.detail.length || 1
        this.scrollToOffset(event.detail.offset, length)
      }
    }

    window.addEventListener('scrollToOffset', this.handleScrollToOffset)
  },

  beforeUnmount() {
    // Clean up event listener
    if (this.handleScrollToOffset) {
      window.removeEventListener('scrollToOffset', this.handleScrollToOffset)
    }
  }
}
</script>

<style scoped>
.hex-view-container {
  display: flex;
  width: 100%;
  height: 600px; /* Optimized height */
  gap: 0;
  max-width: 100%;
  overflow: hidden;
}

.main-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.controls-bar {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 8px;
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.toolbar-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: 10px;
  padding-left: 15px;
  border-left: 1px solid var(--border-color);
}

.jump-control {
  display: flex;
  gap: 4px;
  flex: 1;
  max-width: 400px;
}

.jump-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.jump-button {
  padding: 6px 12px;
  background-color: var(--link-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.content-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px; /* Reduced padding for more compact layout */
}

.color-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 8px 10px 8px;
}

.hex-options {
  display: flex;
  align-items: center;
  gap: 10px;
}

.capitalize-button,
.color-toggle-button {
  padding: 6px 12px;
  background: var(--button-bg, #4a5568);
  color: var(--button-text, white);
  border: 1px solid var(--button-border, #2d3748);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.capitalize-button:hover,
.color-toggle-button:hover {
  background: var(--button-hover-bg, #2d3748);
  transform: translateY(-1px);
}

.color-toggle-button.colors-disabled {
  opacity: 0.6;
}

.color-icon {
  font-size: 16px;
}

.case-icon {
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -2px;
}

/* Right panel with tabs */
.right-panel {
  flex: 0 0 450px; /* Increased for better content display */
  width: 450px;
  border-left: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Tab styles exactly matching main navigation */
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
  color: var(--tab-active-color, #48bb78); /* Use green color, fallback if not defined */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Tab content */
.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

.tab-pane {
  height: 100%;
  overflow: auto;
  padding: 0;
}

/* Ensure the container takes full height */
:deep(.data-inspector) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Update container styles */
.hex-view {
  background-color: var(--bg-secondary);
  padding: 0;
  border-radius: 8px;
  height: 600px;
  display: flex;
  flex-direction: row;
  user-select: none;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

/* Content area styles */
.hex-content {
  flex: 1;
  height: 100%;
  overflow-x: auto;
  overflow-y: auto;
  position: relative;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
}

/* Virtual scrolling styles */
.virtual-scroll-content {
  position: absolute;
  width: 100%;
}

.visible-window {
  position: absolute;
  width: 100%;
  will-change: transform;
}

/* Column Headers */
.hex-header {
  padding: 8px 8px;
  background: var(--header-bg, #2d3748);
  color: var(--header-text, #e2e8f0);
  border-bottom: 2px solid var(--header-border, #4a5568);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
  white-space: nowrap;
}

/* CSS Grid Layout */
.hex-grid-row {
  display: grid;
  grid-template-columns: 96px repeat(16, 24px) 1fr;
  gap: 4px;
  align-items: center;
}

.grid-offset {
  color: var(--hex-offset);
  text-align: left;
  padding-right: 8px;
}

.grid-hex-byte {
  text-align: center;
  padding: 1px 0;
  border-radius: 2px;
  cursor: pointer;
  color: var(--hex-text);
}

.grid-hex-byte.empty {
  cursor: default;
}

.grid-ascii {
  padding-left: 8px;
  white-space: nowrap;
}

/* Header row ASCII text should match other headers */
.hex-header .grid-ascii {
  color: inherit; /* Use header text color */
  font-weight: 600;
}

/* Data row ASCII text uses normal ascii color */
.hex-row .grid-ascii {
  color: var(--hex-ascii);
}

.header-offset {
  display: inline-block;
  width: 96px;
  text-align: left;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  margin-right: 16px;
}

.header-hex-values {
  display: inline-block;
  width: 380px; /* 16 bytes * 20px + 15 spaces * 4px = 320px + 60px = 380px */
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  white-space: nowrap;
  letter-spacing: 0;
  margin-right: 16px;
}

.header-ascii {
  display: inline-block;
  min-width: 160px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Row styles */
.hex-row {
  padding: 2px 8px;
  white-space: nowrap;
  height: 24px;
  line-height: 18px;
  color: var(--text-primary);
  font-size: 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Offset column styles */
.offset {
  display: inline-block;
  width: 96px;
  color: var(--hex-offset);
  text-align: left;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  margin-right: 16px;
}

/* Hex values section styles */
.hex-values {
  display: inline-block;
  width: 380px; /* Match header width exactly: 16*20px + 15*4px = 380px */
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  color: var(--hex-text);
  white-space: nowrap;
  letter-spacing: 0;
  margin-right: 16px;
}

/* ASCII section styles */
.ascii-column {
  display: inline-block;
  min-width: 160px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  color: var(--hex-ascii);
  white-space: nowrap;
}

/* Common styles for both hex and ASCII characters */
.hex-byte,
.ascii-char {
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--hex-text);
}

.header-byte {
  display: inline-block;
  width: 20px;
  text-align: center;
}

.hex-byte {
  display: inline-block;
  width: 20px;
  text-align: center;
  padding: 1px 0;
  border-radius: 2px;
  cursor: pointer;
}

.hex-byte.empty {
  cursor: default;
}

.hex-spacer {
  display: inline-block;
  width: 4px;
}

.ascii-char {
  padding: 1px;
  border-radius: 2px;
}

/* Spacing for hex bytes */
/* Remove the old margin rule as we handle spacing inline */

/* Interactive states - Light mode (blue theme) */
.grid-hex-byte.hovered,
.ascii-char.hovered {
  background-color: rgba(59, 130, 246, 0.2); /* Semi-transparent blue */
  outline: 1px solid #3b82f6;
  outline-offset: -1px;
}

.grid-hex-byte.highlighted,
.ascii-char.highlighted {
  background-color: #3b82f6 !important; /* Blue background for light mode */
  color: white !important;
  font-weight: 500;
}

/* Light mode styles for new elements */
:root:not([class='dark-mode']) .capitalize-button,
:root:not([class='dark-mode']) .color-toggle-button {
  background: #e2e8f0;
  color: #2d3748;
  border-color: #cbd5e0;
}

:root:not([class='dark-mode']) .capitalize-button:hover,
:root:not([class='dark-mode']) .color-toggle-button:hover {
  background: #cbd5e0;
}

:root:not([class='dark-mode']) .hex-header {
  background: #f7fafc;
  color: #2d3748;
  border-bottom-color: #cbd5e0;
}

.grid-hex-byte.selected,
.ascii-char.selected {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

/* Dark mode specific overrides */
:root[class='dark-mode'] .hex-view {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .hex-byte,
:root[class='dark-mode'] .ascii-char {
  color: var(--hex-text);
}

:root[class='dark-mode'] .capitalize-button,
:root[class='dark-mode'] .color-toggle-button {
  background: #4a5568;
  color: #e2e8f0;
  border-color: #2d3748;
}

:root[class='dark-mode'] .capitalize-button:hover,
:root[class='dark-mode'] .color-toggle-button:hover {
  background: #2d3748;
}

:root[class='dark-mode'] .hex-header {
  background: #1a202c;
  color: #e2e8f0;
  border-bottom-color: #2d3748;
}

:root[class='dark-mode'] .offset {
  color: var(--hex-offset);
}

:root[class='dark-mode'] .ascii-column {
  color: var(--hex-ascii);
}

/* Byte value-based coloring for better visibility */
.byte-null {
  color: #999;
}

.byte-white {
  color: var(--text-primary) !important;
}

.byte-printable {
  color: #333;
}

.byte-control {
  color: #666;
}

.byte-extended {
  color: #555;
}

.byte-ff {
  color: #777;
}

.byte-default {
  color: #444;
}

/* Dark mode byte coloring - much brighter colors for visibility */
:root[class='dark-mode'] .byte-null {
  color: #888 !important;
}

:root[class='dark-mode'] .byte-printable {
  color: #f0f0f0 !important;  /* Bright white for printable ASCII */
}

:root[class='dark-mode'] .byte-control {
  color: #ffb86c !important;  /* Orange for control characters */
}

:root[class='dark-mode'] .byte-extended {
  color: #bd93f9 !important;  /* Purple for extended ASCII */
}

:root[class='dark-mode'] .byte-ff {
  color: #ff79c6 !important;  /* Pink for FF bytes */
}

:root[class='dark-mode'] .byte-default {
  color: #e0e0e0 !important;  /* Light gray default */
}

/* Fix highlight visibility in dark mode */
:root[class='dark-mode'] .grid-hex-byte.highlighted,
:root[class='dark-mode'] .ascii-char.highlighted {
  background-color: #fb923c !important; /* Orange background for better consistency */
  color: white !important;
  font-weight: 500;
}

:root[class='dark-mode'] .grid-hex-byte.hovered,
:root[class='dark-mode'] .ascii-char.hovered {
  background-color: rgba(251, 146, 60, 0.3); /* Semi-transparent orange for hover */
  color: white;
  outline: 1px solid #fb923c;
  outline-offset: -1px;
}

/* Utilities */
::selection {
  background: transparent;
}

/* Add to existing styles */
.grid-hex-byte.locked {
  outline: 2px solid var(--link-color);
  outline-offset: -2px;
  background-color: var(--link-color);
  color: white;
}

/* Add these styles */
.controls-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.base-offset-indicator {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background-color: var(--link-color);
  color: white;
  border-radius: 4px;
  font-size: 0.875rem;
  margin-bottom: 8px;
  justify-content: space-between;
}

.jump-button {
  background-color: transparent;
  border: 1px solid white;
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.jump-button:hover {
  background-color: white;
  color: var(--link-color);
}

.jump-dialog {
  display: flex;
  gap: 8px;
  padding: 8px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 8px;
}

.jump-dialog input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.jump-dialog button {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.jump-dialog button:hover {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

/* Dark mode support for tabs - matching main navigation */
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
  color: var(--tab-active-color, #68d391); /* Use green color, fallback if not defined */
}

/* Kaitai Structure Panel Styles */

</style>