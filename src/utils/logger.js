/**
 * VULNEX -Bytes Revealer-
 *
 * File: logger.js
 * Author: Simon Roses Femerling
 * Created: 2025-01-16
 * Last Modified: 2025-01-16
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

// Development logging utility that can be disabled in production
const isDevelopment = import.meta.env.DEV
const isProduction = import.meta.env.PROD

class Logger {
  constructor(namespace = 'BytesRevealer') {
    this.namespace = namespace
    // Completely disable all logging in production unless explicitly enabled via localStorage
    // In development, check localStorage for debug mode setting
    if (isProduction) {
      this.enabled = localStorage.getItem('forceDebugMode') === 'true'
    } else {
      this.enabled = localStorage.getItem('debugMode') === 'true'
    }
  }

  log(...args) {
    if (this.enabled) {
      console.log(`[${this.namespace}]`, ...args)
    }
  }

  info(...args) {
    if (this.enabled) {
      console.info(`[${this.namespace}]`, ...args)
    }
  }

  warn(...args) {
    // Only show warnings if enabled
    if (this.enabled) {
      console.warn(`[${this.namespace}]`, ...args)
    }
  }

  error(...args) {
    // In production, only show errors if explicitly enabled
    // In development, always show errors
    if (this.enabled || (isDevelopment && !isProduction)) {
      console.error(`[${this.namespace}]`, ...args)
    }
  }

  debug(...args) {
    if (this.enabled) {
      console.debug(`[${this.namespace}]`, ...args)
    }
  }

  group(label) {
    if (this.enabled) {
      console.group(`[${this.namespace}] ${label}`)
    }
  }

  groupEnd() {
    if (this.enabled) {
      console.groupEnd()
    }
  }

  time(label) {
    if (this.enabled) {
      console.time(`[${this.namespace}] ${label}`)
    }
  }

  timeEnd(label) {
    if (this.enabled) {
      console.timeEnd(`[${this.namespace}] ${label}`)
    }
  }
}

// Create logger instances for different modules
export const createLogger = (namespace) => new Logger(namespace)

// Default logger instance
export default new Logger()