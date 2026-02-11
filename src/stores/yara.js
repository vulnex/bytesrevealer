/**
 * VULNEX -Bytes Revealer-
 *
 * File: yara.js
 * Author: Simon Roses Femerling
 * Created: 2026-02-10
 * Last Modified: 2026-02-10
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { defineStore } from 'pinia'
import { createLogger } from '../utils/logger'

const logger = createLogger('YaraStore')

export const useYaraStore = defineStore('yara', {
  state: () => ({
    // Rule editor state
    currentRules: '',
    selectedRuleSet: null,
    importedFileName: null,

    // Scan state
    isScanning: false,
    scanProgress: 0,
    compileErrors: [],
    consoleLogs: [],
    matchedRules: [],

    // Scan metadata
    lastScanTimestamp: null,
    lastScanDuration: null,
    error: null,

    // Display options
    highlightMatchesInHex: false
  }),

  getters: {
    hasResults: (state) => state.matchedRules.length > 0,

    totalMatches: (state) => {
      return state.matchedRules.reduce(
        (sum, rule) => sum + (rule.matches ? rule.matches.length : 0),
        0
      )
    },

    hasCompileErrors: (state) => state.compileErrors.length > 0,

    allMatchLocations: (state) => {
      const locations = []
      for (const rule of state.matchedRules) {
        if (rule.matches) {
          for (const match of rule.matches) {
            locations.push({
              ruleName: rule.ruleName,
              offset: match.offset,
              length: match.length,
              stringIdentifier: match.stringIdentifier,
              data: match.data
            })
          }
        }
      }
      return locations
    },

    matchHighlightBytes: (state) => {
      if (!state.highlightMatchesInHex) return []
      const MAX_HIGHLIGHT_BYTES = 100000
      const bytes = new Set()
      for (const rule of state.matchedRules) {
        if (rule.matches) {
          for (const match of rule.matches) {
            for (let i = 0; i < match.length; i++) {
              bytes.add(match.offset + i)
              if (bytes.size > MAX_HIGHLIGHT_BYTES) {
                // Highlights disabled for large result sets
                return []
              }
            }
          }
        }
      }
      return Array.from(bytes)
    },

    serializableState: (state) => {
      return {
        currentRules: state.currentRules,
        selectedRuleSet: state.selectedRuleSet,
        importedFileName: state.importedFileName,
        compileErrors: state.compileErrors,
        consoleLogs: state.consoleLogs,
        matchedRules: state.matchedRules,
        lastScanTimestamp: state.lastScanTimestamp,
        lastScanDuration: state.lastScanDuration,
        highlightMatchesInHex: state.highlightMatchesInHex
      }
    }
  },

  actions: {
    setRules(rules) {
      this.currentRules = rules
      this.selectedRuleSet = null
      this.importedFileName = null
    },

    selectBuiltInRuleSet(ruleSetId, rules) {
      logger.debug('Selecting built-in rule set:', ruleSetId)
      this.selectedRuleSet = ruleSetId
      this.currentRules = rules
      this.importedFileName = null
    },

    setImportedRules(fileName, rules) {
      logger.debug('Imported rules from:', fileName)
      this.importedFileName = fileName
      this.currentRules = rules
      this.selectedRuleSet = null
    },

    setScanResults({ compileErrors, consoleLogs, matchedRules, duration }) {
      this.compileErrors = compileErrors || []
      this.consoleLogs = consoleLogs || []
      this.matchedRules = matchedRules || []
      this.lastScanTimestamp = new Date().toISOString()
      this.lastScanDuration = duration || null
      this.isScanning = false
      this.scanProgress = 100
      this.error = null
      logger.info(
        `Scan complete: ${this.matchedRules.length} rules matched, ${this.totalMatches} total matches`
      )
    },

    clearResults() {
      this.compileErrors = []
      this.consoleLogs = []
      this.matchedRules = []
      this.lastScanTimestamp = null
      this.lastScanDuration = null
      this.scanProgress = 0
      this.error = null
    },

    reset() {
      logger.debug('Resetting YARA store')
      this.currentRules = ''
      this.selectedRuleSet = null
      this.importedFileName = null
      this.isScanning = false
      this.scanProgress = 0
      this.compileErrors = []
      this.consoleLogs = []
      this.matchedRules = []
      this.lastScanTimestamp = null
      this.lastScanDuration = null
      this.error = null
      this.highlightMatchesInHex = false
    },

    restoreFromSession(savedState) {
      if (!savedState) return
      logger.debug('Restoring YARA state from session')
      this.currentRules = savedState.currentRules || ''
      this.selectedRuleSet = savedState.selectedRuleSet || null
      this.importedFileName = savedState.importedFileName || null
      this.compileErrors = savedState.compileErrors || []
      this.consoleLogs = savedState.consoleLogs || []
      this.matchedRules = savedState.matchedRules || []
      this.lastScanTimestamp = savedState.lastScanTimestamp || null
      this.lastScanDuration = savedState.lastScanDuration || null
      this.highlightMatchesInHex = savedState.highlightMatchesInHex || false
    },

    toggleHexHighlight() {
      this.highlightMatchesInHex = !this.highlightMatchesInHex
    }
  }
})
