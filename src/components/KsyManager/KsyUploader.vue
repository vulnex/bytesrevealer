/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KsyUploader.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="ksy-uploader">
    <div 
      class="upload-area"
      :class="{ 
        'drag-over': isDragOver,
        'has-files': uploadedFiles.length > 0
      }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        accept=".ksy,.yaml,.yml"
        @change="handleFileSelect"
        style="display: none"
      />
      
      <div v-if="uploadedFiles.length === 0" class="upload-prompt">
        <div class="upload-icon">📁</div>
        <h3>Drop KSY files here</h3>
        <p>or click to browse</p>
        <p class="file-types">Accepts .ksy, .yaml, .yml files</p>
      </div>
      
      <div v-else class="uploaded-list">
        <h3>Uploaded Formats</h3>
        <div class="file-list">
          <div 
            v-for="file in uploadedFiles" 
            :key="file.id"
            class="file-item"
            :class="{ 'has-error': file.error }"
          >
            <div class="file-info">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ formatSize(file.size) }}</span>
            </div>
            <div class="file-status">
              <span v-if="file.processing" class="status-processing">Processing...</span>
              <span v-else-if="file.error" class="status-error">{{ file.error }}</span>
              <span v-else class="status-success">✓ Ready</span>
              <button 
                @click.stop="removeFile(file.id)"
                class="remove-btn"
                title="Remove"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        <button @click="clearAll" class="clear-all-btn">Clear All</button>
      </div>
    </div>
    
    <div v-if="uploadedFiles.length > 0" class="actions">
      <button 
        @click="processFiles"
        :disabled="processing || !hasValidFiles"
        class="process-btn"
      >
        {{ processing ? 'Processing...' : 'Load Formats' }}
      </button>
    </div>
    
    <div v-if="validationErrors.length > 0" class="validation-errors">
      <h4>Validation Errors:</h4>
      <ul>
        <li v-for="(error, index) in validationErrors" :key="index">
          {{ error }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { getKsyManager } from '../../kaitai/ksy/KsyManager'
import { getKsyValidator } from '../../kaitai/ksy/KsyValidator'
import { createLogger } from '../../utils/logger'

const logger = createLogger('KsyUploader')

export default {
  name: 'KsyUploader',
  
  emits: ['formats-loaded', 'error'],
  
  setup(props, { emit }) {
    const fileInput = ref(null)
    const isDragOver = ref(false)
    const uploadedFiles = ref([])
    const processing = ref(false)
    const validationErrors = ref([])
    
    const ksyManager = getKsyManager()
    const validator = getKsyValidator()
    
    const hasValidFiles = computed(() => {
      if (!uploadedFiles.value || uploadedFiles.value.length === 0) {
        return false
      }
      return uploadedFiles.value.some(f => !f.error && !f.processing)
    })
    
    const triggerFileInput = () => {
      if (fileInput.value) {
        fileInput.value.click()
      }
    }
    
    const handleFileSelect = (event) => {
      const files = Array.from(event.target.files)
      processSelectedFiles(files)
    }
    
    const handleDrop = (event) => {
      event.preventDefault()
      isDragOver.value = false
      
      const files = Array.from(event.dataTransfer.files)
      const ksyFiles = files.filter(f => 
        f.name.endsWith('.ksy') || 
        f.name.endsWith('.yaml') || 
        f.name.endsWith('.yml')
      )
      
      if (ksyFiles.length > 0) {
        processSelectedFiles(ksyFiles)
      } else {
        validationErrors.value = ['Please drop only KSY, YAML, or YML files']
      }
    }
    
    const handleDragOver = (event) => {
      event.preventDefault()
      isDragOver.value = true
    }
    
    const handleDragLeave = (event) => {
      event.preventDefault()
      isDragOver.value = false
    }
    
    const processSelectedFiles = async (files) => {
      validationErrors.value = []
      
      for (const file of files) {
        const fileId = generateId()
        const fileEntry = {
          id: fileId,
          name: file.name,
          size: file.size,
          file: file,
          processing: true,
          error: null,
          content: null
        }
        
        uploadedFiles.value.push(fileEntry)
        const fileIndex = uploadedFiles.value.length - 1  // Get the index of the newly added file
        
        try {
          // Read file content
          const content = await file.text()
          
          // Update the entry in the array directly for reactivity
          uploadedFiles.value[fileIndex].content = content
          
          // Quick validation
          const isValid = validator.quickValidate(content)
          
          if (!isValid) {
            uploadedFiles.value[fileIndex].error = 'Invalid YAML syntax'
          }
          
          // Update processing state directly in the array
          uploadedFiles.value[fileIndex].processing = false
        } catch (error) {
          logger.error('Error reading file:', error)
          uploadedFiles.value[fileIndex].error = error.message
          uploadedFiles.value[fileIndex].processing = false
        }
      }
    }
    
    const processFiles = async () => {
      processing.value = true
      validationErrors.value = []
      const loadedFormats = []
      
      for (const file of uploadedFiles.value) {
        if (file.error || !file.content) continue
        
        try {
          // Full validation
          const validation = await validator.validate(file.content)
          
          // Skip validation errors for now - just check if we can parse it
          if (!validation.parsed) {
            file.error = 'Failed to parse YAML'
            validationErrors.value.push(`${file.name}: Failed to parse YAML structure`)
            continue
          }
          
          // Only block on actual errors, not warnings
          if (!validation.valid && validation.errors && validation.errors.length > 0) {
            // Only show as error if there are real errors, not just warnings
            file.error = validation.errors[0]
            validationErrors.value.push(`${file.name}: ${validation.errors.join(', ')}`)
            continue
          }
          
          // Don't log warnings to console - they're not errors
          // if (validation.warnings && validation.warnings.length > 0) {
          //   console.info(`Info for ${file.name}:`, validation.warnings)
          // }
          
          // Add to manager
          const formatId = await ksyManager.add({
            name: file.name.replace(/\.(ksy|yaml|yml)$/i, ''),
            content: file.content,
            category: 'user',
            metadata: {
              originalFileName: file.name,
              warnings: validation.warnings || []
            }
          })
          
          loadedFormats.push({
            id: formatId,
            name: file.name,
            metadata: validation.parsed?.meta
          })
          
        } catch (error) {
          logger.error('Error processing file:', error)
          file.error = error.message
          validationErrors.value.push(`${file.name}: ${error.message}`)
          // Don't set processing to false here - let all files process
        }
      }
      
      processing.value = false
      
      if (loadedFormats.length > 0) {
        emit('formats-loaded', loadedFormats)
        // Clear successful files
        uploadedFiles.value = uploadedFiles.value.filter(f => f.error)
        
        if (uploadedFiles.value.length === 0) {
          validationErrors.value = []
        }
      }
    }
    
    const removeFile = (fileId) => {
      uploadedFiles.value = uploadedFiles.value.filter(f => f.id !== fileId)
      if (uploadedFiles.value.length === 0) {
        validationErrors.value = []
      }
    }
    
    const clearAll = () => {
      uploadedFiles.value = []
      validationErrors.value = []
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }
    
    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
    
    const generateId = () => {
      return Date.now().toString(36) + Math.random().toString(36).substr(2)
    }
    
    return {
      fileInput,
      isDragOver,
      uploadedFiles,
      processing,
      validationErrors,
      hasValidFiles,
      triggerFileInput,
      handleFileSelect,
      handleDrop,
      handleDragOver,
      handleDragLeave,
      processFiles,
      removeFile,
      clearAll,
      formatSize
    }
  }
}
</script>

<style scoped>
.ksy-uploader {
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.upload-area {
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-primary);
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-area:hover {
  border-color: var(--link-color);
  background: rgba(66, 184, 131, 0.05);
}

.upload-area.drag-over {
  border-color: var(--link-color);
  background: rgba(66, 184, 131, 0.1);
  transform: scale(1.02);
}

.upload-area.has-files {
  padding: 20px;
  cursor: default;
}

.upload-prompt {
  user-select: none;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-prompt h3 {
  color: var(--text-primary);
  margin: 0 0 8px 0;
  font-size: 18px;
}

.upload-prompt p {
  color: var(--text-secondary);
  margin: 4px 0;
  font-size: 14px;
}

.file-types {
  font-size: 12px;
  opacity: 0.7;
}

.uploaded-list {
  width: 100%;
}

.uploaded-list h3 {
  color: var(--text-primary);
  margin: 0 0 16px 0;
  font-size: 16px;
  text-align: left;
}

.file-list {
  max-height: 300px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 4px;
  margin-bottom: 8px;
  text-align: left;
}

.file-item.has-error {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  color: var(--text-primary);
  font-weight: 500;
  font-size: 14px;
}

.file-size {
  color: var(--text-secondary);
  font-size: 12px;
}

.file-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-processing {
  color: var(--warning-text);
  font-size: 12px;
}

.status-error {
  color: var(--error-text);
  font-size: 12px;
}

.status-success {
  color: var(--success-text);
  font-size: 12px;
}

.remove-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 0, 0, 0.1);
  color: var(--error-text);
  border-radius: 4px;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.remove-btn:hover {
  background: rgba(255, 0, 0, 0.2);
}

.clear-all-btn {
  margin-top: 12px;
  padding: 6px 12px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.clear-all-btn:hover {
  background: var(--error-bg);
  color: var(--error-text);
  border-color: var(--error-text);
}

.actions {
  margin-top: 20px;
  text-align: center;
}

.process-btn {
  padding: 10px 24px;
  background: var(--link-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.process-btn:hover:not(:disabled) {
  background: var(--link-hover);
}

.process-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.validation-errors {
  margin-top: 20px;
  padding: 16px;
  background: var(--error-bg);
  border: 1px solid var(--error-text);
  border-radius: 4px;
}

.validation-errors h4 {
  color: var(--error-text);
  margin: 0 0 8px 0;
  font-size: 14px;
}

.validation-errors ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.validation-errors li {
  color: var(--error-text);
  font-size: 12px;
  padding: 4px 0;
}

/* Scrollbar styling */
.file-list::-webkit-scrollbar {
  width: 6px;
}

.file-list::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

.file-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.file-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>