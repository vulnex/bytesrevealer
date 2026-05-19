<template>
  <div class="disasm-toolbar">
    <div class="control-group">
      <label class="control-label">Arch</label>
      <select
        :value="architecture"
        class="control-select"
        aria-label="Architecture"
        :disabled="disabled"
        @change="onArchChange($event.target.value)"
      >
        <option v-for="a in architectures" :key="a" :value="a">{{ a }}</option>
      </select>
    </div>

    <div class="control-group">
      <label class="control-label">Mode</label>
      <select
        :value="mode"
        class="control-select"
        aria-label="Mode"
        :disabled="disabled"
        @change="$emit('update:mode', $event.target.value)"
      >
        <option v-for="m in availableModes" :key="m" :value="m">{{ m }}</option>
      </select>
    </div>

    <div v-if="architecture === 'x86'" class="control-group">
      <label class="control-label">Syntax</label>
      <select
        :value="syntaxStyle"
        class="control-select"
        aria-label="Syntax style"
        :disabled="disabled"
        @change="$emit('update:syntaxStyle', $event.target.value)"
      >
        <option value="intel">Intel</option>
        <option value="att">AT&amp;T</option>
      </select>
    </div>

    <div class="control-group">
      <label class="control-label">Start</label>
      <input
        :value="formatHex(startOffset)"
        class="control-input"
        aria-label="Start offset (hex)"
        placeholder="0x0"
        :disabled="disabled"
        @change="onStartChange($event.target.value)"
      />
    </div>

    <div class="control-group">
      <label class="control-label">End</label>
      <input
        :value="endOffset !== null ? formatHex(endOffset) : ''"
        class="control-input"
        aria-label="End offset (hex)"
        :placeholder="`auto (+${DEFAULT_RANGE_BYTES.toString(16)})`"
        :disabled="disabled"
        @change="onEndChange($event.target.value)"
      />
    </div>

    <button
      class="action-btn primary"
      :disabled="disabled || !canDisassemble"
      @click="$emit('disassemble')"
    >
      {{ isDisassembling ? 'Disassembling...' : 'Disassemble' }}
    </button>

    <button
      v-if="hasResults"
      class="action-btn"
      :disabled="disabled || isDisassembling"
      @click="$emit('clear')"
    >
      Clear
    </button>

    <button
      v-if="hasResults"
      class="action-btn"
      :disabled="disabled || isDisassembling"
      @click="$emit('export')"
    >
      Export .asm
    </button>

    <label class="highlight-toggle">
      <input
        type="checkbox"
        :checked="highlightInHex"
        :disabled="disabled"
        @change="$emit('update:highlightInHex', $event.target.checked)"
      />
      <span>Highlight in Hex</span>
    </label>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const DEFAULT_RANGE_BYTES = 0x1000

const architectures = ['x86', 'arm', 'arm64', 'mips']
const MODES_BY_ARCH = {
  x86: ['16', '32', '64'],
  arm: ['arm', 'thumb'],
  arm64: ['arm'],
  mips: ['mips32', 'mips64']
}

const props = defineProps({
  architecture: { type: String, required: true },
  mode: { type: String, required: true },
  syntaxStyle: { type: String, required: true },
  startOffset: { type: Number, required: true },
  endOffset: { type: Number, default: null },
  isDisassembling: { type: Boolean, default: false },
  hasResults: { type: Boolean, default: false },
  highlightInHex: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  canDisassemble: { type: Boolean, default: true }
})

const emit = defineEmits([
  'update:architecture',
  'update:mode',
  'update:syntaxStyle',
  'update:startOffset',
  'update:endOffset',
  'update:highlightInHex',
  'disassemble',
  'clear',
  'export'
])

const availableModes = computed(() => MODES_BY_ARCH[props.architecture] || [])

function onArchChange(newArch) {
  emit('update:architecture', newArch)
  const validModes = MODES_BY_ARCH[newArch] || []
  if (!validModes.includes(props.mode) && validModes.length > 0) {
    emit('update:mode', validModes[0])
  }
}

function parseHex(value) {
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const hex = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed : '0x' + trimmed
  const parsed = Number.parseInt(hex, 16)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function onStartChange(value) {
  const parsed = parseHex(value)
  if (parsed !== null) emit('update:startOffset', parsed)
}

function onEndChange(value) {
  if (!String(value).trim()) {
    emit('update:endOffset', null)
    return
  }
  const parsed = parseHex(value)
  if (parsed !== null) emit('update:endOffset', parsed)
}

function formatHex(n) {
  return '0x' + n.toString(16)
}
</script>

<style scoped>
.disasm-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
  padding: 10px 12px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.control-label {
  font-size: 11px;
  color: var(--text-muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.control-select,
.control-input {
  padding: 4px 8px;
  font-family: inherit;
  font-size: 13px;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-primary, #d4d4d4);
  border: 1px solid var(--border-color, #555);
  border-radius: 3px;
  min-width: 80px;
}

.control-input {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
}

.action-btn {
  padding: 6px 14px;
  font-size: 13px;
  background: var(--bg-secondary, #3a3a3a);
  color: var(--text-primary, #d4d4d4);
  border: 1px solid var(--border-color, #555);
  border-radius: 3px;
  cursor: pointer;
  align-self: flex-end;
}

.action-btn.primary {
  background: var(--link-color, #0e639c);
  border-color: var(--link-color, #0e639c);
  color: #fff;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn:hover:not(:disabled) {
  background: var(--button-hover, #4a4a4a);
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--button-primary-hover, #1177bb);
}

.highlight-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-primary, #d4d4d4);
  align-self: flex-end;
  padding: 6px 0;
  cursor: pointer;
}
</style>
