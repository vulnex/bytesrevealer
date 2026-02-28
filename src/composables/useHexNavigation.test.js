import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { createApp } from 'vue'
import { useHexNavigation } from './useHexNavigation'

function withSetup(fn) {
  let result
  const app = createApp({ setup() { result = fn(); return () => {} } })
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

function makeDeps(overrides = {}) {
  return {
    containerRef: ref(null),
    ROW_HEIGHT: 24,
    BYTES_PER_ROW: 16,
    totalRows: ref(64), // 1024 / 16
    scrollTop: ref(0),
    forceViewRow: ref(null),
    useVirtualNavigation: ref(false),
    virtualOffset: ref(0),
    navigationInProgress: ref(false),
    handleScroll: vi.fn(),
    hoveredByte: ref(null),
    baseOffset: ref(0),
    ...overrides
  }
}

describe('useHexNavigation', () => {
  let originalAlert

  beforeEach(() => {
    originalAlert = window.alert
    window.alert = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    window.alert = originalAlert
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('jumpOffset is empty string', () => {
      const [result, app] = withSetup(() => useHexNavigation(makeProps(), makeDeps()))
      expect(result.jumpOffset.value).toBe('')
      app.unmount()
    })
  })

  describe('handleJump', () => {
    it('parses hex input with 0x prefix', () => {
      const hoveredByte = ref(null)
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ hoveredByte, containerRef }))
      )

      result.jumpOffset.value = '0x10'
      result.handleJump()

      expect(hoveredByte.value).toBe(16)
      expect(containerRef.value.scrollTop).toBe(Math.floor(16 / 16) * 24)
      expect(result.jumpOffset.value).toBe('')
      app.unmount()
    })

    it('parses decimal input', () => {
      const hoveredByte = ref(null)
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ hoveredByte, containerRef }))
      )

      result.jumpOffset.value = '100'
      result.handleJump()

      expect(hoveredByte.value).toBe(100)
      app.unmount()
    })

    it('parses hex input without 0x prefix', () => {
      const hoveredByte = ref(null)
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ hoveredByte, containerRef }))
      )

      result.jumpOffset.value = 'ff'
      result.handleJump()

      expect(hoveredByte.value).toBe(255)
      app.unmount()
    })

    it('alerts on invalid offset (NaN)', () => {
      const [result, app] = withSetup(() => useHexNavigation(makeProps(), makeDeps()))

      result.jumpOffset.value = 'xyz'
      result.handleJump()

      expect(window.alert).toHaveBeenCalledWith(
        'Invalid offset. Please enter a valid offset within file bounds.'
      )
      app.unmount()
    })

    it('alerts on negative offset', () => {
      const [result, app] = withSetup(() => useHexNavigation(makeProps(), makeDeps()))

      result.jumpOffset.value = '-1'
      result.handleJump()

      expect(window.alert).toHaveBeenCalled()
      app.unmount()
    })

    it('alerts on offset beyond file bounds', () => {
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps({ fileBytes: new Uint8Array(100) }), makeDeps())
      )

      result.jumpOffset.value = '100'
      result.handleJump()

      expect(window.alert).toHaveBeenCalled()
      app.unmount()
    })

    it('does not scroll when containerRef is null', () => {
      const hoveredByte = ref(null)
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ hoveredByte, containerRef: ref(null) }))
      )

      result.jumpOffset.value = '0x10'
      result.handleJump()

      expect(hoveredByte.value).toBe(16)
      app.unmount()
    })

    it('accounts for baseOffset when setting hoveredByte', () => {
      const hoveredByte = ref(null)
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ hoveredByte, containerRef, baseOffset: ref(100) }))
      )

      result.jumpOffset.value = '0x10'
      result.handleJump()

      // actualOffset = 16 - 100 = -84
      expect(hoveredByte.value).toBe(16 - 100)
      app.unmount()
    })

    it('clears hoveredByte after 1500ms timeout', () => {
      const hoveredByte = ref(null)
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ hoveredByte, containerRef }))
      )

      result.jumpOffset.value = '0x10'
      result.handleJump()

      expect(hoveredByte.value).toBe(16)
      vi.advanceTimersByTime(1500)
      expect(hoveredByte.value).toBe(null)
      app.unmount()
    })

    it('does not clear hoveredByte if it changed before timeout', () => {
      const hoveredByte = ref(null)
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ hoveredByte, containerRef }))
      )

      result.jumpOffset.value = '0x10'
      result.handleJump()

      expect(hoveredByte.value).toBe(16)
      hoveredByte.value = 42 // user hovered somewhere else
      vi.advanceTimersByTime(1500)
      expect(hoveredByte.value).toBe(42) // should not be cleared
      app.unmount()
    })

    it('clears jumpOffset after successful jump', () => {
      const containerRef = ref({ scrollTop: 0 })
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ containerRef }))
      )

      result.jumpOffset.value = '0x10'
      result.handleJump()

      expect(result.jumpOffset.value).toBe('')
      app.unmount()
    })
  })

  describe('navigateToOffset', () => {
    it('returns false when navigationInProgress is true', async () => {
      const navigationInProgress = ref(true)
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ navigationInProgress }))
      )

      const ret = await result.navigateToOffset(0)
      expect(ret).toBe(false)
      app.unmount()
    })

    it('returns false when containerRef is null', async () => {
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ containerRef: ref(null) }))
      )

      const ret = await result.navigateToOffset(0)
      expect(ret).toBe(false)
      app.unmount()
    })

    it('sets navigationInProgress during navigation and clears it after', async () => {
      const navigationInProgress = ref(false)
      const container = { scrollTop: 0, clientHeight: 600 }
      const handleScroll = vi.fn()
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({
          navigationInProgress,
          containerRef: ref(container),
          handleScroll
        }))
      )

      const promise = result.navigateToOffset(32)
      expect(navigationInProgress.value).toBe(true)
      await promise
      expect(navigationInProgress.value).toBe(false)
      app.unmount()
    })

    it('scrolls to correct position for normal-size files', async () => {
      const scrollTop = ref(0)
      const container = { scrollTop: 0, clientHeight: 600 }
      const handleScroll = vi.fn()
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({
          scrollTop,
          containerRef: ref(container),
          handleScroll,
          totalRows: ref(64)
        }))
      )

      await result.navigateToOffset(256)
      // Row 16, centered in viewport
      expect(handleScroll).toHaveBeenCalledWith(true)
      expect(scrollTop.value).toBeGreaterThanOrEqual(0)
      app.unmount()
    })

    it('uses virtual navigation for very large files', async () => {
      vi.useRealTimers()
      const forceViewRow = ref(null)
      const useVirtualNavigation = ref(false)
      const virtualOffset = ref(0)
      const scrollTop = ref(0)
      // totalRows * ROW_HEIGHT > 30000000
      const totalRows = ref(2000000) // 2M rows * 24 = 48M > 30M
      const container = { scrollTop: 0, clientHeight: 600 }
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({
          forceViewRow,
          useVirtualNavigation,
          virtualOffset,
          scrollTop,
          totalRows,
          containerRef: ref(container)
        }))
      )

      await result.navigateToOffset(1000)
      expect(useVirtualNavigation.value).toBe(true)
      expect(virtualOffset.value).toBe(1000)
      expect(forceViewRow.value).toBe(Math.floor(1000 / 16))
      app.unmount()
    })

    it('resets virtual navigation for small files', async () => {
      const forceViewRow = ref(5)
      const useVirtualNavigation = ref(true)
      const virtualOffset = ref(100)
      const container = { scrollTop: 0, clientHeight: 600 }
      const handleScroll = vi.fn()
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({
          forceViewRow,
          useVirtualNavigation,
          virtualOffset,
          containerRef: ref(container),
          handleScroll,
          totalRows: ref(64) // 64 * 24 = 1536 < 30M
        }))
      )

      await result.navigateToOffset(32)
      expect(useVirtualNavigation.value).toBe(false)
      expect(virtualOffset.value).toBe(0)
      expect(forceViewRow.value).toBe(null)
      app.unmount()
    })

    it('loads chunks for progressive files', async () => {
      vi.useRealTimers()
      const getRange = vi.fn().mockResolvedValue(new Uint8Array(256))
      const fileBytes = new Uint8Array(1024)
      fileBytes.isProgressive = true
      const chunkManager = {
        CHUNK_SIZE: 256,
        totalChunks: 4,
        getRange
      }
      const container = { scrollTop: 0, clientHeight: 600 }
      const handleScroll = vi.fn()

      const [result, app] = withSetup(() =>
        useHexNavigation(
          makeProps({ fileBytes, chunkManager }),
          makeDeps({ containerRef: ref(container), handleScroll })
        )
      )

      await result.navigateToOffset(300)
      expect(getRange).toHaveBeenCalled()
      app.unmount()
    })
  })

  describe('scrollToOffset', () => {
    it('delegates to navigateToOffset', async () => {
      const container = { scrollTop: 0, clientHeight: 600 }
      const handleScroll = vi.fn()
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({
          containerRef: ref(container),
          handleScroll
        }))
      )

      const ret = await result.scrollToOffset(32, 1)
      // Should not throw, navigateToOffset was called internally
      expect(ret).toBeUndefined() // scrollToOffset doesn't return
      app.unmount()
    })
  })

  describe('scrollToOffset CustomEvent listener', () => {
    it('registers event listener on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const [result, app] = withSetup(() => useHexNavigation(makeProps(), makeDeps()))

      expect(addSpy).toHaveBeenCalledWith('scrollToOffset', expect.any(Function))
      addSpy.mockRestore()
      app.unmount()
    })

    it('removes event listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const [result, app] = withSetup(() => useHexNavigation(makeProps(), makeDeps()))

      app.unmount()
      expect(removeSpy).toHaveBeenCalledWith('scrollToOffset', expect.any(Function))
      removeSpy.mockRestore()
    })

    it('handles scrollToOffset CustomEvent with offset detail', async () => {
      const container = { scrollTop: 0, clientHeight: 600 }
      const handleScroll = vi.fn()
      const navigationInProgress = ref(false)
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({
          containerRef: ref(container),
          handleScroll,
          navigationInProgress
        }))
      )

      const event = new CustomEvent('scrollToOffset', {
        detail: { offset: 64, length: 4 }
      })
      window.dispatchEvent(event)

      // scrollToOffset was called, which calls navigateToOffset
      // Navigation should have been triggered
      await nextTick()
      app.unmount()
    })

    it('ignores CustomEvent without valid offset', () => {
      const navigationInProgress = ref(false)
      const [result, app] = withSetup(() =>
        useHexNavigation(makeProps(), makeDeps({ navigationInProgress }))
      )

      const event = new CustomEvent('scrollToOffset', {
        detail: { offset: 'invalid' }
      })
      window.dispatchEvent(event)

      // Should not navigate (typeof 'invalid' !== 'number')
      expect(navigationInProgress.value).toBe(false)
      app.unmount()
    })
  })
})
