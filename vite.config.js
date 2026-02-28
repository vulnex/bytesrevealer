/**
 * VULNEX -Bytes Revealer-
 *
 * File: vite.config.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-12
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { compression } from 'vite-plugin-compression2'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath, URL } from 'url'

const isAnalyze = process.env.ANALYZE === 'true'

export default defineConfig({
  plugins: [
    vue(),
    // Gzip pre-compression (.gz files)
    compression({
      algorithm: 'gzip',
      threshold: 1024,
      exclude: [/\.(br|gz)$/]
    }),
    // Brotli pre-compression (.br files)
    compression({
      algorithm: 'brotliCompress',
      threshold: 1024,
      exclude: [/\.(br|gz)$/]
    }),
    // Bundle visualizer (only when ANALYZE=true)
    isAnalyze &&
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true
      })
  ].filter(Boolean),
  server: {
    host: '127.0.0.1',
    port: 8080
  },
  worker: {
    format: 'es'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url))
      },
      output: {
        // Manual chunks for better code splitting
        manualChunks(id) {
          // libyara-wasm in its own chunk (~1.1MB WASM, loaded on demand)
          if (id.includes('libyara-wasm')) return 'libyara-wasm'
          // Split Kaitai category formats into separate chunks
          if (id.includes('ksy/categories/')) {
            const match = id.match(/categories\/([^/]+)\.js/)
            if (match) {
              return `formats-${match[1]}`
            }
          }
          // Legacy generated formats (if still used)
          if (id.includes('generated_formats')) {
            return 'kaitai-formats-legacy'
          }
          // Split node_modules into vendor chunk
          if (id.includes('node_modules')) {
            // Keep crypto-js separate for better caching
            if (id.includes('crypto-js')) {
              return 'crypto'
            }
            // Keep kaitai-struct separate
            if (id.includes('kaitai-struct')) {
              return 'kaitai-runtime'
            }
            // All other vendor modules
            return 'vendor'
          }
        },
        // Use smaller chunk size for better loading
        chunkFileNames: (chunkInfo) => {
          return `assets/${chunkInfo.name}-[hash].js`
        }
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
      extensions: ['.js', '.cjs']
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    // Enable minification optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: ['console.debug', 'console.log', 'console.info']
      }
    }
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'crypto-js': 'crypto-js',
      'iconv-lite': fileURLToPath(new URL('./src/kaitai/polyfills/iconv-lite.js', import.meta.url)),
      zlib: fileURLToPath(new URL('./src/kaitai/polyfills/zlib.js', import.meta.url))
    }
  },
  optimizeDeps: {
    include: ['vue', 'pinia', 'crypto-js', 'iconv-lite', 'buffer'],
    exclude: ['kaitai-struct']
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  }
})
