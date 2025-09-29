/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KaitaiCompilerWorker.js
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

/**
 * Web Worker for KSY compilation
 * Runs compilation in a separate thread to avoid blocking the UI
 */

// Worker code as a string for inline worker creation
const workerCode = `
// Simple YAML parser for worker
function parseYAML(content) {
  // This is a simplified YAML parser for basic KSY files
  // In production, you'd include a proper YAML library
  const lines = content.split('\\n');
  const result = {};
  let currentSection = null;
  let currentIndent = 0;
  
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    
    const indent = line.search(/\\S/);
    const trimmed = line.trim();
    
    if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      
      if (indent === 0) {
        currentSection = key;
        result[key] = value || {};
      } else if (currentSection) {
        // Nested property
        if (typeof result[currentSection] !== 'object') {
          result[currentSection] = {};
        }
        result[currentSection][key] = value || {};
      }
    }
  }
  
  return result;
}

// KSY to JS compiler
function compileKSY(ksyContent) {
  try {
    const parsed = parseYAML(ksyContent);
    
    if (!parsed.meta || !parsed.meta.id) {
      throw new Error('Invalid KSY: missing meta.id');
    }
    
    const className = toPascalCase(parsed.meta.id);
    
    let js = \`
class \${className} {
  constructor(_io, _parent = null, _root = null) {
    this._io = _io;
    this._parent = _parent;
    this._root = _root || this;
    this._read();
  }
  
  _read() {
    // Auto-generated parsing code
\`;
    
    // Add basic field readers
    if (parsed.seq) {
      // Simplified seq processing
      js += \`    // Sequence fields\\n\`;
    }
    
    js += \`  }
}

\${className};
\`;
    
    return js;
  } catch (error) {
    throw new Error(\`Compilation failed: \${error.message}\`);
  }
}

function toPascalCase(str) {
  return str.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase());
}

// Message handler
self.addEventListener('message', async (event) => {
  const { type, content, id } = event.data;
  
  if (type === 'compile') {
    try {
      const result = compileKSY(content);
      self.postMessage({
        type: 'compiled',
        result,
        id
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error.message,
        id
      });
    }
  } else if (type === 'validate') {
    try {
      parseYAML(content);
      self.postMessage({
        type: 'validated',
        valid: true,
        id
      });
    } catch (error) {
      self.postMessage({
        type: 'validated',
        valid: false,
        error: error.message,
        id
      });
    }
  }
});
`;

/**
 * Create a Web Worker from inline code
 * @returns {Worker} Web Worker instance
 */
export function createCompilerWorker() {
  // Create a blob from the worker code
  const blob = new Blob([workerCode], { type: 'application/javascript' })
  const workerUrl = URL.createObjectURL(blob)
  
  // Create and return the worker
  const worker = new Worker(workerUrl)
  
  // Clean up the URL when the worker is terminated
  const originalTerminate = worker.terminate.bind(worker)
  worker.terminate = function() {
    URL.revokeObjectURL(workerUrl)
    originalTerminate()
  }
  
  return worker
}

/**
 * Compile KSY in worker
 * @param {Worker} worker - Worker instance
 * @param {string} content - KSY content
 * @returns {Promise<string>} Compiled JavaScript
 */
export function compileInWorker(worker, content) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substr(2, 9)
    
    const messageHandler = (event) => {
      if (event.data.id !== id) return
      
      worker.removeEventListener('message', messageHandler)
      
      if (event.data.type === 'compiled') {
        resolve(event.data.result)
      } else if (event.data.type === 'error') {
        reject(new Error(event.data.error))
      }
    }
    
    worker.addEventListener('message', messageHandler)
    worker.postMessage({
      type: 'compile',
      content,
      id
    })
  })
}

/**
 * Validate KSY in worker
 * @param {Worker} worker - Worker instance
 * @param {string} content - KSY content
 * @returns {Promise<boolean>} Is valid
 */
export function validateInWorker(worker, content) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substr(2, 9)
    
    const messageHandler = (event) => {
      if (event.data.id !== id) return
      
      worker.removeEventListener('message', messageHandler)
      
      if (event.data.type === 'validated') {
        resolve(event.data.valid)
      } else {
        reject(new Error('Validation failed'))
      }
    }
    
    worker.addEventListener('message', messageHandler)
    worker.postMessage({
      type: 'validate',
      content,
      id
    })
  })
}