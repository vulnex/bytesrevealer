/** 
 * VULNEX -Bytes Revealer-
 *
 * File: VisualView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-16
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="visual-view">
    <!-- Color Palette for byte selection -->
    <ColorPalette @color-selected="handleColorSelected" />
    
    <!-- Main content area with virtual scrolling -->
    <div 
      ref="containerRef"
      class="visual-content"
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
          <!-- Individual byte rows -->
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
                  'hovered': hoveredByte === (row.offset + index),
                  'ascii-byte': isAsciiByte(byte),
                  'selected': isSelected(row.offset + index)
                }"
                :style="getByteStyles(row.offset + index)"
                @mouseenter="onByteHover(row.offset + index, $event)"
                @mouseleave="onByteLeave"
              ></div>
            </div>

            <!-- ASCII representation -->
            <div class="ascii-group">
              |<span 
                v-for="(byte, index) in row.bytes" 
                :key="index"
                :data-byte-index="row.offset + index"
                :class="{ 
                  'highlighted': isHighlighted(row.offset + index),
                  'hovered': hoveredByte === (row.offset + index),
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
import ColorPalette from './ColorPalette.vue'
import ByteTooltip from './shared/ByteTooltip.vue'

export default {
  name: 'VisualView',
  components: {
    ColorPalette,
    ByteTooltip
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
      startOffset,
      tooltipX,
      tooltipY
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

    onByteHover(index, event) {
      this.hoveredByte = index
      if (event) {
        this.tooltipX = event.clientX
        this.tooltipY = event.clientY
      }
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
.visual-view {
  background: white;
  padding: 20px;
  border-radius: 8px;
  height: 600px;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.visual-content {
  flex: 1;
  overflow: auto;
  position: relative;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 14px;
  line-height: 1.5;
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
  color: #666;
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
  border: 1px solid #eee;
  background-color: #f0f0f0;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.byte-square.ascii-byte {
  background-color: #4a90e2;
}

.byte-square.highlighted,
.ascii-group span.highlighted {
  background-color: #ffd700;
}

.byte-square.hovered,
.ascii-group span.hovered {
  background-color: rgba(59, 130, 246, 0.2);
}

.byte-square.selected,
.ascii-group span.selected {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}

.ascii-group {
  margin-left: 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.ascii-group span {
  cursor: pointer;
  padding: 1px 2px;
  border-radius: 2px;
  transition: background-color 0.15s ease;
}

::selection {
  background: transparent;
}
</style>