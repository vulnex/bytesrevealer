import { ref, computed, watch, watchEffect } from 'vue'

function isSafeRegex(pattern) {
  if (pattern.length > 1000) return false
  // Detect nested quantifiers (catastrophic backtracking)
  if (/(\+|\*|\?|\{)\s*\)[\+\*\?]|\)[\+\*\?]\s*\{/.test(pattern)) return false
  // Detect excessive repetition groups
  if (/(\{[0-9]{4,}\})/.test(pattern)) return false
  return true
}

/**
 * Composable for string search, filter, sort, regex validation, and pagination.
 * @param {import('vue').Ref<Array>} strings - reactive strings array from useStringExtraction
 */
export function useStringFilter(strings) {
  const searchQuery = ref('')
  const typeFilter = ref('all')
  const sortBy = ref('size')
  const useRegex = ref(false)
  const regexError = ref(null)
  const currentPage = ref(1)
  const itemsPerPage = ref(50)

  // Derive compiled regex separately to avoid side effects in computed
  const compiledRegex = ref(null)

  watchEffect(() => {
    if (!useRegex.value || !searchQuery.value) {
      compiledRegex.value = null
      regexError.value = null
      return
    }

    if (!isSafeRegex(searchQuery.value)) {
      compiledRegex.value = null
      regexError.value = 'Unsafe regex pattern: pattern is too long, contains nested quantifiers, or excessive repetition'
      return
    }

    try {
      compiledRegex.value = new RegExp(searchQuery.value, 'i')
      regexError.value = null
    } catch (error) {
      compiledRegex.value = null
      regexError.value = error.message
    }
  })

  const filteredAndSortedStrings = computed(() => {
    let result = [...strings.value]

    // Apply type filter
    if (typeFilter.value !== 'all') {
      if (typeFilter.value === 'UTF-16') {
        result = result.filter(str => str.type.includes('UTF-16'))
      } else {
        result = result.filter(str => str.type === typeFilter.value)
      }
    }

    // Apply search filter
    if (searchQuery.value) {
      if (useRegex.value) {
        const regex = compiledRegex.value
        if (regex) {
          result = result.filter(str =>
            regex.test(str.value) || regex.test(str.type)
          )
        }
        // If regex is invalid (compiledRegex is null), don't filter
      } else {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(str =>
          str.value.toLowerCase().includes(query) ||
          str.type.toLowerCase().includes(query)
        )
      }
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy.value === 'size') {
        return b.size - a.size
      } else if (sortBy.value === 'offset') {
        return (a.offset || 0) - (b.offset || 0)
      } else {
        return a.type.localeCompare(b.type)
      }
    })

    return result
  })

  const totalPages = computed(() => {
    return Math.ceil(filteredAndSortedStrings.value.length / itemsPerPage.value)
  })

  const paginatedStrings = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return filteredAndSortedStrings.value.slice(start, end)
  })

  // Reset to first page when filters change
  watch(filteredAndSortedStrings, () => {
    currentPage.value = 1
  })

  return {
    searchQuery,
    typeFilter,
    sortBy,
    useRegex,
    regexError,
    currentPage,
    itemsPerPage,
    filteredAndSortedStrings,
    totalPages,
    paginatedStrings
  }
}
