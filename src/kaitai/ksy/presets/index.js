/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: presets/index.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-09
 * Last Modified: 2025-01-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

// Define preset KSY content inline since Vite doesn't handle .ksy imports
const pngKsy = `meta:
  id: png
  title: PNG (Portable Network Graphics) image file
  file-extension: png
  endian: be
seq:
  - id: magic
    contents: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  - id: ihdr_len
    type: u4
  - id: ihdr_type
    type: str
    size: 4
    encoding: UTF-8
  - id: ihdr_width
    type: u4
  - id: ihdr_height
    type: u4
`

const zipKsy = `meta:
  id: zip
  title: ZIP archive file
  file-extension:
    - zip
    - jar
  endian: le
seq:
  - id: sections
    type: pk_section
    repeat: eos
types:
  pk_section:
    seq:
      - id: magic
        contents: PK
      - id: section_type
        type: u2
`

const dosMzKsy = `meta:
  id: dos_mz
  title: DOS MZ executable
  file-extension:
    - exe
    - dll
  endian: le
seq:
  - id: mz_header
    type: mz_header
types:
  mz_header:
    seq:
      - id: magic
        contents: MZ
      - id: bytes_in_last_page
        type: u2
      - id: pages_in_file
        type: u2
`

// Lazy load generated formats to reduce bundle size
let generatedFormats = []

/**
 * Built-in preset KSY format definitions (kept for compatibility)
 */
export const builtinPresets = [
  {
    id: 'preset_png',
    name: 'PNG Image',
    content: pngKsy,
    category: 'system',
    metadata: {
      isPreset: true,
      fileExtensions: ['png'],
      signature: {
        offset: 0,
        bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
      }
    }
  },
  {
    id: 'preset_zip',
    name: 'ZIP Archive',
    content: zipKsy,
    category: 'system',
    metadata: {
      isPreset: true,
      fileExtensions: ['zip', 'jar', 'apk', 'docx', 'xlsx', 'pptx'],
      signature: {
        offset: 0,
        bytes: [0x50, 0x4B]
      }
    }
  },
  {
    id: 'preset_dos_mz',
    name: 'DOS/PE Executable',
    content: dosMzKsy,
    category: 'system',
    metadata: {
      isPreset: true,
      fileExtensions: ['exe', 'dll', 'sys'],
      signature: {
        offset: 0,
        bytes: [0x4D, 0x5A]
      }
    }
  }
]

/**
 * All preset formats (built-in + generated)
 * Note: generatedFormats are loaded lazily
 */
export const presetFormats = [
  ...builtinPresets
]

/**
 * Load all preset formats (including lazy-loaded generated formats)
 * @returns {Promise<Array>} Preset format definitions
 */
export async function getPresetFormats() {
  // Lazy load ALL category formats if not already loaded
  // Note: This should only be called when absolutely necessary
  if (generatedFormats.length === 0) {
    const { categoryMetadata } = await import('../categories/index.js')

    // Load all categories in parallel
    const loadPromises = Object.entries(categoryMetadata).map(async ([key, meta]) => {
      const module = await meta.loader()
      return module.default.formats
    })

    const allFormats = await Promise.all(loadPromises)
    generatedFormats = allFormats.flat()
  }
  return [...builtinPresets, ...generatedFormats]
}

/**
 * Get preset format by ID - optimized to only load needed category
 * @param {string} id - Format ID
 * @returns {Promise<Object|null>} Format definition or null
 */
export async function getPresetFormat(id) {
  // Check built-in presets first
  const builtIn = builtinPresets.find(f => f.id === id)
  if (builtIn) return builtIn

  // Check if we already have it cached
  const cached = generatedFormats.find(f => f.id === id)
  if (cached) return cached

  // Smart loading - only load the category containing this format
  const { categoryMetadata } = await import('../categories/index.js')

  // Try to determine category by common patterns
  const categoryGuesses = guessCategory(id)

  for (const guess of categoryGuesses) {
    if (categoryMetadata[guess]) {
      const module = await categoryMetadata[guess].loader()
      const format = module.default.formats.find(f => f.id === id)
      if (format) {
        // Cache for future use
        generatedFormats.push(...module.default.formats)
        return format
      }
    }
  }

  // If not found in guessed categories, load all (fallback)
  await getPresetFormats()
  return generatedFormats.find(f => f.id === id) || null
}

// Helper to guess category from format ID
function guessCategory(id) {
  const patterns = {
    images: /png|jpg|jpeg|gif|bmp|tiff|ico|webp/i,
    archives: /zip|rar|tar|gz|bz|7z|cab/i,
    executable: /elf|pe|exe|dll|mach|dex|class/i,
    media: /mp3|mp4|avi|wav|ogg|flac|mkv|mov/i,
    network: /pcap|tcp|udp|dns|http|tls/i,
    file_system: /fat|ntfs|ext|hfs|iso/i,
    database: /sqlite|db|leveldb|bson/i
  }

  const guesses = []
  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.test(id)) {
      guesses.push(category)
    }
  }

  // Add common as fallback
  guesses.push('common')
  return guesses
}

/**
 * Get preset format by file extension
 * @param {string} extension - File extension (without dot)
 * @returns {Object|null} Format definition or null
 */
export function getPresetFormatByExtension(extension) {
  const ext = extension.toLowerCase()
  return presetFormats.find(f => 
    f.metadata.fileExtensions?.includes(ext)
  ) || null
}

export default {
  presetFormats,
  getPresetFormats,
  getPresetFormat,
  getPresetFormatByExtension
}