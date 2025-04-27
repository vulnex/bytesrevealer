/** 
 * VULNEX -Bytes Revealer-
 *
 * File: FileAnalysis.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-03-17
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="analysis-panel" v-if="fileBytes.length > 0">
    <!-- Add loading indicator -->
    <div v-if="isAnalyzing" class="analysis-loading">
      <span class="loading-spinner"></span>
      Analyzing file...
    </div>
    
    <!-- Show content when analysis is complete -->
    <div v-else>
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
      
      <FileSignatures 
        :signatures="fileSignatures"
        class="mb-4"
      />
      
      <HashSection :hashes="hashes" />
    </div>
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
      default: () => []
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
  data() {
    return {
      isAnalyzing: false,
      analysisResults: {
        nullBytes: 0,
        printableChars: 0,
        controlChars: 0,
        byteCounts: new Array(256).fill(0)
      }
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
      const printable = this.fileBytes.filter(byte => byte >= 32 && byte <= 126).length
      return (printable / this.fileBytes.length) * 100
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
  watch: {
    fileBytes: {
      immediate: true,
      handler(newBytes) {
        if (newBytes && newBytes.length > 0) {
          this.performAnalysis()
        }
      }
    }
  },
  methods: {
    performAnalysis() {
      this.isAnalyzing = true
      try {
        // Calculate basic statistics
        const byteCounts = new Array(256).fill(0)
        let nullBytes = 0
        let printableChars = 0
        let controlChars = 0

        // Process all bytes
        for (let i = 0; i < this.fileBytes.length; i++) {
          const byte = this.fileBytes[i]
          byteCounts[byte]++
          
          if (byte === 0) nullBytes++
          if (byte >= 32 && byte <= 126) printableChars++
          if (byte < 32 || byte === 127) controlChars++
        }

        this.analysisResults = {
          nullBytes,
          printableChars,
          controlChars,
          byteCounts
        }
      } catch (error) {
        console.error('Analysis error:', error)
      } finally {
        this.isAnalyzing = false
      }
    },

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
  },
  created() {
    // Listen for analysis results
    this.$on('analysis-complete', (results) => {
      this.analysisResults = results
    })
  }
}
</script>

<style scoped>
.analysis-panel {
  color: var(--text-primary);
  background-color: var(--bg-secondary);
  padding: 20px;
  border-radius: 8px;
}

/* File Statistics section */
.stats-section {
  margin-bottom: 24px;
}

.stats-section h3,
.entropy-analysis h3 {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  background-color: var(--bg-primary);
  padding: 16px;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.stat-item label {
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
}

.stat-item span {
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 1rem;
}

/* Entropy Analysis section */
.entropy-analysis {
  margin-top: 32px;
}

.graph-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.graph-tabs button {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.graph-tabs button:hover {
  background-color: var(--bg-secondary);
}

.graph-tabs button.active {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.graph-container {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

/* Dark mode specific overrides */
:root[class='dark-mode'] .analysis-panel {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .stats-grid {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .stat-item {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .stat-item label {
  color: var(--text-secondary);
}

:root[class='dark-mode'] .stat-item span {
  color: var(--text-primary);
}

:root[class='dark-mode'] .graph-container {
  background-color: var(--bg-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .graph-tabs button {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .graph-tabs button:hover {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .graph-tabs button.active {
  background-color: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

/* Graph text and elements */
:root[class='dark-mode'] .entropy-graph text {
  fill: var(--text-primary);
}

:root[class='dark-mode'] .entropy-graph path,
:root[class='dark-mode'] .entropy-graph line {
  stroke: var(--text-secondary);
}

:root[class='dark-mode'] .entropy-graph .data-line {
  stroke: var(--link-color);
}

/* Add loading styles */
.analysis-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--text-secondary);
}

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 8px;
  border: 2px solid var(--border-color);
  border-top-color: var(--link-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>