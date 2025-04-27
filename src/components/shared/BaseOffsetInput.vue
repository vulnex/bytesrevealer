/** 
 * VULNEX -Bytes Revealer-
 *
 * File: BaseOffsetInput.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2025-04-27
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="base-offset-input">
    <label>Base Offset:</label>
    <div class="input-group">
      <input 
        type="text"
        v-model="offsetInput"
        @input="validateInput"
        @keydown.enter="updateOffset"
        placeholder="Enter hex offset"
        :class="{ 'error': hasError }"
      />
      <select v-model="offsetFormat" @change="handleFormatChange">
        <option value="hex">Hex</option>
        <option value="dec">Dec</option>
      </select>
    </div>
    <span v-if="hasError" class="error-message">Invalid offset format</span>
  </div>
</template>

<script>
import { ref, watch } from 'vue'

export default {
  name: 'BaseOffsetInput',
  props: {
    modelValue: {
      type: Number,
      default: 0
    },
    maxOffset: {
      type: Number,
      required: true
    }
  },
  emits: ['update:modelValue'],
  
  setup(props, { emit }) {
    const offsetInput = ref('')
    const offsetFormat = ref('hex')
    const hasError = ref(false)

    // Initialize the input with the current value
    watch(() => props.modelValue, (newValue) => {
      offsetInput.value = offsetFormat.value === 'hex' 
        ? newValue.toString(16).toUpperCase()
        : newValue.toString()
    }, { immediate: true })

    const validateInput = () => {
      const value = offsetInput.value.trim()
      if (!value) {
        hasError.value = false
        return
      }

      try {
        const parsed = offsetFormat.value === 'hex' 
          ? parseInt(value, 16)
          : parseInt(value, 10)
        
        hasError.value = isNaN(parsed) || parsed < 0 || parsed > props.maxOffset
      } catch {
        hasError.value = true
      }
    }

    const updateOffset = () => {
      if (hasError.value) return

      const value = offsetInput.value.trim()
      if (!value) {
        emit('update:modelValue', 0)
        return
      }

      const parsed = offsetFormat.value === 'hex' 
        ? parseInt(value, 16)
        : parseInt(value, 10)
      
      if (!isNaN(parsed) && parsed >= 0 && parsed <= props.maxOffset) {
        emit('update:modelValue', parsed)
      }
    }

    const handleFormatChange = () => {
      const currentValue = offsetFormat.value === 'hex' 
        ? parseInt(offsetInput.value, 16)
        : parseInt(offsetInput.value, 10)
      
      if (!isNaN(currentValue)) {
        offsetInput.value = offsetFormat.value === 'hex' 
          ? currentValue.toString(16).toUpperCase()
          : currentValue.toString()
      }
      validateInput()
    }

    return {
      offsetInput,
      offsetFormat,
      hasError,
      validateInput,
      updateOffset,
      handleFormatChange
    }
  }
}
</script>

<style scoped>
.base-offset-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background-color: var(--bg-primary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
}

input.error {
  border-color: #ff4444;
}

select {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

.error-message {
  font-size: 0.75rem;
  color: #ff4444;
}

/* Dark mode overrides */
:root[class='dark-mode'] input,
:root[class='dark-mode'] select {
  background: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-primary);
}
</style> 