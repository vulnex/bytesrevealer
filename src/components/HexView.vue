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
import { computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
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
import { useHexDisplay } from '../composables/useHexDisplay'
import { useHexNavigation } from '../composables/useHexNavigation'

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
    const display = useHexDisplay(props, {
      baseOffset,
      structureHighlight: kaitai.structureHighlight,
      selectionStart: selection.selectionStart,
      selectionEnd: selection.selectionEnd,
      hoveredByte: inspector.hoveredByte,
      selectedColor: selection.selectedColor
    })
    const navigation = useHexNavigation(props, {
      containerRef: scroll.containerRef,
      ROW_HEIGHT: scroll.ROW_HEIGHT,
      BYTES_PER_ROW: scroll.BYTES_PER_ROW,
      totalRows: scroll.totalRows,
      scrollTop: scroll.scrollTop,
      forceViewRow: scroll.forceViewRow,
      useVirtualNavigation: scroll.useVirtualNavigation,
      virtualOffset: scroll.virtualOffset,
      navigationInProgress: scroll.navigationInProgress,
      handleScroll: scroll.handleScroll,
      hoveredByte: inspector.hoveredByte,
      baseOffset
    })

    // Cross-composable wiring: onByteHover updates both inspector and selection
    const onByteHover = (displayOffset) => {
      inspector.onByteHover(displayOffset, baseOffset.value)
      if (selection.isSelecting.value) {
        selection.selectionEnd.value = displayOffset - baseOffset.value
      }
    }

    const onByteLeave = () => {
      inspector.hoveredByte.value = null
    }

    const startSelection = (event) => {
      if (event.button === 2) return
      const element = event.target.closest('[data-byte-index]')
      if (element) {
        const byteIndex = parseInt(element.dataset.byteIndex)
        selection.isSelecting.value = true
        selection.selectionStart.value = byteIndex
        selection.selectionEnd.value = byteIndex
      } else {
        selection.selectionStart.value = null
        selection.selectionEnd.value = null
      }
    }

    const updateSelection = (event) => {
      if (!selection.isSelecting.value) return
      const element = event.target.closest('[data-byte-index]')
      if (element) {
        selection.selectionEnd.value = parseInt(element.dataset.byteIndex)
      }
    }

    const endSelection = (event) => {
      if (event && event.button === 2) return
      if (!selection.isSelecting.value) return
      selection.isSelecting.value = false

      if (selection.selectedColor.value) {
        const start = Math.min(selection.selectionStart.value, selection.selectionEnd.value)
        const end = Math.max(selection.selectionStart.value, selection.selectionEnd.value)
        emit('byte-selection', { start, end, color: selection.selectedColor.value })

        selection.selectionStart.value = null
        selection.selectionEnd.value = null
      }
    }

    const lockInspector = (displayOffset) => {
      const actualOffset = displayOffset - baseOffset.value
      inspector.inspectorLocked.value = true
      inspector.lockedByte.value = actualOffset
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
      // Inspector
      hoveredByte: inspector.hoveredByte,
      inspectorLocked: inspector.inspectorLocked,
      lockedByte: inspector.lockedByte,
      // Selection
      selectionStart: selection.selectionStart,
      selectionEnd: selection.selectionEnd,
      selectedColor: selection.selectedColor,
      // Display
      useUppercase: display.useUppercase,
      useColors: display.useColors,
      formatOffset: display.formatOffset,
      formatByte: display.formatByte,
      getByteClass: display.getByteClass,
      byteToAscii: display.byteToAscii,
      isHighlighted: display.isHighlighted,
      isSelected: display.isSelected,
      handleColorSelected: display.handleColorSelected,
      getByteStyles: display.getByteStyles,
      getDisplayOffset: display.getDisplayOffset,
      toggleCapitalization: display.toggleCapitalization,
      toggleColors: display.toggleColors,
      // Navigation
      jumpOffset: navigation.jumpOffset,
      handleJump: navigation.handleJump,
      navigateToOffset: navigation.navigateToOffset,
      scrollToOffset: navigation.scrollToOffset,
      // Base offset
      baseOffset,
      // Cross-composable wiring
      onByteHover,
      onByteLeave,
      startSelection,
      updateSelection,
      endSelection,
      lockInspector,
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
      // Props exposed for template
      fileBytes: props.fileBytes,
      chunkManager: props.chunkManager
    }
  }
}
</script>

<style scoped>
@import '../styles/hex-view.css';
</style>
