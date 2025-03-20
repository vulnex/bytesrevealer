/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: vite.config.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-02-12
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 8080
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  publicDir: 'public'
})