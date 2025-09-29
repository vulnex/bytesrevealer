/**
 * VULNEX -Bytes Revealer-
 *
 * File: FormatSelector.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="format-selector">
    <div class="selector-header">
      <label class="format-label">Format:</label>
      <div class="selector-controls">
        <div class="button-group">
          <button 
            @click="showUploader = !showUploader"
            class="add-format-btn"
            title="Add custom format"
          >
            +
          </button>
          
          <button 
            @click="showLibrary = !showLibrary"
            class="library-btn"
            title="Browse format library"
          >
            📚
          </button>
          
          <button 
            @click="clearFormat"
            class="reset-btn"
            title="Clear selected format"
          >
            ↺
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="currentFormat" class="format-info">
      <span class="format-label-text">Selected Format:</span>
      <span class="format-name">{{ currentFormat.name }}</span>
      <span v-if="isAutoDetected" class="format-badge auto">
        Auto-detected
      </span>
      <span v-if="confidence" class="confidence">
        ({{ Math.round(confidence * 100) }}% match)
      </span>
    </div>
    
    <!-- Uploader Modal -->
    <div v-if="showUploader" class="modal-overlay" @click="showUploader = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Upload KSY Format</h3>
          <button @click="showUploader = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <KsyUploader 
            @formats-loaded="handleFormatsLoaded"
            @error="handleError"
          />
        </div>
      </div>
    </div>
    
    <!-- Library Modal -->
    <div v-if="showLibrary" class="modal-overlay" @click="showLibrary = false">
      <div class="modal-content large" @click.stop>
        <div class="modal-header">
          <h3>Format Library</h3>
          <button @click="showLibrary = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <KsyLibrary
            @format-use="handleFormatUse"
            @format-edit="handleFormatEdit"
          />
        </div>
      </div>
    </div>

    <!-- KSY Editor Modal -->
    <div v-if="showEditor" class="modal-overlay" @click="showEditor = false">
      <div class="modal-content large" @click.stop>
        <div class="modal-header">
          <h3>Edit KSY Format</h3>
          <button @click="showEditor = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <KsyEditor
            :initial-content="editingFormat?.content || ''"
            :initial-name="editingFormat?.name || ''"
            @save="handleFormatSave"
            @close="showEditor = false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import KsyUploader from './KsyUploader.vue'
import KsyLibrary from './KsyLibrary.vue'
import KsyEditor from './KsyEditor.vue'
import { getFormatRegistry } from '../../kaitai/runtime/FormatRegistry'
import KsyManager from '../../kaitai/ksy/KsyManager'
import { getTestKsyCompiler } from '../../kaitai/ksy/TestKsyCompiler'
import { createLogger } from '../../utils/logger'
import { useFormatStore } from '../../stores/format'

const logger = createLogger('FormatSelector')

export default {
  name: 'FormatSelector',
  
  components: {
    KsyUploader,
    KsyLibrary,
    KsyEditor
  },
  
  props: {
    fileBytes: {
      type: Object,
      validator: (value) => value instanceof Uint8Array || value === null,
      default: null
    },
    fileName: {
      type: String,
      default: null
    },
    detectedFormat: {
      type: String,
      default: null
    }
  },
  
  emits: ['format-changed', 'error'],
  
  setup(props, { emit }) {
    const formatStore = useFormatStore()

    // Use store values through computed refs
    const selectedFormatId = computed({
      get: () => formatStore.selectedFormatId,
      set: (value) => formatStore.selectedFormatId = value
    })
    const currentFormat = computed(() => formatStore.currentFormat)
    const isAutoDetected = computed(() => formatStore.isAutoDetected)
    const confidence = computed(() => formatStore.confidence)
    const formats = ref([])
    const showUploader = ref(false)
    const showLibrary = ref(false)
    const showEditor = ref(false)
    const editingFormat = ref(null)
    
    const formatRegistry = getFormatRegistry()
    const ksyManager = new KsyManager()
    
    const systemFormats = computed(() => {
      // Include all non-user formats as "system" formats
      // This includes 'system', 'Executable', 'Archives', 'Images', etc.
      return formats.value.filter(f => f.category !== 'user')
    })
    
    const userFormats = computed(() => {
      return formats.value.filter(f => f.category === 'user')
    })
    
    const loadFormats = async (skipDetection = false) => {
      try {
        // Initialize format registry if not already initialized
        await formatRegistry.initialize()
        
        // Get all available formats - this should always return all formats
        const allFormats = formatRegistry.getAllFormats()
        formats.value = allFormats
        logger.info(`Loaded ${allFormats.length} formats into selector`)
        
        // No auto-detection - user must select a format
      } catch (error) {
        logger.error('Failed to load formats:', error)
      }
    }
    
    const detectFormat = async () => {
      // No auto-detection - wait for user to select a format
      logger.debug('Auto-detection disabled - waiting for user to select a format')
      formatStore.clearFormat()
      confidence.value = null
    }
    
    const handleSimpleDetection = () => {
      // No auto-detection - disabled
      logger.debug('Simple detection disabled - waiting for user to select a format')
    }
    
    const handleFormatChange = async () => {
      if (!selectedFormatId.value) {
        // Reset to auto-detect
        resetFormat()
        return
      }
      
      const format = formatRegistry.getFormat(selectedFormatId.value)
      if (format) {
        // Clone to avoid reactivity warnings
        formatStore.setFormat({ ...format })
        
        emit('format-changed', {
          format,
          isAutoDetected: false
        })
      }
    }
    
    const clearFormat = () => {
      formatStore.clearFormat()
      
      // Emit format cleared event to clear the structure view
      emit('format-changed', {
        format: null,
        isAutoDetected: false,
        cleared: true
      })
      
      // Don't reload formats - they should persist
      logger.debug('Format cleared, registry maintains all formats')
    }
    
    const resetFormat = async () => {
      formatStore.clearFormat()
      
      // Just load formats, no auto-detection
      await loadFormats(true) // Skip detection in loadFormats
      
      // Emit cleared format
      emit('format-changed', {
        format: null,
        isAutoDetected: false,
        cleared: true
      })
    }
    
    const handleFormatsLoaded = async (loadedFormats) => {
      showUploader.value = false
      
      // Register new formats
      for (const format of loadedFormats) {
        try {
          await formatRegistry.registerFormat(format)
        } catch (error) {
          logger.error(`Failed to register format ${format?.name || 'unknown'}:`, error)
        }
      }
      
      // Reload format list
      await loadFormats()
      
      // Select the first loaded format
      if (loadedFormats.length > 0) {
        selectedFormatId.value = loadedFormats[0].id
        await handleFormatChange()
      }
    }
    
    const handleFormatUse = async (format) => {
      showLibrary.value = false
      
      try {
        logger.debug('Handling format use:', format)
        
        // Set the current format immediately (clone to avoid reactivity warnings)
        formatStore.setFormat({ ...format })
        confidence.value = null
        
        // Try to get compiled version if possible
        let formatToEmit = format
        try {
          const compiledFormat = await formatRegistry.getCompiledFormat(format.id)
          if (compiledFormat) {
            formatToEmit = compiledFormat
            // Clone to avoid reactivity warnings
            formatStore.setFormat({ ...compiledFormat })
            logger.debug('Using compiled format with parser:', !!compiledFormat.parser)
          }
        } catch (compileError) {
          logger.warn('Could not compile format, using as-is:', compileError)
        }
        
        // Always emit format-changed event
        emit('format-changed', {
          format: formatToEmit,
          isAutoDetected: false
        })
        
        logger.info('Format selected:', formatToEmit.name, 'ID:', formatToEmit.id)
      } catch (error) {
        logger.error('Error selecting format:', error)
        emit('error', error.message)
      }
    }
    
    const handleFormatEdit = (format) => {
      logger.debug('Edit format:', format)
      editingFormat.value = format
      showEditor.value = true
    }

    const handleFormatSave = async (savedFormat) => {
      try {
        logger.info('Saving edited format:', savedFormat.name)

        // Update the format in the registry if it exists
        const formatRegistry = getFormatRegistry()
        if (editingFormat.value && editingFormat.value.id) {
          await formatRegistry.updateFormat(editingFormat.value.id, savedFormat)
        }

        // Also save to KsyManager for persistence
        const ksyManager = new KsyManager()
        await ksyManager.saveKsy(savedFormat)

        // Refresh the formats list
        await loadFormats()

        // Close the editor
        showEditor.value = false
        editingFormat.value = null

        logger.info('Format saved successfully')
      } catch (error) {
        logger.error('Error saving format:', error)
        emit('error', `Failed to save format: ${error.message}`)
      }
    }
    
    const handleError = (error) => {
      emit('error', error)
    }
    
    // Watch for file changes
    watch(() => props.fileBytes, async () => {
      // No auto-detection on file change
      logger.debug('File changed - no auto-detection')
    })
    
    // Watch for library modal opening to ensure formats are available
    watch(showLibrary, async (newValue) => {
      if (newValue) {
        // Ensure registry is initialized but don't reload if already loaded
        await formatRegistry.initialize()
        logger.info(`Library opened, ${formats.value.length} formats available`)
      }
    })
    
    onMounted(async () => {
      await loadFormats()
      // Always try to auto-detect on mount if we have file bytes
      if (props.fileBytes) {
        await detectFormat()
      }
    })
    
    return {
      selectedFormatId,
      currentFormat,
      isAutoDetected,
      confidence,
      formats,
      systemFormats,
      userFormats,
      showUploader,
      showLibrary,
      showEditor,
      editingFormat,
      handleFormatChange,
      clearFormat,
      resetFormat,
      handleFormatsLoaded,
      handleFormatUse,
      handleFormatEdit,
      handleFormatSave,
      handleError
    }
  }
}
</script>

<style scoped>
.format-selector {
  padding: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto; /* Allow horizontal scrolling if needed */
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0; /* Allow proper flex shrinking */
}

.format-label {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.button-group {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.selector-controls {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

.add-format-btn,
.library-btn,
.reset-btn {
  flex-shrink: 0;
  padding: 6px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  white-space: nowrap;
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-format-btn:hover {
  background: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.library-btn:hover {
  background: var(--info-bg);
  color: var(--info-text);
  border-color: var(--info-text);
}

.reset-btn:hover {
  background: var(--warning-bg);
  color: var(--warning-text);
  border-color: var(--warning-text);
}

.format-info {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.format-label-text {
  color: var(--text-secondary);
  font-weight: 500;
}

.format-badge {
  padding: 2px 6px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-secondary);
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 500;
}

.format-badge.auto {
  background: var(--success-bg);
  color: var(--success-text);
  border-color: var(--success-text);
}

.format-name {
  color: var(--text-primary);
  font-weight: 500;
}

.confidence {
  color: var(--text-secondary);
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-content.large {
  max-width: 900px;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>