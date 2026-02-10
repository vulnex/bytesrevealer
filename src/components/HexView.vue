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
        <button
          class="tab"
          :class="{ active: activeTab === 'bookmarks' }"
          @click="activeTab = 'bookmarks'"
        >
          Bookmarks
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

        <!-- Bookmarks Tab -->
        <div v-show="activeTab === 'bookmarks'" class="tab-pane">
          <BookmarksPanel
            :bookmarks="bookmarks"
            :annotations="annotations"
            @navigate-to-offset="navigateToOffset"
            @update-bookmark="(b) => $emit('update-bookmark', b)"
            @remove-bookmark="(id) => $emit('remove-bookmark', id)"
            @update-annotation="(a) => $emit('update-annotation', a)"
            @remove-annotation="(id) => $emit('remove-annotation', id)"
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
      :selection-start="selectionStart"
      :selection-end="selectionEnd"
      :clicked-offset="contextMenu.clickedOffset"
      @close="closeContextMenu"
      @copy="handleCopyResult"
      @export="openExportDialog"
      @export-range="openExportRangeDialog"
      @add-bookmark="handleAddBookmark"
      @add-annotation="handleAddAnnotation"
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
import { ref, computed, onMounted, onUnmounted, nextTick, defineAsyncComponent } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useFormatStore } from '../stores/format'
import ColorPalette from './ColorPalette.vue'
import DataInspector from './shared/DataInspector.vue'
import ChunkLoadingIndicator from './ChunkLoadingIndicator.vue'
import HexContextMenu from './HexContextMenu.vue'
import ExportBytesDialog from './ExportBytesDialog.vue'
import ExportBytesRangeDialog from './ExportBytesRangeDialog.vue'
import ToastNotification from './ToastNotification.vue'
import BookmarksPanel from './BookmarksPanel.vue'
import { useByteInspector } from '../composables/useByteInspector'
import { useByteSelection } from '../composables/useByteSelection'
import { useHexVirtualScroll } from '../composables/useHexVirtualScroll'
import { useHexExport } from '../composables/useHexExport'
import { useKaitaiIntegration } from '../composables/useKaitaiIntegration'

// Lazy load Kaitai components to reduce bundle size
const KaitaiStructureView = defineAsyncComponent(() =>
  import('./KaitaiStructureView.vue')
)

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
    ToastNotification,
    BookmarksPanel
  },
  computed: {
    // Create a Set for O(1) highlight lookups
    highlightSet() {
      if (!this.highlightedBytes || this.highlightedBytes.length === 0) {
        return new Set()
      }
      return new Set(this.highlightedBytes)
    },
    // O(1) bookmark lookup by offset
    bookmarkMap() {
      const map = new Map()
      for (const b of this.bookmarks) {
        map.set(b.offset, b)
      }
      return map
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
    },
    bookmarks: {
      type: Array,
      default: () => []
    },
    annotations: {
      type: Array,
      default: () => []
    }
  },

  setup(props, { emit }) {
    const settingsStore = useSettingsStore()
    const formatStore = useFormatStore()

    // Get baseOffset from store
    const baseOffset = computed(() => settingsStore.baseOffset)

    // Display toggles
    const useUppercase = ref(true)
    const useColors = ref(true)

    // --- Composables ---
    const inspector = useByteInspector()
    const selection = useByteSelection()
    const scroll = useHexVirtualScroll(props, baseOffset)
    const hexExport = useHexExport(props, {
      baseOffset,
      selectionStart: selection.selectionStart,
      selectionEnd: selection.selectionEnd,
      emit
    })
    const kaitai = useKaitaiIntegration(props, {
      hoveredByte: inspector.hoveredByte,
      visibleRange: scroll.visibleRange,
      containerRef: scroll.containerRef
    })

    // Cross-composable wiring: onByteHover updates both inspector and selection
    const onByteHover = (displayOffset) => {
      inspector.onByteHover(displayOffset, baseOffset.value)
      if (selection.isSelecting.value) {
        selection.selectionEnd.value = displayOffset - baseOffset.value
      }
    }

    // Jump offset state
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

      if (input.startsWith('0x')) {
        offset = parseInt(input.substring(2), 16)
      } else {
        offset = /^\d+$/.test(input) ? parseInt(input, 10) : parseInt(input, 16)
      }

      if (isNaN(offset) || offset < 0 || offset >= props.fileBytes.length) {
        alert('Invalid offset. Please enter a valid offset within file bounds.')
        return
      }

      const row = Math.floor(offset / scroll.BYTES_PER_ROW)
      if (scroll.containerRef.value) {
        scroll.containerRef.value.scrollTop = row * scroll.ROW_HEIGHT
      }

      const actualOffset = offset - baseOffset.value
      inspector.hoveredByte.value = actualOffset
      setTimeout(() => {
        if (inspector.hoveredByte.value === actualOffset) {
          inspector.hoveredByte.value = null
        }
      }, 1500)

      showJumpInput.value = false
      jumpOffset.value = ''
    }

    // Lifecycle hooks
    onMounted(async () => {
      window.addEventListener('keydown', inspector.handleKeyDown)

      // Initialize Kaitai manager
      await kaitai.initializeKaitai()

      // Check if we have a format in store but no structures - restore them
      if (formatStore.currentFormat && formatStore.kaitaiStructures.length === 0) {
        const formatId = formatStore.currentFormat.id || formatStore.currentFormat.name
        if (formatId && kaitai.kaitaiRuntime.value) {
          await kaitai.parseViewport(formatId)
        }
      }
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', inspector.handleKeyDown)
      kaitai.kaitaiRuntime.value = null
    })

    return {
      // Virtual scroll
      containerRef: scroll.containerRef,
      visibleData: scroll.visibleData,
      totalHeight: scroll.totalHeight,
      startOffset: scroll.startOffset,
      totalRows: scroll.totalRows,
      scrollTop: scroll.scrollTop,
      handleScroll: scroll.handleScroll,
      visibleRange: scroll.visibleRange,
      useVirtualNavigation: scroll.useVirtualNavigation,
      virtualOffset: scroll.virtualOffset,
      navigationInProgress: scroll.navigationInProgress,
      forceViewRow: scroll.forceViewRow,
      // Inspector
      hoveredByte: inspector.hoveredByte,
      inspectorLocked: inspector.inspectorLocked,
      lockedByte: inspector.lockedByte,
      handleKeyDown: inspector.handleKeyDown,
      // Selection
      isSelecting: selection.isSelecting,
      selectionStart: selection.selectionStart,
      selectionEnd: selection.selectionEnd,
      selectedColor: selection.selectedColor,
      // Display toggles
      useUppercase,
      toggleCapitalization: () => { useUppercase.value = !useUppercase.value },
      useColors,
      toggleColors: () => { useColors.value = !useColors.value },
      // Base offset
      baseOffset,
      // Cross-composable hover
      onByteHover,
      // Jump
      showJumpInput,
      jumpOffset,
      showJumpDialog,
      handleJump,
      cancelJump,
      // Kaitai
      activeTab: kaitai.activeTab,
      hasKsyFormat: kaitai.hasKsyFormat,
      kaitaiRuntime: kaitai.kaitaiRuntime,
      kaitaiSupported: kaitai.kaitaiSupported,
      kaitaiStructures: kaitai.kaitaiStructures,
      kaitaiLoading: kaitai.kaitaiLoading,
      kaitaiError: kaitai.kaitaiError,
      detectedFormat: kaitai.detectedFormat,
      handleStructureHover: kaitai.handleStructureHover,
      handleStructureSelect: kaitai.handleStructureSelect,
      handleStructureHighlight: kaitai.handleStructureHighlight,
      handleFormatChanged: kaitai.handleFormatChanged,
      structureHighlight: kaitai.structureHighlight,
      // Export
      contextMenu: hexExport.contextMenu,
      handleContextMenu: hexExport.handleContextMenu,
      closeContextMenu: hexExport.closeContextMenu,
      handleCopyResult: hexExport.handleCopyResult,
      handleAddBookmark: hexExport.handleAddBookmark,
      handleAddAnnotation: hexExport.handleAddAnnotation,
      exportDialog: hexExport.exportDialog,
      openExportDialog: hexExport.openExportDialog,
      closeExportDialog: hexExport.closeExportDialog,
      handleExportSave: hexExport.handleExportSave,
      handleExportCopy: hexExport.handleExportCopy,
      exportRangeDialog: hexExport.exportRangeDialog,
      openExportRangeDialog: hexExport.openExportRangeDialog,
      closeExportRangeDialog: hexExport.closeExportRangeDialog,
      handleExportRangeSave: hexExport.handleExportRangeSave,
      handleExportRangeCopy: hexExport.handleExportRangeCopy,
      totalSize: hexExport.totalSize,
      fileData: hexExport.fileData,
      toast: hexExport.toast,
      // Exposed for methods
      nextTick,
      fileBytes: props.fileBytes,
      chunkManager: props.chunkManager
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
      if (byte === 0x00) return 'byte-null'
      if (!this.useColors) return 'byte-white'
      if (byte >= 0x20 && byte <= 0x7E) return 'byte-printable'
      if (byte === 0xFF) return 'byte-ff'
      if (byte >= 0x01 && byte <= 0x1F) return 'byte-control'
      if (byte >= 0x7F && byte <= 0xFE) return 'byte-extended'
      return 'byte-default'
    },

    byteToAscii(byte) {
      return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
    },

    isHighlighted(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset

      if (this.highlightSet.size > 0 && !window._highlightDebugLogged) {
        window._highlightDebugLogged = true
      }

      if (this.structureHighlight) {
        const { start, end } = this.structureHighlight
        if (actualOffset >= start && actualOffset < end) {
          return true
        }
      }

      return this.highlightSet.has(actualOffset)
    },

    isSelected(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset
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

      if (this.isHighlighted(displayOffset) || this.hoveredByte === actualOffset) {
        return {}
      }

      const styles = {}

      const annotation = this.annotations.find(a =>
        actualOffset >= a.startOffset && actualOffset <= a.endOffset
      )
      if (annotation) {
        styles.backgroundColor = annotation.color + '40'
        styles.borderBottom = `2px solid ${annotation.color}`
      }

      const colorRange = this.coloredBytes.find(range =>
        actualOffset >= range.start && actualOffset <= range.end
      )
      if (colorRange) {
        styles.backgroundColor = colorRange.color
      }

      const bookmark = this.bookmarkMap.get(actualOffset)
      if (bookmark) {
        styles.borderTop = `2px solid ${bookmark.color}`
      }

      return styles
    },

    startSelection(event) {
      if (event.button === 2) return

      const element = event.target.closest('[data-byte-index]')
      if (element) {
        const byteIndex = parseInt(element.dataset.byteIndex)
        this.isSelecting = true
        this.selectionStart = byteIndex
        this.selectionEnd = byteIndex
      } else {
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
      if (event && event.button === 2) return

      if (!this.isSelecting) return
      this.isSelecting = false

      if (this.selectedColor) {
        const start = Math.min(this.selectionStart, this.selectionEnd)
        const end = Math.max(this.selectionStart, this.selectionEnd)
        this.$emit('byte-selection', { start, end, color: this.selectedColor })

        this.selectionStart = null
        this.selectionEnd = null
      }
    },

    lockInspector(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset
      this.inspectorLocked = true
      this.lockedByte = actualOffset
    },

    handleGlobalClick(event) {
      if (this.inspectorLocked && !event.target.closest('.hex-byte') && !event.target.closest('.data-inspector')) {
        this.inspectorLocked = false
        this.lockedByte = null
      }
    },

    getDisplayOffset(actualOffset) {
      return actualOffset + this.baseOffset
    },

    async navigateToOffset(offset) {
      if (this.navigationInProgress) {
        return false
      }

      this.navigationInProgress = true

      try {
        window._highlightDebugLogged = false

        await this.$nextTick()

      const BYTES_PER_ROW = 16
      const ROW_HEIGHT = 24
      const targetRow = Math.floor(offset / BYTES_PER_ROW)

      if (this.fileBytes.isProgressive && this.chunkManager) {
        const CHUNK_SIZE = this.chunkManager.CHUNK_SIZE
        const targetChunkIndex = Math.floor(offset / CHUNK_SIZE)

        const startChunk = Math.max(0, targetChunkIndex - 1)
        const endChunk = Math.min(this.chunkManager.totalChunks - 1, targetChunkIndex + 1)

        const loadPromises = []
        for (let i = startChunk; i <= endChunk; i++) {
          const chunkStart = i * CHUNK_SIZE
          const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, this.fileBytes.length)
          loadPromises.push(this.chunkManager.getRange(chunkStart, chunkEnd))
        }

        try {
          await Promise.all(loadPromises)
          await this.nextTick()
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          // chunk loading failed
        }
      }

      const container = this.containerRef

      if (!container) {
        const fallbackContainer = this.$el?.querySelector('.hex-content')
        if (!fallbackContainer) {
          return false
        }
        return this.scrollContainerToOffset(fallbackContainer, offset)
      }

      const containerHeight = container.clientHeight || 600
      const viewportRows = Math.floor(containerHeight / ROW_HEIGHT)
      const centeredRow = Math.max(0, targetRow - Math.floor(viewportRows / 2))
      const expectedScrollTop = centeredRow * ROW_HEIGHT

      this.scrollTop = expectedScrollTop

      const result = await this.scrollContainerToOffset(container, offset)
      return result
    } finally {
      this.navigationInProgress = false
    }
  },

    async scrollContainerToOffset(container, offset) {
      const BYTES_PER_ROW = 16
      const ROW_HEIGHT = 24

      const rowIndex = Math.floor(offset / BYTES_PER_ROW)

      const MAX_SAFE_SCROLL = 30000000
      const totalHeight = this.totalRows * ROW_HEIGHT

      if (totalHeight > MAX_SAFE_SCROLL) {
        this.forceViewRow = rowIndex
        this.useVirtualNavigation = true
        this.virtualOffset = offset

        container.scrollTop = 0
        this.scrollTop = 0

        if (this.fileBytes.isProgressive) {
          const CHUNK_SIZE = this.chunkManager.CHUNK_SIZE
          const chunkIndex = Math.floor(offset / CHUNK_SIZE)

          try {
            const chunkStart = chunkIndex * CHUNK_SIZE
            const chunkEnd = Math.min((chunkIndex + 1) * CHUNK_SIZE, this.fileBytes.length)
            await this.chunkManager.getRange(chunkStart, chunkEnd)

            if (chunkIndex > 0) {
              const prevStart = (chunkIndex - 1) * CHUNK_SIZE
              const prevEnd = chunkIndex * CHUNK_SIZE
              this.chunkManager.getRange(prevStart, prevEnd)
            }
            if (chunkIndex < this.chunkManager.totalChunks - 1) {
              const nextStart = (chunkIndex + 1) * CHUNK_SIZE
              const nextEnd = Math.min((chunkIndex + 2) * CHUNK_SIZE, this.fileBytes.length)
              this.chunkManager.getRange(nextStart, nextEnd)
            }
          } catch (error) {
            // chunk loading failed
          }
        }

        await this.nextTick()
        this.$forceUpdate()

        await new Promise(resolve => setTimeout(resolve, 100))
        this.$forceUpdate()

        return true
      }

      this.forceViewRow = null
      this.useVirtualNavigation = false
      this.virtualOffset = 0

      const containerHeight = container.clientHeight || 600
      const viewportRows = Math.floor(containerHeight / ROW_HEIGHT)
      const centeredRow = Math.max(0, rowIndex - Math.floor(viewportRows / 2))
      const centeredScrollTop = centeredRow * ROW_HEIGHT

      this.scrollTop = centeredScrollTop
      container.scrollTop = centeredScrollTop
      this.handleScroll(true)

      await this.nextTick()
      this.$forceUpdate()

      return true
    },

    async scrollToOffset(offset, length = 1) {
      await this.navigateToOffset(offset)
    }
  },

  mounted() {
    this.handleScrollToOffset = (event) => {
      if (event.detail && typeof event.detail.offset === 'number') {
        const length = event.detail.length || 1
        this.scrollToOffset(event.detail.offset, length)
      }
    }

    window.addEventListener('scrollToOffset', this.handleScrollToOffset)
  },

  beforeUnmount() {
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
  flex-wrap: wrap;
  gap: 1px;
  background-color: var(--bg-secondary);
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.tab {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  white-space: nowrap;
  font-size: 0.85rem;
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