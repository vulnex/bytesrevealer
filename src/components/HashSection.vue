/** 
 * VULNEX -Bytes Revealer-
 *
 * File: HashSection.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.2
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
        <span>{{ hashes.md5 }}</span>
        <div class="dropdown">
          <button class="dropdown-trigger">Search Hash</button>
          <div class="dropdown-content">
            <a :href="`https://www.virustotal.com/gui/search/${hashes.md5}`" target="_blank">VirusTotal</a>
            <a :href="`https://www.google.com/search?q=${hashes.md5}`" target="_blank">Google</a>
            <a :href="`https://metadefender.com/results/file/${hashes.md5}/`" target="_blank">MetaDefender</a>
            <a :href="`https://hybrid-analysis.com/search?query=${hashes.md5}`" target="_blank">Hybrid Analysis</a>
          </div>
        </div>
      </div>
      <div class="hash-item">
        <label>SHA-1:</label>
        <span>{{ hashes.sha1 }}</span>
        <div class="dropdown">
          <button class="dropdown-trigger">Search Hash</button>
          <div class="dropdown-content">
            <a :href="`https://www.virustotal.com/gui/search/${hashes.sha1}`" target="_blank">VirusTotal</a>
            <a :href="`https://www.google.com/search?q=${hashes.sha1}`" target="_blank">Google</a>
            <a :href="`https://metadefender.com/results/file/${hashes.sha1}/`" target="_blank">MetaDefender</a>
            <a :href="`https://hybrid-analysis.com/search?query=${hashes.sha1}`" target="_blank">Hybrid Analysis</a>
          </div>
        </div>
      </div>
      <div class="hash-item">
        <label>SHA-256:</label>
        <span>{{ hashes.sha256 }}</span>
        <div class="dropdown">
          <button class="dropdown-trigger">Search Hash</button>
          <div class="dropdown-content">
            <a :href="`https://www.virustotal.com/gui/search/${hashes.sha256}`" target="_blank">VirusTotal</a>
            <a :href="`https://www.google.com/search?q=${hashes.sha256}`" target="_blank">Google</a>
            <a :href="`https://metadefender.com/results/file/${hashes.sha256}/`" target="_blank">MetaDefender</a>
            <a :href="`https://hybrid-analysis.com/search?query=${hashes.sha256}`" target="_blank">Hybrid Analysis</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hashes-section {
  margin-top: 24px;
}

.hash-grid {
  display: grid;
  gap: 16px;
}

.hash-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: var(--bg-primary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.hash-item label {
  color: var(--text-secondary);
  font-weight: 500;
  min-width: 70px;
}

.hash-item span {
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  flex: 1;
}

/* Dropdown styles */
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-trigger {
  padding: 6px 12px;
  border-radius: 4px;
  background-color: var(--link-color);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.dropdown-trigger:hover {
  background-color: var(--link-hover-color);
}

.dropdown-content {
  display: none;
  position: absolute;
  right: 0;
  min-width: 160px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.dropdown:hover .dropdown-content {
  display: block;
}

.dropdown-content a {
  color: var(--text-primary);
  padding: 8px 12px;
  text-decoration: none;
  display: block;
  font-size: 14px;
  transition: background-color 0.2s;
}

.dropdown-content a:hover {
  background-color: var(--bg-hover);
}

/* Dark mode overrides */
:root[class='dark-mode'] .hash-item {
  background-color: var(--bg-primary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .dropdown-content {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .dropdown-content a {
  color: var(--text-primary);
}

:root[class='dark-mode'] .dropdown-content a:hover {
  background-color: var(--bg-hover);
}
</style>

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
