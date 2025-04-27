/** 
 * VULNEX -Bytes Revealer-
 *
 * File: FileSignatures.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-01
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 */

<template>
  <div v-if="signatures.length" class="file-signatures">
    <h3 class="text-lg font-medium mb-2">File Signatures:</h3>
    <div class="bg-gray-50 p-4 rounded">
      <div v-for="(sig, index) in signatures" :key="index" 
           class="signature-item mb-3 last:mb-0 border-b last:border-0 pb-2">
        <div class="flex justify-between items-center">
          <div class="signature-info">
            <span class="font-medium text-blue-700">{{ sig.name }}</span>
            <span class="ml-2 text-sm text-gray-600">
              ({{ sig.extension }})
            </span>
          </div>
          <div class="confidence-badge" 
               :class="getConfidenceClass(sig.confidence)">
            {{ sig.confidence }}
          </div>
        </div>
        <div class="signature-details mt-1">
          <span class="text-sm text-gray-600">
            Offset: 
            <code class="bg-gray-100 px-1 rounded">
              0x{{ sig.offset.toString(16).toUpperCase().padStart(8, '0') }}
            </code>
          </span>
          <span v-if="sig.pattern" class="text-sm text-gray-600 ml-3">
            Pattern: 
            <code class="bg-gray-100 px-1 rounded">
              {{ formatPattern(sig.pattern) }}
            </code>
          </span>
        </div>
        <div v-if="sig.nestedFiles && sig.nestedFiles.length" class="nested-files mt-2">
          <div class="text-sm font-medium text-gray-700">Nested Files:</div>
          <div class="ml-4 mt-1">
            <div v-for="(nested, nIndex) in sig.nestedFiles" 
                 :key="nIndex"
                 class="nested-file-item text-sm">
              <span class="text-blue-600">{{ nested.type }}</span>
              <span class="text-gray-600 ml-2">
                {{ nested.name }}
                <span class="text-gray-400">
                  (offset: 0x{{ nested.offset.toString(16).toUpperCase().padStart(8, '0') }})
                </span>
              </span>
            </div>
          </div>
        </div>
        <div v-if="sig.details" class="file-details mt-2">
          <div class="text-sm font-medium text-gray-700">Details:</div>
          <div class="ml-4 mt-1 grid grid-cols-2 gap-2">
            <div v-for="(value, key) in sig.details" 
                 :key="key"
                 class="text-sm">
              <span class="text-gray-600">{{ formatKey(key) }}:</span>
              <span class="ml-2">{{ formatValue(value) }}</span>
            </div>
          </div>
        </div>
        <div v-if="sig.metadata" class="metadata-section mt-4">
          <div class="text-sm font-medium text-gray-700">Metadata:</div>
          <div class="ml-4 mt-1">
            <template v-if="sig.metadata.error">
              <div class="text-red-600">{{ sig.metadata.error }}</div>
            </template>
            <template v-else>
              <div v-for="(value, key) in flattenMetadata(sig.metadata)" 
                   :key="key" 
                   class="metadata-item">
                <span class="text-gray-600">{{ formatKey(key) }}:</span>
                <span class="ml-2">{{ formatValue(value) }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileSignatures',
  
  props: {
    signatures: {
      type: Array,
      default: () => []
    }
  },

  methods: {
    getConfidenceClass(confidence) {
      const classes = {
        'High': 'bg-green-100 text-green-800',
        'Medium': 'bg-yellow-100 text-yellow-800',
        'Low': 'bg-red-100 text-red-800'
      };
      return `px-2 py-1 rounded-full text-xs ${classes[confidence] || classes['Medium']}`;
    },

    formatPattern(pattern) {
      if (Array.isArray(pattern)) {
        return pattern.map(byte => 
          byte.toString(16).padStart(2, '0').toUpperCase()
        ).join(' ');
      }
      return pattern;
    },

    formatKey(key) {
      const formattedKey = key.replace(/_/g, ' ');
      return formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
    },

    formatValue(value) {
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    },

    flattenMetadata(metadata, prefix = '') {
      const result = {};
      
      for (const [key, value] of Object.entries(metadata)) {
        if (value === null || value === undefined) continue;
        
        if (typeof value === 'object' && !Array.isArray(value)) {
          const nested = this.flattenMetadata(value, `${prefix}${key}.`);
          Object.assign(result, nested);
        } else {
          result[`${prefix}${key}`] = value;
        }
      }
      
      return result;
    }
  }
}
</script>

<style scoped>
.file-signatures {
  @apply mb-6;
}

.signature-item {
  @apply transition-colors duration-200;
}

.signature-item:hover {
  @apply bg-gray-100 rounded;
}

.confidence-badge {
  @apply font-medium;
}

code {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}
</style>
