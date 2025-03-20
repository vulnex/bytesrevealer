/** 
 * VULNEX -Bytes Revealer-
 *
 * File: StringAnalysisView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="string-analysis min-h-screen bg-white">
    <!-- Header Section -->
    <div class="bg-gray-50 border-b border-gray-200 p-6">
      <h2 class="text-2xl font-semibold text-gray-800">String Analysis</h2>
      <p class="mt-2 text-gray-600">Displaying extracted ASCII and UTF-8 strings from the binary file</p>
    </div>

    <!-- Stats Section -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-white border-b border-gray-200">
      <div class="bg-blue-50 rounded-lg p-4">
        <div class="text-sm font-medium text-blue-600">Total Strings</div>
        <div class="mt-1 text-2xl font-semibold text-blue-900">{{ strings.length }}</div>
      </div>
      <div class="bg-green-50 rounded-lg p-4">
        <div class="text-sm font-medium text-green-600">ASCII Strings</div>
        <div class="mt-1 text-2xl font-semibold text-green-900">
          {{ strings.filter(s => s.type === 'ASCII').length }}
        </div>
      </div>
      <div class="bg-purple-50 rounded-lg p-4">
        <div class="text-sm font-medium text-purple-600">UTF-8 Strings</div>
        <div class="mt-1 text-2xl font-semibold text-purple-900">
          {{ strings.filter(s => s.type === 'UTF-8').length }}
        </div>
      </div>
    </div>

    <!-- Search and Filter Section -->
    <div class="p-6 border-b border-gray-200">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Search strings..." 
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
        </div>
        <div class="flex gap-4">
          <select 
            v-model="typeFilter" 
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="ASCII">ASCII Only</option>
            <option value="UTF-8">UTF-8 Only</option>
          </select>
          <select 
            v-model="sortBy" 
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="size">Sort by Size</option>
            <option value="type">Sort by Type</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Table Section -->
    <div class="p-6">
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                String Content
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(str, index) in filteredAndSortedStrings" 
                :key="index" 
                class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <span 
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="{
                    'bg-green-100 text-green-800': str.type === 'ASCII',
                    'bg-purple-100 text-purple-800': str.type === 'UTF-8'
                  }"
                >
                  {{ str.type }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ str.size }} chars
              </td>
              <td class="px-6 py-4">
                <div class="text-sm text-gray-900 font-mono break-all">
                  {{ str.value }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StringAnalysisView',
  
  props: {
    fileBytes: {
      type: Array,
      required: true
    }
  },
  
  data() {
    return {
      strings: [],
      searchQuery: '',
      typeFilter: 'all',
      sortBy: 'size'
    }
  },
  
  computed: {
    filteredAndSortedStrings() {
      let result = [...this.strings];
      
      // Apply type filter
      if (this.typeFilter !== 'all') {
        result = result.filter(str => str.type === this.typeFilter);
      }
      
      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(str => 
          str.value.toLowerCase().includes(query) ||
          str.type.toLowerCase().includes(query)
        );
      }
      
      // Apply sorting
      result.sort((a, b) => {
        if (this.sortBy === 'size') {
          return b.size - a.size;
        } else {
          return a.type.localeCompare(b.type);
        }
      });
      
      return result;
    }
  },
  
  watch: {
    fileBytes: {
      immediate: true,
      handler: 'extractStrings'
    }
  },
  
  methods: {
    escapeString(str) {
      return str
        .replace(/[\x00-\x1F\x7F-\x9F]/g, (char) => 
          `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`
        );
    },
    
    extractStrings() {
      this.strings = [];
      if (!this.fileBytes.length) return;
      
      let currentString = '';
      let currentType = 'ASCII';
      
      for (let i = 0; i < this.fileBytes.length; i++) {
        const byte = this.fileBytes[i];
        
        if (byte >= 0x20 && byte <= 0x7E) {
          currentString += String.fromCharCode(byte);
        } else {
          try {
            const utf8Bytes = this.fileBytes.slice(i, i + 4);
            const utf8String = new TextDecoder('utf-8').decode(new Uint8Array(utf8Bytes));
            
            if (utf8String.length > 0 && /^[\u0080-\uFFFF]/.test(utf8String)) {
              if (currentString) {
                this.addString(currentString, currentType);
                currentString = '';
              }
              currentType = 'UTF-8';
              currentString = utf8String;
              i += utf8String.length - 1;
              continue;
            }
          } catch {
            // Not a valid UTF-8 sequence
          }
          
          if (currentString) {
            this.addString(currentString, currentType);
            currentString = '';
            currentType = 'ASCII';
          }
        }
      }
      
      if (currentString) {
        this.addString(currentString, currentType);
      }
    },
    
    addString(str, type) {
      if (str.trim().length > 0) {
        this.strings.push({
          type: type,
          size: str.length,
          value: this.escapeString(str)
        });
      }
    }
  }
}
</script>