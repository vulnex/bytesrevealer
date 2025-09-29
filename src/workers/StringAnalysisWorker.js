/**
 * VULNEX -Bytes Revealer-
 *
 * File: StringAnalysisWorker.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-16
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

// String extraction in Web Worker for performance
self.addEventListener('message', async (event) => {
  const { type, data, options } = event.data

  if (type === 'analyze') {
    try {
      const results = await analyzeStrings(data, options)
      self.postMessage({ type: 'complete', results })
    } catch (error) {
      self.postMessage({ type: 'error', error: error.message })
    }
  }
})

async function analyzeStrings(fileBytes, options = {}) {
  const {
    minLength = 4,
    maxResults = 10000,
    chunkSize = 1024 * 1024, // 1MB chunks
    encoding = 'all' // 'ascii', 'utf8', 'utf16le', 'utf16be', 'all'
  } = options

  const results = {
    ascii: [],
    utf16le: [],
    utf16be: [],
    urls: [],
    emails: [],
    paths: [],
    ips: [],
    interesting: [],
    totalFound: 0,
    processedBytes: 0
  }

  const totalBytes = fileBytes.length
  let processedBytes = 0

  // Process in chunks to allow progress updates
  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const endOffset = Math.min(offset + chunkSize, totalBytes)
    const chunk = fileBytes.slice(offset, endOffset)

    // Extract ASCII strings
    if (encoding === 'ascii' || encoding === 'all') {
      extractAsciiStrings(chunk, offset, minLength, results.ascii, maxResults)
    }

    // Extract UTF-16 strings
    if (encoding === 'utf16le' || encoding === 'all') {
      extractUtf16Strings(chunk, offset, minLength, results.utf16le, maxResults, 'le')
    }

    if (encoding === 'utf16be' || encoding === 'all') {
      extractUtf16Strings(chunk, offset, minLength, results.utf16be, maxResults, 'be')
    }

    processedBytes = endOffset

    // Send progress update
    if (processedBytes % (chunkSize * 10) === 0 || processedBytes === totalBytes) {
      self.postMessage({
        type: 'progress',
        progress: (processedBytes / totalBytes) * 100,
        found: results.ascii.length + results.utf16le.length + results.utf16be.length
      })
    }

    // Stop if we've found enough strings
    const totalFound = results.ascii.length + results.utf16le.length + results.utf16be.length
    if (totalFound >= maxResults) {
      break
    }
  }

  // Analyze found strings for patterns
  analyzePatterns(results)

  results.totalFound = results.ascii.length + results.utf16le.length + results.utf16be.length
  results.processedBytes = processedBytes

  return results
}

function extractAsciiStrings(bytes, baseOffset, minLength, results, maxResults) {
  let current = []
  let startOffset = baseOffset

  for (let i = 0; i < bytes.length && results.length < maxResults; i++) {
    const byte = bytes[i]

    // Printable ASCII range (0x20-0x7E)
    if (byte >= 0x20 && byte <= 0x7E) {
      if (current.length === 0) {
        startOffset = baseOffset + i
      }
      current.push(String.fromCharCode(byte))
    } else {
      if (current.length >= minLength) {
        results.push({
          offset: startOffset,
          length: current.length,
          value: current.join(''),
          encoding: 'ASCII'
        })
      }
      current = []
    }
  }

  // Check final string
  if (current.length >= minLength && results.length < maxResults) {
    results.push({
      offset: startOffset,
      length: current.length,
      value: current.join(''),
      encoding: 'ASCII'
    })
  }
}

function extractUtf16Strings(bytes, baseOffset, minLength, results, maxResults, endianness) {
  let current = []
  let startOffset = baseOffset

  for (let i = 0; i < bytes.length - 1 && results.length < maxResults; i += 2) {
    const code = endianness === 'le'
      ? bytes[i] | (bytes[i + 1] << 8)
      : (bytes[i] << 8) | bytes[i + 1]

    // Basic Multilingual Plane printable characters
    if (code >= 0x20 && code <= 0x7E) {
      if (current.length === 0) {
        startOffset = baseOffset + i
      }
      current.push(String.fromCharCode(code))
    } else if (code === 0) {
      // Null terminator
      if (current.length >= minLength) {
        results.push({
          offset: startOffset,
          length: current.length * 2,
          value: current.join(''),
          encoding: `UTF-16${endianness.toUpperCase()}`
        })
      }
      current = []
    } else {
      // Non-printable, reset
      if (current.length >= minLength) {
        results.push({
          offset: startOffset,
          length: current.length * 2,
          value: current.join(''),
          encoding: `UTF-16${endianness.toUpperCase()}`
        })
      }
      current = []
    }
  }

  // Check final string
  if (current.length >= minLength && results.length < maxResults) {
    results.push({
      offset: startOffset,
      length: current.length * 2,
      value: current.join(''),
      encoding: `UTF-16${endianness.toUpperCase()}`
    })
  }
}

function analyzePatterns(results) {
  const allStrings = [
    ...results.ascii,
    ...results.utf16le,
    ...results.utf16be
  ]

  // Regular expressions for pattern matching
  const patterns = {
    url: /https?:\/\/[^\s]+/gi,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    path: /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$|^\/(?:[^\/\0]+\/)*[^\/\0]*$/gm,
    ip: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
  }

  const interestingKeywords = [
    'password', 'secret', 'key', 'token', 'api', 'private',
    'credential', 'auth', 'admin', 'root', 'user', 'login'
  ]

  for (const str of allStrings) {
    const value = str.value

    // Check for URLs
    const urls = value.match(patterns.url)
    if (urls) {
      urls.forEach(url => {
        if (!results.urls.some(u => u.value === url)) {
          results.urls.push({ ...str, value: url, type: 'URL' })
        }
      })
    }

    // Check for emails
    const emails = value.match(patterns.email)
    if (emails) {
      emails.forEach(email => {
        if (!results.emails.some(e => e.value === email)) {
          results.emails.push({ ...str, value: email, type: 'Email' })
        }
      })
    }

    // Check for paths
    if (patterns.path.test(value)) {
      results.paths.push({ ...str, type: 'Path' })
    }

    // Check for IPs
    const ips = value.match(patterns.ip)
    if (ips) {
      ips.forEach(ip => {
        if (!results.ips.some(i => i.value === ip)) {
          results.ips.push({ ...str, value: ip, type: 'IP' })
        }
      })
    }

    // Check for interesting keywords
    const lowerValue = value.toLowerCase()
    for (const keyword of interestingKeywords) {
      if (lowerValue.includes(keyword)) {
        results.interesting.push({ ...str, keyword, type: 'Interesting' })
        break
      }
    }
  }
}