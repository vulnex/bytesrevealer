<template>
  <div class="disassembly-panel">
    <div class="header-section">
      <h2>Disassembly</h2>
      <p>Decode machine code into assembly instructions (powered by Capstone v5 / WASM).</p>
    </div>

    <DisasmToolbar
      :architecture="disasmStore.architecture"
      :mode="disasmStore.mode"
      :syntax-style="disasmStore.syntaxStyle"
      :start-offset="disasmStore.startOffset"
      :end-offset="disasmStore.endOffset"
      :is-disassembling="disasmStore.isDisassembling"
      :has-results="disasmStore.hasResults"
      :highlight-in-hex="disasmStore.highlightInHex"
      :can-disassemble="!!fileBytes && fileBytes.length > 0"
      :disabled="!fileBytes || !fileBytes.length"
      @update:architecture="disasmStore.setArchitecture($event)"
      @update:mode="disasmStore.setMode($event)"
      @update:syntax-style="disasmStore.setSyntaxStyle($event)"
      @update:start-offset="disasmStore.startOffset = $event"
      @update:end-offset="disasmStore.endOffset = $event"
      @update:highlight-in-hex="onToggleHighlight($event)"
      @disassemble="runDisassembly"
      @clear="disasmStore.clearResults()"
      @export="exportAsAsm"
    />

    <div
      v-if="disasmStore.isDisassembling"
      class="progress-section"
      role="status"
      aria-live="polite"
    >
      <div class="progress-text">Disassembling... {{ disasmStore.progress }}%</div>
      <div
        class="progress-bar"
        role="progressbar"
        :aria-valuenow="disasmStore.progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Disassembly progress"
      >
        <div class="progress-fill" :style="{ width: `${disasmStore.progress}%` }"></div>
      </div>
    </div>

    <div v-if="disasmStore.error" class="error-banner">{{ disasmStore.error }}</div>

    <div v-if="disasmStore.hasResults" class="results-meta">
      <span
        ><strong>{{ disasmStore.instructionCount }}</strong> instructions</span
      >
      <span v-if="disasmStore.lastDuration != null"
        >· decoded in {{ formatDuration(disasmStore.lastDuration) }}</span
      >
      <span class="meta-hint">· press <kbd>?</kbd> for keys</span>
    </div>

    <div v-if="cmdMode && disasmStore.hasResults" class="cmd-bar">
      <span class="cmd-prefix">{{ cmdMode === 'goto' ? 'Goto:' : '/' }}</span>
      <input
        ref="cmdInputRef"
        v-model="cmdInput"
        class="cmd-input"
        :placeholder="cmdPlaceholder"
        :aria-label="cmdMode === 'goto' ? 'Goto address' : 'Search'"
        @keydown.escape.prevent="closeCmd"
        @keydown.enter.prevent="onCmdEnter"
      />
      <span v-if="cmdMode === 'search'" class="cmd-status">
        {{
          searchMatchAddresses.length
            ? `${searchCursor + 1} / ${searchMatchAddresses.length}`
            : cmdInput
              ? 'no matches'
              : ''
        }}
      </span>
      <button
        v-if="cmdMode === 'search'"
        class="cmd-btn"
        title="Previous match (p)"
        @click="prevMatch"
      >
        ↑
      </button>
      <button v-if="cmdMode === 'search'" class="cmd-btn" title="Next match (n)" @click="nextMatch">
        ↓
      </button>
      <button class="cmd-btn" title="Close (Esc)" @click="closeCmd">×</button>
    </div>

    <div v-if="showHelp && disasmStore.hasResults" class="help-bar" role="note">
      <div><kbd>j</kbd>/<kbd>k</kbd> next/prev instruction</div>
      <div><kbd>g</kbd> goto address</div>
      <div><kbd>/</kbd> search (then <kbd>n</kbd>/<kbd>p</kbd> for next/prev match)</div>
      <div><kbd>Esc</kbd> close / clear</div>
    </div>

    <div v-if="disasmStore.hasResults" class="results-row">
      <DisasmListing
        :instructions="disasmStore.instructions"
        :selected-address="disasmStore.selectedAddress"
        :xref-map="disasmStore.xrefMap"
        :instruction-address-set="disasmStore.instructionAddressSet"
        :file-bytes="fileBytes"
        :search-matches="searchMatchSet"
        :current-match-address="currentMatchAddress"
        class="results-listing"
        @navigate-to-offset="$emit('navigate-to-offset', $event)"
        @select-instruction="disasmStore.selectInstruction($event)"
      />
      <div class="sidebar" role="tabpanel">
        <div class="sidebar-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="sidebar-tab"
            :class="{ active: sidebarTab === 'detail' }"
            :aria-selected="sidebarTab === 'detail'"
            @click="sidebarTab = 'detail'"
          >
            Detail
          </button>
          <button
            type="button"
            role="tab"
            class="sidebar-tab"
            :class="{ active: sidebarTab === 'functions' }"
            :aria-selected="sidebarTab === 'functions'"
            @click="sidebarTab = 'functions'"
          >
            Functions ({{ disasmStore.functionStarts.length }})
          </button>
        </div>
        <InstructionDetail
          v-if="sidebarTab === 'detail'"
          :instruction="disasmStore.selectedInstruction"
        />
        <FunctionList
          v-else
          :functions="disasmStore.functionStarts"
          :selected-address="disasmStore.selectedAddress"
          @select-function="disasmStore.selectInstruction($event)"
        />
      </div>
    </div>

    <div v-else-if="!disasmStore.isDisassembling && !disasmStore.error" class="empty-state">
      <p>
        Pick an architecture and byte range above, then click <strong>Disassemble</strong> to decode
        instructions. Default range disassembles the first 4&nbsp;KB.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisassemblyStore } from '../stores/disassembly'
import { detectDisasmArch } from '../utils/disasmArchDetect'
import { extractSymbolNames } from '../utils/disasmSymbols'
import { formatAsAsm, suggestAsmFilename } from '../utils/disasmFormatter'
import DisasmToolbar from './DisasmToolbar.vue'
import DisasmListing from './DisasmListing.vue'
import InstructionDetail from './InstructionDetail.vue'
import FunctionList from './FunctionList.vue'

const DEFAULT_RANGE_BYTES = 0x1000

const props = defineProps({
  fileBytes: {
    type: [Array, Uint8Array],
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  }
})

defineEmits(['navigate-to-offset'])

const disasmStore = useDisassemblyStore()

const sidebarTab = ref('detail')

// Keyboard navigation state.
// cmdMode is 'goto' | 'search' | null. cmdInput is the live text in the bar.
const cmdMode = ref(null)
const cmdInput = ref('')
const cmdInputRef = ref(null)
const searchCursor = ref(0)
const showHelp = ref(false)

const cmdPlaceholder = computed(() =>
  cmdMode.value === 'goto'
    ? 'address — e.g. 0x401000 or 4198400'
    : 'substring match against mnemonic + operands'
)

const searchMatchAddresses = computed(() => {
  if (cmdMode.value !== 'search' || !cmdInput.value) return []
  const q = cmdInput.value.toLowerCase()
  const out = []
  for (const ins of disasmStore.instructions) {
    const text = `${ins.mnemonic} ${ins.opStr || ''}`.toLowerCase()
    if (text.includes(q)) out.push(ins.address)
  }
  return out
})

const searchMatchSet = computed(() => new Set(searchMatchAddresses.value))

const currentMatchAddress = computed(() => {
  const matches = searchMatchAddresses.value
  if (!matches.length) return null
  const i = Math.min(searchCursor.value, matches.length - 1)
  return matches[i]
})

// When a new search produces matches, jump selection to the first one so
// the listing scrolls into view immediately.
watch(searchMatchAddresses, (matches) => {
  searchCursor.value = 0
  if (matches.length) disasmStore.selectInstruction(matches[0])
})

function openSearch() {
  cmdMode.value = 'search'
  cmdInput.value = ''
  searchCursor.value = 0
  nextTick(() => cmdInputRef.value?.focus())
}

function openGoto() {
  cmdMode.value = 'goto'
  cmdInput.value = ''
  nextTick(() => cmdInputRef.value?.focus())
}

function closeCmd() {
  cmdMode.value = null
  cmdInput.value = ''
}

function performGoto() {
  const raw = cmdInput.value.trim()
  if (!raw) return
  // Accept hex with or without 0x, or decimal if the user typed pure digits.
  let target
  if (/^0x[0-9a-f]+$/i.test(raw)) target = Number.parseInt(raw.slice(2), 16)
  else if (/^[0-9]+$/.test(raw)) target = Number.parseInt(raw, 10)
  else target = Number.parseInt(raw, 16)
  if (!Number.isFinite(target)) return

  const ins = disasmStore.instructions
  let found = null
  for (const i of ins) {
    if (i.address >= target) {
      found = i
      break
    }
  }
  if (!found && ins.length) found = ins[ins.length - 1]
  if (found) disasmStore.selectInstruction(found.address)
  closeCmd()
}

function nextMatch() {
  const matches = searchMatchAddresses.value
  if (!matches.length) return
  searchCursor.value = (searchCursor.value + 1) % matches.length
  disasmStore.selectInstruction(matches[searchCursor.value])
}

function prevMatch() {
  const matches = searchMatchAddresses.value
  if (!matches.length) return
  searchCursor.value = (searchCursor.value - 1 + matches.length) % matches.length
  disasmStore.selectInstruction(matches[searchCursor.value])
}

function onCmdEnter() {
  if (cmdMode.value === 'goto') performGoto()
  else if (cmdMode.value === 'search') nextMatch()
}

function moveRow(delta) {
  const ins = disasmStore.instructions
  if (!ins.length) return
  let idx = 0
  if (disasmStore.selectedAddress != null) {
    const found = ins.findIndex((i) => i.address === disasmStore.selectedAddress)
    idx = found >= 0 ? found : 0
  }
  idx = Math.max(0, Math.min(ins.length - 1, idx + delta))
  disasmStore.selectInstruction(ins[idx].address)
}

function isTypingElsewhere(target) {
  if (!target) return false
  if (target === cmdInputRef.value) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function handleKeydown(event) {
  if (!props.isActive) return
  if (!disasmStore.hasResults) return
  if (isTypingElsewhere(event.target)) return

  // While the command bar input has focus, only Esc / Enter are handled
  // (Enter via the @keydown.enter on the input, Esc via the @keydown.escape
  // on the input). Letters typed inside the input are pure text input.
  if (cmdMode.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeCmd()
    }
    return
  }

  // Free-roam shortcuts.
  switch (event.key) {
    case 'j':
      event.preventDefault()
      moveRow(1)
      break
    case 'k':
      event.preventDefault()
      moveRow(-1)
      break
    case 'g':
      event.preventDefault()
      openGoto()
      break
    case '/':
      event.preventDefault()
      openSearch()
      break
    case 'n':
      if (searchMatchAddresses.value.length) {
        event.preventDefault()
        nextMatch()
      }
      break
    case 'p':
      if (searchMatchAddresses.value.length) {
        event.preventDefault()
        prevMatch()
      }
      break
    case '?':
      event.preventDefault()
      showHelp.value = !showHelp.value
      break
    case 'Escape':
      if (showHelp.value) {
        event.preventDefault()
        showHelp.value = false
      }
      break
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))

let worker = null
let runId = 0

function ensureWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/DisasmWorker.js', import.meta.url), { type: 'module' })
  }
  return worker
}

function onToggleHighlight(value) {
  if (value !== disasmStore.highlightInHex) {
    disasmStore.toggleHexHighlight()
  }
}

function exportAsAsm() {
  if (!disasmStore.hasResults) return
  const text = formatAsAsm(disasmStore.instructions, {
    architecture: disasmStore.architecture,
    mode: disasmStore.mode,
    syntaxStyle: disasmStore.syntaxStyle,
    startOffset: disasmStore.startOffset,
    endOffset: disasmStore.endOffset,
    generatedAt: disasmStore.lastDisassembledAt
  })
  const filename = suggestAsmFilename({
    architecture: disasmStore.architecture,
    mode: disasmStore.mode,
    startOffset: disasmStore.startOffset
  })
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function applyAutoDetect(bytes) {
  if (!bytes || !bytes.length) return
  if (disasmStore.isDisassembling) return
  const detected = detectDisasmArch(bytes)
  if (!detected) return
  disasmStore.setArchitecture(detected.arch)
  disasmStore.setMode(detected.mode)
  if (detected.startOffset > 0 && disasmStore.startOffset === 0 && !disasmStore.hasResults) {
    disasmStore.setRange(detected.startOffset, disasmStore.endOffset)
  }
}

function applySymbolNames(bytes) {
  if (!bytes || !bytes.length) {
    disasmStore.setSymbolNames(new Map())
    return
  }
  disasmStore.setSymbolNames(extractSymbolNames(bytes))
}

watch(
  () => props.fileBytes,
  (b) => {
    applyAutoDetect(b)
    applySymbolNames(b)
  },
  { immediate: true }
)

async function runDisassembly() {
  if (!props.fileBytes || !props.fileBytes.length) return

  const currentRunId = ++runId

  if (disasmStore.isDisassembling && worker) {
    worker.terminate()
    worker = null
  }

  disasmStore.clearResults()
  disasmStore.startDisassembly()

  const totalSize = props.fileBytes.length
  const start = Math.max(0, Math.min(disasmStore.startOffset, totalSize))
  const explicitEnd = disasmStore.endOffset
  const end =
    explicitEnd != null
      ? Math.max(start, Math.min(explicitEnd, totalSize))
      : Math.min(start + DEFAULT_RANGE_BYTES, totalSize)

  const bytes =
    props.fileBytes instanceof Uint8Array
      ? props.fileBytes.subarray(start, end)
      : new Uint8Array(props.fileBytes.slice(start, end))

  const w = ensureWorker()

  await new Promise((resolve) => {
    w.onmessage = (event) => {
      if (currentRunId !== runId) {
        resolve()
        return
      }
      const { type } = event.data
      switch (type) {
        case 'progress':
          disasmStore.setProgress(event.data.progress)
          break
        case 'complete':
          disasmStore.setResults({
            instructions: event.data.instructions,
            duration: event.data.duration
          })
          resolve()
          break
        case 'error':
          disasmStore.setError(event.data.error)
          resolve()
          break
      }
    }

    w.onerror = (err) => {
      if (currentRunId !== runId) {
        resolve()
        return
      }
      disasmStore.setError(err.message || 'Worker error')
      resolve()
    }

    w.postMessage({
      type: 'disassemble',
      data: {
        bytes,
        arch: disasmStore.architecture,
        mode: disasmStore.mode,
        syntax: disasmStore.syntaxStyle,
        baseAddress: start
      }
    })
  })
}

function formatDuration(ms) {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

onBeforeUnmount(() => {
  if (worker) {
    worker.terminate()
    worker = null
  }
})
</script>

<style scoped>
.disassembly-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  min-height: 600px;
}

.header-section h2 {
  margin: 0 0 4px;
  font-size: 18px;
  color: var(--text-primary, #d4d4d4);
}

.header-section p {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted, #888);
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-text {
  font-size: 12px;
  color: var(--text-muted, #888);
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--bg-secondary, #2a2a2a);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--link-color, #0e639c);
  transition: width 120ms ease-out;
}

.error-banner {
  padding: 8px 12px;
  background: var(--error-bg, #5a1f1f);
  color: var(--error-text, #f5a5a5);
  border: 1px solid var(--error-border, #8c2a2a);
  border-radius: 4px;
  font-size: 13px;
}

.results-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted, #888);
  align-items: center;
}

.meta-hint {
  font-size: 11px;
  color: var(--text-muted, #888);
}

.meta-hint kbd {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 10px;
  padding: 0 4px;
  border: 1px solid var(--border-color, #444);
  border-radius: 3px;
  background: var(--bg-primary, #1e1e1e);
}

.cmd-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--link-color, #4ec9b0);
  border-radius: 4px;
  font-size: 13px;
}

.cmd-prefix {
  color: var(--link-color, #4ec9b0);
  font-weight: 600;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
}

.cmd-input {
  flex: 1 1 auto;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-primary, #d4d4d4);
  border: 1px solid var(--border-color, #555);
  border-radius: 3px;
  padding: 4px 8px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 13px;
  outline: none;
}

.cmd-input:focus {
  border-color: var(--link-color, #4ec9b0);
}

.cmd-status {
  font-size: 12px;
  color: var(--text-muted, #888);
  font-variant-numeric: tabular-nums;
}

.cmd-btn {
  padding: 2px 8px;
  font-size: 12px;
  background: var(--bg-secondary, #3a3a3a);
  color: var(--text-primary, #d4d4d4);
  border: 1px solid var(--border-color, #555);
  border-radius: 3px;
  cursor: pointer;
}

.cmd-btn:hover {
  background: var(--button-hover, #4a4a4a);
}

.help-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 6px 10px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px dashed var(--border-color, #444);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-muted, #888);
}

.help-bar kbd {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 11px;
  padding: 0 5px;
  border: 1px solid var(--border-color, #555);
  border-radius: 3px;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-primary, #d4d4d4);
}

.empty-state {
  padding: 24px;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px dashed var(--border-color, #444);
  border-radius: 4px;
  color: var(--text-muted, #888);
  font-size: 13px;
  text-align: center;
}

.results-row {
  display: flex;
  flex-direction: row;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 400px;
}

.results-listing {
  flex: 1 1 auto;
  min-width: 0;
}

.sidebar {
  flex: 0 0 280px;
  min-width: 240px;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  overflow: hidden;
  align-self: flex-start;
}

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color, #444);
  background: var(--bg-primary, #1e1e1e);
}

.sidebar-tab {
  flex: 1 1 0;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border-color, #444);
  color: var(--text-muted, #888);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sidebar-tab:last-child {
  border-right: none;
}

.sidebar-tab:hover {
  background: var(--surface-hover, #2d2d2d);
  color: var(--text-primary, #d4d4d4);
}

.sidebar-tab.active {
  background: var(--bg-secondary, #2a2a2a);
  color: var(--link-color, #4ec9b0);
  font-weight: 600;
}

@media (max-width: 900px) {
  .results-row {
    flex-direction: column;
  }
  .sidebar {
    flex: 0 0 auto;
    max-width: 100%;
    width: 100%;
  }
}
</style>
