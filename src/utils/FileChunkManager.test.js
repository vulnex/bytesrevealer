import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// The module under test exports a singleton whose constructor calls
// initIndexedDB(). In the happy-dom test environment indexedDB may not be
// available, so the constructor gracefully sets this.db = null. We import the
// singleton first, then provide a lightweight mock DB object directly on the
// instance for tests that need IndexedDB behaviour.
// ---------------------------------------------------------------------------

import fileChunkManager from './FileChunkManager.js'

// ---------------------------------------------------------------------------
// Helpers for a mock IDB
// ---------------------------------------------------------------------------

function createMockIDBRequest(result = undefined) {
  const req = {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
    _resolve(value) {
      this.result = value
      if (this.onsuccess) this.onsuccess({ target: this })
    },
    _reject(err) {
      this.error = err
      if (this.onerror) this.onerror({ target: this })
    }
  }
  return req
}

function createMockObjectStore() {
  const data = new Map()
  return {
    _data: data,
    put(value) {
      const req = createMockIDBRequest()
      data.set(value.id, value)
      queueMicrotask(() => req._resolve())
      return req
    },
    get(key) {
      const req = createMockIDBRequest()
      queueMicrotask(() => req._resolve(data.get(key) ?? null))
      return req
    },
    delete(key) {
      const req = createMockIDBRequest()
      data.delete(key)
      queueMicrotask(() => req._resolve())
      return req
    },
    index() {
      return {
        openCursor() {
          const req = createMockIDBRequest()
          Object.defineProperty(req, 'onsuccess', {
            set(fn) {
              req._onsuccessFn = fn
              queueMicrotask(() => fn({ target: { result: null } }))
            },
            get() {
              return req._onsuccessFn
            }
          })
          return req
        }
      }
    },
    createIndex() {}
  }
}

function createMockDB() {
  const chunksStore = createMockObjectStore()
  const metadataStore = createMockObjectStore()
  return {
    _stores: { chunks: chunksStore, metadata: metadataStore },
    objectStoreNames: { contains: (name) => name === 'chunks' || name === 'metadata' },
    transaction(_storeNames) {
      return {
        objectStore: (name) => this._stores[name]
      }
    },
    createObjectStore() {
      return { createIndex() {} }
    }
  }
}

// Ensure IDBKeyRange is available for clear()
if (typeof globalThis.IDBKeyRange === 'undefined') {
  globalThis.IDBKeyRange = { only: (v) => v }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Uint8Array of `size` bytes filled with an incrementing pattern. */
function makeBytes(size) {
  const arr = new Uint8Array(size)
  for (let i = 0; i < size; i++) arr[i] = i % 256
  return arr
}

/** Create a mock File with the given bytes. */
function makeFile(bytes, name = 'test.bin') {
  return new File([bytes], name, { type: 'application/octet-stream' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileChunkManager', () => {
  let mockDB

  beforeEach(async () => {
    // Provide a fresh mock DB so tests that touch IndexedDB paths work.
    mockDB = createMockDB()
    fileChunkManager.db = mockDB

    await fileChunkManager.clear()
    // Allow any pending microtasks to settle
    await new Promise((r) => setTimeout(r, 10))
  })

  // -----------------------------------------------------------------------
  // Constructor / default state
  // -----------------------------------------------------------------------
  describe('constructor defaults', () => {
    it('has expected CHUNK_SIZE', () => {
      expect(fileChunkManager.CHUNK_SIZE).toBe(10 * 1024 * 1024)
    })

    it('has expected MAX_MEMORY_CHUNKS', () => {
      expect(fileChunkManager.MAX_MEMORY_CHUNKS).toBe(10)
    })

    it('has expected LARGE_FILE_THRESHOLD', () => {
      expect(fileChunkManager.LARGE_FILE_THRESHOLD).toBe(50 * 1024 * 1024)
    })

    it('starts with empty chunks and chunkMetadata maps', () => {
      expect(fileChunkManager.chunks.size).toBe(0)
      expect(fileChunkManager.chunkMetadata.size).toBe(0)
    })

    it('starts with totalSize 0 and totalChunks 0', () => {
      expect(fileChunkManager.totalSize).toBe(0)
      expect(fileChunkManager.totalChunks).toBe(0)
    })

    it('isLargeFile defaults to false', () => {
      expect(fileChunkManager.isLargeFile).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // formatSize
  // -----------------------------------------------------------------------
  describe('formatSize()', () => {
    it('formats bytes correctly', () => {
      expect(fileChunkManager.formatSize(0)).toBe('0.00 B')
      expect(fileChunkManager.formatSize(512)).toBe('512.00 B')
    })

    it('formats kilobytes correctly', () => {
      expect(fileChunkManager.formatSize(1024)).toBe('1.00 KB')
      expect(fileChunkManager.formatSize(2560)).toBe('2.50 KB')
    })

    it('formats megabytes correctly', () => {
      expect(fileChunkManager.formatSize(1024 * 1024)).toBe('1.00 MB')
      expect(fileChunkManager.formatSize(10.5 * 1024 * 1024)).toBe('10.50 MB')
    })

    it('formats gigabytes correctly', () => {
      expect(fileChunkManager.formatSize(1024 * 1024 * 1024)).toBe('1.00 GB')
    })

    it('clamps to GB for very large values', () => {
      const result = fileChunkManager.formatSize(2 * 1024 * 1024 * 1024)
      expect(result).toBe('2.00 GB')
    })
  })

  // -----------------------------------------------------------------------
  // calculateCacheHitRate
  // -----------------------------------------------------------------------
  describe('calculateCacheHitRate()', () => {
    it('returns 0 (stub)', () => {
      expect(fileChunkManager.calculateCacheHitRate()).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // getStats
  // -----------------------------------------------------------------------
  describe('getStats()', () => {
    it('returns correct stats after clear', () => {
      const stats = fileChunkManager.getStats()
      expect(stats).toEqual({
        totalSize: 0,
        totalChunks: 0,
        chunksInMemory: 0,
        memoryUsage: 0,
        isLargeFile: false,
        cacheHitRate: 0
      })
    })

    it('reflects stored chunks in memory stats', async () => {
      fileChunkManager.fileId = 'test_123'
      fileChunkManager.totalSize = 100
      fileChunkManager.totalChunks = 1
      fileChunkManager.isLargeFile = false

      const data = new Uint8Array(100)
      await fileChunkManager.storeChunk(0, data)

      const stats = fileChunkManager.getStats()
      expect(stats.chunksInMemory).toBe(1)
      expect(stats.memoryUsage).toBe(100)
    })
  })

  // -----------------------------------------------------------------------
  // initialize -- Uint8Array (small file)
  // -----------------------------------------------------------------------
  describe('initialize() with small Uint8Array', () => {
    it('returns the same array reference for small files', async () => {
      const data = makeBytes(1024)
      const result = await fileChunkManager.initialize(data)
      expect(result).toBe(data)
    })

    it('sets totalSize correctly', async () => {
      const data = makeBytes(500)
      await fileChunkManager.initialize(data)
      expect(fileChunkManager.totalSize).toBe(500)
    })

    it('does not mark isLargeFile', async () => {
      const data = makeBytes(1024)
      await fileChunkManager.initialize(data)
      expect(fileChunkManager.isLargeFile).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // initialize -- Uint8Array (large file, > LARGE_FILE_THRESHOLD)
  // -----------------------------------------------------------------------
  describe('initialize() with large Uint8Array', () => {
    let origThreshold
    let origChunkSize

    beforeEach(() => {
      origThreshold = fileChunkManager.LARGE_FILE_THRESHOLD
      origChunkSize = fileChunkManager.CHUNK_SIZE
      fileChunkManager.LARGE_FILE_THRESHOLD = 100 // 100 bytes
      fileChunkManager.CHUNK_SIZE = 50 // 50-byte chunks
    })

    afterEach(() => {
      fileChunkManager.LARGE_FILE_THRESHOLD = origThreshold
      fileChunkManager.CHUNK_SIZE = origChunkSize
    })

    it('marks file as large when above threshold', async () => {
      const data = makeBytes(200)
      await fileChunkManager.initialize(data)
      expect(fileChunkManager.isLargeFile).toBe(true)
    })

    it('computes correct totalChunks', async () => {
      const data = makeBytes(200)
      await fileChunkManager.initialize(data)
      // 200 / 50 = 4 chunks
      expect(fileChunkManager.totalChunks).toBe(4)
    })

    it('computes totalChunks correctly for non-evenly-divisible sizes', async () => {
      const data = makeBytes(175)
      await fileChunkManager.initialize(data)
      // ceil(175 / 50) = 4
      expect(fileChunkManager.totalChunks).toBe(4)
    })

    it('stores chunks in memory', async () => {
      const data = makeBytes(200)
      await fileChunkManager.initialize(data)
      expect(fileChunkManager.chunks.size).toBeGreaterThan(0)
    })

    it('stores chunk metadata', async () => {
      const data = makeBytes(200)
      await fileChunkManager.initialize(data)
      expect(fileChunkManager.chunkMetadata.size).toBe(4)
    })

    it('returns the original array', async () => {
      const data = makeBytes(200)
      const result = await fileChunkManager.initialize(data)
      expect(result).toBe(data)
    })

    it('sets fileId with array_ prefix', async () => {
      const data = makeBytes(200)
      await fileChunkManager.initialize(data)
      expect(fileChunkManager.fileId).toMatch(/^array_/)
    })
  })

  // -----------------------------------------------------------------------
  // initialize -- File/Blob (small)
  // -----------------------------------------------------------------------
  describe('initialize() with small File', () => {
    it('returns a Uint8Array for small File', async () => {
      const bytes = makeBytes(64)
      const file = makeFile(bytes)
      const result = await fileChunkManager.initialize(file)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(64)
    })

    it('preserves file contents', async () => {
      const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
      const file = makeFile(bytes, 'magic.bin')
      const result = await fileChunkManager.initialize(file)
      expect(result[0]).toBe(0xde)
      expect(result[1]).toBe(0xad)
      expect(result[2]).toBe(0xbe)
      expect(result[3]).toBe(0xef)
    })

    it('stores fileName from File object', async () => {
      const bytes = makeBytes(32)
      const file = makeFile(bytes, 'hello.dat')
      await fileChunkManager.initialize(file)
      expect(fileChunkManager.fileName).toBe('hello.dat')
    })
  })

  // -----------------------------------------------------------------------
  // initialize -- File/Blob (large)
  // -----------------------------------------------------------------------
  describe('initialize() with large File', () => {
    let origThreshold
    let origChunkSize

    beforeEach(() => {
      origThreshold = fileChunkManager.LARGE_FILE_THRESHOLD
      origChunkSize = fileChunkManager.CHUNK_SIZE
      fileChunkManager.LARGE_FILE_THRESHOLD = 50
      fileChunkManager.CHUNK_SIZE = 30
    })

    afterEach(() => {
      fileChunkManager.LARGE_FILE_THRESHOLD = origThreshold
      fileChunkManager.CHUNK_SIZE = origChunkSize
    })

    it('returns a Uint8Array with isChunked flag', async () => {
      const bytes = makeBytes(100)
      const file = makeFile(bytes, 'big.bin')
      const result = await fileChunkManager.initialize(file)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.isChunked).toBe(true)
    })

    it('attaches chunkManager reference', async () => {
      const bytes = makeBytes(100)
      const file = makeFile(bytes, 'big.bin')
      const result = await fileChunkManager.initialize(file)
      expect(result.chunkManager).toBe(fileChunkManager)
    })

    it('marks isLargeFile true', async () => {
      const bytes = makeBytes(100)
      const file = makeFile(bytes, 'big.bin')
      await fileChunkManager.initialize(file)
      expect(fileChunkManager.isLargeFile).toBe(true)
    })

    it('computes totalChunks correctly', async () => {
      const bytes = makeBytes(100)
      const file = makeFile(bytes, 'big.bin')
      await fileChunkManager.initialize(file)
      // ceil(100/30) = 4
      expect(fileChunkManager.totalChunks).toBe(4)
    })

    it('sets fileId with file_ prefix', async () => {
      const bytes = makeBytes(100)
      const file = makeFile(bytes, 'big.bin')
      await fileChunkManager.initialize(file)
      expect(fileChunkManager.fileId).toMatch(/^file_big\.bin_/)
    })
  })

  // -----------------------------------------------------------------------
  // initialize -- invalid input
  // -----------------------------------------------------------------------
  describe('initialize() with invalid input', () => {
    it('throws for a string', async () => {
      await expect(fileChunkManager.initialize('not a file')).rejects.toThrow('Invalid file type')
    })

    it('throws for a number', async () => {
      await expect(fileChunkManager.initialize(42)).rejects.toThrow('Invalid file type')
    })

    it('throws for null', async () => {
      await expect(fileChunkManager.initialize(null)).rejects.toThrow()
    })

    it('throws for undefined', async () => {
      await expect(fileChunkManager.initialize(undefined)).rejects.toThrow()
    })
  })

  // -----------------------------------------------------------------------
  // initialize -- empty inputs
  // -----------------------------------------------------------------------
  describe('initialize() with empty data', () => {
    it('handles empty Uint8Array', async () => {
      const data = new Uint8Array(0)
      const result = await fileChunkManager.initialize(data)
      expect(result).toBe(data)
      expect(fileChunkManager.totalSize).toBe(0)
      expect(fileChunkManager.isLargeFile).toBe(false)
    })

    it('handles single-byte Uint8Array', async () => {
      const data = new Uint8Array([0xff])
      const result = await fileChunkManager.initialize(data)
      expect(result).toBe(data)
      expect(fileChunkManager.totalSize).toBe(1)
    })

    it('handles empty File', async () => {
      const file = new File([], 'empty.bin')
      const result = await fileChunkManager.initialize(file)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // storeChunk
  // -----------------------------------------------------------------------
  describe('storeChunk()', () => {
    beforeEach(() => {
      fileChunkManager.fileId = 'test_store'
    })

    it('stores chunk in memory map', async () => {
      const chunk = new Uint8Array([1, 2, 3])
      await fileChunkManager.storeChunk(0, chunk)
      expect(fileChunkManager.chunks.has(0)).toBe(true)
      expect(fileChunkManager.chunks.get(0)).toBe(chunk)
    })

    it('stores metadata with correct fields', async () => {
      const chunk = new Uint8Array(10)
      await fileChunkManager.storeChunk(5, chunk)
      const meta = fileChunkManager.chunkMetadata.get(5)
      expect(meta).toBeDefined()
      expect(meta.size).toBe(10)
      expect(meta.loaded).toBe(true)
      expect(meta.lastAccess).toBeGreaterThan(0)
    })

    it('evicts oldest chunk when exceeding MAX_MEMORY_CHUNKS', async () => {
      fileChunkManager.MAX_MEMORY_CHUNKS = 3

      await fileChunkManager.storeChunk(0, new Uint8Array([0]))
      await fileChunkManager.storeChunk(1, new Uint8Array([1]))
      await fileChunkManager.storeChunk(2, new Uint8Array([2]))

      // This should evict chunk 0
      await fileChunkManager.storeChunk(3, new Uint8Array([3]))
      expect(fileChunkManager.chunks.has(0)).toBe(false)
      expect(fileChunkManager.chunks.has(3)).toBe(true)
      expect(fileChunkManager.chunks.size).toBe(3)

      // Restore
      fileChunkManager.MAX_MEMORY_CHUNKS = 10
    })

    it('stores to IndexedDB when db is available and isLargeFile', async () => {
      fileChunkManager.isLargeFile = true
      const chunk = new Uint8Array([0xaa, 0xbb])
      await fileChunkManager.storeChunk(0, chunk)

      // Allow the async IDB put to settle
      await new Promise((r) => setTimeout(r, 20))

      const stored = mockDB._stores.chunks._data.get('test_store_0')
      expect(stored).toBeDefined()
      expect(stored.fileId).toBe('test_store')
      expect(stored.chunkIndex).toBe(0)
    })

    it('does not store to IndexedDB when isLargeFile is false', async () => {
      fileChunkManager.isLargeFile = false
      const chunk = new Uint8Array([1, 2])
      await fileChunkManager.storeChunk(0, chunk)

      await new Promise((r) => setTimeout(r, 20))

      const stored = mockDB._stores.chunks._data.get('test_store_0')
      expect(stored).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // getChunk
  // -----------------------------------------------------------------------
  describe('getChunk()', () => {
    let origThreshold, origChunkSize

    beforeEach(async () => {
      origThreshold = fileChunkManager.LARGE_FILE_THRESHOLD
      origChunkSize = fileChunkManager.CHUNK_SIZE
      fileChunkManager.LARGE_FILE_THRESHOLD = 50
      fileChunkManager.CHUNK_SIZE = 25

      const data = makeBytes(100)
      await fileChunkManager.initialize(data)
    })

    afterEach(() => {
      fileChunkManager.LARGE_FILE_THRESHOLD = origThreshold
      fileChunkManager.CHUNK_SIZE = origChunkSize
    })

    it('returns null for negative index', async () => {
      expect(await fileChunkManager.getChunk(-1)).toBeNull()
    })

    it('returns null for index >= totalChunks', async () => {
      expect(await fileChunkManager.getChunk(100)).toBeNull()
    })

    it('returns chunk from memory cache', async () => {
      const chunk = await fileChunkManager.getChunk(0)
      expect(chunk).toBeInstanceOf(Uint8Array)
      expect(chunk.byteLength).toBe(25)
    })

    it('returns correct data for each chunk', async () => {
      const chunk0 = await fileChunkManager.getChunk(0)
      const chunk1 = await fileChunkManager.getChunk(1)

      // chunk0 should have bytes 0-24
      expect(chunk0[0]).toBe(0)
      expect(chunk0[24]).toBe(24)

      // chunk1 should have bytes 25-49
      expect(chunk1[0]).toBe(25)
      expect(chunk1[24]).toBe(49)
    })
  })

  // -----------------------------------------------------------------------
  // getChunk -- IndexedDB fallback
  // -----------------------------------------------------------------------
  describe('getChunk() IndexedDB fallback', () => {
    it('falls back to IndexedDB when chunk not in memory', async () => {
      fileChunkManager.fileId = 'idb_test'
      fileChunkManager.totalChunks = 2
      fileChunkManager.isLargeFile = true
      fileChunkManager.totalSize = 20

      // Put data directly into the mock IDB store
      const chunkData = new Uint8Array([10, 20, 30])
      mockDB._stores.chunks._data.set('idb_test_0', {
        id: 'idb_test_0',
        fileId: 'idb_test',
        chunkIndex: 0,
        data: chunkData.buffer
      })

      // Clear memory cache to force IDB lookup
      fileChunkManager.chunks.clear()

      const result = await fileChunkManager.getChunk(0)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result[0]).toBe(10)
      expect(result[1]).toBe(20)
      expect(result[2]).toBe(30)
    })

    it('caches chunk in memory after IDB retrieval', async () => {
      fileChunkManager.fileId = 'idb_cache'
      fileChunkManager.totalChunks = 1
      fileChunkManager.isLargeFile = true

      const chunkData = new Uint8Array([42])
      mockDB._stores.chunks._data.set('idb_cache_0', {
        id: 'idb_cache_0',
        fileId: 'idb_cache',
        chunkIndex: 0,
        data: chunkData.buffer
      })

      fileChunkManager.chunks.clear()
      await fileChunkManager.getChunk(0)

      // Should now be in memory cache
      expect(fileChunkManager.chunks.has(0)).toBe(true)
    })

    it('returns null when chunk not in memory, IDB, or file reference', async () => {
      fileChunkManager.fileId = 'missing_test'
      fileChunkManager.totalChunks = 5
      fileChunkManager.isLargeFile = false
      fileChunkManager.fileReference = null
      fileChunkManager.chunks.clear()

      const result = await fileChunkManager.getChunk(0)
      expect(result).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // loadFileChunk
  // -----------------------------------------------------------------------
  describe('loadFileChunk()', () => {
    it('returns null when no fileReference', async () => {
      fileChunkManager.fileReference = null
      const result = await fileChunkManager.loadFileChunk(0)
      expect(result).toBeNull()
    })

    it('loads chunk from fileReference when available', async () => {
      const data = makeBytes(100)
      const blob = new Blob([data])
      fileChunkManager.fileReference = blob
      fileChunkManager.totalSize = 100
      fileChunkManager.CHUNK_SIZE = 50
      fileChunkManager.fileId = 'load_test'

      const chunk = await fileChunkManager.loadFileChunk(0)
      expect(chunk).toBeInstanceOf(Uint8Array)
      expect(chunk.byteLength).toBe(50)
    })

    it('loads last chunk with correct size when not evenly divisible', async () => {
      const data = makeBytes(75)
      const blob = new Blob([data])
      fileChunkManager.fileReference = blob
      fileChunkManager.totalSize = 75
      fileChunkManager.CHUNK_SIZE = 50
      fileChunkManager.fileId = 'load_test2'

      const chunk = await fileChunkManager.loadFileChunk(1)
      expect(chunk.byteLength).toBe(25)
    })

    it('stores loaded chunk in memory cache', async () => {
      const data = makeBytes(50)
      const blob = new Blob([data])
      fileChunkManager.fileReference = blob
      fileChunkManager.totalSize = 50
      fileChunkManager.CHUNK_SIZE = 50
      fileChunkManager.fileId = 'load_store'

      await fileChunkManager.loadFileChunk(0)
      expect(fileChunkManager.chunks.has(0)).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // getRange
  // -----------------------------------------------------------------------
  describe('getRange()', () => {
    let origThreshold, origChunkSize

    beforeEach(async () => {
      origThreshold = fileChunkManager.LARGE_FILE_THRESHOLD
      origChunkSize = fileChunkManager.CHUNK_SIZE
      fileChunkManager.LARGE_FILE_THRESHOLD = 50
      fileChunkManager.CHUNK_SIZE = 25

      const data = makeBytes(100)
      await fileChunkManager.initialize(data)
    })

    afterEach(() => {
      fileChunkManager.LARGE_FILE_THRESHOLD = origThreshold
      fileChunkManager.CHUNK_SIZE = origChunkSize
    })

    it('returns null for small file', async () => {
      fileChunkManager.isLargeFile = false
      const result = await fileChunkManager.getRange(0, 10)
      expect(result).toBeNull()
    })

    it('returns correct byte range within a single chunk', async () => {
      const result = await fileChunkManager.getRange(5, 15)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(10)
      for (let i = 0; i < 10; i++) {
        expect(result[i]).toBe(5 + i)
      }
    })

    it('returns correct byte range spanning two chunks', async () => {
      // Chunk 0: bytes 0-24, Chunk 1: bytes 25-49
      const result = await fileChunkManager.getRange(20, 35)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(15)
      for (let i = 0; i < 15; i++) {
        expect(result[i]).toBe(20 + i)
      }
    })

    it('returns correct byte range spanning multiple chunks', async () => {
      // Range spans chunks 0, 1, 2
      const result = await fileChunkManager.getRange(10, 60)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(50)
      for (let i = 0; i < 50; i++) {
        expect(result[i]).toBe(10 + i)
      }
    })

    it('returns correct data for range at chunk boundaries', async () => {
      // Exactly chunk boundary: 25 to 50
      const result = await fileChunkManager.getRange(25, 50)
      expect(result.byteLength).toBe(25)
      expect(result[0]).toBe(25)
      expect(result[24]).toBe(49)
    })

    it('handles range starting at 0', async () => {
      const result = await fileChunkManager.getRange(0, 25)
      expect(result.byteLength).toBe(25)
      expect(result[0]).toBe(0)
    })

    it('handles range at end of file', async () => {
      const result = await fileChunkManager.getRange(90, 100)
      expect(result.byteLength).toBe(10)
      expect(result[0]).toBe(90)
      expect(result[9]).toBe(99)
    })

    it('returns empty array for zero-length range', async () => {
      const result = await fileChunkManager.getRange(10, 10)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // createProxyArray
  // -----------------------------------------------------------------------
  describe('createProxyArray()', () => {
    it('returns the same Uint8Array reference when given Uint8Array', () => {
      const data = makeBytes(100)
      fileChunkManager.totalSize = 100
      const proxy = fileChunkManager.createProxyArray(data)
      expect(proxy.buffer).toBe(data.buffer)
    })

    it('returns empty Uint8Array when given non-Uint8Array', () => {
      fileChunkManager.totalSize = 0
      const proxy = fileChunkManager.createProxyArray(null)
      expect(proxy).toBeInstanceOf(Uint8Array)
      expect(proxy.byteLength).toBe(0)
    })

    it('returns empty Uint8Array when given undefined', () => {
      fileChunkManager.totalSize = 0
      const proxy = fileChunkManager.createProxyArray(undefined)
      expect(proxy).toBeInstanceOf(Uint8Array)
      expect(proxy.byteLength).toBe(0)
    })

    it('sets isChunked flag', () => {
      const data = makeBytes(50)
      fileChunkManager.totalSize = 50
      const proxy = fileChunkManager.createProxyArray(data)
      expect(proxy.isChunked).toBe(true)
    })

    it('sets chunkManager reference', () => {
      const data = makeBytes(50)
      fileChunkManager.totalSize = 50
      const proxy = fileChunkManager.createProxyArray(data)
      expect(proxy.chunkManager).toBe(fileChunkManager)
    })

    it('overridden slice works synchronously for small ranges', () => {
      const data = makeBytes(100)
      fileChunkManager.totalSize = 100
      fileChunkManager.CHUNK_SIZE = 50
      const proxy = fileChunkManager.createProxyArray(data)

      // Small slice (< CHUNK_SIZE * 2 = 100) should be synchronous
      const sliced = proxy.slice(10, 20)
      expect(sliced).toBeInstanceOf(Uint8Array)
      expect(sliced.byteLength).toBe(10)
      for (let i = 0; i < 10; i++) {
        expect(sliced[i]).toBe(10 + i)
      }
    })

    it('overridden slice returns promise for large ranges', () => {
      const data = makeBytes(500)
      fileChunkManager.totalSize = 500
      fileChunkManager.CHUNK_SIZE = 50
      fileChunkManager.isLargeFile = true
      // Store chunks so getRange can find them
      for (let i = 0; i < 10; i++) {
        fileChunkManager.chunks.set(i, data.slice(i * 50, (i + 1) * 50))
      }
      fileChunkManager.totalChunks = 10

      const proxy = fileChunkManager.createProxyArray(data)

      // Large slice (>= CHUNK_SIZE * 2 = 100) returns a promise
      const result = proxy.slice(0, 200)
      expect(result).toBeInstanceOf(Promise)
    })

    it('overridden slice defaults start=0 end=totalSize', () => {
      const data = makeBytes(50)
      fileChunkManager.totalSize = 50
      fileChunkManager.CHUNK_SIZE = 50
      const proxy = fileChunkManager.createProxyArray(data)

      const sliced = proxy.slice()
      expect(sliced.byteLength).toBe(50)
    })
  })

  // -----------------------------------------------------------------------
  // clear
  // -----------------------------------------------------------------------
  describe('clear()', () => {
    it('clears chunks and metadata', async () => {
      fileChunkManager.fileId = 'clear_test'
      await fileChunkManager.storeChunk(0, new Uint8Array(10))
      await fileChunkManager.storeChunk(1, new Uint8Array(10))

      expect(fileChunkManager.chunks.size).toBe(2)
      expect(fileChunkManager.chunkMetadata.size).toBe(2)

      await fileChunkManager.clear()

      expect(fileChunkManager.chunks.size).toBe(0)
      expect(fileChunkManager.chunkMetadata.size).toBe(0)
    })

    it('resets file properties', async () => {
      fileChunkManager.fileId = 'some_id'
      fileChunkManager.totalSize = 999
      fileChunkManager.totalChunks = 5
      fileChunkManager.isLargeFile = true
      fileChunkManager.fileReference = {}

      await fileChunkManager.clear()

      expect(fileChunkManager.fileId).toBeNull()
      expect(fileChunkManager.totalSize).toBe(0)
      expect(fileChunkManager.totalChunks).toBe(0)
      expect(fileChunkManager.isLargeFile).toBe(false)
      expect(fileChunkManager.fileReference).toBeNull()
    })

    it('can be called multiple times safely', async () => {
      await fileChunkManager.clear()
      await fileChunkManager.clear()
      await fileChunkManager.clear()
      expect(fileChunkManager.chunks.size).toBe(0)
    })
  })

  // -----------------------------------------------------------------------
  // initialize clears previous state
  // -----------------------------------------------------------------------
  describe('initialize() clears previous state', () => {
    it('clears old chunks when initializing with new data', async () => {
      const data1 = makeBytes(64)
      await fileChunkManager.initialize(data1)

      // Manually add a chunk to simulate previous state
      fileChunkManager.chunks.set(99, new Uint8Array(5))

      const data2 = makeBytes(128)
      await fileChunkManager.initialize(data2)

      // Old chunk 99 should be gone
      expect(fileChunkManager.chunks.has(99)).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // Boundary: exactly LARGE_FILE_THRESHOLD
  // -----------------------------------------------------------------------
  describe('boundary at LARGE_FILE_THRESHOLD', () => {
    let origThreshold

    beforeEach(() => {
      origThreshold = fileChunkManager.LARGE_FILE_THRESHOLD
      fileChunkManager.LARGE_FILE_THRESHOLD = 100
    })

    afterEach(() => {
      fileChunkManager.LARGE_FILE_THRESHOLD = origThreshold
    })

    it('treats file of exactly threshold size as small', async () => {
      const data = makeBytes(100)
      const result = await fileChunkManager.initialize(data)
      expect(fileChunkManager.isLargeFile).toBe(false)
      expect(result).toBe(data)
    })

    it('treats file of threshold + 1 as large', async () => {
      const data = makeBytes(101)
      await fileChunkManager.initialize(data)
      expect(fileChunkManager.isLargeFile).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // storeChunk -- IndexedDB error handling
  // -----------------------------------------------------------------------
  describe('storeChunk() IndexedDB error handling', () => {
    it('does not throw when IndexedDB store fails', async () => {
      fileChunkManager.fileId = 'err_test'
      fileChunkManager.isLargeFile = true

      // Temporarily break the db transaction
      const origDB = fileChunkManager.db
      fileChunkManager.db = {
        transaction() {
          throw new Error('IDB failure')
        }
      }

      // Should not throw -- error is caught internally
      await expect(fileChunkManager.storeChunk(0, new Uint8Array([1, 2]))).resolves.not.toThrow()

      // Still stored in memory
      expect(fileChunkManager.chunks.has(0)).toBe(true)

      fileChunkManager.db = origDB
    })

    it('does not store to IDB when db is null', async () => {
      fileChunkManager.fileId = 'null_db'
      fileChunkManager.isLargeFile = true

      const origDB = fileChunkManager.db
      fileChunkManager.db = null

      await fileChunkManager.storeChunk(0, new Uint8Array([5]))
      // Should still store in memory
      expect(fileChunkManager.chunks.has(0)).toBe(true)

      fileChunkManager.db = origDB
    })
  })

  // -----------------------------------------------------------------------
  // Eviction order
  // -----------------------------------------------------------------------
  describe('chunk eviction order', () => {
    it('evicts in FIFO order (oldest chunk first)', async () => {
      fileChunkManager.fileId = 'evict_test'
      fileChunkManager.MAX_MEMORY_CHUNKS = 3

      await fileChunkManager.storeChunk(10, new Uint8Array([10]))
      await fileChunkManager.storeChunk(20, new Uint8Array([20]))
      await fileChunkManager.storeChunk(30, new Uint8Array([30]))

      // Storing 4th should evict chunk 10
      await fileChunkManager.storeChunk(40, new Uint8Array([40]))
      expect(fileChunkManager.chunks.has(10)).toBe(false)
      expect(fileChunkManager.chunks.has(20)).toBe(true)
      expect(fileChunkManager.chunks.has(30)).toBe(true)
      expect(fileChunkManager.chunks.has(40)).toBe(true)

      // Storing 5th should evict chunk 20
      await fileChunkManager.storeChunk(50, new Uint8Array([50]))
      expect(fileChunkManager.chunks.has(20)).toBe(false)
      expect(fileChunkManager.chunks.has(30)).toBe(true)

      fileChunkManager.MAX_MEMORY_CHUNKS = 10
    })
  })

  // -----------------------------------------------------------------------
  // getStats -- memory usage calculation
  // -----------------------------------------------------------------------
  describe('getStats() memory usage', () => {
    it('sums byteLength of all cached chunks', async () => {
      fileChunkManager.fileId = 'stats_mem'
      fileChunkManager.totalSize = 300
      fileChunkManager.totalChunks = 3
      fileChunkManager.isLargeFile = true

      await fileChunkManager.storeChunk(0, new Uint8Array(100))
      await fileChunkManager.storeChunk(1, new Uint8Array(100))
      await fileChunkManager.storeChunk(2, new Uint8Array(100))

      const stats = fileChunkManager.getStats()
      expect(stats.memoryUsage).toBe(300)
      expect(stats.chunksInMemory).toBe(3)
      expect(stats.totalChunks).toBe(3)
      expect(stats.isLargeFile).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // Blob input (not File)
  // -----------------------------------------------------------------------
  describe('initialize() with Blob', () => {
    it('handles a plain Blob as input (small)', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])])
      const result = await fileChunkManager.initialize(blob)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(4)
      expect(result[0]).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // Re-initialization
  // -----------------------------------------------------------------------
  describe('re-initialization', () => {
    it('second initialize replaces first file state', async () => {
      const data1 = makeBytes(32)
      await fileChunkManager.initialize(data1)
      expect(fileChunkManager.totalSize).toBe(32)

      const data2 = makeBytes(64)
      await fileChunkManager.initialize(data2)
      expect(fileChunkManager.totalSize).toBe(64)
    })
  })

  // -----------------------------------------------------------------------
  // getChunk with fileReference fallback
  // -----------------------------------------------------------------------
  describe('getChunk() with fileReference fallback', () => {
    it('loads from fileReference when not in memory or IDB', async () => {
      const data = makeBytes(100)
      const blob = new Blob([data])
      fileChunkManager.fileId = 'file_ref_test'
      fileChunkManager.totalChunks = 2
      fileChunkManager.totalSize = 100
      fileChunkManager.CHUNK_SIZE = 50
      fileChunkManager.isLargeFile = false // no IDB fallback
      fileChunkManager.fileReference = blob
      fileChunkManager.chunks.clear()

      const result = await fileChunkManager.getChunk(0)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.byteLength).toBe(50)
    })
  })

  // -----------------------------------------------------------------------
  // Edge case: chunk metadata tracking
  // -----------------------------------------------------------------------
  describe('chunk metadata tracking', () => {
    it('stores metadata for each chunk independently', async () => {
      fileChunkManager.fileId = 'meta_test'
      await fileChunkManager.storeChunk(0, new Uint8Array(10))
      await fileChunkManager.storeChunk(1, new Uint8Array(20))
      await fileChunkManager.storeChunk(2, new Uint8Array(30))

      expect(fileChunkManager.chunkMetadata.get(0).size).toBe(10)
      expect(fileChunkManager.chunkMetadata.get(1).size).toBe(20)
      expect(fileChunkManager.chunkMetadata.get(2).size).toBe(30)
    })

    it('updates metadata lastAccess on store', async () => {
      fileChunkManager.fileId = 'time_test'
      const before = Date.now()
      await fileChunkManager.storeChunk(0, new Uint8Array(5))
      const meta = fileChunkManager.chunkMetadata.get(0)
      expect(meta.lastAccess).toBeGreaterThanOrEqual(before)
      expect(meta.lastAccess).toBeLessThanOrEqual(Date.now())
    })
  })
})
