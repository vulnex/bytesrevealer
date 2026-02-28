import { reactive, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { createLogger } from '../utils/logger'

const logger = createLogger('AppPreferences')

/**
 * Composable for application preferences: feature toggles, theme, and help dialog.
 */
export function useAppPreferences() {
  const features = reactive({
    fileAnalysis: true,
    visualView: true,
    hexView: true,
    stringAnalysis: true,
    yaraScanning: true
  })

  const activeTab = ref('info')
  const activeGraphTab = ref('entropy')
  const showHelpDialog = ref(false)
  const currentYear = ref(new Date().getFullYear())

  function saveAnalysisPreferences() {
    try {
      localStorage.setItem('analysisOptions', JSON.stringify(features))
    } catch (error) {
      logger.error('Error saving analysis preferences:', error)
    }
  }

  function loadAnalysisPreferences() {
    try {
      const saved = localStorage.getItem('analysisOptions')
      if (saved) {
        const savedFeatures = JSON.parse(saved)
        features.fileAnalysis = savedFeatures.fileAnalysis !== false
        features.visualView = savedFeatures.visualView !== false
        features.hexView = savedFeatures.hexView !== false
        features.stringAnalysis = savedFeatures.stringAnalysis !== false
        features.yaraScanning = savedFeatures.yaraScanning !== false
      }
    } catch (error) {
      logger.error('Error loading analysis preferences:', error)
    }
  }

  function initializeTheme() {
    const savedTheme = localStorage.getItem('theme')

    if (!savedTheme) {
      const defaultTheme = 'dark'
      document.documentElement.classList.add('dark-mode')
      localStorage.setItem('theme', defaultTheme)
      logger.info('Initialized with dark mode as default')
    } else {
      document.documentElement.classList.add(`${savedTheme}-mode`)
      logger.info(`Applied saved theme: ${savedTheme}`)
    }
  }

  function handleSettingsUpdate(newSettings) {
    const settingsStore = useSettingsStore()

    if (typeof newSettings.baseOffset === 'number') {
      settingsStore.setBaseOffset(newSettings.baseOffset)
    }
  }

  function resetFeatures() {
    features.fileAnalysis = true
    features.visualView = true
    features.hexView = true
    features.stringAnalysis = true
    features.yaraScanning = true
  }

  // Auto-save preferences when features change
  watch(features, () => {
    saveAnalysisPreferences()
  })

  // Initialize on creation
  loadAnalysisPreferences()
  initializeTheme()

  return {
    features,
    activeTab,
    activeGraphTab,
    showHelpDialog,
    currentYear,
    saveAnalysisPreferences,
    loadAnalysisPreferences,
    initializeTheme,
    handleSettingsUpdate,
    resetFeatures
  }
}
