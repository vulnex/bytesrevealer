/**
 * VULNEX -Bytes Revealer-
 *
 * File: HashSection.vue
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="hashes-section">
    <h3>File Hashes</h3>
    <div class="hash-grid">
      <div class="hash-item">
        <div class="hash-label">MD5</div>
        <div class="hash-content">
          <span class="hash-value">{{ hashes.md5 || 'N/A' }}</span>
          <div class="hash-actions">
            <button
              v-if="hashes.md5 && hashes.md5 !== 'N/A (file > 50MB)'"
              @click="copyHash('md5', hashes.md5)"
              class="copy-btn"
              title="Copy MD5 hash"
            >
              📋
            </button>
            <div v-if="hashes.md5 && hashes.md5 !== 'N/A (file > 50MB)'" class="dropdown" :class="{ active: activeDropdown === 'md5' }">
              <button class="dropdown-trigger" @click="toggleDropdown('md5', $event)">Search 🔍</button>
              <div class="dropdown-content">
                <a :href="`https://www.virustotal.com/gui/search/${hashes.md5}`" target="_blank">VirusTotal</a>
                <a :href="`https://www.google.com/search?q=${hashes.md5}`" target="_blank">Google</a>
                <a :href="`https://metadefender.com/results/file/${hashes.md5}/`" target="_blank">MetaDefender</a>
                <a :href="`https://hybrid-analysis.com/search?query=${hashes.md5}`" target="_blank">Hybrid Analysis</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="hash-item">
        <div class="hash-label">SHA-1</div>
        <div class="hash-content">
          <span class="hash-value">{{ hashes.sha1 || 'N/A' }}</span>
          <div class="hash-actions">
            <button
              v-if="hashes.sha1 && hashes.sha1 !== 'N/A (file > 50MB)'"
              @click="copyHash('sha1', hashes.sha1)"
              class="copy-btn"
              title="Copy SHA-1 hash"
            >
              📋
            </button>
            <div v-if="hashes.sha1 && hashes.sha1 !== 'N/A (file > 50MB)'" class="dropdown" :class="{ active: activeDropdown === 'sha1' }">
              <button class="dropdown-trigger" @click="toggleDropdown('sha1', $event)">Search 🔍</button>
              <div class="dropdown-content">
                <a :href="`https://www.virustotal.com/gui/search/${hashes.sha1}`" target="_blank">VirusTotal</a>
                <a :href="`https://www.google.com/search?q=${hashes.sha1}`" target="_blank">Google</a>
                <a :href="`https://metadefender.com/results/file/${hashes.sha1}/`" target="_blank">MetaDefender</a>
                <a :href="`https://hybrid-analysis.com/search?query=${hashes.sha1}`" target="_blank">Hybrid Analysis</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="hash-item">
        <div class="hash-label">SHA-256</div>
        <div class="hash-content">
          <span class="hash-value">{{ hashes.sha256 || 'N/A' }}</span>
          <div class="hash-actions">
            <button
              v-if="hashes.sha256 && hashes.sha256 !== 'N/A (file > 50MB)'"
              @click="copyHash('sha256', hashes.sha256)"
              class="copy-btn"
              title="Copy SHA-256 hash"
            >
              📋
            </button>
            <div v-if="hashes.sha256 && hashes.sha256 !== 'N/A (file > 50MB)'" class="dropdown" :class="{ active: activeDropdown === 'sha256' }">
              <button class="dropdown-trigger" @click="toggleDropdown('sha256', $event)">Search 🔍</button>
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
    </div>

    <!-- Copy notification -->
    <div v-if="showCopyNotification" class="copy-notification">
      {{ copyMessage }}
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
  },
  data() {
    return {
      showCopyNotification: false,
      copyMessage: '',
      activeDropdown: null
    }
  },
  mounted() {
    // Close dropdown when clicking outside
    document.addEventListener('click', this.handleOutsideClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleOutsideClick);
  },
  methods: {
    async copyHash(type, hash) {
      try {
        await navigator.clipboard.writeText(hash);
        this.copyMessage = `${type.toUpperCase()} hash copied!`;
        this.showCopyNotification = true;
        setTimeout(() => {
          this.showCopyNotification = false;
        }, 2000);
      } catch (err) {
        // console.error('Failed to copy hash:', err);
      }
    },
    toggleDropdown(hashType, event) {
      event.stopPropagation();
      if (this.activeDropdown === hashType) {
        this.activeDropdown = null;
      } else {
        this.activeDropdown = hashType;
      }
    },
    handleOutsideClick(event) {
      if (!event.target.closest('.dropdown')) {
        this.activeDropdown = null;
      }
    }
  }
}
</script>

<style scoped>
.hashes-section {
  margin-top: 24px;
  margin-bottom: 24px;
  position: relative;
  overflow: visible;
}

.hashes-section h3 {
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.hash-grid {
  display: grid;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.hash-item {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: linear-gradient(135deg, var(--bg-primary), var(--bg-secondary));
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
  z-index: auto;
}

.hash-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

/* Removed dynamic margin - dropdown will overflow naturally */

.hash-label {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.hash-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hash-value {
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9rem;
  word-break: break-all;
  flex: 1;
  padding: 8px 12px;
  background-color: var(--bg-primary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.hash-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copy-btn {
  padding: 6px 10px;
  border-radius: 4px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn:hover {
  background-color: var(--link-color);
  transform: scale(1.1);
}

/* Dropdown styles */
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown.active .dropdown-content {
  display: block;
  animation: dropIn 0.2s ease;
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.dropdown-trigger:hover {
  background-color: var(--link-hover-color, #2563eb);
  transform: translateY(-1px);
}

.dropdown-content {
  display: none;
  position: absolute;
  right: 0;
  bottom: calc(100% + 4px); /* Open upwards to avoid cutoff */
  min-width: 160px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  overflow: hidden;
}

/* Removed hover-only display - now controlled by click */

@keyframes dropIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-content a {
  color: var(--text-primary);
  padding: 10px 14px;
  text-decoration: none;
  display: block;
  font-size: 14px;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--border-color);
}

.dropdown-content a:last-child {
  border-bottom: none;
}

.dropdown-content a:hover {
  background-color: var(--bg-hover);
  padding-left: 18px;
}

.copy-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: var(--link-color);
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Dark mode overrides */
:root[class='dark-mode'] .hash-item {
  background: linear-gradient(135deg, var(--bg-primary), rgba(45, 55, 72, 0.5));
}

:root[class='dark-mode'] .hash-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:root[class='dark-mode'] .hash-value {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .copy-btn {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}

:root[class='dark-mode'] .copy-btn:hover {
  background-color: var(--link-color);
}

:root[class='dark-mode'] .dropdown-content {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:root[class='dark-mode'] .dropdown-content a {
  color: var(--text-primary);
  border-bottom-color: var(--border-color);
}

:root[class='dark-mode'] .dropdown-content a:hover {
  background-color: rgba(66, 153, 225, 0.1);
}

/* Responsive design */
@media (max-width: 768px) {
  .hash-content {
    flex-direction: column;
    align-items: stretch;
  }

  .hash-actions {
    justify-content: flex-end;
    margin-top: 8px;
  }

  .dropdown-content {
    right: auto;
    left: 0;
  }
}
</style>