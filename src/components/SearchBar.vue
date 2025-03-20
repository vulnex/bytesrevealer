/** 
 * VULNEX -Bytes Revealer-
 *
 * File: SearchBar.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="search-box">
    <select v-model="searchTypeLocal" class="search-type">
      <option value="hex">Hex</option>
      <option value="ascii">ASCII</option>
    </select>
    <input 
      type="text" 
      v-model="searchPatternLocal" 
      :placeholder="searchTypeLocal === 'hex' ? 'Search hex pattern: e.g. FF D8' : 'Search ASCII text'"
    >
    <button @click="search" class="search-button">Search</button>
    <button @click="clear" class="clear-button">Clear</button>
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
      this.$emit('search')
    },
    clear() {
      this.$emit('clear')
    }
  }
}
</script>
