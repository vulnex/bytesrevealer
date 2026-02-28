/** 
 * VULNEX -Bytes Revealer-
 *
 * File: VisualView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-16
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
            class="color-scheme-button"
            :class="{ 'hex-colors': useHexColors }"
            @click="toggleColorScheme"
            :title="useHexColors ? 'Switch to blue color scheme' : 'Switch to hex view color scheme'"
          >
            <span class="color-icon">{{ useHexColors ? '🎨' : '🔵' }}</span>
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
          class="visual-content"
          @mousedown="startSelection"
          @mousemove="updateSelection"
          @mouseup="endSelection"
        >
          <div 
            class="virtual-scroll-content"
            :style="{ height: `${totalHeight}px` }"
          >
            <div
              class="visible-window"
              :style="{ transform: `translateY(${startOffset}px)` }"
            >
              <div 
                v-for="row in visibleData" 
                :key="row.offset"
                class="byte-row"
              >
                <!-- Offset column -->
                <span class="offset">{{ formatOffset(row.offset) }}</span>
                
                <!-- Byte squares grid -->
                <div class="squares-container">
                  <div
                    v-for="(byte, index) in row.bytes"
                    :key="index"
                    :data-byte-index="row.offset + index"
                    class="byte-square"
                    :class="{
                      'highlighted': isHighlighted(row.offset + index),
                      'hovered': !inspectorLocked && hoveredByte === (row.offset + index),
                      'ascii-byte': !useHexColors && isAsciiByte(byte),
                      'selected': isSelected(row.offset + index),
                      'locked': inspectorLocked && lockedByte === (row.offset + index),
                      'byte-null': useHexColors && byte === 0x00,
                      'byte-printable': useHexColors && byte >= 0x20 && byte <= 0x7E,
                      'byte-control': useHexColors && byte >= 0x01 && byte <= 0x1F,
                      'byte-extended': useHexColors && byte >= 0x7F && byte <= 0xFE,
                      'byte-ff': useHexColors && byte === 0xFF
                    }"
                    :style="getByteStyles(row.offset + index)"
                    @mouseenter="onByteHover(row.offset + index, $event)"
                    @mouseleave="onByteLeave"
                    @dblclick="lockInspector(row.offset + index)"
                  ></div>
                </div>

                <!-- ASCII representation -->
                <div class="ascii-column">
                  |<span 
                    v-for="(byte, index) in row.bytes" 
                    :key="index"
                    :data-byte-index="row.offset + index"
                    class="ascii-char"
                    :class="{ 
                      'highlighted': isHighlighted(row.offset + index),
                      'hovered': !inspectorLocked && hoveredByte === (row.offset + index),
                      'selected': isSelected(row.offset + index)
                    }"
                    :style="getByteStyles(row.offset + index)"
                    @mouseenter="onByteHover(row.offset + index, $event)"
                    @mouseleave="onByteLeave"
                  >{{ byteToAscii(byte) }}</span>|
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <DataInspector
      :offset="getDisplayOffset(inspectorLocked ? lockedByte : (hoveredByte ?? 0))"
      :value="inspectorLocked ? (fileBytes[lockedByte] ?? 0) : (hoveredByte !== null ? fileBytes[hoveredByte] : 0)"
      :fileBytes="fileBytes"
      :isLocked="inspectorLocked"
      :actualOffset="inspectorLocked ? lockedByte : (hoveredByte ?? 0)"
      class="inspector-panel"
    />
    
    <!-- Byte information tooltip -->
    <ByteTooltip
      :show="!!hoveredByte"
      :byte="hoveredByte !== null ? fileBytes[hoveredByte] : 0"
      :offset="hoveredByte || 0"
      :x="tooltipX"
      :y="tooltipY"
    />

    <!-- Chunk Loading Indicator -->
    <ChunkLoadingIndicator
      :chunk-manager="chunkManager"
      :file-bytes="fileBytes"
    />
  </div>
</template>

<script>
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useVisualScroll } from '../composables/useVisualScroll'
import { useVisualInteraction } from '../composables/useVisualInteraction'
import ColorPalette from './ColorPalette.vue'
import ByteTooltip from './shared/ByteTooltip.vue'
import DataInspector from './shared/DataInspector.vue'
import ChunkLoadingIndicator from './ChunkLoadingIndicator.vue'

export default {
  name: 'VisualView',
  components: {
    ColorPalette,
    ByteTooltip,
    DataInspector,
    ChunkLoadingIndicator
  },
  props: {
    fileBytes: {
      type: Object,
      validator: (value) => value instanceof Uint8Array,
      required: true
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
    const baseOffset = computed(() => settingsStore.baseOffset)

    const scroll = useVisualScroll(props, baseOffset)
    const interaction = useVisualInteraction(props, emit, {
      baseOffset,
      containerRef: scroll.containerRef,
      ROW_HEIGHT: scroll.ROW_HEIGHT,
      BYTES_PER_ROW: scroll.BYTES_PER_ROW
    })

    return {
      // Scroll
      containerRef: scroll.containerRef,
      visibleData: scroll.visibleData,
      totalHeight: scroll.totalHeight,
      startOffset: scroll.startOffset,
      totalRows: scroll.totalRows,
      // Interaction
      hoveredByte: interaction.hoveredByte,
      inspectorLocked: interaction.inspectorLocked,
      lockedByte: interaction.lockedByte,
      handleKeyDown: interaction.handleKeyDown,
      tooltipX: interaction.tooltipX,
      tooltipY: interaction.tooltipY,
      selectedColor: interaction.selectedColor,
      isSelecting: interaction.isSelecting,
      selectionStart: interaction.selectionStart,
      selectionEnd: interaction.selectionEnd,
      handleColorSelected: interaction.handleColorSelected,
      startSelection: interaction.startSelection,
      updateSelection: interaction.updateSelection,
      endSelection: interaction.endSelection,
      showJumpInput: interaction.showJumpInput,
      jumpOffset: interaction.jumpOffset,
      showJumpDialog: interaction.showJumpDialog,
      cancelJump: interaction.cancelJump,
      handleJump: interaction.handleJump,
      useHexColors: interaction.useHexColors,
      toggleColorScheme: interaction.toggleColorScheme,
      formatOffset: interaction.formatOffset,
      isAsciiByte: interaction.isAsciiByte,
      byteToAscii: interaction.byteToAscii,
      getDisplayOffset: interaction.getDisplayOffset,
      bookmarkMap: interaction.bookmarkMap,
      getByteStyles: interaction.getByteStyles,
      isHighlighted: interaction.isHighlighted,
      isSelected: interaction.isSelected,
      onByteHover: interaction.onByteHover,
      onByteLeave: interaction.onByteLeave,
      lockInspector: interaction.lockInspector,
      handleGlobalClick: interaction.handleGlobalClick,
      baseOffset
    }
  }
}
</script>

<style scoped>
@import '../styles/visual-view.css';
</style>