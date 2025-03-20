/** 
 * VULNEX -Bytes Revealer-
 *
 * File: HashSection.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="hashes-section">
    <h3>File Hashes</h3>
    <div class="hash-grid">
      <div class="hash-item">
        <label>MD5:</label>
        <span>{{ hashes.md5 }}</span> |  <a :href="`https://www.virustotal.com/gui/search/${hashes.md5}`" target="_blank" class="text-blue-500">Check on VirusTotal</a>
      </div>
      <div class="hash-item">
        <label>SHA-1:</label>
        <span>{{ hashes.sha1 }}</span>
      </div>
      <div class="hash-item">
        <label>SHA-256:</label>
        <span>{{ hashes.sha256 }}</span> | <a :href="`https://www.virustotal.com/gui/search/${hashes.sha256}`" target="_blank" class="text-blue-500">Check on VirusTotal</a>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HashSection',
  props: {
    hashes: {
      type: Object,
      required: true,
      validator: function(obj) {
        return ['md5', 'sha1', 'sha256'].every(key => key in obj)
      }
    }
  }
}
</script>
