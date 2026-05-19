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
    </div>

    <div v-if="disasmStore.hasResults" class="results-row">
      <DisasmListing
        :instructions="disasmStore.instructions"
        :selected-address="disasmStore.selectedAddress"
        :xref-map="disasmStore.xrefMap"
        :instruction-address-set="disasmStore.instructionAddressSet"
        :file-bytes="fileBytes"
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
import { onBeforeUnmount, ref, watch } from 'vue'
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
  }
})

defineEmits(['navigate-to-offset'])

const disasmStore = useDisassemblyStore()

const sidebarTab = ref('detail')

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
