/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KaitaiStructureView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="kaitai-structure-view">
    <!-- Format Selector -->
    <FormatSelector
      :fileBytes="fileBytes"
      :fileName="fileName"
      :detectedFormat="formatName"
      @format-changed="handleFormatChanged"
      @error="handleFormatError"
    />
    
    <div v-if="loading" class="loading">
      Parsing structure...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else-if="safeStructures && safeStructures.length > 0" class="structure-tree">
      <div class="structure-header">
        <span class="format-name">{{ formatName }} Structure</span>
        <button @click="toggleExpanded" class="toggle-btn">
          {{ allExpanded ? 'Collapse All' : 'Expand All' }}
        </button>
      </div>
      
      <div class="structure-content">
        <template v-for="(struct, index) in safeStructures" :key="index">
          <div 
            v-if="struct && typeof struct === 'object'"
            class="structure-item"
          >
            <StructureNode
              :structure="struct"
              :depth="0"
              :expanded="expandedNodes.has(getNodeKey(struct, index))"
              @toggle="toggleNode(getNodeKey(struct, index))"
              @hover="handleHover"
              @select="handleSelect"
            />
          </div>
        </template>
      </div>
    </div>
    
    <div v-else class="no-structure">
      No structure available for this format
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, toRefs } from 'vue'
import StructureNode from './StructureNode.vue'
import FormatSelector from './KsyManager/FormatSelector.vue'
import { createLogger } from '../utils/logger'

const logger = createLogger('KaitaiStructureView')

export default {
  name: 'KaitaiStructureView',
  
  components: {
    StructureNode,
    FormatSelector
  },
  
  props: {
    structures: {
      type: Array,
      default: () => []
    },
    formatName: {
      type: String,
      default: 'Unknown'
    },
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    },
    currentOffset: {
      type: Number,
      default: 0
    },
    fileBytes: {
      type: Object,
      validator: (value) => value instanceof Uint8Array || value === null,
      default: null
    },
    fileName: {
      type: String,
      default: null
    }
  },
  
  emits: ['hover', 'select', 'highlight', 'format-changed'],
  
  setup(props, { emit }) {
    // Use toRefs for better reactivity
    const { structures, formatName, loading, error, currentOffset } = toRefs(props)
    
    const expandedNodes = ref(new Set())
    const allExpanded = ref(false)
    
    // Ensure props have default values
    const safeStructures = computed(() => {
      const structs = structures.value
      logger.debug('KaitaiStructureView received structures:', structs)
      if (!structs || !Array.isArray(structs)) return []
      const filtered = structs.filter(s => s && typeof s === 'object')
      logger.debug('KaitaiStructureView filtered structures:', filtered)
      return filtered
    })
    
    const getNodeKey = (struct, index) => {
      if (!struct) return `null_${index}`
      return `${struct.offset || 0}_${index}`
    }
    
    const toggleNode = (key) => {
      if (expandedNodes.value.has(key)) {
        expandedNodes.value.delete(key)
      } else {
        expandedNodes.value.add(key)
      }
    }
    
    const toggleExpanded = () => {
      if (allExpanded.value) {
        expandedNodes.value.clear()
      } else {
        // Expand all nodes
        const structures = safeStructures.value
        if (structures.length > 0) {
          structures.forEach((struct, index) => {
            if (!struct) return
            expandedNodes.value.add(getNodeKey(struct, index))
            // Add nested structures
            if (struct.fields && Array.isArray(struct.fields)) {
              addNestedKeys(struct.fields, `${getNodeKey(struct, index)}_`)
            }
          })
        }
      }
      allExpanded.value = !allExpanded.value
    }
    
    const addNestedKeys = (fields, prefix) => {
      if (!fields || !Array.isArray(fields)) return
      fields.forEach((field, index) => {
        if (!field) return
        const key = `${prefix}${index}`
        expandedNodes.value.add(key)
        if (field && field.fields && Array.isArray(field.fields)) {
          addNestedKeys(field.fields, `${key}_`)
        }
      })
    }
    
    const handleHover = (structure) => {
      if (!structure) {
        // Clear highlight when hover ends
        emit('hover', null)
        emit('highlight', null)
        return
      }
      emit('hover', structure)
      if (structure && structure.offset !== undefined && structure.offset !== null && structure.size) {
        emit('highlight', {
          start: structure.offset,
          end: structure.offset + structure.size
        })
      }
    }
    
    const handleSelect = (structure) => {
      emit('select', structure)
    }
    
    const handleFormatChanged = (event) => {
      emit('format-changed', event)
    }
    
    const handleFormatError = (error) => {
      logger.error('Format error:', error)
    }
    
    // Auto-expand structures at current offset
    watch(currentOffset, (newOffset) => {
      if (!newOffset || typeof newOffset !== 'number') return
      const structs = safeStructures.value
      if (!structs || structs.length === 0) return
      structs.forEach((struct, index) => {
        if (!struct || typeof struct.offset !== 'number') return
        const size = typeof struct.size === 'number' ? struct.size : 1
        if (struct.offset <= newOffset && newOffset < struct.offset + size) {
          expandedNodes.value.add(getNodeKey(struct, index))
        }
      })
    })
    
    return {
      expandedNodes,
      allExpanded,
      safeStructures,
      getNodeKey,
      toggleNode,
      toggleExpanded,
      handleHover,
      handleSelect,
      handleFormatChanged,
      handleFormatError
    }
  }
}
</script>

<style scoped>
.kaitai-structure-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.structure-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.format-name {
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-btn {
  padding: 4px 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.toggle-btn:hover {
  background: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.structure-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  max-height: calc(100vh - 400px); /* Prevent overlapping with format selector */
  min-height: 200px;
}

.structure-item {
  margin-bottom: 4px;
}

.loading, .error, .no-structure {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.error {
  color: var(--error-text);
  background: var(--error-bg);
  margin: 8px;
  border-radius: 4px;
}

/* Scrollbar styling */
.structure-content::-webkit-scrollbar {
  width: 8px;
}

.structure-content::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.structure-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.structure-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>