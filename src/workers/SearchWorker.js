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
let isSearching = false
let shouldCancel = false

/**
 * Search for hex pattern in data
 */
function searchHexPattern(data, pattern, onProgress) {
  const results = []
  const patternBytes = pattern.trim().split(/\s+/).map(hex => {
    const num = parseInt(hex, 16)
    return isNaN(num) ? null : num
  })

  // Validate pattern
  if (patternBytes.some(b => b === null)) {
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
    }

    // Report progress
    processed++
    if (processed % chunkSize === 0 && onProgress) {
      onProgress(Math.min(99, Math.floor((i / dataLength) * 100)))
    }
  }

  return { results, cancelled: false }
}

/**
 * Search for ASCII/UTF-8 pattern in data
 */
function searchAsciiPattern(data, pattern, caseInsensitive, onProgress) {
  const results = []
  const searchBytes = Array.from(pattern).map(char => char.charCodeAt(0))
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
    }

    // Report progress
    processed++
    if (processed % chunkSize === 0 && onProgress) {
      onProgress(Math.min(99, Math.floor((i / dataLength) * 100)))
    }
  }

  return { results, cancelled: false }
}

/**
 * Search for regex pattern in data
 */
function searchRegexPattern(data, pattern, flags, onProgress) {
  const results = []
  const dataLength = data.length
  const chunkSize = 10 * 1024 * 1024 // 10MB chunks for regex (slower)

  try {
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
      }

      processedBytes = chunkEnd

      if (onProgress) {
        onProgress(Math.min(99, Math.floor((processedBytes / dataLength) * 100)))
      }
    }

    return { results, cancelled: shouldCancel }
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${error.message}`)
  }
}

/**
 * Perform search based on type
 */
function performSearch(data, searchType, pattern, options = {}) {
  shouldCancel = false
  isSearching = true

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
        result = searchAsciiPattern(
          data,
          pattern,
          options.caseInsensitive || false,
          onProgress
        )
        break

      case 'regex':
        result = searchRegexPattern(
          data,
          pattern,
          options.regexFlags || 'g',
          onProgress
        )
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
    isSearching = false
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = function(event) {
  const { type, data } = event.data

  switch (type) {
    case 'search':
      try {
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
          result.results.forEach(match => {
            for (let i = 0; i < match.length; i++) {
              highlightedBytes.push(match.offset + i)
            }
          })

          self.postMessage({
            type: 'searchComplete',
            results: result.results,
            highlightedBytes,
            matchCount: result.results.length
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