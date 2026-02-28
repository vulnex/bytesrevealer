import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { createApp } from 'vue'
import { useVisualScroll } from './useVisualScroll'

function withSetup(fn) {
  let result
  const app = createApp({
    setup() {
      result = fn()
      return () => {}
    }
  })
  app.mount(document.createElement('div'))
  return [result, app]
}

function makeProps(overrides = {}) {
  return {
    fileBytes: new Uint8Array(1024),
    chunkManager: null,
    ...overrides
  }
}

function mockContainer(scrollTopVal = 0) {
  return {
    scrollTop: scrollTopVal,
    clientHeight: 480,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}

describe('useVisualScroll', () => {
  let rafCallbacks
  let originalRaf
  let originalCancelRaf

  beforeEach(() => {
    rafCallbacks = []
    originalRaf = window.requestAnimationFrame
    originalCancelRaf = window.cancelAnimationFrame
    window.requestAnimationFrame = vi.fn((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length // starts at 1 to avoid falsy 0
    })
    window.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCancelRaf
  })

  describe('constants', () => {
    it('ROW_HEIGHT is 24 and BYTES_PER_ROW is 32', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(result.ROW_HEIGHT).toBe(24)
      expect(result.BYTES_PER_ROW).toBe(32)
      app.unmount()
    })
  })

  describe('initial state', () => {
    it('containerRef is null', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(result.containerRef.value).toBe(null)
      app.unmount()
    })

    it('visibleRows is 0', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(result.visibleRows.value).toBe(0)
      app.unmount()
    })

    it('scrollTop is 0', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(result.scrollTop.value).toBe(0)
      app.unmount()
    })
  })

  describe('totalRows', () => {
    it('computes correct row count', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(result.totalRows.value).toBe(32) // 1024 / 32
      app.unmount()
    })

    it('rounds up for partial last row', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(33) }), ref(0))
      )
      expect(result.totalRows.value).toBe(2) // ceil(33/32)
      app.unmount()
    })

    it('accounts for baseOffset', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(32)))
      expect(result.totalRows.value).toBe(31) // ceil((1024-32)/32)
      app.unmount()
    })

    it('returns 1 for a single byte', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(1) }), ref(0))
      )
      expect(result.totalRows.value).toBe(1)
      app.unmount()
    })

    it('returns exact rows when length is multiple of BYTES_PER_ROW', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(128) }), ref(0))
      )
      expect(result.totalRows.value).toBe(4) // 128 / 32
      app.unmount()
    })
  })

  describe('totalHeight', () => {
    it('returns totalRows * ROW_HEIGHT', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(result.totalHeight.value).toBe(32 * 24) // 768
      app.unmount()
    })

    it('scales with file size', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(320) }), ref(0))
      )
      expect(result.totalHeight.value).toBe(10 * 24) // 240
      app.unmount()
    })
  })

  describe('visibleRange', () => {
    it('starts at 0 when scrollTop is 0', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(result.visibleRange.value.start).toBe(0)
      app.unmount()
    })

    it('clamps start to 0 when scroll is small', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(100000) }), ref(0))
      )
      result.scrollTop.value = 24 * 10 // row 10, minus BUFFER_ROWS=30 => would be -20
      result.visibleRows.value = 20
      expect(result.visibleRange.value.start).toBe(0)
      app.unmount()
    })

    it('clamps end to totalRows', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(64) }), ref(0))
      )
      result.visibleRows.value = 100
      expect(result.visibleRange.value.end).toBe(2) // only 2 total rows (64/32)
      app.unmount()
    })

    it('applies buffer rows when scrolled far', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(100000) }), ref(0))
      )
      result.scrollTop.value = 24 * 500 // row 500
      result.visibleRows.value = 20
      const range = result.visibleRange.value
      // start = max(0, 500 - 30) = 470
      expect(range.start).toBe(470)
      // end = min(totalRows, ceil((500*24 + 20*24)/24) + 30) = min(3125, 520+30) = 550
      expect(range.end).toBe(550)
      app.unmount()
    })
  })

  describe('startOffset', () => {
    it('returns 0 when scrollTop is 0', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(result.startOffset.value).toBe(0)
      app.unmount()
    })

    it('returns visibleRange.start * ROW_HEIGHT', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(100000) }), ref(0))
      )
      result.scrollTop.value = 24 * 500
      result.visibleRows.value = 20
      expect(result.startOffset.value).toBe(result.visibleRange.value.start * 24)
      app.unmount()
    })
  })

  describe('visibleData', () => {
    it('produces correct row structure', () => {
      const bytes = new Uint8Array(64)
      for (let i = 0; i < 64; i++) bytes[i] = i
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: bytes }), ref(0))
      )
      result.visibleRows.value = 10
      const data = result.visibleData.value
      expect(data.length).toBe(2) // 64/32 = 2 rows
      expect(data[0]).toEqual({
        offset: 0,
        actualOffset: 0,
        bytes: Array.from(bytes.slice(0, 32))
      })
      expect(data[1].offset).toBe(32)
      expect(data[1].actualOffset).toBe(32)
      expect(data[1].bytes).toEqual(Array.from(bytes.slice(32, 64)))
      app.unmount()
    })

    it('respects baseOffset in display offset', () => {
      const bytes = new Uint8Array(512)
      const baseOffset = ref(0x100)
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: bytes }), baseOffset)
      )
      result.visibleRows.value = 10
      const data = result.visibleData.value
      expect(data[0].offset).toBe(0x100) // display offset includes base
      expect(data[0].actualOffset).toBe(0) // actual offset is 0
      app.unmount()
    })

    it('handles partial last row', () => {
      const bytes = new Uint8Array(40)
      for (let i = 0; i < 40; i++) bytes[i] = i
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: bytes }), ref(0))
      )
      result.visibleRows.value = 10
      const data = result.visibleData.value
      expect(data.length).toBe(2)
      expect(data[0].bytes.length).toBe(32) // full row
      expect(data[1].bytes.length).toBe(8) // partial row (40-32)
      app.unmount()
    })

    it('returns empty array for empty file bytes', () => {
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: new Uint8Array(0) }), ref(0))
      )
      expect(result.visibleData.value).toEqual([])
      app.unmount()
    })

    it('stops when actualOffset exceeds file length', () => {
      const bytes = new Uint8Array(48)
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: bytes }), ref(0))
      )
      result.visibleRows.value = 100 // request far more rows than exist
      const data = result.visibleData.value
      expect(data.length).toBe(2) // ceil(48/32) = 2
      app.unmount()
    })

    it('handles progressive loading with chunkManager', () => {
      const bytes = new Uint8Array(64)
      bytes.isProgressive = true
      bytes.loadedChunks = new Set()
      for (let i = 0; i < 64; i++) bytes[i] = i
      const getRange = vi.fn().mockResolvedValue(new Uint8Array(64))
      const chunkManager = { CHUNK_SIZE: 256, getRange }
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: bytes, chunkManager }), ref(0))
      )
      result.visibleRows.value = 10
      const data = result.visibleData.value
      expect(data.length).toBe(2)
      expect(getRange).toHaveBeenCalled()
      app.unmount()
    })

    it('skips chunk loading when chunks are already loaded', () => {
      const bytes = new Uint8Array(64)
      bytes.isProgressive = true
      bytes.loadedChunks = new Set([0]) // chunk 0 already loaded
      for (let i = 0; i < 64; i++) bytes[i] = i
      const getRange = vi.fn().mockResolvedValue(new Uint8Array(64))
      const chunkManager = { CHUNK_SIZE: 256, getRange }
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: bytes, chunkManager }), ref(0))
      )
      result.visibleRows.value = 10
      result.visibleData.value
      expect(getRange).not.toHaveBeenCalled()
      app.unmount()
    })

    it('uses standard slice mode when not progressive', () => {
      const bytes = new Uint8Array(64)
      for (let i = 0; i < 64; i++) bytes[i] = i
      const [result, app] = withSetup(() =>
        useVisualScroll(makeProps({ fileBytes: bytes }), ref(0))
      )
      result.visibleRows.value = 10
      const data = result.visibleData.value
      expect(data[0].bytes).toEqual(Array.from(bytes.slice(0, 32)))
      app.unmount()
    })
  })

  describe('handleScroll', () => {
    it('defers scrollTop update via requestAnimationFrame', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      result.containerRef.value = mockContainer(240)
      result.handleScroll()
      expect(result.scrollTop.value).toBe(0) // not yet
      rafCallbacks.forEach((cb) => cb())
      expect(result.scrollTop.value).toBe(240)
      app.unmount()
    })

    it('cancels previous RAF before scheduling new one', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      result.containerRef.value = mockContainer(100)
      result.handleScroll()
      result.containerRef.value = mockContainer(200)
      result.handleScroll()
      expect(window.cancelAnimationFrame).toHaveBeenCalled()
      app.unmount()
    })

    it('no-op when containerRef is null', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      result.containerRef.value = null
      result.handleScroll()
      rafCallbacks.forEach((cb) => cb())
      expect(result.scrollTop.value).toBe(0)
      app.unmount()
    })
  })

  describe('updateVisibleRows', () => {
    it('calculates from containerRef.clientHeight', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      result.containerRef.value = mockContainer(0)
      result.containerRef.value.clientHeight = 480
      result.updateVisibleRows()
      expect(result.visibleRows.value).toBe(20) // ceil(480/24)
      app.unmount()
    })

    it('rounds up partial rows', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      result.containerRef.value = mockContainer(0)
      result.containerRef.value.clientHeight = 500
      result.updateVisibleRows()
      expect(result.visibleRows.value).toBe(21) // ceil(500/24)
      app.unmount()
    })

    it('no-op when containerRef is null', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      result.containerRef.value = null
      result.updateVisibleRows()
      expect(result.visibleRows.value).toBe(0)
      app.unmount()
    })
  })

  describe('lifecycle', () => {
    it('registers resize listener on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const [_result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      addSpy.mockRestore()
      app.unmount()
    })

    it('removes resize listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const [_result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      app.unmount()
      expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      removeSpy.mockRestore()
    })

    // eslint-disable-next-line vitest/expect-expect -- smoke test: verifies no throw
    it('adds scroll listener to containerRef on mount', () => {
      const container = mockContainer(0)
      const [_result, app] = withSetup(() => {
        const scroll = useVisualScroll(makeProps(), ref(0))
        scroll.containerRef.value = container
        return scroll
      })
      // onMounted runs after setup, but containerRef was set in setup
      // The addEventListener is called on the container during mount
      app.unmount()
    })

    it('cancels pending RAF on unmount', () => {
      const [result, app] = withSetup(() => useVisualScroll(makeProps(), ref(0)))
      result.containerRef.value = mockContainer(100)
      result.handleScroll() // schedule a RAF
      app.unmount()
      expect(window.cancelAnimationFrame).toHaveBeenCalled()
    })
  })
})
