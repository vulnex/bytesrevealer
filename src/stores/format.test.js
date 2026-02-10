import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFormatStore } from './format.js'

describe('FormatStore', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useFormatStore()
  })

  // ── Initial state ──

  it('starts with null format', () => {
    expect(store.currentFormat).toBeNull()
    expect(store.selectedFormatId).toBe('')
    expect(store.kaitaiStructures).toEqual([])
    expect(store.isAutoDetected).toBe(false)
    expect(store.confidence).toBe(0)
    expect(store.isLoadingFormat).toBe(false)
  })

  // ── Getters ──

  describe('getters', () => {
    it('hasFormat is false when no format', () => {
      expect(store.hasFormat).toBe(false)
    })

    it('hasFormat is true when format is set', () => {
      store.setFormat({ id: 'png', name: 'PNG' })
      expect(store.hasFormat).toBe(true)
    })

    it('formatName returns name or Unknown', () => {
      expect(store.formatName).toBe('Unknown')
      store.setFormat({ id: 'png', name: 'PNG' })
      expect(store.formatName).toBe('PNG')
    })

    it('formatId returns id or selectedFormatId', () => {
      expect(store.formatId).toBe('')
      store.setFormat({ id: 'pe', name: 'PE' })
      expect(store.formatId).toBe('pe')
    })
  })

  // ── Actions ──

  describe('setFormat()', () => {
    it('sets the format and clears autoDetected flag', () => {
      store.setFormat({ id: 'elf', name: 'ELF' })
      expect(store.currentFormat).toEqual({ id: 'elf', name: 'ELF' })
      expect(store.selectedFormatId).toBe('elf')
      expect(store.isAutoDetected).toBe(false)
    })

    it('handles null format', () => {
      store.setFormat({ id: 'x', name: 'X' })
      store.setFormat(null)
      expect(store.currentFormat).toBeNull()
      expect(store.selectedFormatId).toBe('')
    })
  })

  describe('setAutoDetectedFormat()', () => {
    it('sets format and marks as auto-detected', () => {
      store.setAutoDetectedFormat({ id: 'pdf', name: 'PDF' }, 0.95)
      expect(store.currentFormat).toEqual({ id: 'pdf', name: 'PDF' })
      expect(store.isAutoDetected).toBe(true)
      expect(store.confidence).toBe(0.95)
    })
  })

  describe('setStructures()', () => {
    it('sets kaitai structures', () => {
      store.setStructures([{ name: 'header' }])
      expect(store.kaitaiStructures).toEqual([{ name: 'header' }])
    })

    it('handles null', () => {
      store.setStructures(null)
      expect(store.kaitaiStructures).toEqual([])
    })
  })

  describe('clearFormat()', () => {
    it('resets all format state', () => {
      store.setAutoDetectedFormat({ id: 'a', name: 'A' }, 0.9)
      store.setStructures([{ x: 1 }])
      store.clearFormat()
      expect(store.currentFormat).toBeNull()
      expect(store.selectedFormatId).toBe('')
      expect(store.kaitaiStructures).toEqual([])
      expect(store.isAutoDetected).toBe(false)
      expect(store.confidence).toBe(0)
    })
  })

  describe('resetForFile()', () => {
    it('clears format (delegates to clearFormat)', () => {
      store.setFormat({ id: 'x', name: 'X' })
      store.resetForFile()
      expect(store.currentFormat).toBeNull()
    })
  })

  describe('loading state', () => {
    it('setLoadingState', () => {
      store.setLoadingState(true, 'PE', 50)
      expect(store.isLoadingFormat).toBe(true)
      expect(store.loadingFormatName).toBe('PE')
      expect(store.loadingProgress).toBe(50)
    })
  })

  describe('category and format caching', () => {
    it('markCategoryLoaded and isCategoryLoaded', () => {
      expect(store.isCategoryLoaded('archive')).toBe(false)
      store.markCategoryLoaded('archive')
      expect(store.isCategoryLoaded('archive')).toBe(true)
    })

    it('markFormatCached and isFormatCached', () => {
      expect(store.isFormatCached('zip')).toBe(false)
      store.markFormatCached('zip')
      expect(store.isFormatCached('zip')).toBe(true)
    })
  })
})
