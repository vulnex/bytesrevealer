import { computed, ref } from 'vue'
import {
  parseInput,
  previewBytes,
  FORMATS,
  MAX_PASTE_SIZE,
  LARGE_PASTE_WARNING
} from '../utils/bytesParser'

/**
 * Composable for the Paste Data dialog. Holds reactive textarea/format/name state,
 * derives a live parse result, and exposes flags the UI can render directly.
 * Pure state + computeds — no DOM, no Vue component dependencies.
 */
export function usePasteDataDialog() {
  const rawText = ref('')
  const format = ref('auto')
  const name = ref(getDefaultName())

  const parseResult = computed(() => {
    if (rawText.value.length === 0) {
      return { ok: false, error: 'empty', format: format.value, idle: true }
    }
    return parseInput(rawText.value, format.value)
  })

  const byteCount = computed(() => (parseResult.value.ok ? parseResult.value.bytes.length : 0))

  const oversized = computed(() => byteCount.value > MAX_PASTE_SIZE)
  const largePaste = computed(
    () => byteCount.value > LARGE_PASTE_WARNING && byteCount.value <= MAX_PASTE_SIZE
  )

  const canSubmit = computed(() => parseResult.value.ok && byteCount.value > 0 && !oversized.value)

  const preview = computed(() =>
    parseResult.value.ok ? previewBytes(parseResult.value.bytes, 16) : ''
  )

  const formatLabel = computed(() => {
    const detected = parseResult.value.ok ? parseResult.value.format : format.value
    const entry = FORMATS.find((f) => f.id === detected)
    return entry ? entry.name : detected
  })

  const statusClass = computed(() => {
    if (!rawText.value) return 'idle'
    if (oversized.value) return 'error'
    if (parseResult.value.ok) return largePaste.value ? 'warning' : 'success'
    return 'error'
  })

  function reset() {
    rawText.value = ''
    format.value = 'auto'
    name.value = getDefaultName()
  }

  return {
    rawText,
    format,
    name,
    parseResult,
    byteCount,
    oversized,
    largePaste,
    canSubmit,
    preview,
    formatLabel,
    statusClass,
    reset,
    FORMATS,
    MAX_PASTE_SIZE,
    LARGE_PASTE_WARNING
  }
}

/**
 * Returns a timestamped default filename for a paste, e.g. "pasted-2026-05-08-181432.bin".
 */
export function getDefaultName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `pasted-${date}-${time}.bin`
}

/**
 * Format a byte count as a human-readable size string.
 */
export function formatPasteSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
