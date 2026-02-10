import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useFormatStore } from '../stores/format'
import { useKaitaiIntegration } from './useKaitaiIntegration'

vi.mock('../kaitai/runtime/KaitaiRuntime', () => ({
  getKaitaiRuntime: vi.fn(() => ({
    formatRegistry: {
      initialize: vi.fn().mockResolvedValue(),
      registerFormat: vi.fn().mockResolvedValue()
    },
    parseViewport: vi.fn().mockResolvedValue([])
  }))
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

function makeContext(overrides = {}) {
  return {
    hoveredByte: overrides.hoveredByte || ref(null),
    visibleRange: overrides.visibleRange || ref({ start: 0, end: 30 }),
    containerRef: overrides.containerRef || ref(null)
  }
}

describe('useKaitaiIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('kaitaiRuntime is null', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      expect(result.kaitaiRuntime.value).toBe(null)
      app.unmount()
    })

    it('activeTab is inspector', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      expect(result.activeTab.value).toBe('inspector')
      app.unmount()
    })

    it('kaitaiSupported is false', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      expect(result.kaitaiSupported.value).toBe(false)
      app.unmount()
    })

    it('kaitaiError is null', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      expect(result.kaitaiError.value).toBe(null)
      app.unmount()
    })

    it('structureHighlight is null', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      expect(result.structureHighlight.value).toBe(null)
      app.unmount()
    })
  })

  describe('hasKsyFormat', () => {
    it('returns true when formatStore has structures', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      const store = useFormatStore()
      store.setStructures([{ name: 'header', offset: 0, size: 4 }])
      expect(result.hasKsyFormat.value).toBe(true)
      app.unmount()
    })

    it('returns false when formatStore is empty', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      expect(result.hasKsyFormat.value).toBe(false)
      app.unmount()
    })
  })

  describe('handleStructureHover', () => {
    it('sets structureHighlight and hoveredByte for valid structure', () => {
      const hoveredByte = ref(null)
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext({ hoveredByte }))
      )
      result.handleStructureHover({ offset: 10, size: 4 })
      expect(result.structureHighlight.value).toEqual({ start: 10, end: 14 })
      expect(hoveredByte.value).toBe(10)
      app.unmount()
    })

    it('uses size 1 when size is 0/falsy', () => {
      const hoveredByte = ref(null)
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext({ hoveredByte }))
      )
      result.handleStructureHover({ offset: 5, size: 0 })
      expect(result.structureHighlight.value).toEqual({ start: 5, end: 6 })
      app.unmount()
    })

    it('clears highlight for null structure', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      result.handleStructureHover({ offset: 10, size: 4 })
      result.handleStructureHover(null)
      expect(result.structureHighlight.value).toBe(null)
      app.unmount()
    })
  })

  describe('handleStructureSelect', () => {
    it('scrolls containerRef to correct row', () => {
      const containerRef = ref({ scrollTop: 0 })
      const hoveredByte = ref(null)
      const [result, app] = withSetup(() =>
        useKaitaiIntegration(
          { fileBytes: new Uint8Array(1024) },
          makeContext({ containerRef, hoveredByte })
        )
      )
      result.handleStructureSelect({ offset: 48 }) // row 3
      expect(containerRef.value.scrollTop).toBe(3 * 24) // 72
      expect(hoveredByte.value).toBe(48)
      app.unmount()
    })

    it('ignores null structure', () => {
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useKaitaiIntegration(
          { fileBytes: new Uint8Array(64) },
          makeContext({ containerRef })
        )
      )
      result.handleStructureSelect(null)
      expect(containerRef.value.scrollTop).toBe(0)
      app.unmount()
    })
  })

  describe('handleStructureHighlight', () => {
    it('sets range directly', () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      const range = { start: 5, end: 20 }
      result.handleStructureHighlight(range)
      expect(result.structureHighlight.value).toEqual(range)
      app.unmount()
    })
  })

  describe('handleFormatChanged', () => {
    it('clears formatStore when event.cleared is true', async () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      const store = useFormatStore()
      store.setStructures([{ name: 'test' }])
      await result.handleFormatChanged({ cleared: true })
      expect(store.kaitaiStructures).toEqual([])
      app.unmount()
    })

    it('clears formatStore when event.format is falsy', async () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      const store = useFormatStore()
      store.setStructures([{ name: 'test' }])
      await result.handleFormatChanged({ format: null })
      expect(store.kaitaiStructures).toEqual([])
      app.unmount()
    })
  })

  describe('initializeKaitai', () => {
    it('sets kaitaiSupported and kaitaiRuntime on success', async () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(64) }, makeContext())
      )
      await result.initializeKaitai()
      expect(result.kaitaiSupported.value).toBe(true)
      expect(result.kaitaiRuntime.value).not.toBe(null)
      expect(result.kaitaiRuntime.value.formatRegistry).toBeDefined()
      app.unmount()
    })

    it('sets error for files over 500MB', async () => {
      const bigBytes = new Uint8Array(501 * 1024 * 1024)
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: bigBytes }, makeContext())
      )
      await result.initializeKaitai()
      expect(result.kaitaiSupported.value).toBe(false)
      expect(result.kaitaiError.value).toContain('500MB')
      app.unmount()
    })
  })

  describe('parseViewport', () => {
    it('populates formatStore structures from parsed fields', async () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(256) }, makeContext())
      )
      await result.initializeKaitai()

      const fields = [
        { name: 'magic', value: 'MZ', offset: 0, size: 2, fields: [] },
        { name: 'header', value: null, offset: 2, size: 10, fields: [{ name: 'sub' }] }
      ]
      result.kaitaiRuntime.value.parseViewport.mockResolvedValueOnce(fields)

      await result.parseViewport('pe')
      const store = useFormatStore()
      expect(store.kaitaiStructures.length).toBe(2)
      expect(store.kaitaiStructures[0]).toEqual({
        name: 'magic', value: 'MZ', offset: 0, size: 2, fields: []
      })
      expect(store.kaitaiStructures[1].fields).toEqual([{ name: 'sub' }])
      app.unmount()
    })

    it('sets kaitaiError on failure', async () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(256) }, makeContext())
      )
      await result.initializeKaitai()
      result.kaitaiRuntime.value.parseViewport.mockRejectedValueOnce(new Error('parse boom'))

      await result.parseViewport('bad')
      expect(result.kaitaiError.value).toBe('Failed to parse file structure')
      expect(result.kaitaiLoading.value).toBe(false)
      app.unmount()
    })

    it('no-op when runtime is null', async () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(256) }, makeContext())
      )
      await result.parseViewport('pe')
      const store = useFormatStore()
      expect(store.kaitaiStructures.length).toBe(0)
      app.unmount()
    })

    it('sets empty structures when fields is not an array', async () => {
      const [result, app] = withSetup(() =>
        useKaitaiIntegration({ fileBytes: new Uint8Array(256) }, makeContext())
      )
      await result.initializeKaitai()
      result.kaitaiRuntime.value.parseViewport.mockResolvedValueOnce(null)

      await result.parseViewport('pe')
      const store = useFormatStore()
      expect(store.kaitaiStructures).toEqual([])
      app.unmount()
    })
  })
})
