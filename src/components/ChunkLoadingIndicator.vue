/** 
 * VULNEX -Bytes Revealer-
 *
 * File: ChunkLoadingIndicator.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div v-if="show" class="chunk-loading-indicator">
    <div class="loading-bar">
      <div class="loading-progress" :style="{ width: `${progress}%` }"></div>
    </div>
    <div class="loading-text">
      Loading chunks: {{ loadedChunks }} / {{ totalChunks }}
      <span v-if="currentChunk !== null">(Loading chunk {{ currentChunk }}...)</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChunkLoadingIndicator',
  props: {
    chunkManager: {
      type: Object,
      default: null
    },
    fileBytes: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      loadedChunks: 0,
      totalChunks: 0,
      currentChunk: null,
      updateInterval: null
    }
  },
  computed: {
    show() {
      return this.fileBytes?.isProgressive && this.totalChunks > 0
    },
    progress() {
      if (this.totalChunks === 0) return 0
      return Math.round((this.loadedChunks / this.totalChunks) * 100)
    }
  },
  mounted() {
    if (this.fileBytes?.isProgressive) {
      // Get info from fileBytes accessor
      if (this.fileBytes.accessor) {
        this.totalChunks = this.fileBytes.accessor.totalChunks
      }

      // Update loaded chunks periodically
      this.updateInterval = setInterval(() => {
        if (this.chunkManager?.getMemoryInfo) {
          const memInfo = this.chunkManager.getMemoryInfo()
          this.loadedChunks = memInfo.loadedChunks
          this.currentChunk = memInfo.loadingChunks > 0 ? null : null

          // Hide if all loaded
          if (this.loadedChunks >= this.totalChunks) {
            setTimeout(() => {
              clearInterval(this.updateInterval)
            }, 2000) // Keep visible for 2 seconds after complete
          }
        }
      }, 100)
    }
  },
  beforeUnmount() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }
}
</script>

<style scoped>
.chunk-loading-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 250px;
}

.loading-bar {
  width: 100%;
  height: 4px;
  background: var(--bg-secondary);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.loading-progress {
  height: 100%;
  background: #4a90e2;
  transition: width 0.3s ease;
}

.loading-text {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Dark mode */
.dark-mode .chunk-loading-indicator {
  background: var(--bg-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>