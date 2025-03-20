/** 
 * VULNEX -Bytes Revealer-
 *
 * File: HexView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-17
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="hex-view">
    <!-- Color Palette for byte selection -->
    <ColorPalette @color-selected="handleColorSelected" />
    
    <!-- Main content area with virtual scrolling -->
    <div 
      ref="containerRef"
      class="hex-content"
      @mousedown="startSelection"
      @mousemove="updateSelection"
      @mouseup="endSelection"
    >
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
          >
            <!-- Offset column -->
            <span class="offset">{{ formatOffset(row.offset) }}</span>

            <!-- Hex values -->
            <div class="hex-values">
              <template v-for="(byte, index) in row.bytes" :key="index">
                <span 
                  :data-byte-index="row.offset + index"
                  class="hex-byte"
                  :class="{ 
                    'highlighted': isHighlighted(row.offset + index),
                    'hovered': hoveredByte === (row.offset + index),
                    'selected': isSelected(row.offset + index)
                  }"
                  :style="getByteStyles(row.offset + index)"
                  @mouseenter="onByteHover(row.offset + index)"
                  @mouseleave="onByteLeave"
                >{{ formatByte(byte) }}</span>{{ index < row.bytes.length - 1 ? ' ' : '' }}
              </template>
            </div>

            <!-- ASCII representation -->
            <div class="ascii-column">
              |<template v-for="(byte, index) in row.bytes" :key="index">
                <span 
                  :data-byte-index="row.offset + index"
                  class="ascii-char"
                  :class="{ 
                    'highlighted': isHighlighted(row.offset + index),
                    'hovered': hoveredByte === (row.offset + index),
                    'selected': isSelected(row.offset + index)
                  }"
                  :style="getByteStyles(row.offset + index)"
                  @mouseenter="onByteHover(row.offset + index)"
                  @mouseleave="onByteLeave"
                >{{ byteToAscii(byte) }}</span>
              </template>|
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ColorPalette from './ColorPalette.vue'

export default {
  name: 'HexView',
  components: {
    ColorPalette
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
    // Refs for DOM elements and state
    const containerRef = ref(null)
    const hoveredByte = ref(null)
    const selectedColor = ref(null)
    const isSelecting = ref(false)
    const selectionStart = ref(null)
    const selectionEnd = ref(null)
    
    // Virtual scrolling constants
    const ROW_HEIGHT = 24 // pixels
    const BYTES_PER_ROW = 16 // Standard hex view shows 16 bytes per row
    const BUFFER_ROWS = 10 // Number of extra rows to render above/below viewport

    // Scrolling state
    const visibleRows = ref(0)
    const scrollTop = ref(0)

    // Computed properties for virtual scrolling
    const totalRows = computed(() => 
      Math.ceil(props.fileBytes.length / BYTES_PER_ROW)
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

    // Generate only the visible rows of data
    const visibleData = computed(() => {
      const { start, end } = visibleRange.value
      const rows = []
      
      for (let i = start; i < end; i++) {
        const offset = i * BYTES_PER_ROW
        if (offset >= props.fileBytes.length) break
        
        rows.push({
          offset,
          bytes: Array.from(props.fileBytes.slice(offset, offset + BYTES_PER_ROW))
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

    // Lifecycle hooks
    onMounted(() => {
      updateVisibleRows()
      containerRef.value?.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', updateVisibleRows)
    })

    onUnmounted(() => {
      containerRef.value?.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateVisibleRows)
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout)
      }
    })

    return {
      containerRef,
      hoveredByte,
      selectedColor,
      isSelecting,
      selectionStart,
      selectionEnd,
      visibleData,
      totalHeight,
      startOffset
    }
  },

  methods: {
    formatOffset(offset) {
      return offset.toString(16).padStart(8, '0').toUpperCase()
    },

    formatByte(byte) {
      return byte.toString(16).padStart(2, '0').toUpperCase()
    },

    byteToAscii(byte) {
      return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
    },

    isHighlighted(index) {
      return this.highlightedBytes.includes(index)
    },

    isSelected(index) {
      if (!this.isSelecting || !this.selectionStart) return false
      const start = Math.min(this.selectionStart, this.selectionEnd || this.selectionStart)
      const end = Math.max(this.selectionStart, this.selectionEnd || this.selectionStart)
      return index >= start && index <= end
    },

    handleColorSelected(color) {
      this.selectedColor = color
    },

    onByteHover(index) {
      this.hoveredByte = index
      if (this.isSelecting) {
        this.selectionEnd = index
      }
    },

    onByteLeave() {
      this.hoveredByte = null
    },

    getByteStyles(index) {
      const colorRange = this.coloredBytes.find(range => 
        index >= range.start && index <= range.end
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
    }
  }
}
</script>

<style scoped>
/* Container styles */
.hex-view {
  background: white;
  padding: 20px;
  border-radius: 8px;
  height: 600px;
  display: flex;
  flex-direction: column;
  user-select: none;
}

/* Content area styles */
.hex-content {
  flex: 1;
  overflow: auto;
  position: relative;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  line-height: 1.5;
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

/* Row styles */
.hex-row {
  display: flex;
  padding: 2px 4px;
  white-space: nowrap;
  height: 24px;
  align-items: center;
}

/* Offset column styles */
.offset {
  color: #666;
  margin-right: 16px;
  min-width: 80px;
}

/* Hex values section styles */
.hex-values {
  margin-right: 16px;
  min-width: 360px;
  display: flex;
  flex-wrap: nowrap;
}

/* Common styles for both hex and ASCII characters */
.hex-byte,
.ascii-char {
  cursor: pointer;
  transition: all 0.15s ease;
}

.hex-byte {
  min-width: 18px;
  text-align: center;
  padding: 1px 2px;
  border-radius: 2px;
}

.ascii-char {
  padding: 1px;
  border-radius: 2px;
}

/* ASCII section styles */
.ascii-column {
  margin-left: 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Spacing for hex bytes */
.hex-byte + .hex-byte {
  margin-left: 4px;
}

/* Interactive states - ensuring identical colors */
.hex-byte.hovered,
.ascii-char.hovered {
  background-color: #3C7BD9;
  color: white;
}

.hex-byte.highlighted,
.ascii-char.highlighted {
  background-color: #ffd700;
}

.hex-byte.selected,
.ascii-char.selected {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}

/* Utilities */
::selection {
  background: transparent;
}
</style>