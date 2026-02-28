import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, reactive } from 'vue'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../stores/session'
import { useFormatStore } from '../stores/format'
import { useSettingsStore } from '../stores/settings'
import { useYaraStore } from '../stores/yara'
import { useSessionRestore } from './useSessionRestore'

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

function withSetup(fn) {
  let result
  const app = createApp({ setup() { result = fn(); return () => {} } })
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  app.mount(document.createElement('div'))
  return [result, app]
}

function makeDeps(overrides = {}) {
  return {
    fileName: overrides.fileName || ref(null),
    fileBytes: overrides.fileBytes || ref(new Uint8Array()),
    entropy: overrides.entropy || ref(0),
    hashes: overrides.hashes || ref({ md5: '', sha1: '', sha256: '' }),
    fileSignatures: overrides.fileSignatures || ref([]),
    detectedFileType: overrides.detectedFileType || ref(null),
    searchPattern: overrides.searchPattern || ref(''),
    searchType: overrides.searchType || ref('hex'),
    highlightedBytes: overrides.highlightedBytes || ref([]),
    coloredBytes: overrides.coloredBytes || ref([]),
    notes: overrides.notes || ref(''),
    bookmarks: overrides.bookmarks || ref([]),
    annotations: overrides.annotations || ref([]),
    tags: overrides.tags || ref([]),
    features: overrides.features || reactive({
      fileAnalysis: true,
      visualView: true,
      hexView: true,
      stringAnalysis: true,
      yaraScanning: true
    }),
    activeTab: overrides.activeTab || ref('info'),
    activeGraphTab: overrides.activeGraphTab || ref('entropy')
  }
}

describe('useSessionRestore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('hasSessionData is false', () => {
      const [result, app] = withSetup(() => useSessionRestore(makeDeps()))
      expect(result.hasSessionData.value).toBe(false)
      app.unmount()
    })

    it('pendingSessionFile is null', () => {
      const [result, app] = withSetup(() => useSessionRestore(makeDeps()))
      expect(result.pendingSessionFile.value).toBeNull()
      app.unmount()
    })
  })

  describe('currentAppState', () => {
    it('aggregates all deps and store state', () => {
      const deps = makeDeps({
        fileName: ref('test.bin'),
        entropy: ref(3.5),
        activeTab: ref('hex'),
        activeGraphTab: ref('byteFreq'),
        notes: ref('my notes')
      })

      const [result, app] = withSetup(() => useSessionRestore(deps))

      const state = result.currentAppState.value
      expect(state.fileName).toBe('test.bin')
      expect(state.entropy).toBe(3.5)
      expect(state.activeTab).toBe('hex')
      expect(state.activeGraphTab).toBe('byteFreq')
      expect(state.notes).toBe('my notes')
      expect(state.features).toBeDefined()
      expect(state.baseOffset).toBe(0)
      expect(state.formatStore).toBeDefined()
      expect(state.formatStore.selectedFormatId).toBe('')
      expect(state.yaraState).toBeDefined()
      app.unmount()
    })
  })

  describe('handleSessionLoaded', () => {
    it('restores full session state', () => {
      const deps = makeDeps()

      const [result, app] = withSetup(() => useSessionRestore(deps))

      result.handleSessionLoaded({
        name: 'Test Session',
        file: { name: 'restored.bin' },
        state: {
          activeGraphTab: 'byteFreq',
          features: { fileAnalysis: false, visualView: true, hexView: true, stringAnalysis: false, yaraScanning: true },
          searchPattern: 'FF00',
          searchType: 'ascii',
          highlightedBytes: [0, 1],
          coloredBytes: [{ start: 0, end: 5, color: '#f00' }],
          baseOffset: 256
        },
        analysis: {
          entropy: 6.2,
          hashes: { md5: 'aaa', sha1: 'bbb', sha256: 'ccc' },
          fileSignatures: [{ type: 'PE' }],
          detectedFileType: { ext: 'exe' }
        },
        format: {
          selectedFormatId: 'pe',
          isAutoDetected: true,
          confidence: 0.95,
          kaitaiStructures: [{ name: 'header' }]
        },
        annotations: {
          notes: 'session notes',
          bookmarks: [{ id: 'bm1' }],
          annotations: [{ id: 'an1' }],
          tags: ['tag1']
        },
        yara: {
          currentRules: 'rule test {}',
          matchedRules: []
        }
      })

      expect(result.hasSessionData.value).toBe(true)
      expect(result.pendingSessionFile.value).toEqual({ name: 'restored.bin' })
      expect(deps.fileName.value).toBe('restored.bin')
      expect(deps.searchPattern.value).toBe('FF00')
      expect(deps.searchType.value).toBe('ascii')
      expect(deps.highlightedBytes.value).toEqual([0, 1])
      expect(deps.coloredBytes.value).toEqual([{ start: 0, end: 5, color: '#f00' }])
      expect(deps.features.fileAnalysis).toBe(false)
      expect(deps.features.stringAnalysis).toBe(false)
      expect(deps.activeGraphTab.value).toBe('byteFreq')

      // Analysis
      expect(deps.entropy.value).toBe(6.2)
      expect(deps.hashes.value).toEqual({ md5: 'aaa', sha1: 'bbb', sha256: 'ccc' })
      expect(deps.fileSignatures.value).toEqual([{ type: 'PE' }])
      expect(deps.detectedFileType.value).toEqual({ ext: 'exe' })

      // Format store
      const formatStore = useFormatStore()
      expect(formatStore.selectedFormatId).toBe('pe')
      expect(formatStore.isAutoDetected).toBe(true)
      expect(formatStore.confidence).toBe(0.95)
      expect(formatStore.kaitaiStructures).toEqual([{ name: 'header' }])

      // Settings store
      const settingsStore = useSettingsStore()
      expect(settingsStore.baseOffset).toBe(256)

      // Annotations
      expect(deps.notes.value).toBe('session notes')
      expect(deps.bookmarks.value).toEqual([{ id: 'bm1' }])
      expect(deps.annotations.value).toEqual([{ id: 'an1' }])
      expect(deps.tags.value).toEqual(['tag1'])

      // YARA
      const yaraStore = useYaraStore()
      expect(yaraStore.currentRules).toBe('rule test {}')

      // isDirty should be false after load
      const sessionStore = useSessionStore()
      expect(sessionStore.isDirty).toBe(false)

      app.unmount()
    })

    it('handles missing state section gracefully', () => {
      const deps = makeDeps()
      const [result, app] = withSetup(() => useSessionRestore(deps))

      expect(() => {
        result.handleSessionLoaded({
          name: 'Minimal Session'
        })
      }).not.toThrow()

      expect(result.hasSessionData.value).toBe(true)
      expect(result.pendingSessionFile.value).toBeNull()
      app.unmount()
    })

    it('handles missing analysis section gracefully', () => {
      const deps = makeDeps()
      const [result, app] = withSetup(() => useSessionRestore(deps))

      expect(() => {
        result.handleSessionLoaded({
          name: 'No Analysis',
          state: { features: { fileAnalysis: true } }
        })
      }).not.toThrow()

      expect(deps.entropy.value).toBe(0) // unchanged
      app.unmount()
    })

    it('handles missing format section gracefully', () => {
      const deps = makeDeps()
      const [result, app] = withSetup(() => useSessionRestore(deps))

      expect(() => {
        result.handleSessionLoaded({
          name: 'No Format',
          state: { features: {} }
        })
      }).not.toThrow()

      const formatStore = useFormatStore()
      expect(formatStore.selectedFormatId).toBe('')
      app.unmount()
    })

    it('handles missing annotations section gracefully', () => {
      const deps = makeDeps()
      const [result, app] = withSetup(() => useSessionRestore(deps))

      expect(() => {
        result.handleSessionLoaded({
          name: 'No Annotations',
          state: { features: {} }
        })
      }).not.toThrow()

      expect(deps.notes.value).toBe('')
      expect(deps.bookmarks.value).toEqual([])
      app.unmount()
    })

    it('handles missing yara section gracefully', () => {
      const deps = makeDeps()
      const [result, app] = withSetup(() => useSessionRestore(deps))

      expect(() => {
        result.handleSessionLoaded({
          name: 'No YARA',
          state: { features: {} }
        })
      }).not.toThrow()

      const yaraStore = useYaraStore()
      expect(yaraStore.currentRules).toBe('')
      app.unmount()
    })
  })

  describe('handleSessionSaved', () => {
    it('does not throw', () => {
      const [result, app] = withSetup(() => useSessionRestore(makeDeps()))
      expect(() => {
        result.handleSessionSaved({ name: 'Saved Session' })
      }).not.toThrow()
      app.unmount()
    })
  })

  describe('clearSessionState', () => {
    it('resets both flags', () => {
      const [result, app] = withSetup(() => useSessionRestore(makeDeps()))
      result.hasSessionData.value = true
      result.pendingSessionFile.value = { name: 'file.bin' }

      result.clearSessionState()

      expect(result.hasSessionData.value).toBe(false)
      expect(result.pendingSessionFile.value).toBeNull()
      app.unmount()
    })
  })
})
