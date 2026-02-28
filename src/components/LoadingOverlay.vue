/** * VULNEX -Bytes Revealer- * * File: FileSignatures.vue * Author: Simon Roses Femerling *
Created: 2025-02-12 * Last Modified: 2025-02-12 * Version: 0.2 * License: Apache-2.0 * Copyright (c)
2025 VULNEX. All rights reserved. * https://www.vulnex.com */

<template>
  <div v-if="show" class="loading-overlay" role="status" aria-live="polite" :aria-label="message">
    <div class="loading-content">
      <div class="spinner" aria-hidden="true"></div>
      <div class="loading-text">{{ message }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoadingOverlay',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: 'Loading...'
    }
  }
}
</script>
