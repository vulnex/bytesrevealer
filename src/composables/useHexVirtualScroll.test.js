import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { createApp } from 'vue'
import { useHexVirtualScroll } from './useHexVirtualScroll'

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

describe('useHexVirtualScroll', () => {
  let rafCallbacks
  let originalRaf
  let originalCancelRaf

  beforeEach(() => {
    rafCallbacks = []
    originalRaf = window.requestAnimationFrame
    originalCancelRaf = window.cancelAnimationFrame
    window.requestAnimationFrame = vi.fn((cb) => {
      const id = rafCallbacks.length
      rafCallbacks.push(cb)
      return id
    })
    window.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCancelRaf
  })

  function makeProps(length) {
    return { fileBytes: new Uint8Array(length) }
  }

  describe('constants', () => {
    it('ROW_HEIGHT is 24 and BYTES_PER_ROW is 16', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      expect(result.ROW_HEIGHT).toBe(24)
      expect(result.BYTES_PER_ROW).toBe(16)
      app.unmount()
    })
  })

  describe('totalRows', () => {
    it('computes correct row count', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      expect(result.totalRows.value).toBe(16) // 256 / 16
      app.unmount()
    })

    it('rounds up for partial last row', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(17), ref(0)))
      expect(result.totalRows.value).toBe(2) // ceil(17/16)
      app.unmount()
    })

    it('accounts for baseOffset', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(16)))
      expect(result.totalRows.value).toBe(15) // ceil((256-16)/16)
      app.unmount()
    })
  })

  describe('totalHeight', () => {
    it('returns 600 in virtual navigation mode', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      result.useVirtualNavigation.value = true
      expect(result.totalHeight.value).toBe(600)
      app.unmount()
    })

    it('returns totalRows * ROW_HEIGHT normally', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      expect(result.totalHeight.value).toBe(16 * 24) // 384
      app.unmount()
    })
  })

  describe('visibleRange', () => {
    it('centers on forceViewRow when set', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(1024), ref(0)))
      result.forceViewRow.value = 30
      expect(result.visibleRange.value.start).toBe(15) // 30 - 15
      expect(result.visibleRange.value.end).toBe(45) // 30 + 15
      app.unmount()
    })

    it('clamps forceViewRow range to bounds', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      result.forceViewRow.value = 5
      expect(result.visibleRange.value.start).toBe(0) // max(0, 5-15)
      expect(result.visibleRange.value.end).toBe(16) // min(16, 5+15)
      app.unmount()
    })

    it('uses virtualOffset in virtual nav mode', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(4096), ref(0)))
      result.useVirtualNavigation.value = true
      result.virtualOffset.value = 320 // row 20
      expect(result.visibleRange.value.start).toBe(5) // max(0, 20-15)
      expect(result.visibleRange.value.end).toBe(35) // min(256, 20+15)
      app.unmount()
    })

    it('uses scrollTop normally with buffer rows', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(100000), ref(0)))
      result.scrollTop.value = 2400 // row 100
      result.visibleRows.value = 20
      const range = result.visibleRange.value
      expect(range.start).toBe(0) // max(0, 100 - 200)
      expect(range.end).toBe(Math.min(6250, 100 + 20 + 200))
      app.unmount()
    })
  })

  describe('startOffset', () => {
    it('returns 0 in virtual navigation mode', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      result.useVirtualNavigation.value = true
      expect(result.startOffset.value).toBe(0)
      app.unmount()
    })

    it('returns visibleRange.start * ROW_HEIGHT normally', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(100000), ref(0)))
      result.scrollTop.value = 24 * 500 // row 500
      result.visibleRows.value = 20
      expect(result.startOffset.value).toBe(result.visibleRange.value.start * 24)
      app.unmount()
    })
  })

  describe('visibleData', () => {
    it('produces correct row structure', () => {
      const bytes = new Uint8Array(48)
      for (let i = 0; i < 48; i++) bytes[i] = i
      const props = { fileBytes: bytes }
      const [result, app] = withSetup(() => useHexVirtualScroll(props, ref(0)))
      result.forceViewRow.value = 1
      const data = result.visibleData.value
      expect(data.length).toBe(3)
      expect(data[0]).toEqual({
        offset: 0,
        actualOffset: 0,
        bytes: Array.from(bytes.slice(0, 16))
      })
      expect(data[1].offset).toBe(16)
      expect(data[1].actualOffset).toBe(16)
      app.unmount()
    })

    it('respects baseOffset in display offset', () => {
      const bytes = new Uint8Array(512)
      const props = { fileBytes: bytes }
      const baseOffset = ref(0x10)
      const [result, app] = withSetup(() => useHexVirtualScroll(props, baseOffset))
      result.forceViewRow.value = 0
      const data = result.visibleData.value
      expect(data[0].offset).toBe(0x10)
      expect(data[0].actualOffset).toBe(0)
      app.unmount()
    })

    it('handles partial last row', () => {
      const bytes = new Uint8Array(20)
      for (let i = 0; i < 20; i++) bytes[i] = i
      const props = { fileBytes: bytes }
      const [result, app] = withSetup(() => useHexVirtualScroll(props, ref(0)))
      result.forceViewRow.value = 0
      const data = result.visibleData.value
      expect(data.length).toBe(2)
      expect(data[1].bytes.length).toBe(4) // only 4 bytes in last row
      app.unmount()
    })
  })

  function mockContainer(scrollTopVal) {
    return {
      scrollTop: scrollTopVal,
      clientHeight: 400,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  }

  describe('handleScroll', () => {
    it('no-op in virtual navigation mode', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      result.useVirtualNavigation.value = true
      result.containerRef.value = mockContainer(999)
      result.handleScroll()
      expect(result.scrollTop.value).toBe(0)
      app.unmount()
    })

    it('updates scrollTop immediately when immediate=true', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      result.containerRef.value = mockContainer(120)
      result.handleScroll(true)
      expect(result.scrollTop.value).toBe(120)
      app.unmount()
    })

    it('defers via requestAnimationFrame when immediate=false', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      result.containerRef.value = mockContainer(240)
      result.handleScroll(false)
      expect(result.scrollTop.value).toBe(0) // not yet updated
      // Execute the RAF callback
      rafCallbacks.forEach((cb) => cb())
      expect(result.scrollTop.value).toBe(240)
      app.unmount()
    })
  })

  describe('updateVisibleRows', () => {
    it('calculates from containerRef.clientHeight', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      result.containerRef.value = mockContainer(0)
      result.containerRef.value.clientHeight = 480
      result.updateVisibleRows()
      expect(result.visibleRows.value).toBe(20) // ceil(480/24)
      app.unmount()
    })

    it('no-op when containerRef is null', () => {
      const [result, app] = withSetup(() => useHexVirtualScroll(makeProps(256), ref(0)))
      result.containerRef.value = null
      result.updateVisibleRows()
      expect(result.visibleRows.value).toBe(0)
      app.unmount()
    })
  })
})
