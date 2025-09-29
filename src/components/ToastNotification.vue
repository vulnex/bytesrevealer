/**
 * VULNEX -Bytes Revealer-
 *
 * File: ToastNotification.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-24
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <Transition name="toast">
    <div
      v-if="visible"
      class="toast-notification"
      :class="[type]"
    >
      <span class="toast-icon">{{ icon }}</span>
      <span class="toast-message">{{ message }}</span>
    </div>
  </Transition>
</template>

<script>
import { ref, computed, watch } from 'vue'

export default {
  name: 'ToastNotification',
  props: {
    message: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      default: 'success',
      validator: (value) => ['success', 'error', 'info', 'warning'].includes(value)
    },
    duration: {
      type: Number,
      default: 3000
    },
    show: {
      type: Boolean,
      default: false
    }
  },

  setup(props) {
    const visible = ref(false)
    let timer = null

    const icon = computed(() => {
      const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        warning: '⚠'
      }
      return icons[props.type] || ''
    })

    watch(() => props.show, (newVal) => {
      if (newVal) {
        visible.value = true
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          visible.value = false
        }, props.duration)
      } else {
        visible.value = false
      }
    })

    return {
      visible,
      icon
    }
  }
}
</script>

<style scoped>
.toast-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 10000;
  font-size: 14px;
  font-weight: 500;
  max-width: 350px;
}

.toast-icon {
  font-size: 18px;
  font-weight: bold;
}

/* Type-specific styles */
.toast-notification.success {
  background-color: #10b981;
  color: white;
}

.toast-notification.error {
  background-color: #ef4444;
  color: white;
}

.toast-notification.info {
  background-color: #3b82f6;
  color: white;
}

.toast-notification.warning {
  background-color: #f59e0b;
  color: white;
}

/* Dark mode support */
:root[class='dark-mode'] .toast-notification.success {
  background-color: #059669;
}

:root[class='dark-mode'] .toast-notification.error {
  background-color: #dc2626;
}

:root[class='dark-mode'] .toast-notification.info {
  background-color: #2563eb;
}

:root[class='dark-mode'] .toast-notification.warning {
  background-color: #d97706;
}

/* Animation */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>