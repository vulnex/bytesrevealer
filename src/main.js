/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: main.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Import global styles
import './styles/main.css'
import './styles/components.css'
import './styles/views.css'

const app = createApp(App)
const pinia = createPinia()

// Install Pinia before mounting
app.use(pinia)
app.mount('#app')

// Register Service Worker for PWA capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        // console.log('Service Worker registered:', registration.scope)

        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60000) // Check every minute

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, prompt user to refresh
              // console.log('New version available! Refresh to update.')
              // Could show a notification or prompt here
            }
          })
        })
      })
      .catch(error => {
        // console.error('Service Worker registration failed:', error)
      })
  })
}