/**
 * VULNEX -Bytes Revealer-
 *
 * File: settings.js
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2025-04-27
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    baseOffset: 0,
    enableEmbeddedExecutableScan: true
    // other settings...
  }),
  actions: {
    setBaseOffset(offset) {
      this.baseOffset = Math.max(0, parseInt(offset) || 0)
    },
    updateBaseOffset(offset) {
      this.baseOffset = offset
    },
    setEnableEmbeddedExecutableScan(enabled) {
      this.enableEmbeddedExecutableScan = !!enabled
    }
  },
  getters: {
    currentOffset: (state) => state.baseOffset
  },
  persist: true // If you want settings to persist across sessions
})
