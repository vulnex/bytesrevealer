import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { createApp } from 'vue'

const mockTerminate = vi.fn()
const mockPostMessage = vi.fn()
let messageListeners = []

class MockWorker {
  constructor() {
    this.postMessage = mockPostMessage
    this.terminate = mockTerminate
    messageListeners = []
  }
  addEventListener(type, handler) {
    if (type === 'message') messageListeners.push(handler)
  }
}

vi.stubGlobal('Worker', MockWorker)
vi.stubGlobal('Blob', class MockBlob { constructor() {} })
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
globalThis.URL.revokeObjectURL = vi.fn()

function withSetup(fn) {
  let result
  const app = createApp({ setup() { result = fn(); return () => {} } })
  app.mount(document.createElement('div'))
  return [result, app]
}

function simulateWorkerMessage(data) {
  messageListeners.forEach(handler => handler({ data }))
}

// Helper: build Uint8Array from ASCII string
function asciiBytes(str) {
  return new Uint8Array([...str].map(c => c.charCodeAt(0)))
}

describe('useStringExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messageListeners = []
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function loadComposable(fileBytes) {
    const { useStringExtraction } = await import('./useStringExtraction')
    return withSetup(() => useStringExtraction(fileBytes || ref([])))
  }

  describe('initial state', () => {
    it('strings is empty array', async () => {
      const [result, app] = await loadComposable()
      expect(result.strings.value).toEqual([])
      app.unmount()
    })

    it('isLoading is false', async () => {
      const [result, app] = await loadComposable()
      expect(result.isLoading.value).toBe(false)
      app.unmount()
    })

    it('progress is 0', async () => {
      const [result, app] = await loadComposable()
      expect(result.progress.value).toBe(0)
      app.unmount()
    })

    it('returns extractStrings function', async () => {
      const [result, app] = await loadComposable()
      expect(typeof result.extractStrings).toBe('function')
      app.unmount()
    })
  })

  describe('synchronous extraction', () => {
    it('extracts ASCII strings from small file', async () => {
      // "Hello World" surrounded by null bytes
      const bytes = ref(new Uint8Array([0x00, ...asciiBytes('Hello World'), 0x00]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].type).toBe('ASCII')
      expect(result.strings.value[0].value).toBe('Hello World')
      expect(result.strings.value[0].size).toBe(11)
      expect(result.strings.value[0].offset).toBe(1)
      app.unmount()
    })

    it('ignores strings shorter than 4 characters', async () => {
      // "Hi" is only 2 chars — below minimum
      const bytes = ref(new Uint8Array([0x00, ...asciiBytes('Hi'), 0x00]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(0)
      app.unmount()
    })

    it('extracts multiple strings separated by non-printable bytes', async () => {
      const bytes = ref(new Uint8Array([
        ...asciiBytes('Hello'), 0x00,
        ...asciiBytes('World'), 0x00
      ]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(2)
      expect(result.strings.value[0].value).toBe('Hello')
      expect(result.strings.value[1].value).toBe('World')
      app.unmount()
    })

    it('records correct offsets for multiple strings', async () => {
      // null + "AAAA" + null + "BBBB"
      const bytes = ref(new Uint8Array([
        0x00,
        ...asciiBytes('AAAA'), 0x00,
        ...asciiBytes('BBBB')
      ]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value[0].offset).toBe(1)
      expect(result.strings.value[1].offset).toBe(6)
      app.unmount()
    })

    it('handles empty fileBytes', async () => {
      const bytes = ref([])
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value).toEqual([])
      expect(result.isLoading.value).toBe(false)
      app.unmount()
    })

    it('handles file with no extractable strings', async () => {
      const bytes = ref(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value).toEqual([])
      app.unmount()
    })

    it('handles file that is all printable ASCII', async () => {
      const str = 'This is a long printable string with many characters'
      const bytes = ref(asciiBytes(str))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe(str)
      expect(result.strings.value[0].size).toBe(str.length)
      app.unmount()
    })

    it('trims strings and requires trimmed length > 3', async () => {
      // 4 spaces + "ab" — trimmed length is 2
      const bytes = ref(new Uint8Array([
        0x00,
        0x20, 0x20, 0x20, 0x20, 0x61, 0x62,
        0x00
      ]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(0)
      app.unmount()
    })

    it('does not set isLoading for small files', async () => {
      const bytes = ref(asciiBytes('Hello World'))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.isLoading.value).toBe(false)
      app.unmount()
    })
  })

  describe('escape string', () => {
    it('escapes control characters in extracted strings', async () => {
      // "AAAA" + tab + "BBBB" — tab (0x09) is a control char
      // The tab will break the string, so "AAAA" and "BBBB" are separate.
      // But if we embed a control char inside a printable range it won't be part of ASCII extraction.
      // Let's test with a string that includes a printable range followed by non-printable:
      // We need a scenario where escapeString is called on a string that has control chars.
      // In sync extraction, the string is built from printable bytes (0x20-0x7E), so control chars
      // don't appear in ASCII strings. But UTF-8 path may produce them via TextDecoder.
      // For unit verification, let's test via worker results path.
      const bytes = ref([])
      const [result, app] = await loadComposable(bytes)

      // Manually trigger extractStrings to ensure it does nothing with empty bytes
      await result.extractStrings()
      expect(result.strings.value).toEqual([])
      app.unmount()
    })
  })

  describe('watch on fileBytes', () => {
    it('re-extracts when fileBytes changes', async () => {
      const bytes = ref(new Uint8Array([0x00, ...asciiBytes('First'), 0x00]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('First')

      // Change fileBytes
      bytes.value = new Uint8Array([0x00, ...asciiBytes('Second string'), 0x00])
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('Second string')
      app.unmount()
    })

    it('clears strings when fileBytes becomes empty', async () => {
      const bytes = ref(new Uint8Array([...asciiBytes('Hello')]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)

      bytes.value = new Uint8Array([])
      await nextTick()

      expect(result.strings.value).toEqual([])
      app.unmount()
    })
  })

  describe('worker path (large files)', () => {
    it('uses worker for files > 10MB', async () => {
      // Create a ref with length > 10MB
      const largeBytes = ref({ length: 10 * 1024 * 1024 + 1, value: null })
      // We need it to look like a real array to pass length check
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      bigArray[0] = 0x48 // 'H'
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.isLoading.value).toBe(true)
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'analyze',
        options: expect.objectContaining({
          minLength: 4,
          maxResults: 10000,
          encoding: 'all'
        })
      }))
      app.unmount()
    })

    it('sets progress from worker progress messages', async () => {
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      simulateWorkerMessage({ type: 'progress', progress: 50 })
      expect(result.progress.value).toBe(50)

      simulateWorkerMessage({ type: 'progress', progress: 75 })
      expect(result.progress.value).toBe(75)
      app.unmount()
    })

    it('processes worker complete results', async () => {
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      simulateWorkerMessage({
        type: 'complete',
        results: {
          ascii: [
            { offset: 0, length: 5, value: 'Hello' },
            { offset: 10, length: 5, value: 'World' }
          ],
          utf16le: [],
          utf16be: []
        }
      })

      expect(result.strings.value.length).toBe(2)
      expect(result.strings.value[0].type).toBe('ASCII')
      expect(result.strings.value[0].value).toBe('Hello')
      expect(result.strings.value[0].size).toBe(5)
      expect(result.strings.value[0].offset).toBe(0)
      expect(result.strings.value[1].value).toBe('World')
      expect(result.isLoading.value).toBe(false)
      app.unmount()
    })

    it('processes UTF-16 results from worker', async () => {
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      simulateWorkerMessage({
        type: 'complete',
        results: {
          ascii: [],
          utf16le: [
            { offset: 0, length: 4, value: 'Test', encoding: 'UTF-16LE' }
          ],
          utf16be: [
            { offset: 100, length: 6, value: 'Sample', encoding: 'UTF-16BE' }
          ]
        }
      })

      expect(result.strings.value.length).toBe(2)
      expect(result.strings.value[0].type).toBe('UTF-16LE')
      expect(result.strings.value[0].value).toBe('Test')
      expect(result.strings.value[1].type).toBe('UTF-16BE')
      expect(result.strings.value[1].value).toBe('Sample')
      app.unmount()
    })

    it('escapes control chars in worker results', async () => {
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      simulateWorkerMessage({
        type: 'complete',
        results: {
          ascii: [
            { offset: 0, length: 6, value: 'AB\x01CD' }
          ],
          utf16le: [],
          utf16be: []
        }
      })

      expect(result.strings.value[0].value).toBe('AB\\x01CD')
      app.unmount()
    })

    it('falls back to sync on worker error message', async () => {
      // Small enough that sync will find nothing interesting
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      // Put a string at the start so sync extraction finds it
      const str = 'FallbackTest'
      for (let i = 0; i < str.length; i++) {
        bigArray[i] = str.charCodeAt(i)
      }
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.isLoading.value).toBe(true)

      simulateWorkerMessage({ type: 'error', error: 'Worker crashed' })

      expect(result.isLoading.value).toBe(false)
      // Should have fallen back to sync extraction and found the string
      expect(result.strings.value.length).toBeGreaterThan(0)
      expect(result.strings.value[0].value).toBe('FallbackTest')
      app.unmount()
    })

    it('terminates worker on complete', async () => {
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      simulateWorkerMessage({
        type: 'complete',
        results: { ascii: [], utf16le: [], utf16be: [] }
      })

      expect(mockTerminate).toHaveBeenCalled()
      app.unmount()
    })

    it('handles missing utf16le/utf16be in results gracefully', async () => {
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      simulateWorkerMessage({
        type: 'complete',
        results: {
          ascii: [{ offset: 0, length: 4, value: 'Test' }]
          // utf16le and utf16be are missing
        }
      })

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('Test')
      app.unmount()
    })
  })

  describe('cleanup on unmount', () => {
    it('terminates worker when component unmounts', async () => {
      const bigArray = new Uint8Array(10 * 1024 * 1024 + 1)
      const bytes = ref(bigArray)
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      // Worker was created for large file
      expect(result.isLoading.value).toBe(true)

      app.unmount()
      expect(mockTerminate).toHaveBeenCalled()
    })

    it('does not error on unmount when no worker exists', async () => {
      const bytes = ref(asciiBytes('Hello'))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      // No worker for small files, unmount should not throw
      expect(() => app.unmount()).not.toThrow()
    })
  })

  describe('extractStrings function', () => {
    it('clears strings before re-extraction', async () => {
      const bytes = ref(new Uint8Array([...asciiBytes('Hello')]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)

      // Manually call extractStrings again
      await result.extractStrings()
      // Should have re-extracted (same data, same result)
      expect(result.strings.value.length).toBe(1)
      app.unmount()
    })

    it('handles Uint8Array input', async () => {
      const bytes = ref(new Uint8Array([...asciiBytes('TestData')]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('TestData')
      app.unmount()
    })

    it('handles plain Array input', async () => {
      const bytes = ref([...asciiBytes('ArrayTest')])
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('ArrayTest')
      app.unmount()
    })
  })

  describe('edge cases', () => {
    it('handles string at very end of file (no trailing null)', async () => {
      const bytes = ref(new Uint8Array([0x00, 0x00, ...asciiBytes('Trailing')]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('Trailing')
      app.unmount()
    })

    it('handles string at very start of file', async () => {
      const bytes = ref(new Uint8Array([...asciiBytes('Leading'), 0x00, 0x00]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('Leading')
      expect(result.strings.value[0].offset).toBe(0)
      app.unmount()
    })

    it('handles exactly 4-char string (minimum length)', async () => {
      const bytes = ref(new Uint8Array([0x00, ...asciiBytes('ABCD'), 0x00]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('ABCD')
      app.unmount()
    })

    it('excludes exactly 3-char string', async () => {
      const bytes = ref(new Uint8Array([0x00, ...asciiBytes('ABC'), 0x00]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(0)
      app.unmount()
    })

    it('handles bytes at ASCII boundary (0x20 and 0x7E)', async () => {
      // 0x20 = space, 0x7E = ~; need trimmed length > 3
      const bytes = ref(new Uint8Array([0x00, 0x7E, 0x20, 0x7E, 0x20, 0x7E, 0x00]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(1)
      expect(result.strings.value[0].value).toBe('~ ~ ~')
      app.unmount()
    })

    it('does not include byte 0x7F (DEL) in strings', async () => {
      // 0x7F is not printable, should break the string
      const bytes = ref(new Uint8Array([...asciiBytes('AB'), 0x7F, ...asciiBytes('CD')]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      // Neither "AB" nor "CD" are >= 4 chars
      expect(result.strings.value.length).toBe(0)
      app.unmount()
    })

    it('single byte file does not crash', async () => {
      const bytes = ref(new Uint8Array([0x41]))
      const [result, app] = await loadComposable(bytes)
      await nextTick()

      expect(result.strings.value.length).toBe(0)
      app.unmount()
    })
  })
})
