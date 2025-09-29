/**
 * VULNEX -Bytes Revealer-
 *
 * File: format.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-16
 * Last Modified: 2025-01-16
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { defineStore } from 'pinia'
import { createLogger } from '../utils/logger'

const logger = createLogger('FormatStore')

export const useFormatStore = defineStore('format', {
  state: () => ({
    currentFormat: null,
    selectedFormatId: '',
    kaitaiStructures: [],
    isAutoDetected: false,
    confidence: 0,
    // Loading state tracking
    isLoadingFormat: false,
    loadingFormatName: '',
    loadingProgress: 0,
    loadedCategories: new Set(),
    cachedFormats: new Set()
  }),

  getters: {
    hasFormat: (state) => !!state.currentFormat,
    formatName: (state) => state.currentFormat?.name || 'Unknown',
    formatId: (state) => state.currentFormat?.id || state.selectedFormatId
  },

  actions: {
    setFormat(format) {
      logger.debug('Setting format:', format)
      // Make a shallow copy to avoid reactivity warnings
      this.currentFormat = format ? { ...format } : null
      this.selectedFormatId = format?.id || ''
      this.isAutoDetected = false
    },

    setAutoDetectedFormat(format, confidence = 0) {
      logger.debug('Setting auto-detected format:', format, 'confidence:', confidence)
      // Make a shallow copy to avoid reactivity warnings
      this.currentFormat = format ? { ...format } : null
      this.selectedFormatId = format?.id || ''
      this.isAutoDetected = true
      this.confidence = confidence
    },

    setStructures(structures) {
      logger.debug('Setting Kaitai structures:', structures?.length || 0, 'items')
      this.kaitaiStructures = structures || []
    },

    clearFormat() {
      logger.debug('Clearing format')
      this.currentFormat = null
      this.selectedFormatId = ''
      this.kaitaiStructures = []
      this.isAutoDetected = false
      this.confidence = 0
    },

    // Called when a new file is loaded
    resetForFile() {
      logger.debug('Resetting format for new file')
      this.clearFormat()
    },

    // Loading state management
    setLoadingState(isLoading, formatName = '', progress = 0) {
      this.isLoadingFormat = isLoading
      this.loadingFormatName = formatName
      this.loadingProgress = progress
    },

    markCategoryLoaded(category) {
      this.loadedCategories.add(category)
      logger.debug(`Category '${category}' marked as loaded`)
    },

    markFormatCached(formatId) {
      this.cachedFormats.add(formatId)
      logger.debug(`Format '${formatId}' marked as cached`)
    },

    isCategoryLoaded(category) {
      return this.loadedCategories.has(category)
    },

    isFormatCached(formatId) {
      return this.cachedFormats.has(formatId)
    }
  }
})