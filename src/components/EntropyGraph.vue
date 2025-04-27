/** 
 * VULNEX -Bytes Revealer-
 *
 * File: EntropyGraph.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.2
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
      type: Array,
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
      canvas: null,
      ctx: null
    }
  },
  watch: {
    activeGraphTab() {
      this.$nextTick(() => {
        this.drawGraph()
      })
    },
    fileBytes() {
      this.$nextTick(() => {
        this.drawGraph()
      })
    }
  },
  mounted() {
    this.initCanvas()
    this.drawGraph()
  },
  methods: {
    initCanvas() {
      const container = this.$refs.graphContainer
      const canvas = this.$refs.canvas
      
      // Set canvas size with device pixel ratio for sharp rendering
      const dpr = window.devicePixelRatio || 1
      canvas.width = container.clientWidth * dpr
      canvas.height = container.clientHeight * dpr
      
      this.canvas = canvas
      this.ctx = canvas.getContext('2d')
      this.ctx.scale(dpr, dpr)
      
      // Set canvas CSS size
      canvas.style.width = `${container.clientWidth}px`
      canvas.style.height = `${container.clientHeight}px`
    },

    drawGraph() {
      if (!this.canvas || !this.ctx || this.fileBytes.length === 0) return

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      
      if (this.activeGraphTab === 'entropy') {
        this.drawEntropyDistribution()
      } else {
        this.drawByteFrequency()
      }
    },

    drawEntropyDistribution() {
      const ctx = this.ctx
      const width = this.canvas.width / window.devicePixelRatio
      const height = this.canvas.height / window.devicePixelRatio
      
      // Clear canvas
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-primary').trim()
      ctx.fillRect(0, 0, width, height)
      
      const blockSize = 256
      const entropyValues = []
      this.hasHighEntropy = false
      
      // Calculate entropy values
      for (let i = 0; i < this.fileBytes.length; i += blockSize) {
        const block = this.fileBytes.slice(i, i + blockSize)
        const frequencies = new Array(256).fill(0)
        block.forEach(byte => frequencies[byte]++)
        
        const entropy = this.calculateEntropy(frequencies, block.length)
        entropyValues.push(entropy)
        
        if (entropy > 7.5) this.hasHighEntropy = true
      }
      
      // Draw grid
      this.drawGrid(ctx, width, height)
      
      // Draw entropy line
      if (entropyValues.length > 0) {
        ctx.beginPath()
        ctx.strokeStyle = '#42b983'
        ctx.lineWidth = 2
        
        entropyValues.forEach((entropy, index) => {
          const x = (index / entropyValues.length) * width
          const y = height - (entropy / 8) * height
          
          if (index === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }

          // Highlight high entropy regions
          if (entropy > 7.5) {
            ctx.fillStyle = 'rgba(255, 107, 107, 0.2)'
            ctx.fillRect(x - 1, 0, 2, height)
          }
        })
        
        ctx.stroke()
      }
      
      // Draw labels
      this.drawLabels(ctx, width, height)
    },

    drawByteFrequency() {
      const ctx = this.ctx
      const width = this.canvas.width / window.devicePixelRatio
      const height = this.canvas.height / window.devicePixelRatio
      
      // Clear canvas
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-primary').trim()
      ctx.fillRect(0, 0, width, height)
      
      // Calculate frequencies
      const frequencies = new Array(256).fill(0)
      this.fileBytes.forEach(byte => frequencies[byte]++)
      
      const maxFreq = Math.max(...frequencies)
      const barWidth = width / 256
      
      // Draw bars
      frequencies.forEach((freq, byte) => {
        const x = (byte / 256) * width
        const barHeight = (freq / maxFreq) * (height - 40)
        const y = height - barHeight - 20
        
        ctx.fillStyle = this.getByteColor(byte)
        ctx.fillRect(x, y, barWidth, barHeight)
      })
      
      // Draw axis and labels
      this.drawFrequencyAxis(ctx, width, height)
    },

    drawGrid(ctx, width, height) {
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--border-color').trim()
      ctx.lineWidth = 0.5
      
      // Draw horizontal grid lines
      for (let i = 0; i <= 8; i++) {
        const y = height - (i / 8) * height
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    },

    drawLabels(ctx, width, height) {
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-primary').trim()
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'right'
      
      // Y-axis labels
      for (let i = 0; i <= 8; i += 2) {
        const y = height - (i / 8) * height
        ctx.fillText(i.toString(), 25, y + 4)
      }
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
      return '#aaa'
    },

    drawFrequencyAxis(ctx, width, height) {
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-secondary').trim()
      ctx.lineWidth = 0.5
      
      // Draw vertical grid lines
      for (let i = 0; i <= 4; i++) {
        const x = (i / 4) * width
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      
      // Draw axis labels
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-primary').trim()
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      
      // X-axis labels
      const labels = ['0x00', '0x40', '0x80', '0xC0', '0xFF']
      labels.forEach((label, i) => {
        const x = (i / (labels.length - 1)) * width
        ctx.fillText(label, x, height - 5)
      })
    }
  },
  beforeUnmount() {
    this.canvas = null
    this.ctx = null
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
  height: 400px;
  position: relative;
}

.graph-canvas {
  width: 100%;
  height: 100%;
  background-color: var(--bg-primary);
}

/* Dark mode overrides */
:root[class='dark-mode'] .entropy-graph {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .graph-container {
  background-color: var(--bg-primary);
  border-color: var(--border-color);
}

.graph-legend {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 10px;
  background-color: var(--bg-primary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
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
}

.legend-item.high-entropy {
  margin-top: 8px;
}

.legend-item.high-entropy .legend-color {
  background-color: #ff6b6b;
}
</style>