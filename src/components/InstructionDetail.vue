<!--
 * VULNEX -Bytes Revealer-
 *
 * File: InstructionDetail.vue
 * Author: Simon Roses Femerling
 * Created: 2026-05-19
 * Version: 0.5
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
-->
<template>
  <aside class="instruction-detail" aria-label="Instruction detail">
    <h3 class="detail-title">Instruction</h3>

    <div v-if="!instruction" class="empty-state">
      <p>Click a row in the listing to see its breakdown.</p>
    </div>

    <dl v-else class="detail-list">
      <dt>Address</dt>
      <dd>
        <code>0x{{ formatAddress(instruction.address) }}</code>
      </dd>

      <dt>Size</dt>
      <dd>{{ instruction.size }} byte{{ instruction.size === 1 ? '' : 's' }}</dd>

      <dt>Bytes</dt>
      <dd>
        <code class="bytes">{{ formatBytes(instruction.bytes) }}</code>
      </dd>

      <dt>Mnemonic</dt>
      <dd>
        <code class="mnemonic">{{ instruction.mnemonic }}</code>
      </dd>

      <dt>Category</dt>
      <dd>
        <span class="category-pill" :class="`category-${classification.category}`">
          {{ classification.category }}
        </span>
      </dd>

      <dt>Operands</dt>
      <dd>
        <span v-if="!classification.operands.length" class="muted">—</span>
        <ul v-else class="operand-list">
          <li v-for="(op, i) in classification.operands" :key="i" class="operand-row">
            <span class="operand-type" :class="`type-${op.type}`">{{ op.type }}</span>
            <code class="operand-text">{{ op.text }}</code>
          </li>
        </ul>
      </dd>
    </dl>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { classifyInstruction } from '../utils/disasmClassify'

const props = defineProps({
  instruction: {
    type: Object,
    default: null
  }
})

const classification = computed(
  () => classifyInstruction(props.instruction) || { category: 'unclassified', operands: [] }
)

function formatAddress(addr) {
  return (addr ?? 0).toString(16).toUpperCase().padStart(8, '0')
}

function formatBytes(bytes) {
  if (!bytes || !bytes.length) return ''
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}
</script>

<style scoped>
.instruction-detail {
  flex: 0 0 280px;
  min-width: 240px;
  max-width: 320px;
  padding: 12px 14px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary, #d4d4d4);
  align-self: flex-start;
}

.detail-title {
  margin: 0 0 10px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #888);
}

.empty-state {
  color: var(--text-muted, #888);
  font-size: 12px;
}

.detail-list {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 6px 10px;
  margin: 0;
}

.detail-list dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted, #888);
  align-self: center;
}

.detail-list dd {
  margin: 0;
  word-break: break-all;
}

.detail-list code {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 12px;
}

.bytes {
  color: var(--text-secondary, #c0c0c0);
}

.mnemonic {
  color: var(--link-color, #4ec9b0);
  font-weight: 600;
}

.category-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #555);
  color: var(--text-primary, #d4d4d4);
}

.category-control-flow {
  border-color: #e06c75;
  color: #e06c75;
}
.category-data {
  border-color: #61afef;
  color: #61afef;
}
.category-arithmetic {
  border-color: #d19a66;
  color: #d19a66;
}
.category-logical {
  border-color: #c678dd;
  color: #c678dd;
}
.category-comparison {
  border-color: #56b6c2;
  color: #56b6c2;
}
.category-string-op {
  border-color: #98c379;
  color: #98c379;
}
.category-system {
  border-color: #abb2bf;
  color: #abb2bf;
}
.category-nop {
  border-color: #5c6370;
  color: #5c6370;
}
.category-unclassified {
  border-color: var(--border-color, #555);
  color: var(--text-muted, #888);
}

.operand-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.operand-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.operand-type {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #555);
  color: var(--text-muted, #888);
  flex-shrink: 0;
}

.type-register {
  border-color: #4ec9b0;
  color: #4ec9b0;
}
.type-immediate {
  border-color: #d19a66;
  color: #d19a66;
}
.type-memory {
  border-color: #61afef;
  color: #61afef;
}
.type-unknown {
  border-color: var(--border-color, #555);
  color: var(--text-muted, #888);
}

.operand-text {
  color: var(--text-primary, #d4d4d4);
  word-break: break-all;
}

.muted {
  color: var(--text-muted, #888);
}

@media (max-width: 900px) {
  .instruction-detail {
    flex: 0 0 auto;
    max-width: 100%;
    width: 100%;
  }
}
</style>
