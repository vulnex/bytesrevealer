/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KsyImportExport.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="ksy-import-export">
    <div class="section-header">
      <h3>Import/Export KSY Collection</h3>
    </div>
    
    <div class="actions">
      <!-- Export Section -->
      <div class="export-section">
        <h4>Export Collection</h4>
        <div class="export-options">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="exportOptions.includePresets"
            />
            Include preset formats
          </label>
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="exportOptions.includeCustom"
            />
            Include custom formats
          </label>
        </div>
        <button 
          @click="exportCollection" 
          class="action-btn export"
          :disabled="!hasFormats"
        >
          <span class="icon">📥</span> Export as ZIP
        </button>
        <button 
          @click="exportAsJson" 
          class="action-btn export-json"
          :disabled="!hasFormats"
        >
          <span class="icon">📋</span> Export as JSON
        </button>
      </div>
      
      <!-- Import Section -->
      <div class="import-section">
        <h4>Import Collection</h4>
        <div 
          class="drop-zone"
          :class="{ dragging: isDragging }"
          @drop="handleDrop"
          @dragover.prevent
          @dragenter.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
        >
          <div class="drop-content">
            <span class="icon">📁</span>
            <p>Drop ZIP or JSON file here</p>
            <p class="hint">or click to browse</p>
            <input 
              type="file"
              accept=".zip,.json"
              @change="handleFileSelect"
              class="file-input"
            />
          </div>
        </div>
        
        <div class="import-options" v-if="importPreview">
          <h5>Import Preview</h5>
          <div class="preview-list">
            <div 
              v-for="format in importPreview" 
              :key="format.id"
              class="preview-item"
            >
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="format.selected"
                />
                {{ format.name }} 
                <span class="format-type">{{ format.type }}</span>
              </label>
            </div>
          </div>
          <div class="import-actions">
            <button @click="confirmImport" class="action-btn confirm">
              Import Selected
            </button>
            <button @click="cancelImport" class="action-btn cancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Status Messages -->
    <div v-if="statusMessage" class="status-message" :class="statusType">
      {{ statusMessage }}
    </div>
    
    <!-- Progress Bar -->
    <div v-if="isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      <span class="progress-text">{{ progressText }}</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { getKsyManager } from '../../kaitai/ksy/KsyManager'
import JSZip from 'jszip'

export default {
  name: 'KsyImportExport',
  
  emits: ['imported', 'exported'],
  
  setup(props, { emit }) {
    const manager = getKsyManager()
    
    // State
    const isDragging = ref(false)
    const isProcessing = ref(false)
    const progress = ref(0)
    const progressText = ref('')
    const statusMessage = ref('')
    const statusType = ref('info')
    const formats = ref([])
    const importPreview = ref(null)
    
    // Export options
    const exportOptions = ref({
      includePresets: true,
      includeCustom: true
    })
    
    // Computed
    const hasFormats = computed(() => formats.value.length > 0)
    
    // Load formats on mount
    onMounted(async () => {
      await loadFormats()
    })
    
    const loadFormats = async () => {
      formats.value = await manager.list()
    }
    
    const exportCollection = async () => {
      try {
        isProcessing.value = true
        progress.value = 0
        progressText.value = 'Preparing export...'
        
        const zip = new JSZip()
        const formatsToExport = formats.value.filter(format => {
          if (format.category === 'preset' && !exportOptions.value.includePresets) {
            return false
          }
          if (format.category === 'custom' && !exportOptions.value.includeCustom) {
            return false
          }
          return true
        })
        
        // Add manifest
        const manifest = {
          version: '1.0',
          created: new Date().toISOString(),
          formats: []
        }
        
        // Add each format
        for (let i = 0; i < formatsToExport.length; i++) {
          const format = formatsToExport[i]
          progress.value = (i / formatsToExport.length) * 100
          progressText.value = `Exporting ${format.name}...`
          
          // Get full format data
          const fullFormat = await manager.get(format.id)
          
          // Add to ZIP
          const folder = format.category || 'custom'
          zip.file(`${folder}/${format.name}.ksy`, fullFormat.content)
          
          // Add to manifest
          manifest.formats.push({
            id: format.id,
            name: format.name,
            category: format.category,
            path: `${folder}/${format.name}.ksy`
          })
        }
        
        // Add manifest to ZIP
        zip.file('manifest.json', JSON.stringify(manifest, null, 2))
        
        // Generate ZIP
        progressText.value = 'Generating ZIP file...'
        const blob = await zip.generateAsync({ type: 'blob' })
        
        // Download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ksy-collection-${Date.now()}.zip`
        a.click()
        URL.revokeObjectURL(url)
        
        setStatus(`Exported ${formatsToExport.length} formats`, 'success')
        emit('exported', formatsToExport)
        
      } catch (error) {
        setStatus(`Export failed: ${error.message}`, 'error')
      } finally {
        isProcessing.value = false
        progress.value = 0
        progressText.value = ''
      }
    }
    
    const exportAsJson = async () => {
      try {
        const formatsToExport = formats.value.filter(format => {
          if (format.category === 'preset' && !exportOptions.value.includePresets) {
            return false
          }
          if (format.category === 'custom' && !exportOptions.value.includeCustom) {
            return false
          }
          return true
        })
        
        const exportData = {
          version: '1.0',
          created: new Date().toISOString(),
          formats: []
        }
        
        for (const format of formatsToExport) {
          const fullFormat = await manager.get(format.id)
          exportData.formats.push(fullFormat)
        }
        
        // Download JSON
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ksy-collection-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
        
        setStatus(`Exported ${formatsToExport.length} formats as JSON`, 'success')
        emit('exported', formatsToExport)
        
      } catch (error) {
        setStatus(`Export failed: ${error.message}`, 'error')
      }
    }
    
    const handleDrop = async (event) => {
      event.preventDefault()
      isDragging.value = false
      
      const files = Array.from(event.dataTransfer.files)
      if (files.length > 0) {
        await processImportFile(files[0])
      }
    }
    
    const handleFileSelect = async (event) => {
      const file = event.target.files[0]
      if (file) {
        await processImportFile(file)
      }
    }
    
    const processImportFile = async (file) => {
      try {
        isProcessing.value = true
        progressText.value = 'Reading file...'
        
        if (file.name.endsWith('.zip')) {
          await processZipImport(file)
        } else if (file.name.endsWith('.json')) {
          await processJsonImport(file)
        } else {
          throw new Error('Unsupported file format')
        }
        
      } catch (error) {
        setStatus(`Import failed: ${error.message}`, 'error')
        isProcessing.value = false
      }
    }
    
    const processZipImport = async (file) => {
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      
      // Read manifest
      const manifestFile = contents.file('manifest.json')
      if (!manifestFile) {
        throw new Error('Invalid ZIP: missing manifest.json')
      }
      
      const manifest = JSON.parse(await manifestFile.async('string'))
      
      // Prepare preview
      const preview = []
      for (const formatInfo of manifest.formats) {
        const ksyFile = contents.file(formatInfo.path)
        if (ksyFile) {
          const content = await ksyFile.async('string')
          preview.push({
            id: formatInfo.id,
            name: formatInfo.name,
            category: formatInfo.category,
            content,
            selected: true
          })
        }
      }
      
      importPreview.value = preview
      isProcessing.value = false
    }
    
    const processJsonImport = async (file) => {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (!data.formats || !Array.isArray(data.formats)) {
        throw new Error('Invalid JSON format')
      }
      
      // Prepare preview
      importPreview.value = data.formats.map(format => ({
        ...format,
        selected: true
      }))
      
      isProcessing.value = false
    }
    
    const confirmImport = async () => {
      try {
        isProcessing.value = true
        const selectedFormats = importPreview.value.filter(f => f.selected)
        
        for (let i = 0; i < selectedFormats.length; i++) {
          const format = selectedFormats[i]
          progress.value = (i / selectedFormats.length) * 100
          progressText.value = `Importing ${format.name}...`
          
          await manager.add({
            name: format.name,
            content: format.content,
            category: format.category || 'imported'
          })
        }
        
        setStatus(`Imported ${selectedFormats.length} formats`, 'success')
        emit('imported', selectedFormats)
        
        // Reload formats
        await loadFormats()
        
        // Clear preview
        importPreview.value = null
        
      } catch (error) {
        setStatus(`Import failed: ${error.message}`, 'error')
      } finally {
        isProcessing.value = false
        progress.value = 0
        progressText.value = ''
      }
    }
    
    const cancelImport = () => {
      importPreview.value = null
    }
    
    const setStatus = (message, type = 'info') => {
      statusMessage.value = message
      statusType.value = type
      
      setTimeout(() => {
        statusMessage.value = ''
      }, 5000)
    }
    
    return {
      isDragging,
      isProcessing,
      progress,
      progressText,
      statusMessage,
      statusType,
      hasFormats,
      exportOptions,
      importPreview,
      exportCollection,
      exportAsJson,
      handleDrop,
      handleFileSelect,
      confirmImport,
      cancelImport
    }
  }
}
</script>

<style scoped>
.ksy-import-export {
  padding: 20px;
  background: var(--bg-primary);
  border-radius: 8px;
}

.section-header {
  margin-bottom: 20px;
}

.section-header h3 {
  color: var(--text-primary);
  font-size: 18px;
  margin: 0;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.export-section,
.import-section {
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.export-section h4,
.import-section h4 {
  color: var(--text-primary);
  font-size: 16px;
  margin: 0 0 15px 0;
}

.export-options {
  margin-bottom: 15px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  color: var(--text-primary);
  cursor: pointer;
}

.checkbox-label input {
  margin-right: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  margin-right: 10px;
  margin-bottom: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn .icon {
  font-size: 16px;
}

.drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  position: relative;
  transition: all 0.3s;
  cursor: pointer;
}

.drop-zone.dragging {
  border-color: var(--link-color);
  background: rgba(74, 144, 226, 0.05);
}

.drop-content {
  position: relative;
}

.drop-content .icon {
  font-size: 48px;
  opacity: 0.5;
}

.drop-content p {
  margin: 10px 0 5px;
  color: var(--text-primary);
}

.drop-content .hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.import-options {
  margin-top: 20px;
  padding: 15px;
  background: var(--bg-primary);
  border-radius: 6px;
}

.import-options h5 {
  color: var(--text-primary);
  font-size: 14px;
  margin: 0 0 10px 0;
}

.preview-list {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 15px;
}

.preview-item {
  padding: 5px 0;
}

.format-type {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 8px;
}

.import-actions {
  display: flex;
  gap: 10px;
}

.action-btn.confirm {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.action-btn.cancel {
  background: #F44336;
  color: white;
  border-color: #F44336;
}

.status-message {
  margin-top: 20px;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
}

.status-message.success {
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.status-message.error {
  background: rgba(244, 67, 54, 0.1);
  color: #F44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.status-message.info {
  background: rgba(33, 150, 243, 0.1);
  color: #2196F3;
  border: 1px solid rgba(33, 150, 243, 0.3);
}

.progress-bar {
  margin-top: 20px;
  height: 30px;
  background: var(--bg-secondary);
  border-radius: 15px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90e2, #357abd);
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

/* Scrollbar styling */
.preview-list::-webkit-scrollbar {
  width: 6px;
}

.preview-list::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.preview-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.preview-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>