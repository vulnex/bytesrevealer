/** 
 * VULNEX -Bytes Revealer-
 *
 * File: FileSignatures.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="signatures-section">
    <h3>File Signatures</h3>
    <div v-if="signatures.length > 0" class="signatures-list">
      <div v-for="(sig, index) in signatures" :key="index" class="signature-item">
        {{ sig.name }} at offset {{ sig.offset.toString(16).toUpperCase() }}h
      </div>
    </div>
    <div v-else>No known file signatures detected</div>
  </div>
</template>

<script>
export default {
  name: 'FileSignatures',
  props: {
    signatures: {
      type: Array,
      required: true
    }
  }
}
</script>
