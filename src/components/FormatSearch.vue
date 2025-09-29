/** 
 * VULNEX -Bytes Revealer-
 *
 * File: FormatSearch.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="format-search-container">
    <!-- Search Header -->
    <div class="search-header">
      <h3>Format Library</h3>
      <span class="format-count">{{ filteredFormats.length }} of {{ totalFormats }} formats</span>
    </div>

    <!-- Search Controls -->
    <div class="search-controls">
      <!-- Search Input -->
      <div class="search-input-wrapper">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search formats by name, extension, or description..."
          class="search-input"
          @input="handleSearch"
        >
        <button v-if="searchQuery" @click="clearSearch" class="clear-btn">✕</button>
      </div>

      <!-- Category Filter -->
      <select v-model="selectedCategory" @change="handleCategoryChange" class="category-select">
        <option value="">All Categories</option>
        <option v-for="cat in categories" :key="cat.key" :value="cat.key">
          {{ cat.name }} ({{ cat.count }})
        </option>
      </select>

      <!-- View Toggle -->
      <div class="view-toggle">
        <button
          @click="viewMode = 'grid'"
          :class="['view-btn', { active: viewMode === 'grid' }]"
          title="Grid View"
        >⊞</button>
        <button
          @click="viewMode = 'list'"
          :class="['view-btn', { active: viewMode === 'list' }]"
          title="List View"
        >☰</button>
      </div>
    </div>

    <!-- Recently Used -->
    <div v-if="recentFormats.length > 0 && !searchQuery && !selectedCategory" class="recent-section">
      <h4>Recently Used</h4>
      <div class="recent-formats">
        <button
          v-for="format in recentFormats"
          :key="format.id"
          @click="selectFormat(format)"
          class="recent-format-btn"
        >
          {{ format.name }}
        </button>
      </div>
    </div>

    <!-- Format Results -->
    <div class="format-results" :class="[viewMode]">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Loading formats...</span>
      </div>

      <!-- No Results -->
      <div v-else-if="filteredFormats.length === 0" class="no-results">
        <p>No formats found matching "{{ searchQuery || selectedCategory }}"</p>
        <button @click="clearFilters" class="reset-btn">Clear Filters</button>
      </div>

      <!-- Format Grid/List -->
      <div v-else class="format-items">
        <div
          v-for="format in paginatedFormats"
          :key="format.id"
          @click="selectFormat(format)"
          :class="['format-item', { selected: format.id === selectedFormatId }]"
        >
          <div class="format-header">
            <span class="format-name">{{ format.name }}</span>
            <span class="format-ext">{{ format.extension }}</span>
          </div>

          <div v-if="viewMode === 'list'" class="format-details">
            <span class="format-category">{{ format.category }}</span>
            <span v-if="format.description" class="format-desc">{{ format.description }}</span>
          </div>

          <div class="format-meta">
            <span v-if="isCached(format.id)" class="cached-badge">⚡ Cached</span>
            <span v-if="format.confidence" class="confidence">{{ format.confidence }}% match</span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          @click="currentPage--"
          :disabled="currentPage === 1"
          class="page-btn"
        >‹</button>

        <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>

        <button
          @click="currentPage++"
          :disabled="currentPage === totalPages"
          class="page-btn"
        >›</button>
      </div>
    </div>

    <!-- Format Preview -->
    <transition name="slide">
      <div v-if="previewFormat" class="format-preview">
        <div class="preview-header">
          <h4>{{ previewFormat.name }}</h4>
          <button @click="previewFormat = null" class="close-btn">✕</button>
        </div>

        <div class="preview-content">
          <div class="preview-field">
            <strong>ID:</strong> {{ previewFormat.id }}
          </div>
          <div class="preview-field">
            <strong>Extension:</strong> .{{ previewFormat.extension }}
          </div>
          <div class="preview-field">
            <strong>Category:</strong> {{ previewFormat.category }}
          </div>
          <div v-if="previewFormat.mimeType" class="preview-field">
            <strong>MIME Type:</strong> {{ previewFormat.mimeType }}
          </div>
          <div v-if="previewFormat.description" class="preview-field">
            <strong>Description:</strong> {{ previewFormat.description }}
          </div>
        </div>

        <div class="preview-actions">
          <button @click="applyFormat(previewFormat)" class="apply-btn">
            Apply Format
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useFormatStore } from '../stores/format'
import { categoryMetadata } from '../kaitai/ksy/categories/index'

const emit = defineEmits(['format-selected', 'close'])

const formatStore = useFormatStore()

// State
const searchQuery = ref('')
const selectedCategory = ref('')
const viewMode = ref('grid')
const currentPage = ref(1)
const itemsPerPage = ref(24)
const isLoading = ref(false)
const allFormats = ref([])
const recentFormats = ref([])
const selectedFormatId = ref('')
const previewFormat = ref(null)

// Categories from metadata
const categories = computed(() => {
  return Object.entries(categoryMetadata).map(([key, meta]) => ({
    key,
    name: meta.name,
    count: meta.count
  })).sort((a, b) => a.name.localeCompare(b.name))
})

// Total formats count
const totalFormats = computed(() => {
  return Object.values(categoryMetadata).reduce((sum, cat) => sum + cat.count, 0)
})

// Filtered formats based on search and category
const filteredFormats = computed(() => {
  let results = allFormats.value

  // Filter by category
  if (selectedCategory.value) {
    results = results.filter(f => f.category === selectedCategory.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    results = results.filter(f =>
      f.name?.toLowerCase().includes(query) ||
      f.id?.toLowerCase().includes(query) ||
      f.extension?.toLowerCase().includes(query) ||
      f.description?.toLowerCase().includes(query)
    )
  }

  return results
})

// Pagination
const totalPages = computed(() =>
  Math.ceil(filteredFormats.value.length / itemsPerPage.value)
)

const paginatedFormats = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredFormats.value.slice(start, end)
})

// Check if format is cached
const isCached = (formatId) => {
  return formatStore.isFormatCached(formatId)
}

// Load all format metadata (lightweight)
const loadFormatMetadata = async () => {
  isLoading.value = true

  try {
    // Load format index
    const { formatIndex } = await import('../kaitai/ksy/formats-index.js')

    // Transform to array with category info
    allFormats.value = formatIndex.map(format => ({
      ...format,
      category: getCategoryForFormat(format.id)
    }))

    // Load recent formats from localStorage
    const stored = localStorage.getItem('recentFormats')
    if (stored) {
      const recentIds = JSON.parse(stored)
      recentFormats.value = recentIds
        .map(id => allFormats.value.find(f => f.id === id))
        .filter(Boolean)
        .slice(0, 5)
    }
  } catch (error) {
    // console.error('Failed to load format metadata:', error)
  } finally {
    isLoading.value = false
  }
}

// Get category for a format
const getCategoryForFormat = (formatId) => {
  // This would map format IDs to categories
  // For now, return a default
  return 'common'
}

// Handle search
const handleSearch = () => {
  currentPage.value = 1
}

// Handle category change
const handleCategoryChange = () => {
  currentPage.value = 1
}

// Clear search
const clearSearch = () => {
  searchQuery.value = ''
  currentPage.value = 1
}

// Clear all filters
const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = ''
  currentPage.value = 1
}

// Select format
const selectFormat = (format) => {
  selectedFormatId.value = format.id
  previewFormat.value = format
}

// Apply format
const applyFormat = (format) => {
  // Update recent formats
  const recentIds = [format.id, ...recentFormats.value.map(f => f.id)]
    .filter((id, index, self) => self.indexOf(id) === index)
    .slice(0, 10)

  localStorage.setItem('recentFormats', JSON.stringify(recentIds))

  // Emit selection
  emit('format-selected', format)

  // Close preview
  previewFormat.value = null
}

// Reset page when filters change
watch([searchQuery, selectedCategory], () => {
  currentPage.value = 1
})

// Load on mount
onMounted(() => {
  loadFormatMetadata()
})
</script>

<style scoped>
.format-search-container {
  background: #2a2a3a;
  border-radius: 8px;
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.search-header h3 {
  color: #e0e0e0;
  font-size: 18px;
  margin: 0;
}

.format-count {
  color: #999;
  font-size: 14px;
}

.search-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search-input-wrapper {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 12px;
  background: #1a1a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #42b983;
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.category-select {
  padding: 8px 12px;
  background: #1a1a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
  min-width: 150px;
}

.view-toggle {
  display: flex;
  gap: 4px;
}

.view-btn {
  padding: 8px 12px;
  background: #1a1a2a;
  border: 1px solid #444;
  color: #999;
  cursor: pointer;
  font-size: 16px;
}

.view-btn.active {
  background: #42b983;
  color: #fff;
  border-color: #42b983;
}

.view-btn:first-child {
  border-radius: 4px 0 0 4px;
}

.view-btn:last-child {
  border-radius: 0 4px 4px 0;
}

.recent-section {
  margin-bottom: 16px;
}

.recent-section h4 {
  color: #e0e0e0;
  font-size: 14px;
  margin: 0 0 8px 0;
}

.recent-formats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.recent-format-btn {
  padding: 6px 12px;
  background: #42b983;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.recent-format-btn:hover {
  background: #35a372;
}

.format-results {
  min-height: 300px;
}

.loading-state,
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #999;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(66, 185, 131, 0.3);
  border-top-color: #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.reset-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: #42b983;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.format-items.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.format-items.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.format-item {
  background: #1a1a2a;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.format-item:hover {
  border-color: #42b983;
  transform: translateY(-2px);
}

.format-item.selected {
  border-color: #42b983;
  background: #2a3a3a;
}

.format-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.format-name {
  color: #e0e0e0;
  font-weight: 500;
  font-size: 14px;
}

.format-ext {
  color: #42b983;
  font-size: 12px;
  font-family: monospace;
}

.format-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.format-category {
  color: #999;
  font-size: 12px;
}

.format-desc {
  color: #777;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.format-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cached-badge {
  color: #ffd700;
  font-size: 11px;
  font-weight: bold;
}

.confidence {
  color: #42b983;
  font-size: 11px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}

.page-btn {
  padding: 6px 12px;
  background: #1a1a2a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 18px;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #999;
  font-size: 14px;
}

.format-preview {
  position: fixed;
  right: 20px;
  top: 100px;
  width: 300px;
  background: #2a2a3a;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #444;
}

.preview-header h4 {
  color: #e0e0e0;
  margin: 0;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  padding: 0;
}

.preview-content {
  padding: 12px;
}

.preview-field {
  margin-bottom: 8px;
  font-size: 13px;
  color: #ccc;
}

.preview-field strong {
  color: #42b983;
  margin-right: 8px;
}

.preview-actions {
  padding: 12px;
  border-top: 1px solid #444;
}

.apply-btn {
  width: 100%;
  padding: 8px;
  background: #42b983;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-weight: 500;
}

.apply-btn:hover {
  background: #35a372;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(100%);
}
</style>