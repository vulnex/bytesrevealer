/** 
 * VULNEX -Bytes Revealer-
 *
 * File: FileAnalysis.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-03-17
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="analysis-panel" v-if="fileBytes.length > 0">
    <div class="stats-section">
      <h3>File Statistics</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <label>File Size:</label>
          <span>{{ formatFileSize(fileBytes.length) }}</span>
        </div>
        <div class="stat-item">
          <label>Entropy:</label>
          <span>{{ entropy.toFixed(2) }} / 8.0</span>
        </div>
        <div class="stat-item">
          <label>ASCII %:</label>
          <span>{{ asciiPercentage.toFixed(1) }}%</span>
        </div>
        <div class="stat-item">
          <label>Null bytes:</label>
          <span>{{ nullByteCount }} ({{ ((nullByteCount / fileBytes.length) * 100).toFixed(1) }}%)</span>
        </div>
        <div class="stat-item">
          <label>Unique bytes:</label>
          <span>{{ uniqueBytes }} / 256</span>
        </div>
        <div class="stat-item">
          <label>Most common byte:</label>
          <span>0x{{ mostCommonByte.value.toString(16).padStart(2, '0').toUpperCase() }} ({{ mostCommonByte.count }}x)</span>
        </div>
        <div class="stat-item">
          <label>Printable chars:</label>
          <span>{{ printableCount }} ({{ ((printableCount / fileBytes.length) * 100).toFixed(1) }}%)</span>
        </div>
        <div class="stat-item">
          <label>Control chars:</label>
          <span>{{ controlCount }} ({{ ((controlCount / fileBytes.length) * 100).toFixed(1) }}%)</span>
        </div>
      </div>
    </div>

    <EntropyGraph 
      :fileBytes="fileBytes" 
      :activeGraphTab="activeGraphTab"
      @update:activeGraphTab="$emit('update:activeGraphTab', $event)"
    />
    
    <FileSignatures :signatures="fileSignatures" />
    <HashSection :hashes="hashes" />
  </div>
</template>

<script>
import EntropyGraph from './EntropyGraph.vue'
import FileSignatures from './FileSignatures.vue'
import HashSection from './HashSection.vue'

export default {
  name: 'FileAnalysis',
  components: {
    EntropyGraph,
    FileSignatures,
    HashSection
  },
  props: {
    fileBytes: {
      type: Array,
      required: true
    },
    entropy: {
      type: Number,
      required: true
    },
    fileSignatures: {
      type: Array,
      required: true
    },
    hashes: {
      type: Object,
      required: true
    },
    activeGraphTab: {
      type: String,
      required: true
    }
  },
  computed: {
    nullByteCount() {
      return this.fileBytes.filter(byte => byte === 0).length
    },
    uniqueBytes() {
      return new Set(this.fileBytes).size
    },
    asciiPercentage() {
      const printableCount = this.fileBytes.filter(byte => byte >= 32 && byte <= 126).length
      return (printableCount / this.fileBytes.length) * 100
    },
    printableCount() {
      return this.fileBytes.filter(byte => byte >= 32 && byte <= 126).length
    },
    controlCount() {
      return this.fileBytes.filter(byte => byte < 32 || byte === 127).length
    },
    mostCommonByte() {
      const byteCounts = new Array(256).fill(0)
      this.fileBytes.forEach(byte => byteCounts[byte]++)
      
      let maxCount = 0
      let maxByte = 0
      byteCounts.forEach((count, byte) => {
        if (count > maxCount) {
          maxCount = count
          maxByte = byte
        }
      })
      
      return { value: maxByte, count: maxCount }
    }
  },
  methods: {
    formatFileSize(bytes) {
      const units = ['B', 'KB', 'MB', 'GB']
      let size = bytes
      let unitIndex = 0
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }
      
      return `${size.toFixed(1)} ${units[unitIndex]}`
    }
  }
}
</script>