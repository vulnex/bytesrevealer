<!--
 * VULNEX -Bytes Revealer-
 *
 * File: FunctionList.vue
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
-->
<template>
  <div class="function-list" aria-label="Detected functions">
    <div v-if="!functions.length" class="empty-state">
      <p>No functions detected. Disassemble a range to see function starts.</p>
    </div>
    <ul v-else class="list">
      <li
        v-for="fn in functions"
        :key="fn.address"
        class="function-row"
        :class="{ selected: fn.address === selectedAddress }"
        :title="`Jump to ${fn.name}`"
        @click="$emit('select-function', fn.address)"
      >
        <code class="address">0x{{ formatAddress(fn.address) }}</code>
        <span class="name">{{ fn.name }}</span>
      </li>
    </ul>
    <div class="count-footer">
      {{ functions.length }} function{{ functions.length === 1 ? '' : 's' }}
    </div>
  </div>
</template>

<script setup>
import { formatDisasmAddress } from '../utils/disasmDisplay'

defineProps({
  functions: {
    type: Array,
    default: () => []
  },
  selectedAddress: {
    type: Number,
    default: null
  }
})

defineEmits(['select-function'])

const formatAddress = formatDisasmAddress
</script>

<style scoped>
.function-list {
  display: flex;
  flex-direction: column;
  max-height: 480px;
  overflow: hidden;
}

.empty-state {
  padding: 12px;
  color: var(--text-muted, #888);
  font-size: 12px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1 1 auto;
}

.function-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 4px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color, #333);
  font-size: 12px;
}

.function-row:hover {
  background: var(--surface-hover, #2d2d2d);
}

.function-row.selected {
  background: var(--surface-selected, #3a3a3a);
  box-shadow: inset 2px 0 0 var(--link-color, #4ec9b0);
}

.address {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  color: var(--text-muted, #888);
  font-size: 11px;
  flex-shrink: 0;
}

.name {
  color: var(--text-primary, #d4d4d4);
  overflow: hidden;
  text-overflow: ellipsis;
}

.count-footer {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text-muted, #888);
  border-top: 1px solid var(--border-color, #444);
  background: var(--bg-secondary, #2a2a2a);
}
</style>
