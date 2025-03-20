/** 
 * VULNEX -Bytes Revealer-
 *
 * File: ByteTooltip.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div 
    class="byte-tooltip" 
    v-if="show"
    :style="tooltipStyle"
  >
    Offset: {{ offset.toString(16).toUpperCase() }}h<br>
    Hex: {{ formatByte(byte) }}<br>
    ASCII: {{ byteToAscii(byte) }}
  </div>
</template>

<script>
export default {
  name: 'ByteTooltip',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    byte: {
      type: Number,
      required: true
    },
    offset: {
      type: Number,
      required: true
    },
    x: {
      type: Number,
      default: 0
    },
    y: {
      type: Number,
      default: 0
    }
  },
  computed: {
    tooltipStyle() {
      return {
        position: 'fixed',
        left: `${this.x + 15}px`,  // Small offset from cursor
        top: `${this.y}px`
      }
    }
  },
  methods: {
    formatByte(byte) {
      return byte.toString(16).padStart(2, '0').toUpperCase()
    },
    byteToAscii(byte) {
      if (byte >= 32 && byte <= 126) {
        return String.fromCharCode(byte)
      }
      return '.'
    }
  }
}
</script>

<style scoped>
.byte-tooltip {
  position: fixed;
  background: rgba(51, 51, 51, 0.95);
  color: white;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 1000;
  backdrop-filter: blur(4px);
  white-space: nowrap;
}
</style>