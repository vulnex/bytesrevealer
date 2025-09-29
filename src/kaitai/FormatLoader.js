/**
 * VULNEX -Bytes Revealer-
 *
 * File: FormatLoader.js
 * Description: Optimized format loader with lazy loading
 * Created: 2025-09-21
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 */

import logger from '../utils/logger'
import { useFormatStore } from '../stores/format'

// Cache for loaded formats
const formatCache = new Map()

// Get format store instance
let formatStore = null
function getFormatStore() {
  if (!formatStore) {
    formatStore = useFormatStore()
  }
  return formatStore
}

// Map of format IDs to their categories for chunked loading
const formatCategories = {
  archives: ['zip', 'rar', 'tar', 'gzip', 'bzip2', '7z', 'cab'],
  images: ['png', 'jpeg', 'gif', 'bmp', 'tiff', 'ico', 'webp'],
  executables: ['elf', 'pe', 'mach_o', 'dex', 'class'],
  media: ['mp3', 'mp4', 'avi', 'wav', 'ogg', 'flac', 'mkv'],
  network: ['pcap', 'pcapng', 'tcp', 'udp', 'dns', 'http'],
  filesystem: ['fat', 'ntfs', 'ext2', 'ext4', 'hfs'],
  documents: ['pdf', 'doc', 'xls', 'ppt', 'odf'],
  database: ['sqlite', 'leveldb', 'bson'],
  game: ['doom_wad', 'quake_pak', 'dune_2_pak'],
  scientific: ['hdf5', 'netcdf', 'fits'],
  serialization: ['json', 'xml', 'protobuf', 'msgpack'],
  firmware: ['uboot', 'android_boot', 'uefi'],
  hardware: ['pci', 'usb', 'edid'],
  common: [] // Will contain all other formats
}

// Reverse map for quick lookup
const formatToCategory = {}
for (const [category, formats] of Object.entries(formatCategories)) {
  for (const format of formats) {
    formatToCategory[format] = category
  }
}

/**
 * Load a specific format by ID
 * @param {string} formatId - The format identifier
 * @returns {Promise<Object|null>} The format definition or null
 */
export async function loadFormat(formatId) {
  const store = getFormatStore()

  // Check cache first
  if (formatCache.has(formatId)) {
    store.markFormatCached(formatId)
    return formatCache.get(formatId)
  }

  try {
    // Determine category
    const category = formatToCategory[formatId] || 'common'

    // Update loading state
    store.setLoadingState(true, formatId, 20)

    // Dynamically import only the needed category chunk
    const module = await loadFormatCategory(category)

    // Update progress
    store.setLoadingState(true, formatId, 80)

    if (module && module.formats) {
      // Cache all formats from this category for future use
      for (const format of module.formats) {
        formatCache.set(format.id, format)
        store.markFormatCached(format.id)
      }

      store.markCategoryLoaded(category)
      store.setLoadingState(false)
      return formatCache.get(formatId) || null
    }
  } catch (error) {
    logger.error(`Failed to load format ${formatId}:`, error)
    store.setLoadingState(false)
  }

  return null
}

/**
 * Load all formats from a specific category
 * @param {string} category - The category name
 * @returns {Promise<Object>} Module with formats array
 */
async function loadFormatCategory(category) {
  const store = getFormatStore()

  // Check if category already loaded
  if (store.isCategoryLoaded(category)) {
    logger.debug(`Category ${category} already loaded`)
    return { formats: Array.from(formatCache.values()).filter(f =>
      (formatToCategory[f.id] || 'common') === category
    )}
  }

  try {
    // Use dynamic imports with explicit chunk names for better splitting
    switch(category) {
      case 'archives':
        return await import(/* webpackChunkName: "formats-archives" */ './ksy/categories/archives.js')
      case 'images':
        return await import(/* webpackChunkName: "formats-images" */ './ksy/categories/images.js')
      case 'executables':
        return await import(/* webpackChunkName: "formats-executables" */ './ksy/categories/executables.js')
      case 'media':
        return await import(/* webpackChunkName: "formats-media" */ './ksy/categories/media.js')
      case 'network':
        return await import(/* webpackChunkName: "formats-network" */ './ksy/categories/network.js')
      case 'filesystem':
        return await import(/* webpackChunkName: "formats-filesystem" */ './ksy/categories/filesystem.js')
      case 'documents':
        return await import(/* webpackChunkName: "formats-documents" */ './ksy/categories/documents.js')
      case 'common':
      default:
        return await import(/* webpackChunkName: "formats-common" */ './ksy/categories/common.js')
    }
  } catch (error) {
    logger.error(`Failed to load category ${category}:`, error)
    return null
  }
}

/**
 * Get format by file extension (lazy load if needed)
 * @param {string} extension - File extension without dot
 * @returns {Promise<Object|null>} Format definition or null
 */
export async function getFormatByExtension(extension) {
  const ext = extension.toLowerCase()

  // Quick check in known extensions
  for (const [formatId, category] of Object.entries(formatToCategory)) {
    // This is simplified - in reality, you'd need to check the format's metadata
    if (formatId.includes(ext)) {
      return await loadFormat(formatId)
    }
  }

  // If not found in known formats, try loading common formats
  const commonModule = await loadFormatCategory('common')
  if (commonModule && commonModule.formats) {
    return commonModule.formats.find(f =>
      f.metadata?.fileExtensions?.includes(ext)
    ) || null
  }

  return null
}

/**
 * Preload commonly used format categories
 * @param {Array<string>} categories - Categories to preload
 */
export async function preloadCategories(categories = ['images', 'archives']) {
  const promises = categories.map(cat => loadFormatCategory(cat))
  await Promise.all(promises)
  logger.debug(`Preloaded format categories: ${categories.join(', ')}`)
}

/**
 * Clear the format cache
 */
export function clearFormatCache() {
  formatCache.clear()
  logger.debug('Format cache cleared')
}

export default {
  loadFormat,
  getFormatByExtension,
  preloadCategories,
  clearFormatCache
}