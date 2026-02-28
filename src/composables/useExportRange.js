import { ref } from 'vue'

export function useExportRange(fileSize) {
  const range = ref({
    start: '',
    end: ''
  })
  const rangeValid = ref(false)
  const rangeError = ref('')
  const parsedRange = ref({
    start: 0,
    end: 0,
    length: 0
  })

  const parseOffset = (value) => {
    if (!value) return NaN

    const trimmed = value.trim()

    // Handle hex format (0x prefix)
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return parseInt(trimmed.substring(2), 16)
    }

    // Try decimal
    const decimal = parseInt(trimmed, 10)
    if (!isNaN(decimal)) {
      return decimal
    }

    // Try as hex without prefix
    return parseInt(trimmed, 16)
  }

  const formatOffset = (offset) => {
    return '0x' + offset.toString(16).toUpperCase().padStart(4, '0')
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const validateRange = () => {
    const start = parseOffset(range.value.start)
    const end = parseOffset(range.value.end)

    rangeValid.value = false
    rangeError.value = ''

    // Check if fileSize is valid
    if (!fileSize.value || fileSize.value === 0) {
      if (range.value.start || range.value.end) {
        rangeError.value = 'File size is not available'
      }
      return
    }

    if (isNaN(start) && range.value.start) {
      rangeError.value = 'Invalid start offset'
      return
    }

    if (isNaN(end) && range.value.end) {
      rangeError.value = 'Invalid end offset'
      return
    }

    if (!range.value.start || !range.value.end) {
      return
    }

    if (start < 0) {
      rangeError.value = 'Start offset cannot be negative'
      return
    }

    if (end < 0) {
      rangeError.value = 'End offset cannot be negative'
      return
    }

    if (start >= fileSize.value) {
      rangeError.value = `Start offset exceeds file size (${fileSize.value} bytes)`
      return
    }

    if (end > fileSize.value) {
      rangeError.value = `End offset exceeds file size (${fileSize.value} bytes)`
      return
    }

    if (start >= end) {
      rangeError.value = 'Start offset must be less than end offset'
      return
    }

    const length = end - start
    if (length > 10 * 1024 * 1024) { // Warn for >10MB
      rangeError.value = `Warning: Large range (${formatFileSize(length)})`
    }

    parsedRange.value = { start, end, length }
    rangeValid.value = true
  }

  const setRange = (start, end) => {
    range.value.start = '0x' + start.toString(16).toUpperCase()
    range.value.end = '0x' + end.toString(16).toUpperCase()
    validateRange()
  }

  const clearRange = () => {
    range.value.start = ''
    range.value.end = ''
    parsedRange.value = { start: 0, end: 0, length: 0 }
    rangeValid.value = false
    rangeError.value = ''
  }

  return {
    range,
    rangeValid,
    rangeError,
    parsedRange,
    parseOffset,
    formatOffset,
    formatFileSize,
    validateRange,
    setRange,
    clearRange
  }
}
