/** 
 * VULNEX -Bytes Revealer-
 *
 * File: FormatLoadingIndicator.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <transition name="fade">
    <div v-if="isLoading || message" class="format-loading-indicator">
      <div class="loading-content">
        <div v-if="isLoading" class="spinner-container">
          <div class="spinner"></div>
          <span class="loading-text">{{ loadingText }}</span>
        </div>

        <div v-if="!isLoading && message"
             :class="['message', messageType]">
          <span class="icon">{{ messageIcon }}</span>
          <span>{{ message }}</span>
        </div>

        <div v-if="isLoading && progress > 0" class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useFormatStore } from '../stores/format'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const formatStore = useFormatStore()

const isLoading = ref(false)
const loadingText = ref('Loading format...')
const message = ref('')
const messageType = ref('success')
const progress = ref(0)

// Message icons
const messageIcon = computed(() => {
  switch (messageType.value) {
    case 'success': return '✓'
    case 'error': return '✗'
    case 'cached': return '⚡'
    default: return 'ℹ'
  }
})

// Auto-hide messages after delay
let messageTimeout = null
watch(message, (newMessage) => {
  if (newMessage && !isLoading.value) {
    if (messageTimeout) clearTimeout(messageTimeout)
    messageTimeout = setTimeout(() => {
      message.value = ''
    }, 3000)
  }
})

// Watch format store loading state
watch(() => formatStore.isLoadingFormat, (loading) => {
  if (loading) {
    const formatName = formatStore.loadingFormatName || 'format'
    startLoading(formatName)
    if (formatStore.loadingProgress > 0) {
      setProgress(formatStore.loadingProgress)
    }
  } else if (isLoading.value) {
    // Loading finished
    const formatName = formatStore.loadingFormatName || 'Format'
    const isCached = formatStore.isFormatCached(formatStore.selectedFormatId)
    showSuccess(`${formatName} loaded successfully`, isCached)
  }
})

// Watch loading progress
watch(() => formatStore.loadingProgress, (progress) => {
  if (formatStore.isLoadingFormat && progress > 0) {
    setProgress(progress)
  }
})

// Format loading state management
const startLoading = (formatName = null) => {
  isLoading.value = true
  loadingText.value = formatName
    ? `Loading ${formatName} format...`
    : 'Loading format...'
  message.value = ''
  progress.value = 0
}

const setProgress = (value) => {
  progress.value = Math.min(100, Math.max(0, value))
}

const showSuccess = (text, cached = false) => {
  isLoading.value = false
  message.value = text
  messageType.value = cached ? 'cached' : 'success'
  progress.value = 0
}

const showError = (text) => {
  isLoading.value = false
  message.value = text
  messageType.value = 'error'
  progress.value = 0
}

const hide = () => {
  isLoading.value = false
  message.value = ''
  progress.value = 0
}

// Expose methods to parent
defineExpose({
  startLoading,
  setProgress,
  showSuccess,
  showError,
  hide
})
</script>

<style scoped>
.format-loading-indicator {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 9999;
  background: rgba(30, 30, 40, 0.95);
  border: 1px solid rgba(66, 185, 131, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 250px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.loading-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spinner-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(66, 185, 131, 0.3);
  border-top-color: #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: #e0e0e0;
  font-size: 14px;
}

.message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 14px;
}

.message .icon {
  font-size: 16px;
  font-weight: bold;
}

.message.success {
  color: #42b983;
}

.message.error {
  color: #ff6b6b;
}

.message.cached {
  color: #ffd700;
}

.progress-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #42b983, #35a372);
  transition: width 0.3s ease;
  border-radius: 2px;
}

/* Fade transition */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>