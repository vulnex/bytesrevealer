/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: StructureNode.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="structure-node">
    <div 
      class="node-header"
      :style="{ paddingLeft: `${depth * 16}px` }"
      @click="handleToggle"
      @mouseenter="handleHover"
      @mouseleave="handleHoverEnd"
    >
      <span 
        v-if="hasChildren" 
        class="expand-icon"
      >
        {{ expanded ? '▼' : '▶' }}
      </span>
      <span v-else class="expand-spacer"></span>
      
      <span class="field-name">{{ displayName }}</span>
      
      <span v-if="displayValue" class="field-value">
        {{ displayValue }}
      </span>
      
      <span class="field-offset">
        0x{{ (structure?.offset || 0).toString(16).toUpperCase().padStart(8, '0') }}
      </span>
    </div>
    
    <div v-if="expanded && hasChildren" class="node-children">
      <template v-for="(field, index) in (structure.fields || [])" :key="`${field ? field.name : 'field'}_${index}`">
        <StructureNode
          v-if="field && typeof field === 'object'"
          :structure="field"
          :depth="depth + 1"
          :expanded="false"
          @toggle="$emit('toggle', $event)"
          @hover="$emit('hover', $event)"
          @select="$emit('select', $event)"
        />
      </template>
    </div>
  </div>
</template>

<script>
import { createLogger } from '../utils/logger'

const logger = createLogger('StructureNode')

export default {
  name: 'StructureNode',
  
  props: {
    structure: {
      type: Object,
      required: true
    },
    depth: {
      type: Number,
      default: 0
    },
    expanded: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['toggle', 'hover', 'select'],
  
  mounted() {
    logger.debug(`StructureNode mounted for ${this.structure?.name}:`, {
      name: this.structure?.name,
      offset: this.structure?.offset,
      size: this.structure?.size,
      fullStructure: this.structure
    })
  },
  
  computed: {
    hasChildren() {
      return this.structure && 
             this.structure.fields && 
             Array.isArray(this.structure.fields) && 
             this.structure.fields.length > 0
    },
    
    displayName() {
      if (!this.structure) return 'Unknown'
      
      if (this.structure.name) {
        return this.structure.name
      }
      if (this.structure.type) {
        return this.structure.type
      }
      return 'Unknown'
    },
    
    displayValue() {
      if (!this.structure) return null
      
      const value = this.structure.value
      
      if (value === null || value === undefined) {
        return null
      }
      
      if (typeof value === 'object') {
        if (value.fields) {
          return `[${value.fields.length} fields]`
        }
        if (Array.isArray(value)) {
          return `[${value.length} items]`
        }
        return null
      }
      
      if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          return `${value} (0x${value.toString(16).toUpperCase()})`
        }
        return value.toString()
      }
      
      if (typeof value === 'string') {
        if (value.length > 50) {
          return `"${value.substring(0, 50)}..."`
        }
        return `"${value}"`
      }
      
      return value.toString()
    }
  },
  
  methods: {
    handleToggle() {
      if (this.hasChildren) {
        this.$emit('toggle')
      } else {
        this.$emit('select', this.structure)
      }
    },
    
    handleHover() {
      this.$emit('hover', this.structure)
    },
    
    handleHoverEnd() {
      this.$emit('hover', null)
    }
  }
}
</script>

<style scoped>
.structure-node {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  user-select: none;
  width: 100%;
}

.node-header {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  cursor: pointer;
  width: 100%;
}

.node-header:hover {
  background: rgba(66, 184, 131, 0.1);
}

.expand-icon {
  width: 12px;
  margin-right: 4px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.expand-spacer {
  width: 16px;
  display: inline-block;
}

.field-name {
  color: var(--link-color);
  margin-right: 8px;
  font-weight: 500;
}

.field-value {
  color: var(--text-primary);
  margin-right: 8px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.field-offset {
  color: #888;
  margin-left: auto;
  padding-left: 8px;
  padding-right: 4px;
  font-size: 11px;
  flex-shrink: 0;
  min-width: fit-content;
  text-align: right;
}

.node-children {
  border-left: 1px solid var(--border-color);
  margin-left: 8px;
}
</style>