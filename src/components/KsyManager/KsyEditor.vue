/** 
 * VULNEX -Bytes Revealer-
 * 
 * File: KsyEditor.vue
 * Author: Simon Roses Femerling
 * Created: 2025-09-27
 * Last Modified: 2025-09-27
 * Version: 0.3
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="ksy-editor">
    <div class="editor-header">
      <input 
        v-model="formatName"
        placeholder="Format Name"
        class="format-name-input"
      />
      <div class="editor-actions">
        <button @click="validateKsy" class="action-btn validate">
          <span class="icon">✓</span> Validate
        </button>
        <button @click="compileKsy" class="action-btn compile">
          <span class="icon">⚡</span> Compile
        </button>
        <button @click="saveKsy" class="action-btn save">
          <span class="icon">💾</span> Save
        </button>
        <button @click="testKsy" class="action-btn test" v-if="testFile">
          <span class="icon">🧪</span> Test
        </button>
      </div>
    </div>
    
    <div class="editor-content">
      <div class="editor-pane">
        <div class="pane-header">KSY Definition</div>
        <textarea
          v-model="ksyContent"
          @input="handleInput"
          class="code-editor"
          placeholder="meta:
  id: format_name
  title: Format Title
  file-extension: ext
  endian: le
  
seq:
  - id: field_name
    type: u4"
          spellcheck="false"
        ></textarea>
      </div>
      
      <div class="preview-pane" v-if="showPreview">
        <div class="pane-header">
          Compiled JavaScript
          <button @click="copyCode" class="copy-btn">Copy</button>
        </div>
        <pre class="code-preview">{{ compiledCode }}</pre>
      </div>
    </div>
    
    <div class="editor-footer" v-if="status">
      <div class="status" :class="statusClass">
        {{ status }}
      </div>
    </div>
    
    <!-- Test File Upload -->
    <div class="test-section" v-if="showTestSection">
      <div class="test-header">Test with Sample File</div>
      <input 
        type="file"
        @change="handleTestFile"
        class="test-file-input"
      />
      <div v-if="testResult" class="test-result">
        <pre>{{ testResult }}</pre>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { getKsyCompiler } from '../../kaitai/ksy/KsyCompiler'
import { getKsyValidator } from '../../kaitai/ksy/KsyValidator'
import { getKsyManager } from '../../kaitai/ksy/KsyManager'

export default {
  name: 'KsyEditor',
  
  props: {
    initialContent: {
      type: String,
      default: ''
    },
    initialName: {
      type: String,
      default: ''
    },
    formatId: {
      type: String,
      default: null
    }
  },
  
  emits: ['save', 'compile', 'validate'],
  
  setup(props, { emit }) {
    const formatName = ref(props.initialName)
    const ksyContent = ref(props.initialContent || getDefaultTemplate())
    const compiledCode = ref('')
    const showPreview = ref(false)
    const status = ref('')
    const statusClass = ref('')
    const showTestSection = ref(false)
    const testFile = ref(null)
    const testResult = ref('')
    
    const compiler = getKsyCompiler()
    const validator = getKsyValidator()
    const manager = getKsyManager()
    
    let inputTimeout = null
    
    function getDefaultTemplate() {
      return `meta:
  id: my_format
  title: My Custom Format
  file-extension: bin
  endian: le
  
seq:
  - id: magic
    type: u4
    doc: Magic number
  - id: version
    type: u2
    doc: Format version
  - id: header_size
    type: u2
    doc: Size of header
  - id: data
    size: header_size
    doc: Data section`
    }
    
    const handleInput = () => {
      clearTimeout(inputTimeout)
      inputTimeout = setTimeout(() => {
        validateKsy()
      }, 500)
    }
    
    const validateKsy = async () => {
      try {
        const validation = await validator.validate(ksyContent.value)
        if (validation.valid) {
          setStatus('Valid KSY', 'success')
        } else {
          setStatus(`Validation errors: ${validation.errors.join(', ')}`, 'error')
        }
        emit('validate', validation)
      } catch (error) {
        setStatus(`Validation failed: ${error.message}`, 'error')
      }
    }
    
    const compileKsy = async () => {
      try {
        setStatus('Compiling...', 'info')
        
        const result = await compiler.compile(ksyContent.value)
        if (result.success) {
          compiledCode.value = result.code
          showPreview.value = true
          setStatus('Compilation successful', 'success')
          emit('compile', result)
        } else {
          setStatus(`Compilation failed: ${result.error}`, 'error')
        }
      } catch (error) {
        setStatus(`Compilation error: ${error.message}`, 'error')
      }
    }
    
    const saveKsy = async () => {
      try {
        const format = {
          name: formatName.value || 'untitled',
          content: ksyContent.value,
          category: 'custom'
        }
        
        if (props.formatId) {
          format.id = props.formatId
          await manager.update(props.formatId, format)
        } else {
          await manager.add(format)
        }
        
        setStatus('Saved successfully', 'success')
        emit('save', format)
      } catch (error) {
        setStatus(`Save failed: ${error.message}`, 'error')
      }
    }
    
    const copyCode = () => {
      navigator.clipboard.writeText(compiledCode.value)
      setStatus('Copied to clipboard', 'success')
    }
    
    const handleTestFile = (event) => {
      const file = event.target.files[0]
      if (file) {
        testFile.value = file
        testKsy()
      }
    }
    
    const testKsy = async () => {
      if (!testFile.value) return
      
      try {
        setStatus('Testing...', 'info')
        
        // Compile the KSY
        const compileResult = await compiler.compile(ksyContent.value)
        if (!compileResult.success) {
          setStatus(`Cannot test: ${compileResult.error}`, 'error')
          return
        }
        
        // Read test file
        const buffer = await testFile.value.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        
        // Parse with compiled format
        const parser = compileResult.parser
        if (parser) {
          const result = await parser.parse(bytes)
          testResult.value = JSON.stringify(result, null, 2)
          showTestSection.value = true
          setStatus('Test successful', 'success')
        } else {
          setStatus('Parser not available', 'error')
        }
      } catch (error) {
        setStatus(`Test failed: ${error.message}`, 'error')
        testResult.value = `Error: ${error.message}`
      }
    }
    
    const setStatus = (message, type) => {
      status.value = message
      statusClass.value = type
      
      if (type === 'success' || type === 'info') {
        setTimeout(() => {
          status.value = ''
        }, 3000)
      }
    }
    
    // Auto-save draft
    watch(ksyContent, (newContent) => {
      localStorage.setItem('ksy-editor-draft', newContent)
    })
    
    // Load draft on mount
    const loadDraft = () => {
      if (!props.initialContent) {
        const draft = localStorage.getItem('ksy-editor-draft')
        if (draft) {
          ksyContent.value = draft
        }
      }
    }
    
    loadDraft()
    
    return {
      formatName,
      ksyContent,
      compiledCode,
      showPreview,
      status,
      statusClass,
      showTestSection,
      testFile,
      testResult,
      handleInput,
      validateKsy,
      compileKsy,
      saveKsy,
      copyCode,
      handleTestFile,
      testKsy
    }
  }
}
</script>

<style scoped>
.ksy-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.format-name-input {
  flex: 1;
  max-width: 300px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.action-btn .icon {
  font-size: 16px;
}

.action-btn.validate .icon { color: #4CAF50; }
.action-btn.compile .icon { color: #FF9800; }
.action-btn.save .icon { color: #2196F3; }
.action-btn.test .icon { color: #9C27B0; }

.editor-content {
  flex: 1;
  display: flex;
  gap: 1px;
  background: var(--border-color);
  overflow: hidden;
}

.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  font-size: 14px;
}

.copy-btn {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.copy-btn:hover {
  background: var(--link-color);
  color: white;
  border-color: var(--link-color);
}

.code-editor {
  flex: 1;
  padding: 12px;
  border: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
}

.code-preview {
  flex: 1;
  padding: 12px;
  margin: 0;
  overflow: auto;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.editor-footer {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.status {
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
}

.status.success {
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
}

.status.error {
  background: rgba(244, 67, 54, 0.1);
  color: #F44336;
}

.status.info {
  background: rgba(33, 150, 243, 0.1);
  color: #2196F3;
}

.test-section {
  padding: 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.test-header {
  font-weight: 600;
  margin-bottom: 8px;
}

.test-file-input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  margin-bottom: 8px;
}

.test-result {
  max-height: 200px;
  overflow: auto;
  padding: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.test-result pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: var(--text-primary);
}

/* Scrollbar styling */
.code-preview::-webkit-scrollbar,
.test-result::-webkit-scrollbar {
  width: 8px;
}

.code-preview::-webkit-scrollbar-track,
.test-result::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.code-preview::-webkit-scrollbar-thumb,
.test-result::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.code-preview::-webkit-scrollbar-thumb:hover,
.test-result::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>