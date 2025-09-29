/** 
 * VULNEX -Bytes Revealer-
 *
 * File: ExportOptions.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-03
 * Last Modified: 2025-004-03
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="settings-panel p-4">
    <h3 class="text-xl font-semibold mb-4">Settings</h3>
    
    <!-- Theme Settings -->
    <div class="setting-section mb-6">
      <h4 class="text-lg font-medium mb-3">Theme</h4>
      <div class="theme-options flex gap-4">
        <button 
          @click="setTheme('light')"
          class="theme-button"
          :class="{ active: settings.theme === 'light' }"
        >
          <span class="theme-icon">☀️</span>
          <span>Light Mode</span>
        </button>
        
        <button 
          @click="setTheme('dark')"
          class="theme-button"
          :class="{ active: settings.theme === 'dark' }"
        >
          <span class="theme-icon">🌙</span>
          <span>Dark Mode</span>
        </button>
      </div>
    </div>

    <!-- Display Settings -->
    <div class="setting-section mb-6">
      <h4 class="text-lg font-medium mb-3">Display</h4>
      <div class="space-y-3">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="settings.hexUppercase"
            class="form-checkbox"
          >
          <span>Show Hex Values in Uppercase</span>
        </label>
        
        <div class="flex items-center space-x-4">
          <span>Bytes per Row:</span>
          <select 
            v-model="settings.bytesPerRow"
            class="form-select rounded border px-2 py-1"
          >
            <option value="8">8 bytes</option>
            <option value="16">16 bytes</option>
            <option value="32">32 bytes</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Debug Settings -->
    <div class="setting-section mb-6">
      <h4 class="text-lg font-medium mb-3">Developer Options</h4>
      <div class="space-y-3">
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            v-model="settings.debugMode"
            @change="toggleDebugMode"
            class="form-checkbox"
          >
          <span>Enable Debug Console Output</span>
        </label>
        <span class="hint text-sm text-gray-500">Shows detailed logging in browser console</span>
      </div>
    </div>

    <!-- Base Offset Setting -->
    <div class="setting-section mb-6">
      <h4 class="text-lg font-medium mb-3">Base Offset</h4>
      <div class="setting-group">
        <div class="input-group">
          <div class="flex items-center space-x-2">
            <input 
              type="number"
              v-model.number="settings.baseOffset"
              min="0"
              @input="validateOffset"
              @change="updateOffset"
              class="form-input"
              :class="{ 'error': offsetError }"
              placeholder="Enter offset"
            >
            <button 
              @click="resetOffset"
              class="reset-button"
              title="Reset to 0"
            >
              ↺
            </button>
          </div>
          <span class="hint">Starting offset for byte numbering (decimal)</span>
          <span v-if="offsetError" class="error-message">{{ offsetError }}</span>
        </div>
        <div class="offset-display mt-2">
          <span class="text-sm">Hex: 0x{{ formatHex(settings.baseOffset) }}</span>
        </div>
      </div>
    </div>

    <div class="mt-6 flex space-x-4">
      <button 
        @click="saveSettings"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Settings
      </button>
      <button 
        @click="resetSettings"
        class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
      >
        Reset to Defaults
      </button>
    </div>
  </div>
</template>

<script>
import { useSettingsStore } from '../stores/settings'
import { createLogger } from '../utils/logger'

const logger = createLogger('SettingsPanel')

export default {
  name: 'SettingsPanel',
  data() {
    const settingsStore = useSettingsStore()
    return {
      settings: {
        theme: 'dark', // Default to dark mode
        hexUppercase: false,
        bytesPerRow: '16',
        baseOffset: settingsStore.baseOffset,
        debugMode: localStorage.getItem('debugMode') === 'true'
      },
      offsetError: ''
    }
  },
  methods: {
    setTheme(theme) {
      this.settings.theme = theme;
      this.applyTheme(theme);
      // Save the theme preference immediately
      this.saveSettings();
    },
    applyTheme(theme) {
      document.documentElement.classList.remove('light-mode', 'dark-mode');
      document.documentElement.classList.add(`${theme}-mode`);
      localStorage.setItem('theme', theme);

      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content',
          theme === 'dark' ? '#1a202c' : '#ffffff'
        );
      }
    },
    toggleDebugMode() {
      // Save debug mode preference to localStorage
      localStorage.setItem('debugMode', this.settings.debugMode.toString());

      // Show feedback to user
      if (this.settings.debugMode) {
        logger.info('Debug mode enabled - console logging is now active');
        alert('Debug mode enabled. Console logging is now active. Refresh the page to see debug messages.');
      } else {
        logger.info('Debug mode disabled - console logging is now inactive');
        alert('Debug mode disabled. Console logging is now inactive. Refresh the page to hide debug messages.');
      }
    },
    saveSettings() {
      try {
        localStorage.setItem('bytesRevealerSettings', JSON.stringify(this.settings));
        this.$emit('settings-updated', this.settings);
      } catch (error) {
        logger.error('Error saving settings:', error);
      }
    },
    resetSettings() {
      // Don't reset the theme when resetting other settings
      const currentTheme = this.settings.theme;
      this.settings = {
        theme: currentTheme, // Preserve current theme
        hexUppercase: false,
        bytesPerRow: '16',
        baseOffset: this.settings.baseOffset
      };
      this.saveSettings();
    },
    loadSettings() {
      try {
        // First try to get the theme from localStorage
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
          this.settings.theme = savedTheme;
        }
        
        // Then load all settings
        const saved = localStorage.getItem('bytesRevealerSettings');
        if (saved) {
          const parsedSettings = JSON.parse(saved);
          this.settings = { ...this.settings, ...parsedSettings };
        }
        
        // Apply the theme
        this.applyTheme(this.settings.theme);
      } catch (error) {
        logger.error('Error loading settings:', error);
      }
    },
    validateOffset(event) {
      const value = event.target.value
      
      // Clear previous error
      this.offsetError = ''
      
      // Check if empty
      if (!value) {
        this.offsetError = 'Offset cannot be empty'
        return false
      }
      
      // Check if negative
      if (value < 0) {
        this.offsetError = 'Offset cannot be negative'
        this.settings.baseOffset = 0
        return false
      }
      
      // Check if it's a valid number
      if (isNaN(value)) {
        this.offsetError = 'Please enter a valid number'
        return false
      }
      
      // Check if it's too large
      if (value > Number.MAX_SAFE_INTEGER) {
        this.offsetError = 'Offset value is too large'
        return false
      }
      
      return true
    },
    updateOffset() {
      if (this.validateOffset({ target: { value: this.settings.baseOffset } })) {
        const settingsStore = useSettingsStore()
        settingsStore.setBaseOffset(this.settings.baseOffset)
        this.$emit('settings-updated', this.settings)
      }
    },
    resetOffset() {
      this.settings.baseOffset = 0
      this.offsetError = ''
      const settingsStore = useSettingsStore()
      settingsStore.setBaseOffset(0)
      this.$emit('settings-updated', this.settings)
    },
    formatHex(value) {
      return value.toString(16).toUpperCase().padStart(8, '0')
    }
  },
  mounted() {
    this.loadSettings();
  }
}
</script>

<style scoped>
.theme-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.theme-button.active {
  border-color: var(--link-color);
  background: var(--link-color);
  color: #ffffff;
}

:root[class='dark-mode'] .theme-button {
  border-color: var(--border-color);
  color: var(--text-primary);
}

:root[class='dark-mode'] .theme-button:hover:not(.active) {
  border-color: var(--link-color);
}

.theme-icon {
  font-size: 1.2em;
}

.settings-panel {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.form-checkbox {
  background-color: var(--checkbox-bg);
  border-color: var(--border-color);
}

.form-select {
  background-color: var(--input-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

/* Settings section headers */
h3, h4 {
  color: var(--text-primary);
}

/* Settings labels */
label span {
  color: var(--text-primary);
}

/* Buttons */
button.bg-blue-600 {
  background-color: var(--link-color);
  color: #ffffff;
}

button.bg-gray-200 {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

/* Dark mode specific styles */
:root[class='dark-mode'] .settings-panel {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

:root[class='dark-mode'] .form-checkbox {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .form-select {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.setting-group {
  margin-bottom: 20px;
}

.setting-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 500;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-input {
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  width: 120px;
  transition: border-color 0.2s ease;
}

.form-input.error {
  border-color: var(--error-text);
}

.error-message {
  color: var(--error-text);
  font-size: 0.75rem;
}

.hint {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.reset-button {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reset-button:hover {
  background-color: var(--bg-secondary);
  border-color: var(--link-color);
  color: var(--link-color);
}

.offset-display {
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Dark mode specific styles */
:root[class='dark-mode'] .form-input {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .reset-button {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .reset-button:hover {
  background-color: var(--bg-primary);
  border-color: var(--link-color);
  color: var(--link-color);
}
</style> 