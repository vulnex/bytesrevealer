import { ref, watch, onUnmounted } from 'vue'

/**
 * Composable for string extraction from binary data.
 * Handles worker lifecycle, sync fallback, and result processing.
 * @param {import('vue').Ref<Array|Uint8Array>} fileBytes - reactive file bytes ref
 */
export function useStringExtraction(fileBytes) {
  const strings = ref([])
  const isLoading = ref(false)
  const progress = ref(0)

  let worker = null

  function escapeString(str) {
    return str
      .replace(/[\x00-\x1F\x7F-\x9F]/g, (char) =>
        `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`
      )
  }

  function cleanupWorker() {
    if (worker) {
      worker.terminate()
      worker = null
    }
  }

  function createStringAnalysisWorker() {
    // Inline worker code for production compatibility
    const workerCode = `
      self.addEventListener('message', async (event) => {
        const { type, data, options } = event.data;

        if (type === 'analyze') {
          try {
            const results = await analyzeStrings(data, options);
            self.postMessage({ type: 'complete', results });
          } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
          }
        }
      });

      async function analyzeStrings(fileBytes, options = {}) {
        const {
          minLength = 4,
          maxResults = 10000,
          chunkSize = 1024 * 1024,
          encoding = 'all'
        } = options;

        const results = {
          ascii: [],
          utf16le: [],
          utf16be: [],
          totalFound: 0,
          processedBytes: 0
        };

        const totalBytes = fileBytes.length;
        let processedBytes = 0;

        for (let offset = 0; offset < totalBytes; offset += chunkSize) {
          const endOffset = Math.min(offset + chunkSize, totalBytes);
          const chunk = fileBytes.slice(offset, endOffset);

          if (encoding === 'ascii' || encoding === 'all') {
            extractAsciiStrings(chunk, offset, minLength, results.ascii, maxResults);
          }

          processedBytes = endOffset;

          if (processedBytes % (chunkSize * 10) === 0 || processedBytes === totalBytes) {
            self.postMessage({
              type: 'progress',
              progress: (processedBytes / totalBytes) * 100,
              found: results.ascii.length
            });
          }

          if (results.ascii.length >= maxResults) break;
        }

        results.totalFound = results.ascii.length;
        results.processedBytes = processedBytes;
        return results;
      }

      function extractAsciiStrings(bytes, baseOffset, minLength, results, maxResults) {
        let current = [];
        let startOffset = baseOffset;

        for (let i = 0; i < bytes.length && results.length < maxResults; i++) {
          const byte = bytes[i];

          if (byte >= 0x20 && byte <= 0x7E) {
            if (current.length === 0) {
              startOffset = baseOffset + i;
            }
            current.push(String.fromCharCode(byte));
          } else {
            if (current.length >= minLength) {
              results.push({
                offset: startOffset,
                length: current.length,
                value: current.join(''),
                encoding: 'ASCII'
              });
            }
            current = [];
          }
        }

        if (current.length >= minLength && results.length < maxResults) {
          results.push({
            offset: startOffset,
            length: current.length,
            value: current.join(''),
            encoding: 'ASCII'
          });
        }
      }
    `

    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const workerUrl = URL.createObjectURL(blob)
    const w = new Worker(workerUrl)

    // Clean up blob URL after worker is created
    setTimeout(() => URL.revokeObjectURL(workerUrl), 1000)

    return w
  }

  function processWorkerResults(results) {
    strings.value = []

    // Process ASCII strings
    if (results.ascii && results.ascii.length > 0) {
      results.ascii.forEach(str => {
        strings.value.push({
          type: 'ASCII',
          size: str.length,
          value: escapeString(str.value),
          offset: str.offset
        })
      })
    }

    // Process UTF-16 strings
    const utf16le = results.utf16le || []
    const utf16be = results.utf16be || []
    ;[...utf16le, ...utf16be].forEach(str => {
      strings.value.push({
        type: str.encoding,
        size: str.length,
        value: escapeString(str.value),
        offset: str.offset
      })
    })
  }

  async function extractStringsWithWorker() {
    isLoading.value = true
    progress.value = 0

    try {
      worker = createStringAnalysisWorker()

      worker.addEventListener('message', (event) => {
        const { type, results, progress: prog, error } = event.data

        if (type === 'progress') {
          progress.value = prog
        } else if (type === 'complete') {
          processWorkerResults(results)
          isLoading.value = false
          cleanupWorker()
        } else if (type === 'error') {
          isLoading.value = false
          cleanupWorker()
          // Fallback to synchronous extraction
          extractStringsSynchronous()
        }
      })

      // Start analysis
      worker.postMessage({
        type: 'analyze',
        data: fileBytes.value,
        options: {
          minLength: 4,
          maxResults: 10000,
          encoding: 'all'
        }
      })
    } catch (error) {
      isLoading.value = false
      // Fallback to synchronous extraction
      extractStringsSynchronous()
    }
  }

  function addString(str, type, offset = 0) {
    if (str.trim().length > 3) {  // Minimum 4 characters
      strings.value.push({
        type: type,
        size: str.length,
        value: escapeString(str),
        offset: offset
      })
    }
  }

  function extractStringsSynchronous() {
    strings.value = []
    let currentString = ''
    let currentType = 'ASCII'
    let startOffset = 0
    const bytes = fileBytes.value

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]

      if (byte >= 0x20 && byte <= 0x7E) {
        if (currentString.length === 0) {
          startOffset = i
        }
        currentString += String.fromCharCode(byte)
      } else {
        try {
          const utf8Bytes = bytes.slice(i, i + 4)
          const utf8String = new TextDecoder('utf-8').decode(new Uint8Array(utf8Bytes))

          if (utf8String.length > 0 && /^[\u0080-\uFFFF]/.test(utf8String)) {
            if (currentString) {
              addString(currentString, currentType, startOffset)
              currentString = ''
            }
            currentType = 'UTF-8'
            startOffset = i
            currentString = utf8String
            i += utf8String.length - 1
            continue
          }
        } catch {
          // Not a valid UTF-8 sequence
        }

        if (currentString) {
          addString(currentString, currentType, startOffset)
          currentString = ''
          currentType = 'ASCII'
        }
      }
    }

    if (currentString) {
      addString(currentString, currentType, startOffset)
    }
  }

  async function extractStrings() {
    strings.value = []
    if (!fileBytes.value.length) return

    const isLargeFile = fileBytes.value.length > 10 * 1024 * 1024

    if (isLargeFile) {
      await extractStringsWithWorker()
    } else {
      extractStringsSynchronous()
    }
  }

  watch(fileBytes, extractStrings, { immediate: true })

  onUnmounted(cleanupWorker)

  return {
    strings,
    isLoading,
    progress,
    extractStrings
  }
}
