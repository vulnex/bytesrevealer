/** 
 * VULNEX -Bytes Revealer-
 *
 * File: SearchBar.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="search-container">
    <div class="search-box">
      <select v-model="searchTypeLocal" class="search-type" :disabled="isSearching">
        <option value="hex">Hex</option>
        <option value="ascii">ASCII</option>
        <option value="string">String</option>
        <option value="regex">Regex</option>
      </select>
      <input
        type="text"
        v-model="searchPatternLocal"
        :placeholder="getPlaceholder()"
        :disabled="isSearching"
        @keyup.enter="search"
      >
      <button
        v-if="!isSearching"
        @click="search"
        class="search-button"
        :disabled="!searchPatternLocal"
      >
        Search
      </button>
      <button
        v-else
        @click="cancel"
        class="cancel-button"
        title="Cancel search"
      >
        Cancel
      </button>
      <button @click="clear" class="clear-button" :disabled="isSearching">Clear</button>
    </div>

    <!-- Progress Bar -->
    <div v-if="isSearching && progress > 0" class="search-progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
      <span class="progress-text">{{ progress }}%</span>
    </div>

    <!-- Results Summary -->
    <div v-if="results.length > 0 && !isSearching" class="search-results">
      <span class="results-count">
        Found {{ results.length }} match{{ results.length !== 1 ? 'es' : '' }}
        <span v-if="results.length > 1" class="current-match">
          ({{ currentMatchIndex + 1 }} of {{ results.length }})
        </span>
      </span>
      <button
        v-if="results.length > 1"
        @click="prevMatch"
        class="nav-button"
        title="Previous match"
      >
        ⬅ Prev
      </button>
      <button
        v-if="results.length > 1"
        @click="nextMatch"
        class="nav-button"
        title="Next match"
      >
        Next ➔
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SearchBar',
  props: {
    searchType: {
      type: String,
      required: true
    },
    searchPattern: {
      type: String,
      required: true
    },
    isSearching: {
      type: Boolean,
      default: false
    },
    progress: {
      type: Number,
      default: 0
    },
    results: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      currentMatchIndex: 0
    }
  },
  computed: {
    searchTypeLocal: {
      get() {
        return this.searchType
      },
      set(value) {
        this.$emit('update:searchType', value)
      }
    },
    searchPatternLocal: {
      get() {
        return this.searchPattern
      },
      set(value) {
        this.$emit('update:searchPattern', value)
      }
    }
  },
  methods: {
    search() {
      if (this.searchPatternLocal && !this.isSearching) {
        this.currentMatchIndex = 0
        this.$emit('search')
      }
    },
    clear() {
      this.currentMatchIndex = 0
      this.$emit('clear')
    },
    cancel() {
      this.$emit('cancel')
    },
    getPlaceholder() {
      switch(this.searchTypeLocal) {
        case 'hex':
          return 'Search hex pattern: e.g. FF D8'
        case 'ascii':
        case 'string':
          return 'Search ASCII/UTF-8 text'
        case 'regex':
          return 'Search with regex pattern'
        default:
          return 'Enter search pattern'
      }
    },
    nextMatch() {
      if (this.results.length > 0) {
        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.results.length

        this.$emit('navigateToMatch', this.results[this.currentMatchIndex])
      }
    },
    prevMatch() {
      if (this.results.length > 0) {
        this.currentMatchIndex = this.currentMatchIndex === 0
          ? this.results.length - 1
          : this.currentMatchIndex - 1

        this.$emit('navigateToMatch', this.results[this.currentMatchIndex])
      }
    }
  }
}
</script>

<style scoped>
.search-container {
  margin-bottom: 1rem;
}

.search-box {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.search-type {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  min-width: 100px;
}

.search-box input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.search-button,
.clear-button,
.cancel-button,
.nav-button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-button:hover:not(:disabled),
.clear-button:hover:not(:disabled),
.nav-button:hover {
  background-color: #e0e0e0;
}

.cancel-button {
  background-color: #ff6b6b;
  color: white;
  border-color: #ff5252;
}

.cancel-button:hover {
  background-color: #ff5252;
}

.search-button:disabled,
.clear-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Progress Bar */
.search-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #45a049);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #666;
  min-width: 40px;
}

/* Search Results */
.search-results {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: #f9f9f9;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.results-count {
  font-weight: 500;
  color: #333;
  margin-right: auto;
}

.current-match {
  font-weight: normal;
  color: #666;
  margin-left: 0.5rem;
}

.nav-button {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

/* Dark mode support */
:root[class='dark-mode'] .search-type,
:root[class='dark-mode'] .search-box input {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .search-button,
:root[class='dark-mode'] .clear-button,
:root[class='dark-mode'] .nav-button {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .search-button:hover:not(:disabled),
:root[class='dark-mode'] .clear-button:hover:not(:disabled),
:root[class='dark-mode'] .nav-button:hover {
  background-color: var(--hover-bg);
}

:root[class='dark-mode'] .search-results {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .results-count {
  color: var(--text-primary);
}

:root[class='dark-mode'] .current-match {
  color: var(--text-secondary);
}

:root[class='dark-mode'] .progress-bar {
  background-color: var(--bg-tertiary);
}
</style>
