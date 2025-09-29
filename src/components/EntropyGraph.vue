/**
 * VULNEX -Bytes Revealer-
 *
 * File: EntropyGraph.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="entropy-graph">
    <h3>Entropy Analysis</h3>
    <div class="graph-tabs">
      <button
        class="tab-button"
        :class="{ active: activeGraphTab === 'entropy' }"
        @click="$emit('update:activeGraphTab', 'entropy')"
      >Entropy Distribution</button>
      <button
        class="tab-button"
        :class="{ active: activeGraphTab === 'frequency' }"
        @click="$emit('update:activeGraphTab', 'frequency')"
      >Byte Frequency</button>
    </div>
    <div class="graph-container" ref="graphContainer">
      <div class="graph-legend" v-if="activeGraphTab === 'entropy'">
        <div class="legend-item">
          <div class="legend-color" style="background: #42b983"></div>
          <span>Entropy (0-8)</span>
        </div>
        <div class="legend-item high-entropy" v-if="hasHighEntropy">
          <div class="legend-color" style="background: #ff6b6b"></div>
          <span>High Entropy Regions</span>
        </div>
      </div>
      <canvas ref="canvas" class="graph-canvas"></canvas>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EntropyGraph',
  props: {
    fileBytes: {
      type: [Array, Object],
      validator: (value) => Array.isArray(value) || value instanceof Uint8Array,
      required: true
    },
    activeGraphTab: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      hasHighEntropy: false,
      resizeObserver: null
    }
  },
  watch: {
    activeGraphTab() {
      this.$nextTick(() => {
        this.setupCanvas()
        this.drawGraph()
      })
    },
    fileBytes() {
      this.$nextTick(() => {
        this.setupCanvas()
        this.drawGraph()
      })
    }
  },
  mounted() {
    this.$nextTick(() => {
      this.setupCanvas()

      // Use ResizeObserver for responsive resizing
      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => {
          this.setupCanvas()
          this.drawGraph()
        })
        this.resizeObserver.observe(this.$refs.graphContainer)
      }

      if (this.fileBytes && this.fileBytes.length > 0) {
        this.drawGraph()
      }
    })
  },
  methods: {
    setupCanvas() {
      const container = this.$refs.graphContainer
      const canvas = this.$refs.canvas

      if (!container || !canvas) return

      // Get the actual rendered size of the container
      const rect = container.getBoundingClientRect()

      // Account for padding (16px on each side)
      const padding = 32
      const width = Math.floor(rect.width - padding)
      const height = Math.floor(rect.height - padding)

      // Set canvas size - this is the key part
      canvas.width = width
      canvas.height = height

      // console.log('Canvas setup:', {
      //   container: `${rect.width}x${rect.height}`,
      //   canvas: `${width}x${height}`
      // })
    },

    async drawGraph() {
      const canvas = this.$refs.canvas
      if (!canvas || !canvas.width || !canvas.height) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Check if fileBytes exists
      if (!this.fileBytes || this.fileBytes.length === 0) return

      if (this.activeGraphTab === 'entropy') {
        await this.drawEntropyDistribution(ctx, canvas.width, canvas.height)
      } else {
        await this.drawByteFrequency(ctx, canvas.width, canvas.height)
      }
    },

    async drawEntropyDistribution(ctx, canvasWidth, canvasHeight) {
      // Clear canvas
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-primary').trim() || '#1a202c'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Define margins
      const margins = {
        left: 45,
        right: 20,
        top: 20,
        bottom: 40
      }

      // Calculate graph area
      const graphWidth = canvasWidth - margins.left - margins.right
      const graphHeight = canvasHeight - margins.top - margins.bottom

      // Calculate entropy
      const blockSize = 256
      const entropyValues = []
      this.hasHighEntropy = false

      let bytesToProcess
      if (this.fileBytes.isChunked) {
        const sampleSize = Math.min(10 * 1024 * 1024, this.fileBytes.length)
        try {
          bytesToProcess = await this.fileBytes.getChunk(0, sampleSize)
        } catch (err) {
          bytesToProcess = this.fileBytes
        }
      } else {
        bytesToProcess = this.fileBytes
      }

      for (let i = 0; i < bytesToProcess.length; i += blockSize) {
        const block = bytesToProcess.slice(i, i + blockSize)
        const frequencies = new Array(256).fill(0)
        block.forEach(byte => frequencies[byte]++)

        const entropy = this.calculateEntropy(frequencies, block.length)
        entropyValues.push(entropy)

        if (entropy > 7.5) this.hasHighEntropy = true
      }

      // Draw grid
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--border-color').trim() || '#4a5568'
      ctx.lineWidth = 0.5

      // Horizontal grid lines (Y-axis)
      for (let i = 0; i <= 8; i++) {
        const y = margins.top + graphHeight - (i / 8) * graphHeight
        ctx.beginPath()
        ctx.moveTo(margins.left, y)
        ctx.lineTo(margins.left + graphWidth, y)
        ctx.stroke()
      }

      // Vertical grid lines (X-axis)
      for (let i = 0; i <= 10; i++) {
        const x = margins.left + (i / 10) * graphWidth
        ctx.beginPath()
        ctx.moveTo(x, margins.top)
        ctx.lineTo(x, margins.top + graphHeight)
        ctx.stroke()
      }

      // Draw entropy line
      if (entropyValues.length > 0) {
        ctx.beginPath()
        ctx.strokeStyle = '#42b983'
        ctx.lineWidth = 2

        entropyValues.forEach((entropy, index) => {
          const x = margins.left + (index / entropyValues.length) * graphWidth
          const y = margins.top + graphHeight - (entropy / 8) * graphHeight

          if (index === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }

          // Highlight high entropy regions
          if (entropy > 7.5) {
            ctx.save()
            ctx.fillStyle = 'rgba(255, 107, 107, 0.2)'
            ctx.fillRect(x - 1, margins.top, 2, graphHeight)
            ctx.restore()
          }
        })

        ctx.stroke()
      }

      // Draw Y-axis labels
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-primary').trim() || '#f7fafc'
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'

      for (let i = 0; i <= 8; i += 2) {
        const y = margins.top + graphHeight - (i / 8) * graphHeight
        ctx.fillText(i.toString(), margins.left - 10, y)
      }

      // Draw X-axis label
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText('File Position', margins.left + graphWidth / 2, canvasHeight - 15)
    },

    async drawByteFrequency(ctx, canvasWidth, canvasHeight) {
      // Clear canvas
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-primary').trim() || '#1a202c'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Define margins
      const margins = {
        left: 55,
        right: 20,
        top: 20,
        bottom: 45
      }

      // Calculate graph area
      const graphWidth = canvasWidth - margins.left - margins.right
      const graphHeight = canvasHeight - margins.top - margins.bottom

      // Calculate frequencies
      const frequencies = new Array(256).fill(0)

      let bytesToProcess
      if (this.fileBytes.isChunked) {
        const sampleSize = Math.min(10 * 1024 * 1024, this.fileBytes.length)
        try {
          bytesToProcess = await this.fileBytes.getChunk(0, sampleSize)
        } catch (err) {
          bytesToProcess = this.fileBytes
        }
      } else {
        bytesToProcess = this.fileBytes
      }

      bytesToProcess.forEach(byte => frequencies[byte]++)
      const maxFreq = Math.max(...frequencies)

      // Draw grid
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--border-color').trim() || '#4a5568'
      ctx.lineWidth = 0.5

      // Horizontal grid lines
      const ySteps = 5
      for (let i = 0; i <= ySteps; i++) {
        const y = margins.top + graphHeight - (i / ySteps) * graphHeight
        ctx.beginPath()
        ctx.moveTo(margins.left, y)
        ctx.lineTo(margins.left + graphWidth, y)
        ctx.stroke()
      }

      // Vertical grid lines
      for (let i = 0; i <= 4; i++) {
        const x = margins.left + (i / 4) * graphWidth
        ctx.beginPath()
        ctx.moveTo(x, margins.top)
        ctx.lineTo(x, margins.top + graphHeight)
        ctx.stroke()
      }

      // Draw bars
      if (maxFreq > 0) {
        const barWidth = graphWidth / 256

        frequencies.forEach((freq, byte) => {
          if (freq > 0) {
            const x = margins.left + (byte / 256) * graphWidth
            const barHeight = (freq / maxFreq) * graphHeight
            const y = margins.top + graphHeight - barHeight

            ctx.fillStyle = this.getByteColor(byte)
            ctx.fillRect(x, y, barWidth, barHeight)
          }
        })
      }

      // Draw Y-axis labels
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-primary').trim() || '#f7fafc'
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'

      for (let i = 0; i <= ySteps; i++) {
        const y = margins.top + graphHeight - (i / ySteps) * graphHeight
        const value = maxFreq ? Math.round((i / ySteps) * maxFreq) : 0
        ctx.fillText(value.toString(), margins.left - 10, y)
      }

      // Draw X-axis labels
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const xLabels = ['0x00', '0x40', '0x80', '0xC0', '0xFF']
      xLabels.forEach((label, i) => {
        const x = margins.left + (i / (xLabels.length - 1)) * graphWidth
        ctx.fillText(label, x, margins.top + graphHeight + 10)
      })
    },

    calculateEntropy(frequencies, total) {
      return -frequencies.reduce((sum, freq) => {
        const p = freq / total
        return sum + (p > 0 ? p * Math.log2(p) : 0)
      }, 0)
    },

    getByteColor(byte) {
      if (byte === 0) return '#ff6b6b'
      if (byte >= 32 && byte <= 126) return '#4a90e2'
      return '#42b983'
    }
  },
  beforeUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  }
}
</script>

<style scoped>
.entropy-graph {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

h3 {
  color: var(--text-primary);
  font-size: 1.5rem;
  margin-bottom: 16px;
}

.graph-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-button {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.tab-button:hover {
  background-color: var(--bg-hover);
}

.tab-button.active {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.graph-container {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  height: 500px;
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.graph-canvas {
  display: block;
  image-rendering: crisp-edges;
}

.graph-legend {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 10px;
  background-color: rgba(26, 32, 44, 0.9);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  z-index: 10;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  margin-right: 8px;
}

.legend-item span {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
}

/* Dark mode overrides */
:root[class='dark-mode'] .entropy-graph {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .graph-container {
  background-color: var(--bg-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .graph-legend {
  background-color: rgba(45, 55, 72, 0.95);
}
</style>