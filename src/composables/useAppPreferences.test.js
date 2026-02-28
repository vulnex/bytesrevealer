import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../stores/settings'

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

describe('useAppPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.classList.remove('dark-mode', 'light-mode')
    // Reset module so top-level logger + init code re-runs fresh
    vi.resetModules()
  })

  async function loadComposable() {
    const { useAppPreferences } = await import('./useAppPreferences')
    return withSetup(() => useAppPreferences())
  }

  describe('initial state', () => {
    it('features default to all true', async () => {
      const [result, app] = await loadComposable()
      expect(result.features.fileAnalysis).toBe(true)
      expect(result.features.visualView).toBe(true)
      expect(result.features.hexView).toBe(true)
      expect(result.features.stringAnalysis).toBe(true)
      expect(result.features.yaraScanning).toBe(true)
      app.unmount()
    })

    it('activeTab defaults to info', async () => {
      const [result, app] = await loadComposable()
      expect(result.activeTab.value).toBe('info')
      app.unmount()
    })

    it('activeGraphTab defaults to entropy', async () => {
      const [result, app] = await loadComposable()
      expect(result.activeGraphTab.value).toBe('entropy')
      app.unmount()
    })

    it('showHelpDialog defaults to false', async () => {
      const [result, app] = await loadComposable()
      expect(result.showHelpDialog.value).toBe(false)
      app.unmount()
    })

    it('currentYear is the current year', async () => {
      const [result, app] = await loadComposable()
      expect(result.currentYear.value).toBe(new Date().getFullYear())
      app.unmount()
    })
  })

  describe('loadAnalysisPreferences', () => {
    it('loads saved preferences from localStorage', async () => {
      localStorage.setItem('analysisOptions', JSON.stringify({
        fileAnalysis: false,
        visualView: false,
        hexView: true,
        stringAnalysis: false,
        yaraScanning: true
      }))
      const [result, app] = await loadComposable()
      expect(result.features.fileAnalysis).toBe(false)
      expect(result.features.visualView).toBe(false)
      expect(result.features.hexView).toBe(true)
      expect(result.features.stringAnalysis).toBe(false)
      expect(result.features.yaraScanning).toBe(true)
      app.unmount()
    })

    it('handles partial saved data (missing keys default to true)', async () => {
      localStorage.setItem('analysisOptions', JSON.stringify({ fileAnalysis: false }))
      const [result, app] = await loadComposable()
      expect(result.features.fileAnalysis).toBe(false)
      expect(result.features.visualView).toBe(true)
      expect(result.features.hexView).toBe(true)
      app.unmount()
    })

    it('handles missing localStorage gracefully', async () => {
      const [result, app] = await loadComposable()
      expect(result.features.fileAnalysis).toBe(true)
      expect(result.features.visualView).toBe(true)
      app.unmount()
    })

    it('handles corrupt JSON gracefully', async () => {
      localStorage.setItem('analysisOptions', '{bad json')
      const [result, app] = await loadComposable()
      // Falls back to defaults
      expect(result.features.fileAnalysis).toBe(true)
      app.unmount()
    })
  })

  describe('saveAnalysisPreferences', () => {
    it('writes features to localStorage', async () => {
      const [result, app] = await loadComposable()
      result.features.fileAnalysis = false
      result.saveAnalysisPreferences()
      const saved = JSON.parse(localStorage.getItem('analysisOptions'))
      expect(saved.fileAnalysis).toBe(false)
      app.unmount()
    })
  })

  describe('initializeTheme', () => {
    it('applies dark-mode by default when no saved theme', async () => {
      const [, app] = await loadComposable()
      expect(document.documentElement.classList.contains('dark-mode')).toBe(true)
      expect(localStorage.getItem('theme')).toBe('dark')
      app.unmount()
    })

    it('applies saved theme from localStorage', async () => {
      localStorage.setItem('theme', 'light')
      const [, app] = await loadComposable()
      expect(document.documentElement.classList.contains('light-mode')).toBe(true)
      app.unmount()
    })
  })

  describe('handleSettingsUpdate', () => {
    it('calls settingsStore.setBaseOffset with a number', async () => {
      const [result, app] = await loadComposable()
      result.handleSettingsUpdate({ baseOffset: 42 })
      const settingsStore = useSettingsStore()
      expect(settingsStore.baseOffset).toBe(42)
      app.unmount()
    })

    it('ignores non-number baseOffset', async () => {
      const [result, app] = await loadComposable()
      result.handleSettingsUpdate({ baseOffset: 'abc' })
      const settingsStore = useSettingsStore()
      expect(settingsStore.baseOffset).toBe(0)
      app.unmount()
    })

    it('ignores missing baseOffset', async () => {
      const [result, app] = await loadComposable()
      result.handleSettingsUpdate({})
      const settingsStore = useSettingsStore()
      expect(settingsStore.baseOffset).toBe(0)
      app.unmount()
    })
  })

  describe('resetFeatures', () => {
    it('resets all features to true', async () => {
      const [result, app] = await loadComposable()
      result.features.fileAnalysis = false
      result.features.visualView = false
      result.features.hexView = false
      result.features.stringAnalysis = false
      result.features.yaraScanning = false
      result.resetFeatures()
      expect(result.features.fileAnalysis).toBe(true)
      expect(result.features.visualView).toBe(true)
      expect(result.features.hexView).toBe(true)
      expect(result.features.stringAnalysis).toBe(true)
      expect(result.features.yaraScanning).toBe(true)
      app.unmount()
    })
  })

  describe('watch: auto-save on features change', () => {
    it('saves to localStorage when a feature changes', async () => {
      const [result, app] = await loadComposable()
      result.features.hexView = false
      await nextTick()
      const saved = JSON.parse(localStorage.getItem('analysisOptions'))
      expect(saved.hexView).toBe(false)
      app.unmount()
    })
  })
})
