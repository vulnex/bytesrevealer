/** 
 * VULNEX -Bytes Revealer-
 *
 * File: EntropyGraph.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="entropy-graph">
    <h3>Entropy Analysis</h3>
    <div class="graph-tabs">
      <button 
        :class="{ active: activeGraphTab === 'entropy' }"
        @click="$emit('update:activeGraphTab', 'entropy')"
      >Entropy Distribution</button>
      <button 
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
      <canvas ref="canvas"></canvas>
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
      canvas.width = container.clientWidth
      canvas.height = 150
      this.canvas = canvas
      this.ctx = canvas.getContext('2d')
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
      const blockSize = 256
      const entropyValues = []
      this.hasHighEntropy = false

      // Calculate entropy for each block
      for (let i = 0; i < this.fileBytes.length; i += blockSize) {
        const block = this.fileBytes.slice(i, i + blockSize)
        const byteCounts = new Array(256).fill(0)
        block.forEach(byte => byteCounts[byte]++)
        
        const probabilities = byteCounts.map(count => count / block.length)
        const entropy = -probabilities.reduce((sum, p) => {
          return sum + (p > 0 ? p * Math.log2(p) : 0)
        }, 0)
        
        if (entropy > 7.5) this.hasHighEntropy = true
        entropyValues.push(entropy)
      }

      // Draw background
      this.ctx.fillStyle = '#f8f9fa'
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

      // Draw grid lines
      this.ctx.strokeStyle = '#ddd'
      this.ctx.lineWidth = 0.5
      for (let i = 0; i <= 8; i++) {
        const y = this.canvas.height - (i / 8) * this.canvas.height
        this.ctx.beginPath()
        this.ctx.moveTo(0, y)
        this.ctx.lineTo(this.canvas.width, y)
        this.ctx.stroke()
      }

      // Draw entropy line
      if (entropyValues.length > 0) {
        this.ctx.beginPath()
        this.ctx.moveTo(0, this.canvas.height - (entropyValues[0] / 8) * this.canvas.height)
        
        entropyValues.forEach((entropy, index) => {
          const x = (index / entropyValues.length) * this.canvas.width
          const y = this.canvas.height - (entropy / 8) * this.canvas.height
          this.ctx.lineTo(x, y)

          // Highlight high entropy regions
          if (entropy > 7.5) {
            this.ctx.fillStyle = 'rgba(255, 107, 107, 0.2)'
            this.ctx.fillRect(x - 1, 0, 2, this.canvas.height)
          }
        })

        this.ctx.strokeStyle = '#42b983'
        this.ctx.lineWidth = 2
        this.ctx.stroke()
      }

      // Add scale labels
      this.ctx.fillStyle = '#666'
      this.ctx.font = '10px sans-serif'
      this.ctx.textAlign = 'right'
      for (let i = 0; i <= 8; i += 2) {
        const y = this.canvas.height - (i / 8) * this.canvas.height
        this.ctx.fillText(i.toString(), 20, y + 4)
      }
    },

    drawByteFrequency() {
      // Calculate byte frequencies
      const byteCounts = new Array(256).fill(0)
      this.fileBytes.forEach(byte => byteCounts[byte]++)
      
      // Draw background
      this.ctx.fillStyle = '#f8f9fa'
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

      // Find max frequency for scaling
      const maxCount = Math.max(...byteCounts)
      if (maxCount === 0) return

      // Draw frequency bars
      byteCounts.forEach((count, byte) => {
        const x = (byte / 256) * this.canvas.width
        const height = (count / maxCount) * this.canvas.height
        const y = this.canvas.height - height

        // Color based on byte type
        if (byte === 0) {
          this.ctx.fillStyle = '#ff6b6b'  // Null bytes
        } else if (byte >= 32 && byte <= 126) {
          this.ctx.fillStyle = '#4a90e2'  // ASCII printable
        } else {
          this.ctx.fillStyle = '#aaa'     // Control chars
        }

        this.ctx.fillRect(x, y, Math.max(1, this.canvas.width / 256), height)
      })

      // Add labels
      this.ctx.fillStyle = '#666'
      this.ctx.font = '10px sans-serif'
      this.ctx.textAlign = 'center'
      
      // X-axis labels
      const labels = ['0x00', '0x40', '0x80', '0xC0', '0xFF']
      labels.forEach((label, i) => {
        const x = (i / (labels.length - 1)) * this.canvas.width
        this.ctx.fillText(label, x, this.canvas.height - 5)
      })
    }
  },
  beforeUnmount() {
    this.canvas = null
    this.ctx = null
  }
}
</script>