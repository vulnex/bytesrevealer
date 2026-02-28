/**
 * VULNEX -Bytes Revealer-
 *
 * File: YaraWorker.js
 * Author: Simon Roses Femerling
 * Created: 2026-02-10
 * Last Modified: 2026-02-10
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 *
 * Web Worker for YARA rule scanning via libyara-wasm.
 * Lazily initializes the WASM instance on first scan and keeps it warm.
 */

let yaraInstance = null

/**
 * Initialize libyara-wasm (lazy, once)
 */
async function initYara() {
  if (yaraInstance) return yaraInstance
  const { default: Yara } = await import('libyara-wasm')
  yaraInstance = await Yara()
  return yaraInstance
}

/**
 * Extract results from C++ collection objects returned by libyara-wasm.
 * The collections use .size() / .get(i) interface.
 */
export function extractResults(rawResult) {
  const compileErrors = []
  const consoleLogs = []
  const matchedRules = []

  // Extract compile errors
  if (rawResult.compileErrors && rawResult.compileErrors.size) {
    for (let i = 0; i < rawResult.compileErrors.size(); i++) {
      const err = rawResult.compileErrors.get(i)
      compileErrors.push({
        type: err.type || 'error',
        lineNumber: err.lineNumber || 0,
        message: err.message || String(err)
      })
    }
  }

  // Extract console logs
  if (rawResult.consoleLogs && rawResult.consoleLogs.size) {
    for (let i = 0; i < rawResult.consoleLogs.size(); i++) {
      consoleLogs.push(rawResult.consoleLogs.get(i))
    }
  }

  // Extract matched rules
  if (rawResult.matchedRules && rawResult.matchedRules.size) {
    for (let i = 0; i < rawResult.matchedRules.size(); i++) {
      const rule = rawResult.matchedRules.get(i)
      const matches = []

      if (rule.resolvedMatches && rule.resolvedMatches.size) {
        for (let j = 0; j < rule.resolvedMatches.size(); j++) {
          const m = rule.resolvedMatches.get(j)
          matches.push({
            offset: m.location || 0,
            length: m.matchLength || 0,
            stringIdentifier: m.stringIdentifier || '',
            data: m.data || ''
          })
        }
      }

      matchedRules.push({
        ruleName: rule.ruleName || `Rule_${i}`,
        tags: rule.tags || [],
        meta: rule.meta || {},
        matches
      })
    }
  }

  return { compileErrors, consoleLogs, matchedRules }
}

/**
 * Handle messages from main thread
 */
self.onmessage = async function (event) {
  // Validate message structure
  if (!event.data || typeof event.data.type !== 'string') {
    self.postMessage({ type: 'error', error: 'Invalid message format' })
    return
  }

  const { type, data } = event.data

  switch (type) {
    case 'scan':
      try {
        // Validate scan message data
        if (!data || !data.fileData || !data.rules) {
          self.postMessage({
            type: 'error',
            error: 'Invalid scan message: missing fileData or rules'
          })
          return
        }
        self.postMessage({ type: 'progress', progress: 5 })

        const startTime = performance.now()
        const yara = await initYara()

        self.postMessage({ type: 'progress', progress: 20 })

        const rawResult = yara.run(data.fileData, data.rules)

        self.postMessage({ type: 'progress', progress: 90 })

        const results = extractResults(rawResult)
        const duration = Math.round(performance.now() - startTime)

        self.postMessage({
          type: 'complete',
          results: {
            ...results,
            duration
          }
        })
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message || String(error)
        })
      }
      break

    default:
      break
  }
}
