/** 
 * VULNEX -Bytes Revealer-
 *
 * File: ProgressTracking.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="progress-tracking space-y-2">
    <!-- Overall progress -->
    <div class="overall-progress">
      <div class="flex justify-between text-sm text-gray-600 mb-1">
        <span>{{ label }}</span>
        <span>{{ totalProgress.toFixed(1) }}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          :style="{ width: `${totalProgress}%` }"
        ></div>
      </div>
    </div>
    
    <!-- Individual progress bars -->
    <div 
      v-for="type in activeAnalyses" 
      :key="type"
      class="analysis-progress"
    >
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>{{ typeLabels[type] }}</span>
        <span>{{ progress[type].toFixed(1) }}%</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-1.5">
        <div 
          class="bg-blue-400 h-1.5 rounded-full transition-all duration-300"
          :style="{ width: `${progress[type]}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  progress: {
    type: Object,
    required: true
  },
  options: {
    type: Object,
    required: true
  },
  label: {
    type: String,
    default: 'Processing file...'
  }
});

const typeLabels = {
  fileAnalysis: 'File Analysis',
  visualView: 'Visual Processing',
  hexView: 'Hex Processing',
  stringAnalysis: 'String Analysis'
};

const activeAnalyses = computed(() => 
  Object.entries(props.options)
    .filter(([_, enabled]) => enabled)
    .map(([key]) => key)
);

const totalProgress = computed(() => {
  const enabledAnalyses = activeAnalyses.value.length;
  if (enabledAnalyses === 0) return 0;
  
  const sum = activeAnalyses.value.reduce(
    (acc, key) => acc + props.progress[key], 
    0
  );
  
  return sum / enabledAnalyses;
});
</script>