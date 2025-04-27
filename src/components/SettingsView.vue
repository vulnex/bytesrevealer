/** 
 * VULNEX -Bytes Revealer-
 *
 * File: SettingsView.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2025-04-27
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="settings-view">
    <div class="settings-section">
      <h3>View Settings</h3>
      
      <div class="setting-group">
        <h4>Navigation</h4>
        <div class="setting-item">
          <label class="setting-label">Base Offset</label>
          <BaseOffsetInput
            v-model="baseOffset"
            :max-offset="maxOffset"
          />
          <div class="setting-description">
            Change the starting offset for viewing file content (current: {{ formatOffset(baseOffset) }})
          </div>
        </div>
      </div>
      
      <!-- Other settings... -->
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import BaseOffsetInput from './shared/BaseOffsetInput.vue'

export default {
  name: 'SettingsView',
  components: {
    BaseOffsetInput
  },
  
  setup() {
    const settingsStore = useSettingsStore()
    
    const baseOffset = computed({
      get: () => settingsStore.baseOffset,
      set: (value) => settingsStore.updateBaseOffset(value)
    })

    const maxOffset = computed(() => {
      // TODO: Get file bytes from appropriate store
      const fileBytes = new Uint8Array() // Placeholder
      return Math.max(0, fileBytes.length - 1)
    })

    const formatOffset = (offset) => {
      return `0x${offset.toString(16).toUpperCase()} (${offset})`
    }

    return {
      baseOffset,
      maxOffset,
      formatOffset
    }
  }
}
</script>

<style scoped>
.settings-view {
  padding: 20px;
  color: var(--text-primary);
}

.settings-section {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.setting-group {
  margin-bottom: 24px;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
}

.setting-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 8px;
}

h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 20px;
}

h4 {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

/* Dark mode overrides */
:root[class='dark-mode'] .settings-section {
  background-color: var(--bg-secondary);
}
</style> 