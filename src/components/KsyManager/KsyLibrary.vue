/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KsyLibrary.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="ksy-library">
    <div class="library-header">
      <h2>Format Library</h2>
      <div class="header-controls">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search formats..."
          class="search-input"
          @input="handleSearch"
        />
        <select v-model="selectedCategory" @change="filterFormats" class="category-select">
          <option value="">All Categories</option>
          <option value="user">User Formats</option>
          <option value="system">System Formats</option>
          <option value="3D Graphics">3D Graphics</option>
          <option value="Archives">Archives</option>
          <option value="CAD">CAD</option>
          <option value="Common">Common</option>
          <option value="Database">Database</option>
          <option value="Executable">Executables</option>
          <option value="File System">File System</option>
          <option value="Firmware">Firmware</option>
          <option value="Fonts">Fonts</option>
          <option value="Games">Games</option>
          <option value="Geospatial">Geospatial</option>
          <option value="Hardware">Hardware</option>
          <option value="Images">Images</option>
          <option value="Logs">Logs</option>
          <option value="Machine Code">Machine Code</option>
          <option value="macOS">macOS</option>
          <option value="Media">Media</option>
          <option value="Network">Network</option>
          <option value="Scientific">Scientific</option>
          <option value="Security">Security</option>
          <option value="Serialization">Serialization</option>
          <option value="Windows">Windows</option>
        </select>
        <button @click="toggleView" class="view-toggle">
          {{ viewMode === 'grid' ? '☰' : '⊞' }}
        </button>
      </div>
    </div>

    <div class="library-stats">
      <span>{{ filteredFormats.length }} formats</span>
      <span v-if="selectedCategory">in {{ selectedCategory }}</span>
      <span v-if="searchQuery">matching "{{ searchQuery }}"</span>
    </div>

    <div 
      class="formats-container"
      :class="{ 'list-view': viewMode === 'list' }"
    >
      <div v-if="loading" class="loading">
        Loading formats...
      </div>

      <div v-else-if="filteredFormats.length === 0" class="no-formats">
        <p>No formats found</p>
        <button @click="resetFilters" v-if="searchQuery || selectedCategory" class="reset-btn">
          Clear filters
        </button>
      </div>

      <div v-else class="formats-grid">
        <div
          v-for="format in filteredFormats"
          :key="format.id"
          class="format-card"
          :class="{ 
            'selected': selectedFormat?.id === format.id,
            'system': format.category === 'system'
          }"
          @click="selectFormat(format)"
        >
          <div class="format-icon">
            {{ getFormatIcon(format) }}
          </div>
          <div class="format-info">
            <h3 class="format-name">{{ format.name }}</h3>
            <p class="format-meta">
              <span class="format-id">{{ format.metadata?.formatId || 'unknown' }}</span>
              <span class="format-category">{{ format.category }}</span>
            </p>
            <p class="format-description">
              {{ format.description || 'No description available' }}
            </p>
            <div class="format-tags">
              <span v-if="format.metadata?.fileExtension" class="tag">
                {{ Array.isArray(format.metadata.fileExtension) 
                   ? format.metadata.fileExtension.join(', ') 
                   : format.metadata.fileExtension }}
              </span>
              <span v-if="format.metadata?.endian" class="tag">
                {{ format.metadata.endian }}
              </span>
            </div>
          </div>
          <div class="format-actions">
            <button 
              @click.stop="useFormat(format)"
              class="use-btn"
              title="Use this format"
            >
              Use
            </button>
            <button 
              @click.stop="viewDetails(format)"
              class="details-btn"
              title="View details"
            >
              ℹ
            </button>
            <button 
              v-if="format.category === 'user'"
              @click.stop="editFormat(format)"
              class="edit-btn"
              title="Edit"
            >
              ✎
            </button>
            <button 
              v-if="format.category === 'user'"
              @click.stop="deleteFormat(format)"
              class="delete-btn"
              title="Delete"
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Format Details Modal -->
    <div v-if="showDetails" class="modal-overlay" @click="closeDetails">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ detailFormat?.name }}</h3>
          <button @click="closeDetails" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-section">
            <h4>Metadata</h4>
            <dl>
              <dt>Format ID:</dt>
              <dd>{{ detailFormat?.metadata?.formatId || 'N/A' }}</dd>
              <dt>Category:</dt>
              <dd>{{ detailFormat?.category }}</dd>
              <dt>Version:</dt>
              <dd>{{ detailFormat?.version || '1.0.0' }}</dd>
              <dt>Endianness:</dt>
              <dd>{{ detailFormat?.metadata?.endian || 'N/A' }}</dd>
              <dt>File Extensions:</dt>
              <dd>{{ formatExtensions(detailFormat?.metadata?.fileExtension) }}</dd>
            </dl>
          </div>
          
          <div v-if="detailFormat?.metadata?.imports?.length" class="detail-section">
            <h4>Dependencies</h4>
            <ul>
              <li v-for="imp in detailFormat.metadata.imports" :key="imp">
                {{ imp }}
              </li>
            </ul>
          </div>

          <div v-if="detailFormat?.metadata?.warnings?.length" class="detail-section warnings">
            <h4>Warnings</h4>
            <ul>
              <li v-for="warning in detailFormat.metadata.warnings" :key="warning">
                {{ warning }}
              </li>
            </ul>
          </div>

          <div class="detail-section">
            <h4>Dates</h4>
            <dl>
              <dt>Created:</dt>
              <dd>{{ formatDate(detailFormat?.created) }}</dd>
              <dt>Modified:</dt>
              <dd>{{ formatDate(detailFormat?.modified) }}</dd>
            </dl>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="useFormat(detailFormat)" class="btn-primary">
            Use Format
          </button>
          <button @click="exportFormat(detailFormat)" class="btn-secondary">
            Export
          </button>
          <button @click="closeDetails" class="btn-cancel">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import KsyManager from '../../kaitai/ksy/KsyManager'
import { getFormatRegistry } from '../../kaitai/runtime/FormatRegistry'
import { createLogger } from '../../utils/logger'

const logger = createLogger('KsyLibrary')

export default {
  name: 'KsyLibrary',
  
  emits: ['format-selected', 'format-use', 'format-edit'],
  
  setup(props, { emit }) {
    const formats = ref([])
    const loading = ref(true)
    const searchQuery = ref('')
    const selectedCategory = ref('')
    const selectedFormat = ref(null)
    const viewMode = ref('grid') // 'grid' or 'list'
    const showDetails = ref(false)
    const detailFormat = ref(null)
    
    const ksyManager = new KsyManager()
    const formatRegistry = getFormatRegistry()
    
    const filteredFormats = computed(() => {
      let result = [...formats.value]
      
      // Filter by category
      if (selectedCategory.value) {
        result = result.filter(f => f.category === selectedCategory.value)
      }
      
      // Filter by search query
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(f => 
          f.name.toLowerCase().includes(query) ||
          f.description?.toLowerCase().includes(query) ||
          f.metadata?.formatId?.toLowerCase().includes(query) ||
          f.metadata?.fileExtension?.toString().toLowerCase().includes(query)
        )
      }
      
      // Sort: user formats last, then by name
      result.sort((a, b) => {
        if (a.category === 'user' && b.category !== 'user') return 1
        if (a.category !== 'user' && b.category === 'user') return -1
        return a.name.localeCompare(b.name)
      })
      
      return result
    })
    
    const loadFormats = async () => {
      loading.value = true
      try {
        logger.debug('Starting to load formats...')
        
        // Ensure format registry is initialized - don't destroy existing formats
        await formatRegistry.initialize()
        logger.debug('Format registry initialized')
        
        // Get all registered formats from registry - this is the authoritative source
        const registeredFormats = formatRegistry.getAllFormats()
        logger.debug(`Got ${registeredFormats.length} formats from registry`)
        logger.debug('Registry stats:', formatRegistry.getStats())
        
        // Also load from KsyManager for user formats
        const storedFormats = await ksyManager.getAll()
        logger.debug(`Loaded ${storedFormats.length} stored formats from KsyManager`)
        
        // Merge and deduplicate - prefer registry formats as they are already compiled/registered
        const formatMap = new Map()
        
        // Add registry formats first (these are the active ones)
        registeredFormats.forEach(f => {
          formatMap.set(f.id, f)
        })
        
        // Add any stored formats that aren't already in registry
        storedFormats.forEach(f => {
          if (!formatMap.has(f.id)) {
            formatMap.set(f.id, f)
          }
        })
        
        formats.value = Array.from(formatMap.values())
        logger.debug(`Total formats available: ${formats.value.length}`)
        
        if (formats.value.length === 0) {
          logger.warn('No formats found! This might be an initialization issue.')
        }
      } catch (error) {
        logger.error('Failed to load formats:', error)
      } finally {
        loading.value = false
      }
    }
    
    const selectFormat = (format) => {
      selectedFormat.value = format
      emit('format-selected', format)
    }
    
    const useFormat = (format) => {
      emit('format-use', format)
    }
    
    const viewDetails = (format) => {
      detailFormat.value = format
      showDetails.value = true
    }
    
    const closeDetails = () => {
      showDetails.value = false
      detailFormat.value = null
    }
    
    const editFormat = (format) => {
      emit('format-edit', format)
    }
    
    const deleteFormat = async (format) => {
      if (confirm(`Delete format "${format.name}"?`)) {
        try {
          await ksyManager.delete(format.id)
          await formatRegistry.removeFormat(format.id)
          await loadFormats()
        } catch (error) {
          logger.error('Failed to delete format:', error)
        }
      }
    }
    
    const exportFormat = async (format) => {
      try {
        const blob = await ksyManager.export(format.id)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${format.name}.ksy`
        a.click()
        URL.revokeObjectURL(url)
      } catch (error) {
        logger.error('Failed to export format:', error)
      }
    }
    
    const handleSearch = () => {
      // Debounced search is handled by computed property
    }
    
    const filterFormats = () => {
      // Filtering is handled by computed property
    }
    
    const resetFilters = () => {
      searchQuery.value = ''
      selectedCategory.value = ''
    }
    
    const toggleView = () => {
      viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
    }
    
    const getFormatIcon = (format) => {
      const icons = {
        system: '📦',
        user: '👤',
        community: '🌐'
      }
      return icons[format.category] || '📄'
    }
    
    const formatExtensions = (ext) => {
      if (!ext) return 'N/A'
      return Array.isArray(ext) ? ext.join(', ') : ext
    }
    
    const formatDate = (timestamp) => {
      if (!timestamp) return 'N/A'
      return new Date(timestamp).toLocaleString()
    }
    
    onMounted(() => {
      loadFormats()
    })
    
    // Refresh formats when new ones are added
    const refreshFormats = () => {
      loadFormats()
    }
    
    return {
      formats,
      loading,
      searchQuery,
      selectedCategory,
      selectedFormat,
      viewMode,
      filteredFormats,
      showDetails,
      detailFormat,
      selectFormat,
      useFormat,
      viewDetails,
      closeDetails,
      editFormat,
      deleteFormat,
      exportFormat,
      handleSearch,
      filterFormats,
      resetFilters,
      toggleView,
      getFormatIcon,
      formatExtensions,
      formatDate,
      refreshFormats
    }
  }
}
</script>

<style scoped>
.ksy-library {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.library-header {
  padding: 16px 20px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.library-header h2 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-size: 18px;
}

.header-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: var(--link-color);
}

.category-select {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}

.view-toggle {
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 16px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.library-stats {
  padding: 8px 20px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
}

.formats-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.loading, .no-formats {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.reset-btn {
  margin-top: 12px;
  padding: 6px 12px;
  background: var(--link-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.formats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.list-view .formats-grid {
  grid-template-columns: 1fr;
}

.format-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  gap: 12px;
}

.format-card:hover {
  border-color: var(--link-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.format-card.selected {
  border-color: var(--link-color);
  background: rgba(66, 184, 131, 0.1);
}

.format-card.system {
  border-left: 3px solid var(--link-color);
}

.format-icon {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.format-info {
  flex: 1;
  min-width: 0;
}

.format-name {
  margin: 0 0 4px 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.format-meta {
  display: flex;
  gap: 8px;
  margin: 0 0 8px 0;
  font-size: 12px;
}

.format-id {
  color: var(--link-color);
  font-family: monospace;
}

.format-category {
  color: var(--text-secondary);
  padding: 2px 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
}

.format-description {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.format-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  padding: 2px 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 3px;
  font-size: 11px;
}

.format-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.format-actions button {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.use-btn:hover {
  background: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.details-btn:hover {
  background: var(--info-bg);
  color: var(--info-text);
  border-color: var(--info-text);
}

.edit-btn:hover {
  background: var(--warning-bg);
  color: var(--warning-text);
  border-color: var(--warning-text);
}

.delete-btn:hover {
  background: var(--error-bg);
  color: var(--error-text);
  border-color: var(--error-text);
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
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.detail-section dl {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  margin: 0;
}

.detail-section dt {
  color: var(--text-secondary);
  font-size: 13px;
}

.detail-section dd {
  color: var(--text-primary);
  font-size: 13px;
  margin: 0;
}

.detail-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.detail-section li {
  padding: 4px 0;
  color: var(--text-primary);
  font-size: 13px;
}

.warnings {
  background: var(--warning-bg);
  padding: 12px;
  border-radius: 4px;
}

.warnings li {
  color: var(--warning-text);
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-footer button {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--link-color);
  color: white;
  border: none;
}

.btn-primary:hover {
  background: var(--link-hover);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-primary);
}

.btn-cancel {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-cancel:hover {
  background: var(--bg-secondary);
}

/* Scrollbar styling */
.formats-container::-webkit-scrollbar,
.modal-body::-webkit-scrollbar {
  width: 8px;
}

.formats-container::-webkit-scrollbar-track,
.modal-body::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.formats-container::-webkit-scrollbar-thumb,
.modal-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.formats-container::-webkit-scrollbar-thumb:hover,
.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>