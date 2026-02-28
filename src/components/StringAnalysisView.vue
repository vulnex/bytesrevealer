/**
 * VULNEX -Bytes Revealer-
 *
 * File: StringAnalysisView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="string-analysis">
    <!-- Header Section -->
    <div class="header-section">
      <h2>String Analysis</h2>
      <p>Extracted ASCII and UTF-8 strings from the binary file</p>
    </div>

    <!-- Loading Progress -->
    <div v-if="isLoading" class="loading-section">
      <div class="progress-text">
        Extracting strings from large file... {{ progress.toFixed(1) }}%
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>

    <!-- Stats Section -->
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-label">Total Strings</div>
        <div class="stat-value">{{ strings.length }}</div>
      </div>
      <div class="stat-card ascii">
        <div class="stat-label">ASCII Strings</div>
        <div class="stat-value">
          {{ strings.filter(s => s.type === 'ASCII').length }}
        </div>
      </div>
      <div class="stat-card utf8">
        <div class="stat-label">UTF-8 Strings</div>
        <div class="stat-value">
          {{ strings.filter(s => s.type === 'UTF-8').length }}
        </div>
      </div>
      <div class="stat-card utf16">
        <div class="stat-label">UTF-16 Strings</div>
        <div class="stat-value">
          {{ strings.filter(s => s.type.includes('UTF-16')).length }}
        </div>
      </div>
    </div>

    <!-- Search and Filter Section -->
    <div class="filter-section">
      <div class="filter-controls">
        <div class="search-container">
          <input
            type="text"
            v-model="searchQuery"
            :placeholder="useRegex ? 'Enter regex pattern...' : 'Search strings...'"
            class="search-input"
            :class="{ 'regex-mode': useRegex, 'regex-error': regexError }"
          >
          <label class="regex-toggle" title="Enable regex search">
            <input type="checkbox" v-model="useRegex">
            <span>Regex</span>
          </label>
        </div>
        <select v-model="typeFilter" class="filter-select">
          <option value="all">All Types</option>
          <option value="ASCII">ASCII Only</option>
          <option value="UTF-8">UTF-8 Only</option>
          <option value="UTF-16">UTF-16 Only</option>
        </select>
        <select v-model="sortBy" class="filter-select">
          <option value="size">Sort by Size</option>
          <option value="type">Sort by Type</option>
          <option value="offset">Sort by Offset</option>
        </select>
      </div>
      <div v-if="regexError" class="regex-error-message">
        Invalid regex pattern: {{ regexError }}
      </div>
    </div>

    <!-- Table Section -->
    <div class="table-container">
      <table class="strings-table">
        <thead>
          <tr>
            <th class="th-offset">Offset</th>
            <th class="th-type">Type</th>
            <th class="th-size">Size</th>
            <th class="th-content">String Content</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(str, index) in paginatedStrings"
              :key="index"
              class="string-row">
            <td class="cell-offset">
              <code>0x{{ (str.offset || 0).toString(16).toUpperCase().padStart(8, '0') }}</code>
            </td>
            <td class="cell-type">
              <span class="type-badge" :class="getTypeClass(str.type)">
                {{ str.type }}
              </span>
            </td>
            <td class="cell-size">
              {{ str.size }} chars
            </td>
            <td class="cell-content">
              <div class="string-value" :title="str.value">
                {{ truncateString(str.value, 100) }}
              </div>
            </td>
            <td class="cell-actions">
              <button
                @click="copyString(str.value)"
                class="action-btn copy"
                title="Copy string"
              >
                📋
              </button>
              <button
                @click="showDetails(str)"
                class="action-btn details"
                title="View details"
              >
                🔍
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty state -->
      <div v-if="filteredAndSortedStrings.length === 0" class="empty-state">
        <p>No strings found matching your criteria</p>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        @click="currentPage = Math.max(1, currentPage - 1)"
        :disabled="currentPage === 1"
        class="page-btn"
      >
        Previous
      </button>
      <span class="page-info">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      <button
        @click="currentPage = Math.min(totalPages, currentPage + 1)"
        :disabled="currentPage === totalPages"
        class="page-btn"
      >
        Next
      </button>
    </div>

    <!-- String Details Modal -->
    <div v-if="selectedString" class="modal-overlay" @click="selectedString = null">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>String Details</h3>
          <button @click="selectedString = null" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <label>Offset:</label>
            <code>0x{{ (selectedString.offset || 0).toString(16).toUpperCase().padStart(8, '0') }}</code>
          </div>
          <div class="detail-row">
            <label>Type:</label>
            <span class="type-badge" :class="getTypeClass(selectedString.type)">
              {{ selectedString.type }}
            </span>
          </div>
          <div class="detail-row">
            <label>Length:</label>
            <span>{{ selectedString.size }} characters</span>
          </div>
          <div class="detail-row">
            <label>Content:</label>
            <div class="string-full-content">
              {{ selectedString.value }}
            </div>
          </div>
          <div class="modal-actions">
            <button @click="copyString(selectedString.value)" class="modal-btn primary">
              Copy String
            </button>
            <button @click="selectedString = null" class="modal-btn">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Copy notification -->
    <div v-if="showCopyNotification" class="copy-notification">
      String copied to clipboard!
    </div>
  </div>
</template>

<script>
import { ref, toRef } from 'vue'
import { useStringExtraction } from '../composables/useStringExtraction'
import { useStringFilter } from '../composables/useStringFilter'

export default {
  name: 'StringAnalysisView',

  props: {
    fileBytes: {
      type: [Array, Uint8Array],
      required: true
    }
  },

  setup(props) {
    const fileBytesRef = toRef(props, 'fileBytes')

    // String extraction (worker lifecycle, sync fallback)
    const {
      strings,
      isLoading,
      progress,
      extractStrings
    } = useStringExtraction(fileBytesRef)

    // Filtering, sorting, pagination
    const {
      searchQuery,
      typeFilter,
      sortBy,
      useRegex,
      regexError,
      currentPage,
      itemsPerPage,
      filteredAndSortedStrings,
      totalPages,
      paginatedStrings
    } = useStringFilter(strings)

    // UI state
    const selectedString = ref(null)
    const showCopyNotification = ref(false)

    function getTypeClass(type) {
      if (type === 'ASCII') return 'type-ascii'
      if (type === 'UTF-8') return 'type-utf8'
      if (type.includes('UTF-16')) return 'type-utf16'
      return 'type-other'
    }

    function truncateString(str, maxLength) {
      if (str.length <= maxLength) return str
      return str.substring(0, maxLength) + '...'
    }

    async function copyString(text) {
      try {
        await navigator.clipboard.writeText(text)
        showCopyNotification.value = true
        setTimeout(() => {
          showCopyNotification.value = false
        }, 2000)
      } catch (err) {
        // clipboard not available
      }
    }

    function showDetails(str) {
      selectedString.value = str
    }

    return {
      strings,
      isLoading,
      progress,
      extractStrings,
      searchQuery,
      typeFilter,
      sortBy,
      useRegex,
      regexError,
      currentPage,
      itemsPerPage,
      filteredAndSortedStrings,
      totalPages,
      paginatedStrings,
      selectedString,
      showCopyNotification,
      getTypeClass,
      truncateString,
      copyString,
      showDetails
    }
  }
}
</script>

<style scoped>
@import '../styles/string-analysis.css';
</style>