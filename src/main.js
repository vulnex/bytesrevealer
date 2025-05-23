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