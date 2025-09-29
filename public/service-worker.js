/**
 * VULNEX -Bytes Revealer-
 *
 * File: service-worker.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

const CACHE_NAME = 'bytesrevealer-v1';
const RUNTIME_CACHE = 'bytesrevealer-runtime';

// Core assets to cache on install
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  // Main bundles - update hashes as needed
  '/assets/main-*.js',
  '/assets/vendor-*.js',
  '/assets/crypto-*.js',
  '/assets/formats-index-*.js',
  '/assets/main-*.css'
];

// Format categories to pre-cache (most commonly used)
const COMMON_FORMATS = [
  '/assets/formats-common-*.js',
  '/assets/formats-images-*.js',
  '/assets/formats-archives-*.js'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Service Worker: Caching core assets');

      // First cache static assets that we know exist
      const staticAssets = ['/', '/favicon.ico'];
      await cache.addAll(staticAssets);

      // Then try to cache dynamic assets
      try {
        const response = await fetch('/');
        const html = await response.text();

        // Find actual asset files from HTML
        const assetPatterns = [
          /\/assets\/main-[^"]+\.js/,
          /\/assets\/vendor-[^"]+\.js/,
          /\/assets\/crypto-[^"]+\.js/,
          /\/assets\/formats-index-[^"]+\.js/,
          /\/assets\/main-[^"]+\.css/
        ];

        for (const pattern of assetPatterns) {
          const match = html.match(pattern);
          if (match) {
            try {
              await cache.add(match[0]);
              console.log('Cached:', match[0]);
            } catch (err) {
              console.log('Failed to cache:', match[0], err);
            }
          }
        }
      } catch (err) {
        console.log('Error caching assets:', err);
      }
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Service Worker: Clearing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests differently (network first)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for API requests
          return caches.match(request);
        })
    );
    return;
  }

  // Handle asset requests (cache first)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          // Update cache in background for format files
          if (url.pathname.includes('formats-')) {
            fetch(request).then(response => {
              if (response.status === 200) {
                caches.open(RUNTIME_CACHE).then(cache => {
                  cache.put(request, response.clone());
                });
              }
            });
          }
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request).then(response => {
          // Cache format files and other assets
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default strategy: network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        // Update cache for successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cache and it's a navigation request, return index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Message event - handle cache control messages
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      ).then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
    });
  }

  if (event.data.type === 'CACHE_FORMAT') {
    // Cache a specific format category on demand
    const { formatCategory } = event.data;
    caches.open(RUNTIME_CACHE).then(cache => {
      fetch(`/assets/formats-${formatCategory}-*.js`)
        .then(response => {
          if (response.status === 200) {
            cache.put(`/assets/formats-${formatCategory}`, response);
            event.ports[0].postMessage({ type: 'FORMAT_CACHED', formatCategory });
          }
        });
    });
  }
});

console.log('BytesRevealer Service Worker loaded');