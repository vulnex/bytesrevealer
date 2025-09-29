/**
 * VULNEX -Bytes Revealer-
 *
 * File: HexContextMenu.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-23
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="hex-context-menu"
    :style="menuStyle"
    @contextmenu.prevent
  >
    <!-- Copy Bytes As submenu -->
    <div
      class="menu-item has-submenu"
      @mouseenter="showSubmenu = 'copyAs'"
      @mouseleave="hideSubmenuDelayed"
    >
      <span class="menu-icon">📋</span>
      <span class="menu-text">Copy Bytes As</span>
      <span class="menu-arrow">▶</span>

      <!-- Formats submenu -->
      <div
        v-if="showSubmenu === 'copyAs'"
        class="submenu"
        :class="submenuPositionClass"
        @mouseenter="cancelHideSubmenu"
        @mouseleave="hideSubmenuDelayed"
      >
        <!-- Data Formats group -->
        <div class="submenu-group">
          <div class="submenu-header">Data Formats</div>
          <div class="submenu-item" @click="copyAs('hex')">
            <span class="submenu-icon">🔤</span>
            Hex
          </div>
          <div class="submenu-item" @click="copyAs('hex-spaced')">
            <span class="submenu-icon">🔤</span>
            Hex (Spaced)
          </div>
          <div class="submenu-item" @click="copyAs('base64')">
            <span class="submenu-icon">🔐</span>
            Base64
          </div>
          <div class="submenu-item" @click="copyAsText">
            <span class="submenu-icon">📄</span>
            Text (ASCII)
          </div>
        </div>

        <div class="submenu-divider"></div>

        <!-- JavaScript group -->
        <div class="submenu-group">
          <div class="submenu-header">JavaScript</div>
          <div class="submenu-item" @click="copyAs('js-uint8')">
            <span class="submenu-icon">📦</span>
            Uint8Array
          </div>
          <div class="submenu-item" @click="copyAs('js-array')">
            <span class="submenu-icon">[]</span>
            Array
          </div>
          <div class="submenu-item" @click="copyAs('js-hex')">
            <span class="submenu-icon">""</span>
            Hex String
          </div>
        </div>

        <div class="submenu-divider"></div>

        <!-- Python group -->
        <div class="submenu-group">
          <div class="submenu-header">Python</div>
          <div class="submenu-item" @click="copyAs('python-bytes')">
            <span class="submenu-icon">b</span>
            bytes()
          </div>
          <div class="submenu-item" @click="copyAs('python-bytearray')">
            <span class="submenu-icon">[]</span>
            bytearray()
          </div>
          <div class="submenu-item" @click="copyAs('python-list')">
            <span class="submenu-icon">[]</span>
            List
          </div>
        </div>

        <div class="submenu-divider"></div>

        <!-- C/C++ group -->
        <div class="submenu-group">
          <div class="submenu-header">C/C++</div>
          <div class="submenu-item" @click="copyAs('c-array')">
            <span class="submenu-icon">{}</span>
            unsigned char[]
          </div>
          <div class="submenu-item" @click="copyAs('c-uint8')">
            <span class="submenu-icon">{}</span>
            uint8_t[]
          </div>
          <div class="submenu-item" @click="copyAs('cpp-vector')">
            <span class="submenu-icon">{}</span>
            std::vector
          </div>
        </div>
      </div>
    </div>

    <div class="menu-divider"></div>

    <div class="menu-item" @click="openExportDialog">
      <span class="menu-icon">💾</span>
      <span class="menu-text">Export Bytes As...</span>
    </div>

    <div class="menu-item" @click="openExportRangeDialog">
      <span class="menu-icon">📐</span>
      <span class="menu-text">Export Bytes From To...</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ByteFormatter from '../services/ByteFormatter'

export default {
  name: 'HexContextMenu',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    position: {
      type: Object,
      default: () => ({ x: 0, y: 0 })
    },
    selectedBytes: {
      type: Uint8Array,
      default: () => new Uint8Array()
    }
  },
  emits: ['close', 'copy', 'export', 'export-range'],
  setup(props, { emit }) {
    const menuRef = ref(null)
    const showSubmenu = ref(null)
    let hideTimeout = null

    const menuStyle = computed(() => {
      // Calculate position to keep menu on screen
      const x = props.position.x
      const y = props.position.y

      // Adjust if menu would go off screen
      let adjustedX = x
      let adjustedY = y

      if (menuRef.value) {
        const rect = menuRef.value.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        if (x + rect.width > viewportWidth) {
          adjustedX = viewportWidth - rect.width - 10
        }

        if (y + rect.height > viewportHeight) {
          adjustedY = viewportHeight - rect.height - 10
        }
      }

      return {
        left: `${adjustedX}px`,
        top: `${adjustedY}px`
      }
    })

    const submenuPositionClass = computed(() => {
      if (!menuRef.value) return ''

      const rect = menuRef.value.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const classes = []

      // Check if submenu would go off the bottom
      // Assume submenu height of ~300px (multiple language groups)
      if (rect.top + 300 > viewportHeight) {
        classes.push('position-above')
      }

      // Check if submenu would go off the right
      // Submenu width is ~180px
      if (rect.right + 180 > viewportWidth) {
        classes.push('position-left')
      }

      return classes.join(' ')
    })

    const hideSubmenuDelayed = () => {
      hideTimeout = setTimeout(() => {
        showSubmenu.value = null
      }, 200)
    }

    const cancelHideSubmenu = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
    }

    const copyAs = async (format) => {
      try {
        const formatted = ByteFormatter.format(props.selectedBytes, format, {
          variableName: 'data',
          splitLines: props.selectedBytes.length > 16
        })

        await navigator.clipboard.writeText(formatted)

        emit('copy', {
          format,
          bytesCount: props.selectedBytes.length,
          success: true
        })

        emit('close')
      } catch (error) {
        // console.error('Failed to copy:', error)
        emit('copy', {
          format,
          bytesCount: props.selectedBytes.length,
          success: false,
          error: error.message
        })
      }
    }

    const copyAsText = async () => {
      try {
        // Convert bytes to text (ASCII)
        const text = Array.from(props.selectedBytes)
          .map(byte => (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.')
          .join('')

        await navigator.clipboard.writeText(text)

        emit('copy', {
          format: 'text',
          bytesCount: props.selectedBytes.length,
          success: true
        })

        emit('close')
      } catch (error) {
        // console.error('Failed to copy as text:', error)
      }
    }

    const openExportDialog = () => {
      emit('export')
      emit('close')
    }

    const openExportRangeDialog = () => {
      emit('export-range')
      emit('close')
    }

    const handleClickOutside = (event) => {
      if (props.visible && menuRef.value && !menuRef.value.contains(event.target)) {
        emit('close')
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape' && props.visible) {
        emit('close')
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      if (hideTimeout) {
        clearTimeout(hideTimeout)
      }
    })

    return {
      menuRef,
      menuStyle,
      submenuPositionClass,
      showSubmenu,
      hideSubmenuDelayed,
      cancelHideSubmenu,
      copyAs,
      copyAsText,
      openExportDialog,
      openExportRangeDialog
    }
  }
}
</script>

<style scoped>
.hex-context-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 200px;
  z-index: 10000;
  font-size: 13px;
  user-select: none;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
  position: relative;
}

.menu-item:hover {
  background: var(--hover-bg);
}

.menu-item.has-submenu:hover {
  background: var(--hover-bg);
}

.menu-icon {
  margin-right: 8px;
  width: 16px;
  text-align: center;
}

.menu-text {
  flex: 1;
}

.menu-arrow {
  margin-left: auto;
  opacity: 0.5;
  font-size: 10px;
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

/* Submenu styles */
.submenu {
  position: absolute;
  left: 100%;
  top: -4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 180px;
  margin-left: 4px;
}

/* Submenu positioned above when near bottom */
.submenu.position-above {
  bottom: -4px;
  top: auto;
}

/* Submenu positioned to left when near right edge */
.submenu.position-left {
  left: auto;
  right: 100%;
  margin-left: 0;
  margin-right: 4px;
}

.submenu-group {
  padding: 2px 0;
}

.submenu-header {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.submenu-item {
  display: flex;
  align-items: center;
  padding: 6px 12px 6px 24px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.submenu-item:hover {
  background: var(--hover-bg);
}

.submenu-icon {
  margin-right: 8px;
  width: 16px;
  text-align: center;
  font-size: 11px;
  font-family: monospace;
}

.submenu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 8px;
}

/* Dark mode adjustments */
.dark-mode .hex-context-menu {
  background: #2a2a2a;
  border-color: #444;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.dark-mode .menu-item:hover,
.dark-mode .submenu-item:hover {
  background: #3a3a3a;
}

.dark-mode .submenu {
  background: #2a2a2a;
  border-color: #444;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.dark-mode .menu-divider,
.dark-mode .submenu-divider {
  background: #444;
}

.dark-mode .submenu-header {
  color: #999;
}
</style>