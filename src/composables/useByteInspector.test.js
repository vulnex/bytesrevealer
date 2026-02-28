import { describe, it, expect } from 'vitest'
import { useByteInspector } from './useByteInspector'

describe('useByteInspector', () => {
  describe('initial state', () => {
    it('hoveredByte is null', () => {
      const { hoveredByte } = useByteInspector()
      expect(hoveredByte.value).toBe(null)
    })

    it('inspectorLocked is false', () => {
      const { inspectorLocked } = useByteInspector()
      expect(inspectorLocked.value).toBe(false)
    })

    it('lockedByte is null', () => {
      const { lockedByte } = useByteInspector()
      expect(lockedByte.value).toBe(null)
    })
  })

  describe('onByteHover', () => {
    it('sets hoveredByte to actual offset when unlocked', () => {
      const { hoveredByte, onByteHover } = useByteInspector()
      onByteHover(0x1a, 0x10)
      expect(hoveredByte.value).toBe(0x0a)
    })

    it('does not update hoveredByte when locked', () => {
      const { hoveredByte, onByteHover, lockInspector } = useByteInspector()
      lockInspector(0x20, 0x10)
      onByteHover(0x30, 0x10)
      expect(hoveredByte.value).toBe(null)
    })
  })

  describe('onByteLeave', () => {
    it('clears hoveredByte', () => {
      const { hoveredByte, onByteHover, onByteLeave } = useByteInspector()
      onByteHover(0x10, 0x00)
      expect(hoveredByte.value).toBe(0x10)
      onByteLeave()
      expect(hoveredByte.value).toBe(null)
    })
  })

  describe('lockInspector', () => {
    it('sets inspectorLocked and lockedByte', () => {
      const { inspectorLocked, lockedByte, lockInspector } = useByteInspector()
      lockInspector(0x30, 0x10)
      expect(inspectorLocked.value).toBe(true)
      expect(lockedByte.value).toBe(0x20)
    })
  })

  describe('handleKeyDown', () => {
    it('pressing "l" locks inspector to current hoveredByte', () => {
      const {
        hoveredByte: _hoveredByte,
        inspectorLocked,
        lockedByte,
        onByteHover,
        handleKeyDown
      } = useByteInspector()
      onByteHover(0x05, 0x00)
      handleKeyDown({ key: 'l' })
      expect(inspectorLocked.value).toBe(true)
      expect(lockedByte.value).toBe(0x05)
    })

    it('pressing "L" (uppercase) also works', () => {
      const { onByteHover, inspectorLocked, handleKeyDown } = useByteInspector()
      onByteHover(0x05, 0x00)
      handleKeyDown({ key: 'L' })
      expect(inspectorLocked.value).toBe(true)
    })

    it('pressing "l" when locked unlocks inspector', () => {
      const { inspectorLocked, lockedByte, lockInspector, handleKeyDown } = useByteInspector()
      lockInspector(0x10, 0x00)
      expect(inspectorLocked.value).toBe(true)
      handleKeyDown({ key: 'l' })
      expect(inspectorLocked.value).toBe(false)
      expect(lockedByte.value).toBe(null)
    })

    it('pressing "l" with no hoveredByte does not lock', () => {
      const { inspectorLocked, handleKeyDown } = useByteInspector()
      handleKeyDown({ key: 'l' })
      expect(inspectorLocked.value).toBe(false)
    })

    it('other keys are ignored', () => {
      const { inspectorLocked, onByteHover, handleKeyDown } = useByteInspector()
      onByteHover(0x05, 0x00)
      handleKeyDown({ key: 'a' })
      expect(inspectorLocked.value).toBe(false)
    })
  })
})
