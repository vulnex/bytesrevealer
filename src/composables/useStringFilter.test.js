import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { createApp } from 'vue'
import { useStringFilter } from './useStringFilter'

function withSetup(fn) {
  let result
  const app = createApp({ setup() { result = fn(); return () => {} } })
  app.mount(document.createElement('div'))
  return [result, app]
}

function makeSampleStrings() {
  return ref([
    { type: 'ASCII', size: 10, value: 'HelloWorld', offset: 0 },
    { type: 'ASCII', size: 5, value: 'Test!', offset: 20 },
    { type: 'UTF-8', size: 8, value: 'Unicode!', offset: 50 },
    { type: 'UTF-16LE', size: 6, value: 'WideCh', offset: 100 },
    { type: 'UTF-16BE', size: 7, value: 'BigEndi', offset: 200 }
  ])
}

describe('useStringFilter', () => {
  describe('initial state', () => {
    it('searchQuery is empty', () => {
      const [result, app] = withSetup(() => useStringFilter(ref([])))
      expect(result.searchQuery.value).toBe('')
      app.unmount()
    })

    it('typeFilter is "all"', () => {
      const [result, app] = withSetup(() => useStringFilter(ref([])))
      expect(result.typeFilter.value).toBe('all')
      app.unmount()
    })

    it('sortBy is "size"', () => {
      const [result, app] = withSetup(() => useStringFilter(ref([])))
      expect(result.sortBy.value).toBe('size')
      app.unmount()
    })

    it('useRegex is false', () => {
      const [result, app] = withSetup(() => useStringFilter(ref([])))
      expect(result.useRegex.value).toBe(false)
      app.unmount()
    })

    it('regexError is null', () => {
      const [result, app] = withSetup(() => useStringFilter(ref([])))
      expect(result.regexError.value).toBe(null)
      app.unmount()
    })

    it('currentPage is 1', () => {
      const [result, app] = withSetup(() => useStringFilter(ref([])))
      expect(result.currentPage.value).toBe(1)
      app.unmount()
    })

    it('itemsPerPage is 50', () => {
      const [result, app] = withSetup(() => useStringFilter(ref([])))
      expect(result.itemsPerPage.value).toBe(50)
      app.unmount()
    })
  })

  describe('filteredAndSortedStrings', () => {
    it('returns all strings when no filters applied', () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      expect(result.filteredAndSortedStrings.value.length).toBe(5)
      app.unmount()
    })

    it('default sort is by size descending', () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      const sizes = result.filteredAndSortedStrings.value.map(s => s.size)
      for (let i = 0; i < sizes.length - 1; i++) {
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i + 1])
      }
      app.unmount()
    })

    it('reacts to changes in source strings', async () => {
      const strings = ref([
        { type: 'ASCII', size: 5, value: 'Hello', offset: 0 }
      ])
      const [result, app] = withSetup(() => useStringFilter(strings))
      expect(result.filteredAndSortedStrings.value.length).toBe(1)

      strings.value = [
        { type: 'ASCII', size: 5, value: 'Hello', offset: 0 },
        { type: 'ASCII', size: 5, value: 'World', offset: 10 }
      ]
      await nextTick()
      expect(result.filteredAndSortedStrings.value.length).toBe(2)
      app.unmount()
    })
  })

  describe('type filtering', () => {
    it('filters by ASCII', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.typeFilter.value = 'ASCII'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.every(s => s.type === 'ASCII')).toBe(true)
      expect(result.filteredAndSortedStrings.value.length).toBe(2)
      app.unmount()
    })

    it('filters by UTF-8', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.typeFilter.value = 'UTF-8'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.every(s => s.type === 'UTF-8')).toBe(true)
      expect(result.filteredAndSortedStrings.value.length).toBe(1)
      app.unmount()
    })

    it('filters UTF-16 variants (LE and BE)', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.typeFilter.value = 'UTF-16'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.every(s => s.type.includes('UTF-16'))).toBe(true)
      expect(result.filteredAndSortedStrings.value.length).toBe(2)
      app.unmount()
    })

    it('returns empty when filter matches nothing', async () => {
      const strings = ref([
        { type: 'ASCII', size: 5, value: 'Hello', offset: 0 }
      ])
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.typeFilter.value = 'UTF-8'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(0)
      app.unmount()
    })
  })

  describe('text search', () => {
    it('filters by value (case-insensitive)', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.searchQuery.value = 'hello'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(1)
      expect(result.filteredAndSortedStrings.value[0].value).toBe('HelloWorld')
      app.unmount()
    })

    it('matches against type as well', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.searchQuery.value = 'utf-8'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(1)
      expect(result.filteredAndSortedStrings.value[0].type).toBe('UTF-8')
      app.unmount()
    })

    it('returns all when search is empty', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.searchQuery.value = 'xyz'
      await nextTick()
      expect(result.filteredAndSortedStrings.value.length).toBe(0)

      result.searchQuery.value = ''
      await nextTick()
      expect(result.filteredAndSortedStrings.value.length).toBe(5)
      app.unmount()
    })

    it('combines type filter and text search', async () => {
      const strings = ref([
        { type: 'ASCII', size: 5, value: 'Apple', offset: 0 },
        { type: 'ASCII', size: 6, value: 'Banana', offset: 10 },
        { type: 'UTF-8', size: 5, value: 'Apple', offset: 20 }
      ])
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.typeFilter.value = 'ASCII'
      result.searchQuery.value = 'apple'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(1)
      expect(result.filteredAndSortedStrings.value[0].type).toBe('ASCII')
      expect(result.filteredAndSortedStrings.value[0].value).toBe('Apple')
      app.unmount()
    })
  })

  describe('regex search', () => {
    it('filters using regex when useRegex is true', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = '^Hello'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(1)
      expect(result.filteredAndSortedStrings.value[0].value).toBe('HelloWorld')
      app.unmount()
    })

    it('regex is case-insensitive', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = 'helloworld'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(1)
      app.unmount()
    })

    it('sets regexError on invalid regex', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = '[invalid('
      await nextTick()

      expect(result.regexError.value).not.toBe(null)
      // Should not filter when regex is invalid
      expect(result.filteredAndSortedStrings.value.length).toBe(5)
      app.unmount()
    })

    it('clears regexError when regex becomes valid', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = '[invalid('
      await nextTick()
      expect(result.regexError.value).not.toBe(null)

      result.searchQuery.value = 'Hello'
      await nextTick()
      expect(result.regexError.value).toBe(null)
      app.unmount()
    })

    it('clears regexError when useRegex is toggled off', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = '[invalid('
      await nextTick()
      expect(result.regexError.value).not.toBe(null)

      result.useRegex.value = false
      await nextTick()
      expect(result.regexError.value).toBe(null)
      app.unmount()
    })

    it('clears regexError when search query is cleared', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = '[invalid('
      await nextTick()
      expect(result.regexError.value).not.toBe(null)

      result.searchQuery.value = ''
      await nextTick()
      expect(result.regexError.value).toBe(null)
      app.unmount()
    })

    it('detects unsafe regex (too long)', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = 'a'.repeat(1001)
      await nextTick()

      expect(result.regexError.value).toContain('Unsafe regex')
      app.unmount()
    })

    it('detects unsafe regex (nested quantifiers)', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = '(a+)+'
      await nextTick()

      expect(result.regexError.value).toContain('Unsafe regex')
      app.unmount()
    })

    it('detects unsafe regex (excessive repetition)', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = 'a{10000}'
      await nextTick()

      expect(result.regexError.value).toContain('Unsafe regex')
      app.unmount()
    })

    it('regex matches against type field too', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.useRegex.value = true
      result.searchQuery.value = 'UTF-16'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(2)
      app.unmount()
    })
  })

  describe('sorting', () => {
    it('sorts by size descending', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.sortBy.value = 'size'
      await nextTick()

      const sizes = result.filteredAndSortedStrings.value.map(s => s.size)
      for (let i = 0; i < sizes.length - 1; i++) {
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i + 1])
      }
      app.unmount()
    })

    it('sorts by offset ascending', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.sortBy.value = 'offset'
      await nextTick()

      const offsets = result.filteredAndSortedStrings.value.map(s => s.offset)
      for (let i = 0; i < offsets.length - 1; i++) {
        expect(offsets[i]).toBeLessThanOrEqual(offsets[i + 1])
      }
      app.unmount()
    })

    it('sorts by type alphabetically', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.sortBy.value = 'type'
      await nextTick()

      const types = result.filteredAndSortedStrings.value.map(s => s.type)
      for (let i = 0; i < types.length - 1; i++) {
        expect(types[i].localeCompare(types[i + 1])).toBeLessThanOrEqual(0)
      }
      app.unmount()
    })

    it('handles null offsets when sorting by offset', async () => {
      const strings = ref([
        { type: 'ASCII', size: 5, value: 'Hello', offset: null },
        { type: 'ASCII', size: 5, value: 'World', offset: 10 }
      ])
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.sortBy.value = 'offset'
      await nextTick()

      // null offset treated as 0, so it should come first
      expect(result.filteredAndSortedStrings.value[0].value).toBe('Hello')
      expect(result.filteredAndSortedStrings.value[1].value).toBe('World')
      app.unmount()
    })
  })

  describe('pagination', () => {
    function makeManyStrings(count) {
      return ref(Array.from({ length: count }, (_, i) => ({
        type: 'ASCII',
        size: count - i,
        value: `String${i}`,
        offset: i * 10
      })))
    }

    it('totalPages is 1 when items fit on one page', () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))
      expect(result.totalPages.value).toBe(1)
      app.unmount()
    })

    it('totalPages is correct for multiple pages', () => {
      const strings = makeManyStrings(120)
      const [result, app] = withSetup(() => useStringFilter(strings))
      expect(result.totalPages.value).toBe(3) // 120 / 50 = 2.4, ceil = 3
      app.unmount()
    })

    it('paginatedStrings returns first page by default', () => {
      const strings = makeManyStrings(120)
      const [result, app] = withSetup(() => useStringFilter(strings))
      expect(result.paginatedStrings.value.length).toBe(50)
      app.unmount()
    })

    it('paginatedStrings returns correct items for page 2', async () => {
      const strings = makeManyStrings(120)
      const [result, app] = withSetup(() => useStringFilter(strings))

      // Need to set page without triggering the filter change reset
      // The watcher resets currentPage when filteredAndSortedStrings changes,
      // so we set the page after initial stabilization
      await nextTick()
      result.currentPage.value = 2
      await nextTick()

      expect(result.paginatedStrings.value.length).toBe(50)
      app.unmount()
    })

    it('last page has remaining items', async () => {
      const strings = makeManyStrings(120)
      const [result, app] = withSetup(() => useStringFilter(strings))
      await nextTick()
      result.currentPage.value = 3
      await nextTick()

      expect(result.paginatedStrings.value.length).toBe(20) // 120 - 100
      app.unmount()
    })

    it('resets to page 1 when filter changes', async () => {
      const strings = makeManyStrings(120)
      const [result, app] = withSetup(() => useStringFilter(strings))
      await nextTick()
      result.currentPage.value = 3
      await nextTick()
      expect(result.currentPage.value).toBe(3)

      // Apply a search filter — this changes filteredAndSortedStrings
      result.searchQuery.value = 'String1'
      await nextTick()

      expect(result.currentPage.value).toBe(1)
      app.unmount()
    })

    it('resets to page 1 when type filter changes', async () => {
      const strings = makeManyStrings(120)
      const [result, app] = withSetup(() => useStringFilter(strings))
      await nextTick()
      result.currentPage.value = 2
      await nextTick()

      result.typeFilter.value = 'UTF-8'
      await nextTick()

      expect(result.currentPage.value).toBe(1)
      app.unmount()
    })

    it('resets to page 1 when sort changes', async () => {
      const strings = makeManyStrings(120)
      const [result, app] = withSetup(() => useStringFilter(strings))
      await nextTick()
      result.currentPage.value = 2
      await nextTick()

      result.sortBy.value = 'offset'
      await nextTick()

      expect(result.currentPage.value).toBe(1)
      app.unmount()
    })

    it('totalPages is 0 when no strings', () => {
      const strings = ref([])
      const [result, app] = withSetup(() => useStringFilter(strings))
      expect(result.totalPages.value).toBe(0)
      app.unmount()
    })

    it('paginatedStrings is empty when no strings', () => {
      const strings = ref([])
      const [result, app] = withSetup(() => useStringFilter(strings))
      expect(result.paginatedStrings.value).toEqual([])
      app.unmount()
    })

    it('respects custom itemsPerPage', async () => {
      const strings = makeManyStrings(30)
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.itemsPerPage.value = 10
      await nextTick()

      expect(result.totalPages.value).toBe(3)
      expect(result.paginatedStrings.value.length).toBe(10)
      app.unmount()
    })
  })

  describe('computed purity (no side effects)', () => {
    it('filteredAndSortedStrings does not mutate regexError', async () => {
      const strings = makeSampleStrings()
      const [result, app] = withSetup(() => useStringFilter(strings))

      // Access the computed — should NOT cause side effects
      const _ = result.filteredAndSortedStrings.value
      expect(result.regexError.value).toBe(null)

      // Even with regex mode enabled and valid pattern
      result.useRegex.value = true
      result.searchQuery.value = 'Hello'
      await nextTick()

      const __ = result.filteredAndSortedStrings.value
      expect(result.regexError.value).toBe(null)
      app.unmount()
    })
  })

  describe('edge cases', () => {
    it('handles empty strings array', () => {
      const strings = ref([])
      const [result, app] = withSetup(() => useStringFilter(strings))
      expect(result.filteredAndSortedStrings.value).toEqual([])
      expect(result.totalPages.value).toBe(0)
      expect(result.paginatedStrings.value).toEqual([])
      app.unmount()
    })

    it('search with special characters in plain text mode', async () => {
      const strings = ref([
        { type: 'ASCII', size: 10, value: 'test.file()', offset: 0 },
        { type: 'ASCII', size: 5, value: 'other', offset: 10 }
      ])
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.searchQuery.value = 'test.file'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(1)
      expect(result.filteredAndSortedStrings.value[0].value).toBe('test.file()')
      app.unmount()
    })

    it('all filters combined', async () => {
      const strings = ref([
        { type: 'ASCII', size: 10, value: 'HelloWorld', offset: 0 },
        { type: 'ASCII', size: 5, value: 'Hello', offset: 10 },
        { type: 'UTF-8', size: 10, value: 'HelloUTF-8', offset: 20 },
        { type: 'ASCII', size: 4, value: 'Nope', offset: 30 }
      ])
      const [result, app] = withSetup(() => useStringFilter(strings))
      result.typeFilter.value = 'ASCII'
      result.searchQuery.value = 'hello'
      result.sortBy.value = 'offset'
      await nextTick()

      expect(result.filteredAndSortedStrings.value.length).toBe(2)
      expect(result.filteredAndSortedStrings.value[0].offset).toBe(0)
      expect(result.filteredAndSortedStrings.value[1].offset).toBe(10)
      app.unmount()
    })
  })
})
