/** 
 * VULNEX -Bytes Revealer-
 *
 * File: ProgressBar.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="progress-container" v-if="show">
    <div class="progress-label">{{ label }}</div>
    <div class="progress-bar">
      <div 
        class="progress-fill"
        :style="{ width: `${progress}%` }"
      ></div>
    </div>
    <div class="progress-text">{{ progress.toFixed(1) }}%</div>
  </div>
</template>

<script>
export default {
  name: 'ProgressBar',
  props: {
    progress: {
      type: Number,
      required: true
    },
    label: {
      type: String,
      default: 'Loading'
    },
    show: {
      type: Boolean,
      default: true
    }
  }
}
</script>
