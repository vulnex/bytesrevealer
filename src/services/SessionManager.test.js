import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionManager, SESSION_FILE_EXTENSION } from './SessionManager.js'

// ---------------------------------------------------------------------------
// Mock idb's openDB so async methods don't need a real IndexedDB
// ---------------------------------------------------------------------------
const mockStores = {}

function createMockStore() {
  const data = new Map()
  return {
    _data: data,
    get: vi.fn(async (key) => data.get(key) || undefined),
    getAll: vi.fn(async () => [...data.values()]),
    put: vi.fn(async (value) => {
      data.set(value.id, value)
    }),
    delete: vi.fn(async (key) => {
      data.delete(key)
    }),
    clear: vi.fn(async () => {
      data.clear()
    })
  }
}

function resetMockStores() {
  mockStores.sessions = createMockStore()
  mockStores.metadata = createMockStore()
}

const mockDb = {
  get: vi.fn(async (storeName, key) => {
    const store = storeName === 'sessions' ? mockStores.sessions : mockStores.metadata
    return store.get(key)
  }),
  getAll: vi.fn(async (storeName) => {
    const store = storeName === 'sessions' ? mockStores.sessions : mockStores.metadata
    return store.getAll()
  }),
  put: vi.fn(async (storeName, value) => {
    const store = storeName === 'sessions' ? mockStores.sessions : mockStores.metadata
    return store.put(value)
  }),
  delete: vi.fn(async (storeName, key) => {
    const store = storeName === 'sessions' ? mockStores.sessions : mockStores.metadata
    return store.delete(key)
  }),
  clear: vi.fn(async (storeName) => {
    const store = storeName === 'sessions' ? mockStores.sessions : mockStores.metadata
    return store.clear()
  }),
  close: vi.fn()
}

vi.mock('idb', () => ({
  openDB: vi.fn(async () => mockDb)
}))

// ---------------------------------------------------------------------------
// Existing tests: pure synchronous methods
// ---------------------------------------------------------------------------

describe('SessionManager (pure methods)', () => {
  let mgr

  beforeEach(() => {
    mgr = new SessionManager()
  })

  describe('generateId()', () => {
    it('returns a string starting with "session_"', () => {
      const id = mgr.generateId()
      expect(typeof id).toBe('string')
      expect(id.startsWith('session_')).toBe(true)
    })

    it('generates unique ids', () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) ids.add(mgr.generateId())
      expect(ids.size).toBe(100)
    })

    it('contains a timestamp segment', () => {
      const before = Date.now()
      const id = mgr.generateId()
      const after = Date.now()
      const parts = id.split('_')
      const ts = parseInt(parts[1])
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })
  })

  describe('sanitizeForStorage()', () => {
    it('passes through primitives', () => {
      expect(mgr.sanitizeForStorage(42)).toBe(42)
      expect(mgr.sanitizeForStorage('hello')).toBe('hello')
      expect(mgr.sanitizeForStorage(true)).toBe(true)
      expect(mgr.sanitizeForStorage(null)).toBeNull()
      expect(mgr.sanitizeForStorage(undefined)).toBeUndefined()
    })

    it('converts Date to ISO string', () => {
      const date = new Date('2025-06-15T12:00:00Z')
      expect(mgr.sanitizeForStorage(date)).toBe('2025-06-15T12:00:00.000Z')
    })

    it('converts Set to Array', () => {
      const set = new Set([1, 2, 3])
      expect(mgr.sanitizeForStorage(set)).toEqual([1, 2, 3])
    })

    it('converts Map to Object', () => {
      const map = new Map([
        ['a', 1],
        ['b', 2]
      ])
      expect(mgr.sanitizeForStorage(map)).toEqual({ a: 1, b: 2 })
    })

    it('nullifies ArrayBuffer and TypedArrays', () => {
      expect(mgr.sanitizeForStorage(new ArrayBuffer(8))).toBeNull()
      expect(mgr.sanitizeForStorage(new Uint8Array(4))).toBeNull()
    })

    it('recursively sanitizes arrays', () => {
      const arr = [1, new Date('2025-01-01'), 'str']
      const result = mgr.sanitizeForStorage(arr)
      expect(result[0]).toBe(1)
      expect(typeof result[1]).toBe('string')
      expect(result[2]).toBe('str')
    })

    it('skips functions and underscore-prefixed keys', () => {
      const obj = {
        name: 'test',
        _internal: 'hidden',
        action: () => {}
      }
      const result = mgr.sanitizeForStorage(obj)
      expect(result).toEqual({ name: 'test' })
    })

    it('handles nested objects', () => {
      const obj = {
        a: { b: { c: 'deep' } }
      }
      expect(mgr.sanitizeForStorage(obj)).toEqual({ a: { b: { c: 'deep' } } })
    })
  })

  describe('createSessionData()', () => {
    const minimalState = {
      fileName: 'test.bin',
      fileBytes: new Uint8Array(100),
      activeTab: 'hex',
      entropy: 4.5,
      hashes: { md5: 'abc', sha1: 'def', sha256: 'ghi' },
      features: { strings: true },
      coloredBytes: [],
      highlightedBytes: [],
      fileSignatures: [],
      detectedFileType: null
    }

    it('creates a session with all expected top-level fields', () => {
      const session = mgr.createSessionData('My Session', minimalState)
      expect(session).toHaveProperty('id')
      expect(session).toHaveProperty('version')
      expect(session).toHaveProperty('name', 'My Session')
      expect(session).toHaveProperty('created')
      expect(session).toHaveProperty('modified')
      expect(session).toHaveProperty('file')
      expect(session).toHaveProperty('state')
      expect(session).toHaveProperty('analysis')
      expect(session).toHaveProperty('format')
      expect(session).toHaveProperty('annotations')
    })

    it('captures file size from fileBytes', () => {
      const session = mgr.createSessionData('S', minimalState)
      expect(session.file.size).toBe(100)
    })

    it('preserves hashes in analysis', () => {
      const session = mgr.createSessionData('S', minimalState)
      expect(session.analysis.hashes.md5).toBe('abc')
      expect(session.analysis.hashes.sha256).toBe('ghi')
    })

    it('defaults name if not provided', () => {
      const session = mgr.createSessionData(null, minimalState)
      expect(session.name).toContain('Session')
    })

    it('sanitizes coloredBytes to plain objects', () => {
      const state = {
        ...minimalState,
        coloredBytes: [{ start: 0, end: 10, color: '#ff0000', label: 'header', extra: true }]
      }
      const session = mgr.createSessionData('S', state)
      expect(session.state.coloredBytes[0]).toEqual({
        start: 0,
        end: 10,
        color: '#ff0000',
        label: 'header'
      })
    })
  })

  describe('extractMetadata()', () => {
    it('extracts lightweight metadata from session', () => {
      const session = {
        id: 's1',
        name: 'Test',
        created: '2025-01-01',
        modified: '2025-06-01',
        file: { name: 'foo.bin', size: 1000 },
        annotations: { tags: ['pe', 'malware'] }
      }
      const meta = mgr.extractMetadata(session)
      expect(meta.id).toBe('s1')
      expect(meta.name).toBe('Test')
      expect(meta.file.name).toBe('foo.bin')
      expect(meta.tags).toEqual(['pe', 'malware'])
    })

    it('defaults tags to empty array', () => {
      const session = { id: 's1', name: 'X', created: 'a', modified: 'b', file: {} }
      const meta = mgr.extractMetadata(session)
      expect(meta.tags).toEqual([])
    })
  })

  describe('verifyFile()', () => {
    const session = {
      file: {
        name: 'test.bin',
        size: 1024,
        sha256: 'abc123'
      }
    }

    it('returns full match for identical file', () => {
      const file = { name: 'test.bin', size: 1024 }
      const result = mgr.verifyFile(session, file, 'abc123')
      expect(result.matches).toBe(true)
      expect(result.nameMatch).toBe(true)
      expect(result.sizeMatch).toBe(true)
      expect(result.hashMatch).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('reports name mismatch as warning', () => {
      const file = { name: 'other.bin', size: 1024 }
      const result = mgr.verifyFile(session, file)
      expect(result.nameMatch).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
      // Name mismatch alone does not set matches to false
      expect(result.matches).toBe(true)
    })

    it('reports size mismatch and sets matches false', () => {
      const file = { name: 'test.bin', size: 2048 }
      const result = mgr.verifyFile(session, file)
      expect(result.sizeMatch).toBe(false)
      expect(result.matches).toBe(false)
    })

    it('reports hash mismatch and sets matches false', () => {
      const file = { name: 'test.bin', size: 1024 }
      const result = mgr.verifyFile(session, file, 'zzz999')
      expect(result.hashMatch).toBe(false)
      expect(result.matches).toBe(false)
    })

    it('hash comparison is case-insensitive', () => {
      const file = { name: 'test.bin', size: 1024 }
      const result = mgr.verifyFile(session, file, 'ABC123')
      expect(result.hashMatch).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// New tests: additional pure method edge cases
// ---------------------------------------------------------------------------

describe('SessionManager (additional pure method coverage)', () => {
  let mgr

  beforeEach(() => {
    mgr = new SessionManager()
  })

  describe('SESSION_FILE_EXTENSION export', () => {
    it('has the expected file extension value', () => {
      expect(SESSION_FILE_EXTENSION).toBe('.brsession')
    })
  })

  describe('sanitizeForStorage() - additional edge cases', () => {
    it('skips symbol-valued properties', () => {
      const sym = Symbol('test')
      const obj = { name: 'ok', [Symbol('hidden')]: 'invisible' }
      obj.symVal = sym
      // Symbol values are typeof "symbol" and should be skipped
      const result = mgr.sanitizeForStorage(obj)
      expect(result).toEqual({ name: 'ok' })
    })

    it('filters null values from arrays after sanitization', () => {
      // ArrayBuffer items become null and should be filtered out
      const arr = ['keep', new ArrayBuffer(4), 'also keep']
      const result = mgr.sanitizeForStorage(arr)
      expect(result).toEqual(['keep', 'also keep'])
    })

    it('handles empty object', () => {
      expect(mgr.sanitizeForStorage({})).toEqual({})
    })

    it('handles empty array', () => {
      expect(mgr.sanitizeForStorage([])).toEqual([])
    })

    it('handles number zero', () => {
      expect(mgr.sanitizeForStorage(0)).toBe(0)
    })

    it('handles empty string', () => {
      expect(mgr.sanitizeForStorage('')).toBe('')
    })

    it('handles Int16Array (TypedArray)', () => {
      expect(mgr.sanitizeForStorage(new Int16Array(2))).toBeNull()
    })

    it('handles Float64Array (TypedArray)', () => {
      expect(mgr.sanitizeForStorage(new Float64Array(3))).toBeNull()
    })

    it('skips properties whose sanitized value is null', () => {
      const obj = { buffer: new ArrayBuffer(8), name: 'test' }
      const result = mgr.sanitizeForStorage(obj)
      expect(result).toEqual({ name: 'test' })
      expect(result).not.toHaveProperty('buffer')
    })

    it('handles deeply nested mixed types', () => {
      const obj = {
        level1: {
          date: new Date('2025-03-01'),
          set: new Set(['a', 'b']),
          level2: {
            map: new Map([['x', 10]]),
            arr: [1, new Uint8Array(1), 3]
          }
        }
      }
      const result = mgr.sanitizeForStorage(obj)
      expect(result.level1.date).toBe('2025-03-01T00:00:00.000Z')
      expect(result.level1.set).toEqual(['a', 'b'])
      expect(result.level1.level2.map).toEqual({ x: 10 })
      expect(result.level1.level2.arr).toEqual([1, 3])
    })
  })

  describe('createSessionData() - additional edge cases', () => {
    it('handles missing fileBytes gracefully (fileSize = 0)', () => {
      const state = {}
      const session = mgr.createSessionData('S', state)
      expect(session.file.size).toBe(0)
    })

    it('handles fileBytes with length property (non-Uint8Array)', () => {
      const state = { fileBytes: { length: 5000 } }
      const session = mgr.createSessionData('S', state)
      expect(session.file.size).toBe(5000)
    })

    it('defaults empty name to date-based name', () => {
      const session = mgr.createSessionData('', {})
      expect(session.name).toContain('Session')
    })

    it('defaults state fields when appState is empty', () => {
      const session = mgr.createSessionData('S', {})
      expect(session.state.activeTab).toBe('info')
      expect(session.state.activeGraphTab).toBe('entropy')
      expect(session.state.searchPattern).toBe('')
      expect(session.state.searchType).toBe('hex')
      expect(session.state.baseOffset).toBe(0)
      expect(session.state.highlightedBytes).toEqual([])
      expect(session.state.coloredBytes).toEqual([])
      expect(session.state.features).toEqual({})
    })

    it('defaults analysis fields when not provided', () => {
      const session = mgr.createSessionData('S', {})
      expect(session.analysis.entropy).toBe(0)
      expect(session.analysis.hashes.md5).toBe('')
      expect(session.analysis.hashes.sha1).toBe('')
      expect(session.analysis.hashes.sha256).toBe('')
      expect(session.analysis.fileSignatures).toEqual([])
      expect(session.analysis.detectedFileType).toBeNull()
    })

    it('defaults format fields when formatStore not provided', () => {
      const session = mgr.createSessionData('S', {})
      expect(session.format.selectedFormatId).toBe('')
      expect(session.format.isAutoDetected).toBe(false)
      expect(session.format.confidence).toBe(0)
    })

    it('populates format from formatStore', () => {
      const state = {
        formatStore: {
          selectedFormatId: 'pe',
          isAutoDetected: true,
          confidence: 95
        }
      }
      const session = mgr.createSessionData('S', state)
      expect(session.format.selectedFormatId).toBe('pe')
      expect(session.format.isAutoDetected).toBe(true)
      expect(session.format.confidence).toBe(95)
    })

    it('defaults annotations fields when not provided', () => {
      const session = mgr.createSessionData('S', {})
      expect(session.annotations.notes).toBe('')
      expect(session.annotations.bookmarks).toEqual([])
      expect(session.annotations.annotations).toEqual([])
      expect(session.annotations.tags).toEqual([])
    })

    it('preserves annotations when provided', () => {
      const state = {
        notes: 'my note',
        bookmarks: [{ offset: 0, label: 'bm' }],
        annotations: [{ id: 1 }],
        tags: ['malware']
      }
      const session = mgr.createSessionData('S', state)
      expect(session.annotations.notes).toBe('my note')
      expect(session.annotations.bookmarks).toEqual([{ offset: 0, label: 'bm' }])
      expect(session.annotations.annotations).toEqual([{ id: 1 }])
      expect(session.annotations.tags).toEqual(['malware'])
    })

    it('stores yaraState from appState', () => {
      const state = { yaraState: { matches: ['rule1'] } }
      const session = mgr.createSessionData('S', state)
      expect(session.yara).toEqual({ matches: ['rule1'] })
    })

    it('stores null yara when yaraState is not provided', () => {
      const session = mgr.createSessionData('S', {})
      expect(session.yara).toBeNull()
    })

    it('sanitizes file signatures through sanitizeForStorage', () => {
      const state = {
        fileSignatures: [
          { name: 'PE', offset: 0, _internal: 'skip' },
          { name: 'ZIP', offset: 100 }
        ]
      }
      const session = mgr.createSessionData('S', state)
      // _internal should be stripped by sanitizeForStorage
      expect(session.analysis.fileSignatures).toEqual([
        { name: 'PE', offset: 0 },
        { name: 'ZIP', offset: 100 }
      ])
    })

    it('sanitizes detectedFileType through sanitizeForStorage', () => {
      const state = {
        detectedFileType: { type: 'PE', confidence: 90, _cache: 'drop' }
      }
      const session = mgr.createSessionData('S', state)
      expect(session.analysis.detectedFileType).toEqual({ type: 'PE', confidence: 90 })
    })

    it('handles highlightedBytes as array of arrays', () => {
      const state = {
        highlightedBytes: [
          [0, 10],
          [20, 30]
        ]
      }
      const session = mgr.createSessionData('S', state)
      expect(session.state.highlightedBytes).toEqual([
        [0, 10],
        [20, 30]
      ])
    })

    it('handles highlightedBytes as array of objects', () => {
      const state = {
        highlightedBytes: [{ start: 5, end: 15 }]
      }
      const session = mgr.createSessionData('S', state)
      expect(session.state.highlightedBytes).toEqual([{ start: 5, end: 15 }])
    })

    it('handles highlightedBytes as primitives', () => {
      const state = {
        highlightedBytes: [42]
      }
      const session = mgr.createSessionData('S', state)
      expect(session.state.highlightedBytes).toEqual([42])
    })

    it('defaults coloredBytes label to empty string', () => {
      const state = {
        coloredBytes: [{ start: 0, end: 5, color: '#000' }]
      }
      const session = mgr.createSessionData('S', state)
      expect(session.state.coloredBytes[0].label).toBe('')
    })

    it('stores file sha256 in file object', () => {
      const state = { hashes: { sha256: 'deadbeef' } }
      const session = mgr.createSessionData('S', state)
      expect(session.file.sha256).toBe('deadbeef')
    })

    it('stores null fileName when not provided', () => {
      const session = mgr.createSessionData('S', {})
      expect(session.file.name).toBeNull()
    })
  })

  describe('extractMetadata() - additional edge cases', () => {
    it('handles session with no file property', () => {
      const session = { id: 's1', name: 'X', created: 'a', modified: 'b' }
      const meta = mgr.extractMetadata(session)
      expect(meta.file.name).toBeUndefined()
      expect(meta.file.size).toBeUndefined()
    })

    it('includes created and modified timestamps', () => {
      const session = {
        id: 's1',
        name: 'X',
        created: '2025-01-01T00:00:00Z',
        modified: '2025-06-01T00:00:00Z',
        file: {}
      }
      const meta = mgr.extractMetadata(session)
      expect(meta.created).toBe('2025-01-01T00:00:00Z')
      expect(meta.modified).toBe('2025-06-01T00:00:00Z')
    })
  })

  describe('verifyFile() - additional edge cases', () => {
    it('handles session with no file info', () => {
      const session = { file: {} }
      const file = { name: 'any.bin', size: 100 }
      const result = mgr.verifyFile(session, file)
      expect(result.matches).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('handles session with null file', () => {
      const session = {}
      const file = { name: 'any.bin', size: 100 }
      const result = mgr.verifyFile(session, file)
      expect(result.matches).toBe(true)
    })

    it('skips hash check when no fileHash argument provided', () => {
      const session = { file: { sha256: 'abc123' } }
      const file = { name: 'test.bin', size: 100 }
      const result = mgr.verifyFile(session, file)
      // hashMatch stays true when not checked
      expect(result.hashMatch).toBe(true)
    })

    it('skips hash check when session has no sha256', () => {
      const session = { file: { name: 'test.bin', size: 100 } }
      const file = { name: 'test.bin', size: 100 }
      const result = mgr.verifyFile(session, file, 'somehash')
      expect(result.hashMatch).toBe(true)
    })

    it('reports both size and hash mismatch', () => {
      const session = { file: { size: 100, sha256: 'aaa' } }
      const file = { name: 'test.bin', size: 200 }
      const result = mgr.verifyFile(session, file, 'bbb')
      expect(result.sizeMatch).toBe(false)
      expect(result.hashMatch).toBe(false)
      expect(result.matches).toBe(false)
      expect(result.warnings).toHaveLength(2)
    })
  })
})

// ---------------------------------------------------------------------------
// New tests: async methods with mocked IndexedDB
// ---------------------------------------------------------------------------

describe('SessionManager (async methods with mocked IDB)', () => {
  let mgr

  beforeEach(() => {
    resetMockStores()
    mgr = new SessionManager()
    // Reset initialization state so init() runs fresh
    mgr.db = null
    mgr.initialized = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const sampleAppState = {
    fileName: 'sample.bin',
    fileBytes: new Uint8Array(256),
    activeTab: 'hex',
    entropy: 3.7,
    hashes: { md5: 'md5hash', sha1: 'sha1hash', sha256: 'sha256hash' },
    features: { strings: true },
    coloredBytes: [{ start: 0, end: 10, color: '#ff0000', label: 'header' }],
    highlightedBytes: [[0, 5]],
    fileSignatures: [{ name: 'PE', offset: 0 }],
    detectedFileType: { type: 'PE', confidence: 90 },
    notes: 'test note',
    bookmarks: [{ offset: 0, label: 'entry' }],
    annotations: [{ id: 'a1', text: 'annotation' }],
    tags: ['malware', 'pe']
  }

  describe('init()', () => {
    it('initializes the database on first call', async () => {
      await mgr.init()
      expect(mgr.initialized).toBe(true)
      expect(mgr.db).toBe(mockDb)
    })

    it('skips re-initialization if already initialized', async () => {
      await mgr.init()
      const { openDB } = await import('idb')
      const callCount = openDB.mock.calls.length
      await mgr.init()
      // openDB should not be called again
      expect(openDB.mock.calls.length).toBe(callCount)
    })

    it('throws and does not set initialized on failure', async () => {
      const { openDB } = await import('idb')
      openDB.mockRejectedValueOnce(new Error('IDB unavailable'))
      mgr.initialized = false
      mgr.db = null
      await expect(mgr.init()).rejects.toThrow('IDB unavailable')
      expect(mgr.initialized).toBe(false)
    })
  })

  describe('saveSession()', () => {
    it('saves a session and returns the session data', async () => {
      const session = await mgr.saveSession('Test Session', sampleAppState)
      expect(session.name).toBe('Test Session')
      expect(session.id).toMatch(/^session_/)
      expect(session.file.name).toBe('sample.bin')
      expect(session.file.size).toBe(256)
      expect(session.analysis.entropy).toBe(3.7)
      // Verify it was stored in both stores
      expect(mockStores.sessions.put).toHaveBeenCalled()
      expect(mockStores.metadata.put).toHaveBeenCalled()
    })

    it('saves metadata with correct fields', async () => {
      const session = await mgr.saveSession('Meta Test', sampleAppState)
      const metaPutCall = mockStores.metadata.put.mock.calls[0][0]
      expect(metaPutCall.id).toBe(session.id)
      expect(metaPutCall.name).toBe('Meta Test')
      expect(metaPutCall.file.name).toBe('sample.bin')
      expect(metaPutCall.tags).toEqual(['malware', 'pe'])
    })

    it('propagates db errors', async () => {
      mockStores.sessions.put.mockRejectedValueOnce(new Error('write failed'))
      await expect(mgr.saveSession('Fail', sampleAppState)).rejects.toThrow('write failed')
    })
  })

  describe('listSessions()', () => {
    it('returns empty array when no sessions exist', async () => {
      const list = await mgr.listSessions()
      expect(list).toEqual([])
    })

    it('returns sessions sorted by modified date descending', async () => {
      mockStores.metadata._data.set('s1', {
        id: 's1',
        name: 'Old',
        modified: '2025-01-01T00:00:00Z'
      })
      mockStores.metadata._data.set('s2', {
        id: 's2',
        name: 'New',
        modified: '2025-06-01T00:00:00Z'
      })
      mockStores.metadata._data.set('s3', {
        id: 's3',
        name: 'Mid',
        modified: '2025-03-01T00:00:00Z'
      })

      const list = await mgr.listSessions()
      expect(list[0].name).toBe('New')
      expect(list[1].name).toBe('Mid')
      expect(list[2].name).toBe('Old')
    })

    it('propagates db errors', async () => {
      mockStores.metadata.getAll.mockRejectedValueOnce(new Error('read failed'))
      await expect(mgr.listSessions()).rejects.toThrow('read failed')
    })
  })

  describe('loadSession()', () => {
    it('loads an existing session by id', async () => {
      const saved = await mgr.saveSession('Load Test', sampleAppState)
      const loaded = await mgr.loadSession(saved.id)
      expect(loaded.name).toBe('Load Test')
      expect(loaded.id).toBe(saved.id)
    })

    it('throws when session not found', async () => {
      await expect(mgr.loadSession('nonexistent')).rejects.toThrow('Session not found')
    })

    it('propagates db errors', async () => {
      mockStores.sessions.get.mockRejectedValueOnce(new Error('db error'))
      await expect(mgr.loadSession('any')).rejects.toThrow('db error')
    })
  })

  describe('deleteSession()', () => {
    it('deletes a session from both stores', async () => {
      const saved = await mgr.saveSession('Delete Test', sampleAppState)
      await mgr.deleteSession(saved.id)
      expect(mockStores.sessions.delete).toHaveBeenCalledWith(saved.id)
      expect(mockStores.metadata.delete).toHaveBeenCalledWith(saved.id)
    })

    it('propagates db errors', async () => {
      mockStores.sessions.delete.mockRejectedValueOnce(new Error('delete failed'))
      await expect(mgr.deleteSession('any')).rejects.toThrow('delete failed')
    })
  })

  describe('updateSession()', () => {
    it('updates an existing session', async () => {
      const saved = await mgr.saveSession('Original', sampleAppState)
      const newState = {
        ...sampleAppState,
        activeTab: 'strings',
        entropy: 5.0,
        notes: 'updated note',
        bookmarks: [{ offset: 100, label: 'new bm' }]
      }
      const updated = await mgr.updateSession(saved.id, newState)
      expect(updated.id).toBe(saved.id)
      expect(updated.created).toBe(saved.created)
      expect(updated.state.activeTab).toBe('strings')
      expect(updated.analysis.entropy).toBe(5.0)
      expect(updated.annotations.notes).toBe('updated note')
    })

    it('throws when session not found', async () => {
      await expect(mgr.updateSession('nonexistent', sampleAppState)).rejects.toThrow(
        'Session not found'
      )
    })

    it('preserves existing notes when not provided in appState', async () => {
      const saved = await mgr.saveSession('Notes Test', {
        ...sampleAppState,
        notes: 'original note'
      })
      const updated = await mgr.updateSession(saved.id, {
        ...sampleAppState,
        notes: '' // falsy
      })
      expect(updated.annotations.notes).toBe('original note')
    })

    it('preserves existing bookmarks when not provided', async () => {
      const saved = await mgr.saveSession('BM Test', {
        ...sampleAppState,
        bookmarks: [{ offset: 0, label: 'bm1' }]
      })
      const updated = await mgr.updateSession(saved.id, {
        ...sampleAppState,
        bookmarks: [] // empty
      })
      expect(updated.annotations.bookmarks).toEqual([{ offset: 0, label: 'bm1' }])
    })

    it('preserves existing annotations when not provided', async () => {
      const saved = await mgr.saveSession('Ann Test', {
        ...sampleAppState,
        annotations: [{ id: 'a1', text: 'ann' }]
      })
      const updated = await mgr.updateSession(saved.id, {
        ...sampleAppState,
        annotations: [] // empty
      })
      expect(updated.annotations.annotations).toEqual([{ id: 'a1', text: 'ann' }])
    })

    it('preserves existing tags when not provided', async () => {
      const saved = await mgr.saveSession('Tag Test', {
        ...sampleAppState,
        tags: ['important']
      })
      const updated = await mgr.updateSession(saved.id, {
        ...sampleAppState,
        tags: [] // empty
      })
      expect(updated.annotations.tags).toEqual(['important'])
    })

    it('propagates db errors', async () => {
      const saved = await mgr.saveSession('Err Test', sampleAppState)
      mockStores.sessions.put.mockRejectedValueOnce(new Error('update failed'))
      await expect(mgr.updateSession(saved.id, sampleAppState)).rejects.toThrow('update failed')
    })
  })

  describe('renameSession()', () => {
    it('renames a session and updates both stores', async () => {
      const saved = await mgr.saveSession('Old Name', sampleAppState)
      const renamed = await mgr.renameSession(saved.id, 'New Name')
      expect(renamed.name).toBe('New Name')
      expect(renamed.id).toBe(saved.id)
      // modified should be updated
      expect(new Date(renamed.modified).getTime()).toBeGreaterThanOrEqual(
        new Date(saved.modified).getTime()
      )
    })

    it('throws when session not found', async () => {
      await expect(mgr.renameSession('nonexistent', 'Name')).rejects.toThrow('Session not found')
    })

    it('propagates db errors', async () => {
      const saved = await mgr.saveSession('Rename Err', sampleAppState)
      mockStores.sessions.put.mockRejectedValueOnce(new Error('rename failed'))
      await expect(mgr.renameSession(saved.id, 'New')).rejects.toThrow('rename failed')
    })
  })

  describe('exportSession()', () => {
    it('exports a session as a blob with correct filename', async () => {
      const saved = await mgr.saveSession('My Export', sampleAppState)
      const { blob, filename } = await mgr.exportSession(saved.id)
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/json')
      expect(filename).toContain('my_export')
      expect(filename.endsWith(SESSION_FILE_EXTENSION)).toBe(true)
    })

    it('export wrapper contains expected metadata', async () => {
      const saved = await mgr.saveSession('Wrapper Test', sampleAppState)
      const { blob } = await mgr.exportSession(saved.id)
      const text = await blob.text()
      const data = JSON.parse(text)
      expect(data.exportVersion).toBe('1.0')
      expect(data.application).toBe('BytesRevealer')
      expect(data.applicationVersion).toBe('0.4')
      expect(data.exportDate).toBeTruthy()
      expect(data.session).toBeTruthy()
      expect(data.session.name).toBe('Wrapper Test')
    })

    it('throws when session not found', async () => {
      await expect(mgr.exportSession('nonexistent')).rejects.toThrow('Session not found')
    })

    it('sanitizes special characters in filename', async () => {
      const saved = await mgr.saveSession('My Session! @#$%', sampleAppState)
      const { filename } = await mgr.exportSession(saved.id)
      // Should only contain alphanumeric and underscores
      const nameWithoutExt = filename.replace(SESSION_FILE_EXTENSION, '')
      expect(nameWithoutExt).toMatch(/^[a-z0-9_]+$/)
    })

    it('propagates db errors', async () => {
      mockStores.sessions.get.mockRejectedValueOnce(new Error('export failed'))
      await expect(mgr.exportSession('any')).rejects.toThrow('export failed')
    })
  })

  describe('importSession()', () => {
    function createImportFile(data, size = null) {
      const json = JSON.stringify(data)
      const blob = new Blob([json], { type: 'application/json' })
      // Mock a File-like object
      return {
        text: () => Promise.resolve(json),
        size: size !== null ? size : blob.size,
        name: 'session.brsession'
      }
    }

    function validExportData(overrides = {}) {
      return {
        exportVersion: '1.0',
        application: 'BytesRevealer',
        session: {
          id: 'session_old_123',
          version: '1.0',
          name: 'Imported Session',
          created: '2025-01-01T00:00:00Z',
          modified: '2025-01-01T00:00:00Z',
          file: { name: 'test.bin', size: 100, sha256: 'abc' },
          state: { activeTab: 'hex' },
          analysis: {},
          format: {},
          annotations: { notes: '', bookmarks: [], annotations: [], tags: [] },
          yara: null,
          ...overrides
        }
      }
    }

    it('imports a valid session file', async () => {
      const file = createImportFile(validExportData())
      const session = await mgr.importSession(file)
      expect(session.name).toBe('Imported Session (imported)')
      expect(session.id).toMatch(/^session_/)
      expect(session.id).not.toBe('session_old_123')
    })

    it('stores the imported session in both stores', async () => {
      const file = createImportFile(validExportData())
      await mgr.importSession(file)
      expect(mockStores.sessions.put).toHaveBeenCalled()
      expect(mockStores.metadata.put).toHaveBeenCalled()
    })

    it('rejects files that are too large', async () => {
      const file = createImportFile(validExportData(), 60 * 1024 * 1024)
      await expect(mgr.importSession(file)).rejects.toThrow('Session file too large')
    })

    it('rejects invalid JSON', async () => {
      const file = {
        text: () => Promise.resolve('not json{'),
        size: 10,
        name: 'bad.brsession'
      }
      await expect(mgr.importSession(file)).rejects.toThrow()
    })

    it('rejects file without session field', async () => {
      const file = createImportFile({ exportVersion: '1.0' })
      await expect(mgr.importSession(file)).rejects.toThrow('Invalid session file format')
    })

    it('rejects file without session.version', async () => {
      const data = validExportData()
      delete data.session.version
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow()
    })

    it('rejects incompatible major version', async () => {
      const data = validExportData({ version: '2.0' })
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('Incompatible session version')
    })

    it('rejects session with forbidden __proto__ key', async () => {
      const data = validExportData()
      data.session.__proto__ = { malicious: true }
      // JSON.stringify will not include __proto__ by default in many engines,
      // so we manually construct the JSON
      const json = `{"exportVersion":"1.0","session":{"__proto__":{"x":1},"id":"s1","version":"1.0","name":"bad","created":"a","modified":"b","file":{}}}`
      const file = {
        text: () => Promise.resolve(json),
        size: json.length,
        name: 'bad.brsession'
      }
      await expect(mgr.importSession(file)).rejects.toThrow('forbidden key')
    })

    it('rejects session with forbidden constructor key', async () => {
      const data = validExportData()
      const json = JSON.stringify({
        ...data,
        session: { ...data.session, constructor: 'bad' }
      })
      const file = {
        text: () => Promise.resolve(json),
        size: json.length,
        name: 'bad.brsession'
      }
      await expect(mgr.importSession(file)).rejects.toThrow('forbidden key')
    })

    it('rejects session with forbidden prototype key', async () => {
      const data = validExportData()
      const json = JSON.stringify({
        ...data,
        session: { ...data.session, prototype: 'bad' }
      })
      const file = {
        text: () => Promise.resolve(json),
        size: json.length,
        name: 'bad.brsession'
      }
      await expect(mgr.importSession(file)).rejects.toThrow('forbidden key')
    })

    it('rejects session with name that is not a string', async () => {
      const data = validExportData({ name: 123 })
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('name must be a string')
    })

    it('rejects session with name longer than 500 chars', async () => {
      const data = validExportData({ name: 'x'.repeat(501) })
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('name must be a string')
    })

    it('rejects session with non-string version', async () => {
      const data = validExportData({ version: 1.0 })
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('version must be a string')
    })

    it('rejects session with invalid version format', async () => {
      const data = validExportData({ version: 'abc' })
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('version must be a string')
    })

    it('rejects session with fileName that is not a string', async () => {
      const data = validExportData()
      data.session.fileName = 123
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('fileName must be a string')
    })

    it('rejects session with fileName longer than 500 chars', async () => {
      const data = validExportData()
      data.session.fileName = 'x'.repeat(501)
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('fileName must be a string')
    })

    it('accepts session with null fileName', async () => {
      const data = validExportData()
      data.session.fileName = null
      const file = createImportFile(data)
      const session = await mgr.importSession(file)
      expect(session).toBeTruthy()
    })

    it('accepts session with undefined fileName', async () => {
      const data = validExportData()
      // fileName will be undefined if not present in JSON
      delete data.session.fileName
      const file = createImportFile(data)
      const session = await mgr.importSession(file)
      expect(session).toBeTruthy()
    })

    it('rejects session with negative fileSize', async () => {
      const data = validExportData()
      data.session.fileSize = -1
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('fileSize must be a non-negative')
    })

    it('rejects session with non-number fileSize', async () => {
      const data = validExportData()
      data.session.fileSize = 'big'
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('fileSize must be a non-negative')
    })

    it('accepts session with null fileSize', async () => {
      const data = validExportData()
      data.session.fileSize = null
      const file = createImportFile(data)
      const session = await mgr.importSession(file)
      expect(session).toBeTruthy()
    })

    it('accepts session with fileSize of zero', async () => {
      const data = validExportData()
      data.session.fileSize = 0
      const file = createImportFile(data)
      const session = await mgr.importSession(file)
      expect(session).toBeTruthy()
    })

    it('rejects session with state that is an array', async () => {
      const data = validExportData({ state: [1, 2, 3] })
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('state must be a plain object')
    })

    it('rejects session with state that is a string', async () => {
      const data = validExportData({ state: 'not an object' })
      const file = createImportFile(data)
      await expect(mgr.importSession(file)).rejects.toThrow('state must be a plain object')
    })

    it('accepts session with null state', async () => {
      const data = validExportData({ state: null })
      const file = createImportFile(data)
      const session = await mgr.importSession(file)
      expect(session).toBeTruthy()
    })

    it('accepts session with undefined state', async () => {
      const data = validExportData()
      delete data.session.state
      const file = createImportFile(data)
      const session = await mgr.importSession(file)
      expect(session).toBeTruthy()
    })

    it('accepts session with version matching current major version', async () => {
      // SESSION_VERSION is '1.0', so '1.5' should be accepted
      const data = validExportData({ version: '1.5' })
      const file = createImportFile(data)
      const session = await mgr.importSession(file)
      expect(session).toBeTruthy()
    })
  })

  describe('clearAllSessions()', () => {
    it('clears both sessions and metadata stores', async () => {
      await mgr.saveSession('Clear Me 1', sampleAppState)
      await mgr.saveSession('Clear Me 2', sampleAppState)
      await mgr.clearAllSessions()
      expect(mockStores.sessions.clear).toHaveBeenCalled()
      expect(mockStores.metadata.clear).toHaveBeenCalled()
    })

    it('works when stores are already empty', async () => {
      await mgr.clearAllSessions()
      expect(mockStores.sessions.clear).toHaveBeenCalled()
      expect(mockStores.metadata.clear).toHaveBeenCalled()
    })

    it('propagates db errors', async () => {
      mockStores.sessions.clear.mockRejectedValueOnce(new Error('clear failed'))
      await expect(mgr.clearAllSessions()).rejects.toThrow('clear failed')
    })
  })

  describe('getStorageUsage()', () => {
    it('returns storage usage with zero sessions', async () => {
      const usage = await mgr.getStorageUsage()
      expect(usage.sessionsUsed).toBe(0)
      expect(usage.sessionsCount).toBe(0)
      expect(typeof usage.totalUsed).toBe('number')
      expect(typeof usage.quota).toBe('number')
    })

    it('reports correct session count and non-zero size', async () => {
      await mgr.saveSession('S1', sampleAppState)
      await mgr.saveSession('S2', sampleAppState)
      const usage = await mgr.getStorageUsage()
      expect(usage.sessionsCount).toBe(2)
      expect(usage.sessionsUsed).toBeGreaterThan(0)
    })

    it('returns fallback values when getAll fails', async () => {
      mockStores.sessions.getAll.mockRejectedValueOnce(new Error('fail'))
      const usage = await mgr.getStorageUsage()
      expect(usage.sessionsUsed).toBe(0)
      expect(usage.sessionsCount).toBe(0)
      expect(usage.totalUsed).toBe(0)
      expect(usage.quota).toBe(0)
      expect(usage.percentUsed).toBe(0)
    })

    it('uses navigator.storage.estimate when available', async () => {
      const originalStorage = navigator.storage
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn(async () => ({ usage: 50000, quota: 1000000 }))
        },
        writable: true,
        configurable: true
      })

      const usage = await mgr.getStorageUsage()
      expect(usage.totalUsed).toBe(50000)
      expect(usage.quota).toBe(1000000)
      expect(parseFloat(usage.percentUsed)).toBeCloseTo(5.0, 1)

      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        writable: true,
        configurable: true
      })
    })
  })

  describe('clearFileCache()', () => {
    let originalIndexedDB

    beforeEach(() => {
      originalIndexedDB = globalThis.indexedDB
    })

    afterEach(() => {
      globalThis.indexedDB = originalIndexedDB
    })

    it('returns not-cleared when chunks database does not exist', async () => {
      globalThis.indexedDB = {
        databases: vi.fn(async () => []),
        deleteDatabase: vi.fn()
      }
      const result = await mgr.clearFileCache()
      expect(result.cleared).toBe(false)
      expect(result.message).toContain('No file cache')
    })

    it('deletes the chunks database when it exists', async () => {
      const deleteRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null
      }
      globalThis.indexedDB = {
        databases: vi.fn(async () => [{ name: 'BytesRevealerChunks' }]),
        deleteDatabase: vi.fn(() => {
          // Simulate async success
          setTimeout(() => {
            if (deleteRequest.onsuccess) deleteRequest.onsuccess()
          }, 0)
          return deleteRequest
        })
      }

      const result = await mgr.clearFileCache()
      expect(result.cleared).toBe(true)
      expect(result.message).toContain('successfully')
    })

    it('throws when deleteDatabase fails', async () => {
      const deleteRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
        error: new Error('delete error')
      }
      globalThis.indexedDB = {
        databases: vi.fn(async () => [{ name: 'BytesRevealerChunks' }]),
        deleteDatabase: vi.fn(() => {
          setTimeout(() => {
            if (deleteRequest.onerror) deleteRequest.onerror()
          }, 0)
          return deleteRequest
        })
      }

      await expect(mgr.clearFileCache()).rejects.toThrow('delete error')
    })
  })

  describe('getFileCacheSize()', () => {
    let originalIndexedDB

    beforeEach(() => {
      originalIndexedDB = globalThis.indexedDB
    })

    afterEach(() => {
      globalThis.indexedDB = originalIndexedDB
    })

    it('returns 0 when chunks database does not exist', async () => {
      globalThis.indexedDB = {
        databases: vi.fn(async () => [])
      }
      const size = await mgr.getFileCacheSize()
      expect(size).toBe(0)
    })

    it('returns 0 when navigator.storage is not available', async () => {
      globalThis.indexedDB = {
        databases: vi.fn(async () => [{ name: 'BytesRevealerChunks' }])
      }
      const originalStorage = navigator.storage
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        writable: true,
        configurable: true
      })

      const size = await mgr.getFileCacheSize()
      expect(size).toBe(0)

      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        writable: true,
        configurable: true
      })
    })

    it('estimates cache size using storage estimate minus sessions', async () => {
      globalThis.indexedDB = {
        databases: vi.fn(async () => [{ name: 'BytesRevealerChunks' }])
      }
      const originalStorage = navigator.storage
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn(async () => ({ usage: 500000, quota: 1000000 }))
        },
        writable: true,
        configurable: true
      })

      const size = await mgr.getFileCacheSize()
      // Should be totalUsage - sessionsSize - metadataOverhead, but at least 0
      expect(size).toBeGreaterThanOrEqual(0)
      expect(typeof size).toBe('number')

      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        writable: true,
        configurable: true
      })
    })

    it('returns 0 on error', async () => {
      globalThis.indexedDB = {
        databases: vi.fn(async () => {
          throw new Error('no databases')
        })
      }
      const size = await mgr.getFileCacheSize()
      expect(size).toBe(0)
    })
  })

  describe('full workflow integration', () => {
    it('save -> load -> update -> rename -> export -> delete', async () => {
      // Save
      const saved = await mgr.saveSession('Workflow', sampleAppState)
      expect(saved.id).toBeTruthy()

      // Load
      const loaded = await mgr.loadSession(saved.id)
      expect(loaded.name).toBe('Workflow')

      // Update
      const updated = await mgr.updateSession(saved.id, {
        ...sampleAppState,
        entropy: 7.0
      })
      expect(updated.analysis.entropy).toBe(7.0)

      // Rename
      const renamed = await mgr.renameSession(saved.id, 'Renamed')
      expect(renamed.name).toBe('Renamed')

      // Export
      const { blob, filename } = await mgr.exportSession(saved.id)
      expect(blob).toBeInstanceOf(Blob)
      expect(filename).toContain('renamed')

      // List
      const list = await mgr.listSessions()
      expect(list.length).toBe(1)

      // Delete
      await mgr.deleteSession(saved.id)

      // Verify deleted
      await expect(mgr.loadSession(saved.id)).rejects.toThrow('Session not found')
    })

    it('save -> export -> clear all -> import', async () => {
      const saved = await mgr.saveSession('Import Test', sampleAppState)
      const { blob } = await mgr.exportSession(saved.id)

      // Clear all
      await mgr.clearAllSessions()

      // Import
      const text = await blob.text()
      const file = {
        text: () => Promise.resolve(text),
        size: text.length,
        name: 'session.brsession'
      }
      const imported = await mgr.importSession(file)
      expect(imported.name).toBe('Import Test (imported)')
      expect(imported.id).not.toBe(saved.id) // New ID generated
    })
  })
})
