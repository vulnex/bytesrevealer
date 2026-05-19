<template>
  <div ref="containerRef" class="disasm-listing" tabindex="0" @scroll="handleScroll">
    <div class="listing-spacer" :style="{ height: totalHeight + 'px' }">
      <table class="instruction-table" :style="{ transform: `translateY(${offsetY}px)` }">
        <thead>
          <tr>
            <th class="col-address">Address</th>
            <th class="col-bytes">Bytes</th>
            <th class="col-mnemonic">Mnemonic</th>
            <th class="col-operands">Operands</th>
            <th class="col-action">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in visibleRows"
            :key="row.ins.address"
            class="instruction-row"
            :class="{ selected: row.ins.address === selectedAddress }"
            @click="onRowClick(row.ins)"
          >
            <td class="col-address">
              <code>0x{{ formatAddress(row.ins.address) }}</code>
              <span
                v-if="row.xrefSources.length"
                class="xref-badge"
                :title="row.xrefTitle"
                :aria-label="`Referenced from ${row.xrefSources.length} location${
                  row.xrefSources.length === 1 ? '' : 's'
                }`"
                >← {{ row.xrefSources.length }}</span
              >
            </td>
            <td class="col-bytes">
              <code>{{ formatBytes(row.ins.bytes) }}</code>
            </td>
            <td class="col-mnemonic">{{ row.ins.mnemonic }}</td>
            <td class="col-operands">
              <template v-if="row.branchInRange">
                <a
                  class="branch-link"
                  :aria-label="`Jump to 0x${formatAddress(row.branchTarget)}`"
                  @click.stop="onBranchClick(row.branchTarget)"
                  >0x{{ formatAddress(row.branchTarget) }}</a
                >
              </template>
              <template v-else>{{ row.ins.opStr }}</template>
              <span v-if="row.stringPreview" class="string-ref">
                → <span class="string-quote">"{{ row.stringPreview }}"</span>
              </span>
            </td>
            <td class="col-action">
              <button
                class="go-btn"
                :aria-label="`Go to offset 0x${formatAddress(row.ins.address)} in hex view`"
                @click.stop="onGoClick(row.ins)"
              >
                Go
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { formatDisasmAddress, formatDisasmBytes } from '../utils/disasmDisplay'
import { extractBranchTarget, extractDataImmediate } from '../utils/disasmXref'
import { readAsciiPreview } from '../utils/disasmStrings'

const ROW_HEIGHT = 24
const HEADER_HEIGHT = 28
const BUFFER_ROWS = 50
const MAX_XREF_DISPLAYED = 5

const props = defineProps({
  instructions: {
    type: Array,
    required: true
  },
  selectedAddress: {
    type: Number,
    default: null
  },
  xrefMap: {
    type: Map,
    default: () => new Map()
  },
  instructionAddressSet: {
    type: Set,
    default: () => new Set()
  },
  fileBytes: {
    type: [Uint8Array, Array],
    default: null
  }
})

const emit = defineEmits(['navigate-to-offset', 'select-instruction'])

function onRowClick(ins) {
  emit('select-instruction', ins.address)
}

function onGoClick(ins) {
  emit('select-instruction', ins.address)
  emit('navigate-to-offset', { offset: ins.address, length: ins.size })
}

function onBranchClick(target) {
  emit('select-instruction', target)
}

const containerRef = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)

const totalHeight = computed(() => HEADER_HEIGHT + props.instructions.length * ROW_HEIGHT)

const visibleRange = computed(() => {
  const currentRow = Math.max(0, Math.floor((scrollTop.value - HEADER_HEIGHT) / ROW_HEIGHT))
  const visibleRowCount = Math.ceil(viewportHeight.value / ROW_HEIGHT)
  const start = Math.max(0, currentRow - BUFFER_ROWS)
  const end = Math.min(props.instructions.length, currentRow + visibleRowCount + BUFFER_ROWS)
  return { start, end }
})

// Build per-row annotations only for rows currently in the visible window.
// O(visible) work per scroll/selection — bounded by BUFFER_ROWS + viewport,
// independent of the total instruction count.
const visibleRows = computed(() => {
  const { start, end } = visibleRange.value
  const out = []
  for (let i = start; i < end; i++) {
    const ins = props.instructions[i]
    if (!ins) continue

    const branchTarget = extractBranchTarget(ins)
    const branchInRange = branchTarget != null && props.instructionAddressSet.has(branchTarget)

    let stringPreview = null
    if (!branchInRange && props.fileBytes && props.fileBytes.length) {
      const imm = branchTarget != null ? null : extractDataImmediate(ins)
      if (imm != null) {
        stringPreview = readAsciiPreview(props.fileBytes, imm, {
          minLen: 4,
          maxLen: 64,
          previewLen: 40
        })
      }
    }

    const allSources = props.xrefMap.get(ins.address) || []
    const xrefSources = allSources.slice(0, MAX_XREF_DISPLAYED)
    const xrefTitle = allSources.length
      ? `Referenced from: ${allSources
          .map((s) => '0x' + formatDisasmAddress(s))
          .join(', ')}${allSources.length > MAX_XREF_DISPLAYED ? ' …' : ''}`
      : ''

    out.push({
      ins,
      branchTarget,
      branchInRange,
      stringPreview,
      xrefSources,
      xrefTitle
    })
  }
  return out
})

const offsetY = computed(() => visibleRange.value.start * ROW_HEIGHT)

let scrollRaf = null
function handleScroll() {
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    if (containerRef.value) {
      scrollTop.value = containerRef.value.scrollTop
    }
  })
}

function updateViewportHeight() {
  if (containerRef.value) {
    viewportHeight.value = containerRef.value.clientHeight
  }
}

// When selectedAddress changes from outside (e.g. a branch-link click),
// scroll the listing to bring that row into view. Row-click selections
// pass through this path too but the row is already visible by definition,
// so the scroll is a no-op for that case.
watch(
  () => props.selectedAddress,
  (addr) => {
    if (addr == null || !containerRef.value) return
    const index = props.instructions.findIndex((i) => i.address === addr)
    if (index < 0) return
    const targetTop = index * ROW_HEIGHT
    const container = containerRef.value
    const viewTop = container.scrollTop
    const viewBottom = viewTop + container.clientHeight - HEADER_HEIGHT
    if (targetTop < viewTop || targetTop + ROW_HEIGHT > viewBottom) {
      // Centre target row in the viewport.
      const half = Math.max(0, container.clientHeight / 2 - ROW_HEIGHT)
      container.scrollTop = Math.max(0, targetTop - half)
      nextTick(() => {
        scrollTop.value = container.scrollTop
      })
    }
  }
)

onMounted(() => {
  updateViewportHeight()
  window.addEventListener('resize', updateViewportHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportHeight)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
})

const formatAddress = formatDisasmAddress
const formatBytes = formatDisasmBytes
</script>

<style scoped>
.disasm-listing {
  height: 100%;
  min-height: 400px;
  overflow-y: auto;
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 13px;
  position: relative;
}

.listing-spacer {
  position: relative;
  width: 100%;
}

.instruction-table {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.instruction-table thead {
  position: sticky;
  top: 0;
  background: var(--bg-secondary, #2a2a2a);
  z-index: 1;
}

.instruction-table th,
.instruction-table td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 24px;
  line-height: 1;
}

.col-address {
  width: 160px;
  color: var(--text-muted, #888);
}

.col-bytes {
  width: 180px;
  color: var(--text-primary, #c0c0c0);
}

.col-mnemonic {
  width: 90px;
  color: var(--link-color, #4ec9b0);
  font-weight: 600;
}

.col-operands {
  color: var(--text-primary, #d4d4d4);
}

.col-action {
  width: 60px;
  text-align: center;
}

.instruction-row:hover {
  background: var(--surface-hover, #2d2d2d);
  cursor: pointer;
}

.instruction-row.selected {
  background: var(--surface-selected, #3a3a3a);
  box-shadow: inset 2px 0 0 var(--link-color, #4ec9b0);
}

.xref-badge {
  margin-left: 6px;
  padding: 0 5px;
  font-size: 10px;
  color: var(--link-color, #4ec9b0);
  border: 1px solid var(--link-color, #4ec9b0);
  border-radius: 8px;
  vertical-align: middle;
  cursor: help;
  font-family: inherit;
}

.branch-link {
  color: var(--link-color, #4ec9b0);
  text-decoration: underline;
  text-decoration-style: dotted;
  cursor: pointer;
}

.branch-link:hover {
  text-decoration-style: solid;
}

.string-ref {
  margin-left: 8px;
  color: var(--text-muted, #888);
  font-size: 12px;
}

.string-quote {
  color: #ce9178;
}

.go-btn {
  padding: 1px 8px;
  font-size: 11px;
  background: var(--bg-secondary, #3a3a3a);
  color: var(--text-primary, #d4d4d4);
  border: 1px solid var(--border-color, #555);
  border-radius: 3px;
  cursor: pointer;
}

.go-btn:hover {
  background: var(--button-hover, #4a4a4a);
}
</style>
