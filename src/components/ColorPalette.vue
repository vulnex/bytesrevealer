/** 
 * VULNEX -Bytes Revealer-
 *
 * File: ColorPalette.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-16
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="color-palette-container">
    <div class="color-squares">
      <button
        v-for="color in colors"
        :key="color.id"
        class="color-square"
        :class="{ 'selected': selectedColor === color.value }"
        :style="{ backgroundColor: color.value }"
        @click="selectColor(color.value)"
      ></button>
    </div>
    <div class="color-instruction">Click a color and select bytes to highlight</div>
  </div>
</template>

<script>
export default {
  name: 'ColorPalette',
  data() {
    return {
      colors: [
        { id: 'white', value: '#ffffff' },
        { id: 'red', value: '#ff4444' },
        { id: 'green', value: '#4caf50' },
        { id: 'yellow', value: '#ffeb3b' },
        { id: 'blue', value: '#2196f3' },
        { id: 'purple', value: '#9c27b0' },
        { id: 'brown', value: '#795548' },
        { id: 'gray', value: '#9e9e9e' }
      ],
      selectedColor: null
    }
  },
  methods: {
    selectColor(color) {
      this.selectedColor = color;
      this.$emit('color-selected', color);
    }
  }
}
</script>

<style scoped>
.color-palette-container {
  background-color: var(--bg-secondary);
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  margin-bottom: 16px;
}

.color-squares {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.color-square {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.color-square:hover {
  transform: scale(1.1);
}

.color-square.selected {
  box-shadow: 0 0 0 2px var(--link-color);
}

.color-instruction {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Special styling for white color square */
.color-square[style*="background-color: #ffffff"] {
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary) !important;
}

/* Dark mode specific overrides */
:root[class='dark-mode'] .color-palette-container {
  background-color: var(--bg-secondary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

:root[class='dark-mode'] .color-instruction {
  color: var(--text-secondary);
}
</style>