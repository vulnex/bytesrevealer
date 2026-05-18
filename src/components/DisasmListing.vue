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
            v-for="ins in visibleInstructions"
            :key="ins.address"
            class="instruction-row"
            @click="$emit('navigate-to-offset', { offset: ins.address, length: ins.size })"
          >
            <td class="col-address">
              <code>0x{{ formatAddress(ins.address) }}</code>
            </td>
            <td class="col-bytes">
              <code>{{ formatBytes(ins.bytes) }}</code>
            </td>
            <td class="col-mnemonic">{{ ins.mnemonic }}</td>
            <td class="col-operands">{{ ins.opStr }}</td>
            <td class="col-action">
              <button
                class="go-btn"
                :aria-label="`Go to offset 0x${formatAddress(ins.address)}`"
                @click.stop="$emit('navigate-to-offset', { offset: ins.address, length: ins.size })"
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const ROW_HEIGHT = 24
const HEADER_HEIGHT = 28
const BUFFER_ROWS = 50

const props = defineProps({
  instructions: {
    type: Array,
    required: true
  }
})

defineEmits(['navigate-to-offset'])

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

const visibleInstructions = computed(() => {
  const { start, end } = visibleRange.value
  return props.instructions.slice(start, end)
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

onMounted(() => {
  updateViewportHeight()
  window.addEventListener('resize', updateViewportHeight)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportHeight)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
})

function formatAddress(addr) {
  return addr.toString(16).toUpperCase().padStart(8, '0')
}

function formatBytes(bytes) {
  if (!bytes) return ''
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}
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
  width: 120px;
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
