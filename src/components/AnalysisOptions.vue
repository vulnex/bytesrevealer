/** 
 * VULNEX -Bytes Revealer-
 *
 * File: AnalysisOptions.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="analysis-options bg-white p-4 rounded-lg shadow mb-4">
    <h3 class="text-lg font-medium mb-2">Select Analysis Features:</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <label class="flex items-center space-x-2">
        <input
          type="checkbox"
          :checked="modelValue.fileAnalysis"
          @change="updateOption('fileAnalysis', $event.target.checked)"
          :disabled="disabled"
          class="form-checkbox h-4 w-4 text-blue-600"
        >
        <span>File Analysis</span>
      </label>
      
      <label class="flex items-center space-x-2">
        <input
          type="checkbox"
          :checked="modelValue.visualView"
          @change="updateOption('visualView', $event.target.checked)"
          :disabled="disabled"
          class="form-checkbox h-4 w-4 text-blue-600"
        >
        <span>Visual View</span>
      </label>
      
      <label class="flex items-center space-x-2">
        <input
          type="checkbox"
          :checked="modelValue.hexView"
          @change="updateOption('hexView', $event.target.checked)"
          :disabled="disabled"
          class="form-checkbox h-4 w-4 text-blue-600"
        >
        <span>Hex View</span>
      </label>
      
      <label class="flex items-center space-x-2">
        <input
          type="checkbox"
          :checked="modelValue.stringAnalysis"
          @change="updateOption('stringAnalysis', $event.target.checked)"
          :disabled="disabled"
          class="form-checkbox h-4 w-4 text-blue-600"
        >
        <span>String Analysis</span>
      </label>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

function updateOption(key, value) {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value
  });
}
</script>