import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from './settings.js'

describe('SettingsStore', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSettingsStore()
  })

  it('starts with baseOffset = 0', () => {
    expect(store.baseOffset).toBe(0)
  })

  describe('setBaseOffset()', () => {
    it('sets a valid offset', () => {
      store.setBaseOffset(100)
      expect(store.baseOffset).toBe(100)
    })

    it('clamps negative values to 0', () => {
      store.setBaseOffset(-50)
      expect(store.baseOffset).toBe(0)
    })

    it('parses string input', () => {
      store.setBaseOffset('42')
      expect(store.baseOffset).toBe(42)
    })

    it('defaults NaN to 0', () => {
      store.setBaseOffset('not a number')
      expect(store.baseOffset).toBe(0)
    })

    it('defaults null to 0', () => {
      store.setBaseOffset(null)
      expect(store.baseOffset).toBe(0)
    })

    it('defaults undefined to 0', () => {
      store.setBaseOffset(undefined)
      expect(store.baseOffset).toBe(0)
    })
  })

  describe('updateBaseOffset()', () => {
    it('sets offset directly without validation', () => {
      store.updateBaseOffset(999)
      expect(store.baseOffset).toBe(999)
    })
  })

  describe('currentOffset getter', () => {
    it('reflects baseOffset', () => {
      expect(store.currentOffset).toBe(0)
      store.setBaseOffset(256)
      expect(store.currentOffset).toBe(256)
    })
  })

  describe('enableEmbeddedExecutableScan', () => {
    it('defaults to true', () => {
      expect(store.enableEmbeddedExecutableScan).toBe(true)
    })

    it('setEnableEmbeddedExecutableScan updates the flag', () => {
      store.setEnableEmbeddedExecutableScan(false)
      expect(store.enableEmbeddedExecutableScan).toBe(false)
      store.setEnableEmbeddedExecutableScan(true)
      expect(store.enableEmbeddedExecutableScan).toBe(true)
    })

    it('coerces truthy/falsy values to booleans', () => {
      store.setEnableEmbeddedExecutableScan(0)
      expect(store.enableEmbeddedExecutableScan).toBe(false)
      store.setEnableEmbeddedExecutableScan('yes')
      expect(store.enableEmbeddedExecutableScan).toBe(true)
      store.setEnableEmbeddedExecutableScan(null)
      expect(store.enableEmbeddedExecutableScan).toBe(false)
    })
  })
})
