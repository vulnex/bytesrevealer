/**
 * VULNEX -Bytes Revealer-
 *
 * File: SearchWorker.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-17
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Web Worker for non-blocking search operations on large files
 */

// Search state
let _isSearching = false
let shouldCancel = false

// Search result limits
const MAX_RESULTS = 10000
const MAX_HIGHLIGHT_BYTES = 100000

/**
 * Validate regex pattern to prevent ReDoS (catastrophic backtracking)
 */
function isSafeRegex(pattern) {
  if (pattern.length > 1000) return false
  // Detect nested quantifiers (catastrophic backtracking)
  if (/([+*?{])\s*\)[+*?]|\)[+*?]\s*\{/.test(pattern)) return false
  // Detect excessive repetition groups
  if (/(\{[0-9]{4,}\})/.test(pattern)) return false
  return true
}

/**
 * Search for hex pattern in data
 */
function searchHexPattern(data, pattern, onProgress) {
  const results = []
  const patternBytes = pattern
    .trim()
    .split(/\s+/)
    .map((hex) => {
      const num = parseInt(hex, 16)
      return isNaN(num) ? null : num
    })

  // Validate pattern
  if (patternBytes.some((b) => b === null)) {
    throw new Error('Invalid hex pattern')
  }

  const patternLength = patternBytes.length
  const dataLength = data.length
  const chunkSize = 1024 * 1024 // 1MB chunks for progress reporting
  let processed = 0

  for (let i = 0; i <= dataLength - patternLength; i++) {
    // Check for cancellation
    if (shouldCancel) {
      return { results, cancelled: true }
    }

    // Check if pattern matches
    let match = true
    for (let j = 0; j < patternLength; j++) {
      if (data[i + j] !== patternBytes[j]) {
        match = false
        break
      }
    }

    if (match) {
      // Store match position
      results.push({
        offset: i,
        length: patternLength
      })
      if (results.length >= MAX_RESULTS) break
    }

    // Report progress
    processed++
    if (processed % chunkSize === 0 && onProgress) {
      onProgress(Math.min(99, Math.floor((i / dataLength) * 100)))
    }
  }

  return { results, cancelled: false, truncated: results.length >= MAX_RESULTS }
}

/**
 * Search for ASCII/UTF-8 pattern in data
 */
function searchAsciiPattern(data, pattern, caseInsensitive, onProgress) {
  const results = []
  const searchBytes = Array.from(pattern).map((char) => char.charCodeAt(0))
  const patternLength = searchBytes.length
  const dataLength = data.length
  const chunkSize = 1024 * 1024 // 1MB chunks for progress reporting
  let processed = 0

  for (let i = 0; i <= dataLength - patternLength; i++) {
    // Check for cancellation
    if (shouldCancel) {
      return { results, cancelled: true }
    }

    // Check if pattern matches
    let match = true
    for (let j = 0; j < patternLength; j++) {
      const dataByte = data[i + j]
      const searchByte = searchBytes[j]

      if (caseInsensitive) {
        // Case insensitive comparison for ASCII letters
        const dataChar = String.fromCharCode(dataByte).toLowerCase()
        const searchChar = String.fromCharCode(searchByte).toLowerCase()
        if (dataChar !== searchChar) {
          match = false
          break
        }
      } else {
        if (dataByte !== searchByte) {
          match = false
          break
        }
      }
    }

    if (match) {
      // Store match position
      results.push({
        offset: i,
        length: patternLength
      })
      if (results.length >= MAX_RESULTS) break
    }

    // Report progress
    processed++
    if (processed % chunkSize === 0 && onProgress) {
      onProgress(Math.min(99, Math.floor((i / dataLength) * 100)))
    }
  }

  return { results, cancelled: false, truncated: results.length >= MAX_RESULTS }
}

/**
 * Search for regex pattern in data
 */
function searchRegexPattern(data, pattern, flags, onProgress) {
  const results = []
  const dataLength = data.length
  const chunkSize = 10 * 1024 * 1024 // 10MB chunks for regex (slower)

  try {
    // Validate regex safety before compilation
    if (!isSafeRegex(pattern)) {
      throw new Error(
        'Unsafe regex pattern: pattern is too long, contains nested quantifiers, or excessive repetition'
      )
    }

    // Convert data to string in chunks to avoid memory issues
    let processedBytes = 0
    const decoder = new TextDecoder('utf-8', { fatal: false })

    while (processedBytes < dataLength && !shouldCancel) {
      const chunkEnd = Math.min(processedBytes + chunkSize, dataLength)
      const chunk = data.slice(processedBytes, chunkEnd)
      const text = decoder.decode(chunk, { stream: true })

      // Create regex
      const regex = new RegExp(pattern, flags || 'g')
      let match

      while ((match = regex.exec(text)) !== null) {
        results.push({
          offset: processedBytes + match.index,
          length: match[0].length,
          match: match[0]
        })
        if (results.length >= MAX_RESULTS) break
      }

      if (results.length >= MAX_RESULTS) break

      processedBytes = chunkEnd

      if (onProgress) {
        onProgress(Math.min(99, Math.floor((processedBytes / dataLength) * 100)))
      }
    }

    return { results, cancelled: shouldCancel, truncated: results.length >= MAX_RESULTS }
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${error.message}`)
  }
}

/**
 * Perform search based on type
 */
function performSearch(data, searchType, pattern, options = {}) {
  shouldCancel = false
  _isSearching = true

  const onProgress = (progress) => {
    self.postMessage({
      type: 'progress',
      progress
    })
  }

  try {
    let result

    switch (searchType) {
      case 'hex':
        result = searchHexPattern(data, pattern, onProgress)
        break

      case 'ascii':
      case 'string':
        result = searchAsciiPattern(data, pattern, options.caseInsensitive || false, onProgress)
        break

      case 'regex':
        result = searchRegexPattern(data, pattern, options.regexFlags || 'g', onProgress)
        break

      default:
        throw new Error(`Unknown search type: ${searchType}`)
    }

    // Send final progress
    if (!result.cancelled) {
      onProgress(100)
    }

    return result
  } finally {
    _isSearching = false
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = function (event) {
  // Validate message structure
  if (!event.data || typeof event.data.type !== 'string') {
    self.postMessage({ type: 'error', error: 'Invalid message format' })
    return
  }

  const { type, data } = event.data

  switch (type) {
    case 'search':
      try {
        // Validate search message data
        if (!data || !data.fileData || !data.searchType || !data.pattern) {
          self.postMessage({
            type: 'error',
            error: 'Invalid search message: missing fileData, searchType, or pattern'
          })
          return
        }

        const { fileData, searchType, pattern, options } = data

        // Start search
        self.postMessage({
          type: 'searchStarted',
          totalBytes: fileData.length
        })

        // Perform search
        const result = performSearch(fileData, searchType, pattern, options)

        if (result.cancelled) {
          self.postMessage({
            type: 'searchCancelled'
          })
        } else {
          // Convert results to array of byte indices for highlighting
          const highlightedBytes = []
          let highlightTruncated = false
          for (const match of result.results) {
            if (highlightedBytes.length + match.length > MAX_HIGHLIGHT_BYTES) {
              highlightTruncated = true
              break
            }
            for (let i = 0; i < match.length; i++) {
              highlightedBytes.push(match.offset + i)
            }
          }

          self.postMessage({
            type: 'searchComplete',
            results: result.results,
            highlightedBytes,
            matchCount: result.results.length,
            truncated: result.truncated || highlightTruncated
          })
        }
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message
        })
      }
      break

    case 'cancel':
      shouldCancel = true
      break

    default:
    // console.warn('Unknown message type:', type)
  }
}
