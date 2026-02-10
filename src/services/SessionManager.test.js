import { describe, it, expect, beforeEach } from 'vitest'
import { SessionManager } from './SessionManager.js'

// Test only the pure, synchronous methods that don't require IndexedDB

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
      const map = new Map([['a', 1], ['b', 2]])
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
        start: 0, end: 10, color: '#ff0000', label: 'header'
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
