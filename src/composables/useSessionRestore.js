import { ref, computed } from 'vue'
import { useSessionStore } from '../stores/session'
import { useFormatStore } from '../stores/format'
import { useSettingsStore } from '../stores/settings'
import { useYaraStore } from '../stores/yara'
import { createLogger } from '../utils/logger'

const logger = createLogger('SessionRestore')

/**
 * Composable for session save/restore/clear logic.
 * @param {Object} deps - refs from all other composables
 */
export function useSessionRestore(deps) {
  const {
    fileName,
    fileBytes,
    entropy,
    hashes,
    fileSignatures,
    detectedFileType,
    searchPattern,
    searchType,
    highlightedBytes,
    coloredBytes,
    notes,
    bookmarks,
    annotations,
    tags,
    features,
    activeTab,
    activeGraphTab
  } = deps

  const hasSessionData = ref(false)
  const pendingSessionFile = ref(null)

  const currentAppState = computed(() => {
    const formatStore = useFormatStore()
    const settingsStore = useSettingsStore()

    return {
      fileName: fileName.value,
      fileBytes: fileBytes.value,
      activeTab: activeTab.value,
      activeGraphTab: activeGraphTab.value,
      features: { ...features },
      searchPattern: searchPattern.value,
      searchType: searchType.value,
      highlightedBytes: highlightedBytes.value,
      coloredBytes: coloredBytes.value,
      entropy: entropy.value,
      hashes: hashes.value,
      fileSignatures: fileSignatures.value,
      detectedFileType: detectedFileType.value,
      baseOffset: settingsStore.baseOffset,
      formatStore: {
        selectedFormatId: formatStore.selectedFormatId,
        isAutoDetected: formatStore.isAutoDetected,
        confidence: formatStore.confidence,
        kaitaiStructures: formatStore.kaitaiStructures
      },
      notes: notes.value,
      bookmarks: bookmarks.value,
      annotations: annotations.value,
      tags: tags.value,
      yaraState: useYaraStore().serializableState
    }
  })

  function handleSessionLoaded(session) {
    logger.info('Loading session:', session.name)

    hasSessionData.value = true
    pendingSessionFile.value = session.file || null

    if (session.file?.name) {
      fileName.value = session.file.name
    }

    // Clear any previous error state (handled by parent)

    // Restore application state from session
    if (session.state) {
      activeTab.value = features.fileAnalysis ? 'file' : 'info'
      activeGraphTab.value = session.state.activeGraphTab || 'entropy'
      Object.assign(features, session.state.features)
      searchPattern.value = session.state.searchPattern || ''
      searchType.value = session.state.searchType || 'hex'
      highlightedBytes.value = session.state.highlightedBytes || []
      coloredBytes.value = session.state.coloredBytes || []

      if (typeof session.state.baseOffset === 'number') {
        const settingsStore = useSettingsStore()
        settingsStore.setBaseOffset(session.state.baseOffset)
      }
    }

    // Restore analysis results
    if (session.analysis) {
      entropy.value = session.analysis.entropy || 0
      hashes.value = session.analysis.hashes || { md5: '', sha1: '', sha256: '' }
      fileSignatures.value = session.analysis.fileSignatures || []
      detectedFileType.value = session.analysis.detectedFileType || null
    }

    // Restore format state
    if (session.format) {
      const formatStore = useFormatStore()
      if (session.format.selectedFormatId) {
        formatStore.selectedFormatId = session.format.selectedFormatId
        formatStore.isAutoDetected = session.format.isAutoDetected || false
        formatStore.confidence = session.format.confidence || 0
      }
      if (session.format.kaitaiStructures) {
        formatStore.setStructures(session.format.kaitaiStructures)
      }
    }

    // Restore annotations
    if (session.annotations) {
      notes.value = session.annotations.notes || ''
      bookmarks.value = session.annotations.bookmarks || []
      annotations.value = session.annotations.annotations || []
      tags.value = session.annotations.tags || []
    }

    // Restore YARA state
    if (session.yara) {
      useYaraStore().restoreFromSession(session.yara)
    }

    // Mark session store as clean since we just loaded
    const sessionStore = useSessionStore()
    sessionStore.isDirty = false

    logger.info('Session loaded successfully:', session.name)
  }

  function handleSessionSaved(session) {
    logger.info('Session saved:', session.name)
  }

  function clearSessionState() {
    hasSessionData.value = false
    pendingSessionFile.value = null
  }

  return {
    hasSessionData,
    pendingSessionFile,
    currentAppState,
    handleSessionLoaded,
    handleSessionSaved,
    clearSessionState
  }
}
