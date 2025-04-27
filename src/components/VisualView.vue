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
                      'ascii-byte': isAsciiByte(byte),
                      'selected': isSelected(row.offset + index),
                      'locked': inspectorLocked && lockedByte === (row.offset + index)
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
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import ColorPalette from './ColorPalette.vue'
import ByteTooltip from './shared/ByteTooltip.vue'
import DataInspector from './shared/DataInspector.vue'

export default {
  name: 'VisualView',
  components: {
    ColorPalette,
    ByteTooltip,
    DataInspector
  },
  props: {
    fileBytes: {
      type: Uint8Array,
      required: true
    },
    highlightedBytes: {
      type: Array,
      default: () => []
    },
    coloredBytes: {
      type: Array,
      default: () => []
    }
  },

  setup(props) {
    const settingsStore = useSettingsStore()
    
    // Get baseOffset from store
    const baseOffset = computed(() => settingsStore.baseOffset)
    
    // Refs for DOM elements and state
    const containerRef = ref(null)
    const hoveredByte = ref(null)
    const selectedColor = ref(null)
    const isSelecting = ref(false)
    const selectionStart = ref(null)
    const selectionEnd = ref(null)
    
    // Tooltip position state
    const tooltipX = ref(0)
    const tooltipY = ref(0)
    
    // Virtual scrolling constants
    const ROW_HEIGHT = 24 // pixels
    const BYTES_PER_ROW = 32
    const BUFFER_ROWS = 10 // Number of extra rows to render above/below viewport

    // Scrolling state
    const visibleRows = ref(0)
    const scrollTop = ref(0)

    // Add these new refs
    const inspectorLocked = ref(false)
    const lockedByte = ref(null)

    // Computed properties for virtual scrolling
    const totalRows = computed(() => 
      Math.ceil((props.fileBytes.length - baseOffset.value) / BYTES_PER_ROW)
    )

    const totalHeight = computed(() => 
      totalRows.value * ROW_HEIGHT
    )

    const visibleRange = computed(() => {
      const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER_ROWS)
      const end = Math.min(
        totalRows.value,
        Math.ceil((scrollTop.value + visibleRows.value * ROW_HEIGHT) / ROW_HEIGHT) + BUFFER_ROWS
      )
      return { start, end }
    })

    const startOffset = computed(() => 
      visibleRange.value.start * ROW_HEIGHT
    )

    // Update visibleData computed to correctly handle base offset
    const visibleData = computed(() => {
      const { start, end } = visibleRange.value
      const rows = []
      
      for (let i = start; i < end; i++) {
        const actualOffset = i * BYTES_PER_ROW // Actual position in file
        const displayOffset = actualOffset + baseOffset.value // Display offset
        
        if (actualOffset >= props.fileBytes.length) break
        
        rows.push({
          offset: displayOffset, // For display purposes only
          actualOffset, // Actual position in file
          bytes: Array.from(props.fileBytes.slice(actualOffset, Math.min(actualOffset + BYTES_PER_ROW, props.fileBytes.length)))
        })
      }
      
      return rows
    })

    // Optimized scroll handler using requestAnimationFrame
    let scrollTimeout
    const handleScroll = () => {
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout)
      }
      
      scrollTimeout = window.requestAnimationFrame(() => {
        if (containerRef.value) {
          scrollTop.value = containerRef.value.scrollTop
        }
      })
    }

    // Update visible rows calculation
    const updateVisibleRows = () => {
      if (containerRef.value) {
        visibleRows.value = Math.ceil(containerRef.value.clientHeight / ROW_HEIGHT)
      }
    }

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

    // Add keyboard event listeners
    onMounted(() => {
      window.addEventListener('keydown', handleKeyDown)
      updateVisibleRows()
      containerRef.value?.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', updateVisibleRows)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeyDown)
      containerRef.value?.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateVisibleRows)
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout)
      }
    })

    // Add to setup()
    const showJumpInput = ref(false)
    const jumpOffset = ref('')

    // Add these methods
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

    return {
      containerRef,
      hoveredByte,
      selectedColor,
      isSelecting,
      selectionStart,
      selectionEnd,
      visibleData,
      totalHeight,
      startOffset,
      tooltipX,
      tooltipY,
      inspectorLocked,
      lockedByte,
      handleKeyDown,
      totalRows,
      baseOffset,
      showJumpInput,
      jumpOffset,
      showJumpDialog,
      handleJump,
      cancelJump
    }
  },

  methods: {
    formatOffset(offset) {
      return offset.toString(16).padStart(8, '0').toUpperCase()
    },

    isAsciiByte(byte) {
      return byte >= 32 && byte <= 126
    },

    byteToAscii(byte) {
      return this.isAsciiByte(byte) ? String.fromCharCode(byte) : '.'
    },

    isHighlighted(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset
      return this.highlightedBytes.includes(actualOffset)
    },

    isSelected(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset
      if (!this.isSelecting || !this.selectionStart) return false
      const start = Math.min(this.selectionStart, this.selectionEnd || this.selectionStart)
      const end = Math.max(this.selectionStart, this.selectionEnd || this.selectionStart)
      return actualOffset >= start && actualOffset <= end
    },

    handleColorSelected(color) {
      this.selectedColor = color
    },

    onByteHover(displayOffset, event) {
      const actualOffset = displayOffset - this.baseOffset
      if (!this.inspectorLocked) {
        this.hoveredByte = actualOffset
      }
      if (event) {
        this.tooltipX = event.clientX
        this.tooltipY = event.clientY
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
      const colorRange = this.coloredBytes.find(range => 
        actualOffset >= range.start && actualOffset <= range.end
      )
      return colorRange ? { backgroundColor: colorRange.color } : {}
    },

    startSelection(event) {
      if (!this.selectedColor) return
      const element = event.target.closest('[data-byte-index]')
      if (element) {
        const byteIndex = parseInt(element.dataset.byteIndex)
        this.isSelecting = true
        this.selectionStart = byteIndex
        this.selectionEnd = byteIndex
      }
    },

    updateSelection(event) {
      if (!this.isSelecting) return
      const element = event.target.closest('[data-byte-index]')
      if (element) {
        this.selectionEnd = parseInt(element.dataset.byteIndex)
      }
    },

    endSelection() {
      if (!this.isSelecting) return
      this.isSelecting = false
      const start = Math.min(this.selectionStart, this.selectionEnd)
      const end = Math.max(this.selectionStart, this.selectionEnd)
      this.$emit('byte-selection', { start, end, color: this.selectedColor })
      this.selectionStart = null
      this.selectionEnd = null
    },

    lockInspector(displayOffset) {
      const actualOffset = displayOffset - this.baseOffset
      this.inspectorLocked = true
      this.lockedByte = actualOffset
    },

    handleGlobalClick(event) {
      // Only unlock if clicking outside of a byte element
      if (this.inspectorLocked && 
          !event.target.closest('.byte-square') && 
          !event.target.closest('.ascii-group span') && 
          !event.target.closest('.data-inspector')) {
        this.inspectorLocked = false
        this.lockedByte = null
      }
    },

    getDisplayOffset(actualOffset) {
      return actualOffset + this.baseOffset
    }
  }
}
</script>

<style scoped>
.hex-view-container {
  display: flex;
  width: 100%;
  height: 100%;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.controls-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
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
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.inspector-panel {
  width: 320px;
  border-left: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.hex-view-container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.visual-view {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

.visual-content {
  flex: 1;
  overflow: auto;
  position: relative;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
}

.virtual-scroll-content {
  position: absolute;
  width: 100%;
}

.visible-window {
  position: absolute;
  width: 100%;
  will-change: transform;
}

.byte-row {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  white-space: nowrap;
  height: 24px;
}

.offset {
  color: var(--text-secondary);
  margin-right: 16px;
  min-width: 80px;
}

.squares-container {
  display: grid;
  grid-template-columns: repeat(32, 12px);
  gap: 1px;
  margin-right: 16px;
}

.byte-square {
  width: 12px;
  height: 12px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.byte-square.ascii-byte {
  background-color: var(--link-color);
}

.byte-square.highlighted,
.ascii-group span.highlighted {
  background-color: var(--link-color);
  color: white;
}

.byte-square.hovered,
.ascii-group span.hovered {
  background-color: var(--link-color);
  opacity: 0.7;
}

.byte-square.selected,
.ascii-group span.selected {
  outline: 2px solid var(--link-color);
  outline-offset: -2px;
}

.ascii-column {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--hex-ascii);
  margin-left: 16px;
}

.ascii-group span {
  cursor: pointer;
  padding: 1px 2px;
  border-radius: 2px;
  transition: background-color 0.15s ease;
  color: var(--text-primary);
}

/* Dark mode specific overrides */
:root[class='dark-mode'] .visual-view {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .byte-square {
  border-color: var(--border-color);
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .byte-square.ascii-byte {
  background-color: var(--link-color);
}

:root[class='dark-mode'] .ascii-group {
  color: var(--text-primary);
}

:root[class='dark-mode'] .ascii-group span {
  color: var(--text-primary);
}

:root[class='dark-mode'] .offset {
  color: var(--text-secondary);
}

/* Ensure tooltip is visible in dark mode */
:root[class='dark-mode'] .byte-tooltip {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

::selection {
  background: transparent;
}

.byte-square.locked {
  outline: 2px solid var(--link-color);
  outline-offset: -2px;
  background-color: var(--link-color);
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
</style>