/**
 * VULNEX -Bytes Revealer-
 *
 * File: HelpDialog.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-29
 * Last Modified: 2025-09-29
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="help-dialog-overlay" @click="handleOverlayClick">
    <div class="help-dialog" @click.stop>
      <div class="dialog-header">
        <h2 class="dialog-title">Help & Information</h2>
        <button @click="$emit('close')" class="close-btn">
          ✕
        </button>
      </div>

      <div class="dialog-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-button"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="dialog-content">
        <!-- Changelog Tab -->
        <div v-if="activeTab === 'changelog'" class="tab-content">
          <h3>Changelog</h3>
          <div class="changelog-entries">
            <div class="changelog-entry">
              <h4>Version 0.3 (September 2025)</h4>
              <ul>
                <li>Added Kaitai Struct format support for advanced binary parsing</li>
                <li>File Type Detection improved and now supports 100+ binary file formats</li>
                <li>Implemented progressive loading for files up to 1.5GB</li>
                <li>Added chunk-based file processing for improved performance</li>
                <li>New export functionality with multiple format support</li>
                <li>Enhanced Visual View and Hex Viiew with color scheme toggle</li>
                <li>Added context menu for hex operations</li>
                <li>Improved dark mode support and set by default</li>
                <li>Added format search and loading indicators</li>
                <li>Cleaaner UI and better error handling</li>
                <li>JSON export functionality updated</li>
                <li>New help dialog and about page</li>
                <li>Many bug fixes and improvements</li>
              </ul>
            </div>

            <div class="changelog-entry">
              <h4>Version 0.2 (April 2025)</h4>
              <ul>
                <li>Introduced String Analysis view with advanced filtering</li>
                <li>Added entropy calculation and visualization</li>
                <li>Implemented file signature detection</li>
                <li>Added hash calculations (MD5, SHA-1, SHA-256)</li>
                <li>Enhanced search capabilities with regex support</li>
                <li>Added data inspector for detailed byte analysis</li>
                <li>Improved memory optimization for large files</li>
              </ul>
            </div>

            <div class="changelog-entry">
              <h4>Version 0.1 (February 2025)</h4>
              <ul>
                <li>Initial release</li>
                <li>Basic hex viewer functionality</li>
                <li>Visual byte representation</li>
                <li>File analysis with basic metadata</li>
                <li>Search functionality for hex and ASCII patterns</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- User Manual Tab -->
        <div v-if="activeTab === 'manual'" class="tab-content">
          <h3>User Manual</h3>

          <div class="manual-section">
            <h4>Getting Started</h4>
            <ol>
              <li>Click "Choose File" to select a file for analysis</li>
              <li>Select which analysis features you want to enable</li>
              <li>Navigate through different views using the tabs</li>
              <li>Use the search bar to find specific patterns</li>
            </ol>
          </div>

          <div class="manual-section">
            <h4>Views</h4>
            <dl>
              <dt><strong>Information</strong></dt>
              <dd>Basic information about the application and usage instructions</dd>

              <dt><strong>File View</strong></dt>
              <dd>Displays file metadata, signatures, hashes, and entropy analysis</dd>

              <dt><strong>Visual View</strong></dt>
              <dd>Shows bytes as colored squares for visual pattern recognition</dd>

              <dt><strong>Hex View</strong></dt>
              <dd>Traditional hex editor interface with byte-level inspection</dd>

              <dt><strong>String Analysis</strong></dt>
              <dd>Extracts and analyzes ASCII/UTF-8 strings from the file</dd>

              <dt><strong>Export</strong></dt>
              <dd>Export analysis results and data in various formats</dd>

              <dt><strong>Settings</strong></dt>
              <dd>Configure application preferences and display options</dd>
            </dl>
          </div>

          <div class="manual-section">
            <h4>Color Schemes</h4>
            <p>Both Visual View and Hex View offer two color schemes to help identify byte patterns:</p>

            <h5>Blue Color Scheme (Default)</h5>
            <ul>
              <li><strong>Purpose:</strong> Provides a gradient visualization based on byte values</li>
              <li><strong>Color Range:</strong> Dark blue (0x00) to bright cyan (0xFF)</li>
              <li><strong>Best for:</strong> General file analysis and pattern recognition</li>
              <li><strong>Null bytes (0x00):</strong> Dark blue/black</li>
              <li><strong>Low values (0x01-0x7F):</strong> Various shades of blue</li>
              <li><strong>High values (0x80-0xFF):</strong> Lighter blues to cyan</li>
            </ul>

            <h5>Hex Category Color Scheme</h5>
            <ul>
              <li><strong>Purpose:</strong> Groups bytes by their characteristics for easier identification</li>
              <li><strong>Null (0x00):</strong> Black - Empty/null bytes</li>
              <li><strong>Low (0x01-0x1F):</strong> Dark purple - Control characters</li>
              <li><strong>ASCII Printable (0x20-0x7E):</strong> Green - Readable text characters</li>
              <li><strong>Delete (0x7F):</strong> Yellow - DEL control character</li>
              <li><strong>Extended ASCII (0x80-0xFF):</strong> Orange/Red - Binary data, encrypted content</li>
            </ul>

            <p><strong>Toggle between schemes:</strong> Click the 🎨 button in Visual or Hex View</p>
            <p><strong>Use cases:</strong></p>
            <ul>
              <li>Blue scheme: Better for visualizing gradients and data distribution</li>
              <li>Hex category: Better for quickly identifying text regions vs binary data</li>
            </ul>
          </div>

          <div class="manual-section">
            <h4>Keyboard Shortcuts</h4>
            <ul>
              <li><kbd>L</kbd> - Lock/unlock data inspector on current byte</li>
              <li><kbd>Enter</kbd> - Execute search or jump to offset</li>
              <li><kbd>Esc</kbd> - Close dialogs and context menus</li>
            </ul>
          </div>

          <div class="manual-section">
            <h4>Search Functionality</h4>
            <ul>
              <li><strong>Hex Search:</strong> Enter hex values (e.g., "FF D8" or "FFD8")</li>
              <li><strong>ASCII Search:</strong> Enter text to search for ASCII strings</li>
              <li><strong>Regular Expression:</strong> Use regex patterns for advanced searching</li>
            </ul>
          </div>

          <div class="manual-section">
            <h4>Performance Tips</h4>
            <ul>
              <li>Files under 50MB: All features available</li>
              <li>Files 50MB-1.5GB: Limited to Visual and Hex views</li>
              <li>Progressive loading enabled for optimal performance</li>
              <li>Use chunk-based operations for large file analysis</li>
            </ul>
          </div>
        </div>

        <!-- License Tab -->
        <div v-if="activeTab === 'license'" class="tab-content">
          <h3>License</h3>
          <div class="license-content">
            <h4>MIT License</h4>
            <p>Copyright (c) 2025 VULNEX</p>

            <p>Permission is hereby granted, free of charge, to any person obtaining a copy
            of this software and associated documentation files (the "Software"), to deal
            in the Software without restriction, including without limitation the rights
            to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
            copies of the Software, and to permit persons to whom the Software is
            furnished to do so, subject to the following conditions:</p>

            <p>The above copyright notice and this permission notice shall be included in all
            copies or substantial portions of the Software.</p>

            <p>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
            IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
            AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
            LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
            OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
            SOFTWARE.</p>
          </div>
        </div>

        <!-- Credits Tab -->
        <div v-if="activeTab === 'credits'" class="tab-content">
          <h3>Credits & Acknowledgments</h3>

          <div class="credits-section">
            <p class="credits-intro">
              BytesRevealer is built with the help of excellent open-source libraries and tools.
              We would like to thank the developers and maintainers of these projects:
            </p>

            <div class="credits-category">
              <h4>Core Libraries</h4>

              <div class="credit-item">
                <h5>Vue.js</h5>
                <p>The Progressive JavaScript Framework</p>
                <a href="https://vuejs.org/" target="_blank">https://vuejs.org/</a>
              </div>

              <div class="credit-item">
                <h5>Vite</h5>
                <p>Next Generation Frontend Tooling</p>
                <a href="https://vitejs.dev/" target="_blank">https://vitejs.dev/</a>
              </div>

              <div class="credit-item">
                <h5>Pinia</h5>
                <p>The intuitive store for Vue.js</p>
                <a href="https://pinia.vuejs.org/" target="_blank">https://pinia.vuejs.org/</a>
              </div>
            </div>

            <div class="credits-category">
              <h4>Binary Analysis Libraries</h4>

              <div class="credit-item">
                <h5>Kaitai Struct</h5>
                <p>A declarative language for describing binary data structures. Used for parsing and analyzing 100+ binary file formats.</p>
                <a href="https://kaitai.io/" target="_blank">https://kaitai.io/</a>
                <p class="credit-license">License: GPLv3+</p>
              </div>

              <div class="credit-item">
                <h5>File Type</h5>
                <p>Detect the file type of a Buffer/Uint8Array/ArrayBuffer. Used for advanced file signature detection.</p>
                <a href="https://github.com/sindresorhus/file-type" target="_blank">https://github.com/sindresorhus/file-type</a>
                <p class="credit-license">License: MIT</p>
              </div>
            </div>

            <div class="credits-category">
              <h4>Utility Libraries</h4>

              <div class="credit-item">
                <h5>CryptoJS</h5>
                <p>JavaScript library of crypto standards. Used for hash calculations (MD5, SHA-1, SHA-256).</p>
                <a href="https://github.com/brix/crypto-js" target="_blank">https://github.com/brix/crypto-js</a>
                <p class="credit-license">License: MIT</p>
              </div>

              <div class="credit-item">
                <h5>JSZip</h5>
                <p>Create, read and edit .zip files with JavaScript. Used for export functionality.</p>
                <a href="https://stuk.github.io/jszip/" target="_blank">https://stuk.github.io/jszip/</a>
                <p class="credit-license">License: MIT</p>
              </div>

              <div class="credit-item">
                <h5>iconv-lite</h5>
                <p>Pure JS character encoding conversion. Used for text encoding detection and conversion.</p>
                <a href="https://github.com/ashtuchkin/iconv-lite" target="_blank">https://github.com/ashtuchkin/iconv-lite</a>
                <p class="credit-license">License: MIT</p>
              </div>

              <div class="credit-item">
                <h5>Buffer</h5>
                <p>The buffer module from Node.js, for the browser. Used for binary data manipulation.</p>
                <a href="https://github.com/feross/buffer" target="_blank">https://github.com/feross/buffer</a>
                <p class="credit-license">License: MIT</p>
              </div>

              <div class="credit-item">
                <h5>YAML</h5>
                <p>JavaScript parser and stringifier for YAML. Used for Kaitai format definitions.</p>
                <a href="https://github.com/eemeli/yaml" target="_blank">https://github.com/eemeli/yaml</a>
                <p class="credit-license">License: ISC</p>
              </div>

              <div class="credit-item">
                <h5>IndexedDB (idb)</h5>
                <p>A tiny library that mirrors IndexedDB API. Used for efficient chunk storage in large files.</p>
                <a href="https://github.com/jakearchibald/idb" target="_blank">https://github.com/jakearchibald/idb</a>
                <p class="credit-license">License: ISC</p>
              </div>
            </div>

            <div class="credits-category">
              <h4>Development Tools</h4>

              <div class="credit-item">
                <h5>Tailwind CSS</h5>
                <p>A utility-first CSS framework</p>
                <a href="https://tailwindcss.com/" target="_blank">https://tailwindcss.com/</a>
              </div>

              <div class="credit-item">
                <h5>Terser</h5>
                <p>JavaScript parser and mangler/compressor toolkit</p>
                <a href="https://terser.org/" target="_blank">https://terser.org/</a>
              </div>
            </div>

            <div class="credits-footer">
              <p><strong>Special Thanks</strong></p>
              <p>To all the open-source contributors who make projects like BytesRevealer possible. Your work enables developers worldwide to build better tools for the community.</p>
              <p>If you find BytesRevealer useful, please consider supporting the open-source projects listed above.</p>
            </div>
          </div>
        </div>

        <!-- About Tab -->
        <div v-if="activeTab === 'about'" class="tab-content">
          <h3>About Bytes Revealer</h3>

          <div class="about-section">
            <p class="about-version">Version 0.3</p>
            <p class="about-tagline">Uncover the Secrets of Binary Files</p>

            <div class="about-description">
              <p>Bytes Revealer is a powerful reverse engineering and binary analysis tool designed for security researchers, forensic analysts, and developers. With features like hex view, visual representation, string extraction, entropy calculation, and file signature detection, it helps users uncover hidden data inside files.</p>

              <p>Whether you are analyzing malware, debugging binaries, or investigating unknown file formats, Bytes Revealer makes it easy to explore, search, and extract valuable information from any binary file.</p>

              <p><strong>Key Features:</strong></p>
              <ul>
                <li>Client-side processing - no data leaves your browser</li>
                <li>Support for files up to 1.5GB</li>
                <li>Multiple analysis views and export options</li>
                <li>Advanced search and pattern matching</li>
                <li>Kaitai Struct format support</li>
                <li>Real-time data inspection</li>
              </ul>
            </div>

            <div class="about-links">
              <h4>Resources</h4>
              <ul>
                <li><a href="https://bytesrevealer.online/" target="_blank">Official Website</a></li>
                <li><a href="https://github.com/vulnex/bytesrevealer" target="_blank">GitHub Repository</a></li>
                <li><a href="https://www.vulnex.com" target="_blank">VULNEX</a></li>
              </ul>
            </div>

            <div class="about-footer">
              <p>© 2025 VULNEX. All rights reserved.</p>
              <p>Created by Simon Roses Femerling</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'HelpDialog',

  data() {
    return {
      activeTab: 'changelog',
      tabs: [
        { id: 'changelog', label: 'Changelog' },
        { id: 'manual', label: 'User Manual' },
        { id: 'license', label: 'License' },
        { id: 'credits', label: 'Credits' },
        { id: 'about', label: 'About' }
      ]
    }
  },

  methods: {
    handleOverlayClick(event) {
      if (event.target === event.currentTarget) {
        this.$emit('close')
      }
    }
  },

  mounted() {
    // Add escape key listener
    this.handleEscKey = (event) => {
      if (event.key === 'Escape') {
        this.$emit('close')
      }
    }
    window.addEventListener('keydown', this.handleEscKey)
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleEscKey)
  }
}
</script>

<style scoped>
.help-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.help-dialog {
  background-color: var(--bg-primary);
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.dialog-tabs {
  display: flex;
  gap: 0;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
}

.tab-button {
  padding: 12px 24px;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.tab-button:hover {
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

.tab-button.active {
  color: var(--link-color);
  border-bottom-color: var(--link-color);
  background-color: var(--bg-primary);
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tab-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.tab-content h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20px;
}

.tab-content h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 20px;
  margin-bottom: 10px;
}

.tab-content h5 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 16px;
  margin-bottom: 8px;
}

/* Changelog styles */
.changelog-entries {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.changelog-entry {
  padding: 16px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
  border-left: 3px solid var(--link-color);
}

.changelog-entry ul {
  margin-top: 10px;
  margin-left: 20px;
  list-style-type: disc;
}

.changelog-entry li {
  margin-bottom: 6px;
  color: var(--text-secondary);
}

/* Manual styles */
.manual-section {
  margin-bottom: 24px;
  padding: 16px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
}

.manual-section dl {
  margin-top: 10px;
}

.manual-section dt {
  margin-top: 12px;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.manual-section dd {
  margin-left: 20px;
  margin-bottom: 8px;
  color: var(--text-secondary);
}

.manual-section ul, .manual-section ol {
  margin-top: 10px;
  margin-left: 20px;
}

.manual-section li {
  margin-bottom: 6px;
  color: var(--text-secondary);
}

kbd {
  padding: 2px 6px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
}

/* License styles */
.license-content {
  padding: 16px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;
}

.license-content p {
  margin-bottom: 16px;
  color: var(--text-secondary);
}

/* About styles */
.about-section {
  padding: 16px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
}

.about-version {
  font-size: 18px;
  font-weight: 600;
  color: var(--link-color);
  margin-bottom: 8px;
}

.about-tagline {
  font-style: italic;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.about-description {
  margin-bottom: 24px;
}

.about-description p {
  margin-bottom: 16px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.about-description ul {
  margin-left: 20px;
  list-style-type: disc;
}

.about-description li {
  margin-bottom: 6px;
  color: var(--text-secondary);
}

.about-links {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.about-links ul {
  margin-top: 10px;
  list-style-type: none;
}

.about-links li {
  margin-bottom: 8px;
}

.about-links a {
  color: var(--link-color);
  text-decoration: none;
}

.about-links a:hover {
  text-decoration: underline;
}

.about-footer {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
  text-align: center;
}

.about-footer p {
  color: var(--text-secondary);
  margin-bottom: 4px;
}

/* Credits styles */
.credits-section {
  padding: 16px;
  background-color: var(--bg-secondary);
  border-radius: 6px;
}

.credits-intro {
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.credits-category {
  margin-bottom: 32px;
  padding: 16px;
  background-color: var(--bg-primary);
  border-radius: 6px;
  border-left: 3px solid var(--link-color);
}

.credits-category h4 {
  color: var(--link-color);
  margin-bottom: 16px;
  font-size: 18px;
}

.credit-item {
  margin-bottom: 20px;
  padding: 12px;
  background-color: var(--bg-secondary);
  border-radius: 4px;
}

.credit-item:last-child {
  margin-bottom: 0;
}

.credit-item h5 {
  color: var(--text-primary);
  font-weight: 600;
  margin-bottom: 4px;
}

.credit-item p {
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.credit-item a {
  color: var(--link-color);
  text-decoration: none;
  font-size: 13px;
}

.credit-item a:hover {
  text-decoration: underline;
}

.credit-license {
  margin-top: 4px;
  font-size: 12px;
  font-style: italic;
  color: var(--text-secondary);
  opacity: 0.8;
}

.credits-footer {
  margin-top: 24px;
  padding: 16px;
  background-color: var(--bg-primary);
  border-radius: 6px;
  text-align: center;
}

.credits-footer p {
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.6;
}

.credits-footer p:first-child {
  color: var(--text-primary);
  font-size: 16px;
  margin-bottom: 12px;
}

/* Dark mode overrides */
:root[class='dark-mode'] .help-dialog {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .dialog-tabs {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .tab-button:hover {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .tab-button.active {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .changelog-entry,
:root[class='dark-mode'] .manual-section,
:root[class='dark-mode'] .license-content,
:root[class='dark-mode'] .about-section,
:root[class='dark-mode'] .credits-section {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .credits-category {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] .credit-item {
  background-color: var(--bg-secondary);
}

:root[class='dark-mode'] .credits-footer {
  background-color: var(--bg-primary);
}

:root[class='dark-mode'] kbd {
  background-color: var(--bg-primary);
  border-color: var(--border-color);
}

/* Scrollbar styling */
.dialog-content::-webkit-scrollbar {
  width: 8px;
}

.dialog-content::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.dialog-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.dialog-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>