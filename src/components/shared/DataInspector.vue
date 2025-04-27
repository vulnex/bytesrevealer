/** 
 * VULNEX -Bytes Revealer-
 *
 * File: DataInspector.vue
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2025-04-27
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="data-inspector" :class="{ 'is-locked': isLocked }">
    <div class="inspector-header">
      <span class="title">Data Inspector</span>
      <span class="lock-status" v-if="isLocked">[Locked]</span>
      <span class="shortcut-hint">(Press 'L' to lock/unlock)</span>
    </div>
    <div class="inspector-content">
      <!-- 1. Basic Info -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('basic')">
          <span class="group-title">Basic Info</span>
          <span class="toggle-icon">{{ groupStates.basic ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates.basic">
          <div class="group-item">
            <label>Display Offset:</label>
            <span>0x{{ formatHex(offset, 8) }}</span>
          </div>
          <div class="group-item">
            <label>File Offset:</label>
            <span>0x{{ formatHex(actualOffset, 8) }}</span>
          </div>
          <div class="group-item">
            <label>Byte:</label>
            <span>0x{{ formatByte(value) }}</span>
          </div>
        </div>
      </div>

      <!-- 2. Number Bases -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('bases')">
          <span class="group-title">Number Bases</span>
          <span class="toggle-icon">{{ groupStates.bases ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates.bases">
          <div class="group-item">
            <label>Decimal:</label>
            <span>{{ value }}</span>
          </div>
          <div class="group-item">
            <label>Hexadecimal:</label>
            <span>0x{{ formatByte(value) }}</span>
          </div>
          <div class="group-item">
            <label>Binary:</label>
            <span>0b{{ formatBinary(value) }}</span>
          </div>
          <div class="group-item">
            <label>Octal:</label>
            <span>0o{{ value.toString(8) }}</span>
          </div>
          <div class="group-item">
            <label>Base64:</label>
            <span>{{ toBase64(value) }}</span>
          </div>
        </div>
      </div>

      <!-- 3. Text Representations -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('text')">
          <span class="group-title">Text Representations</span>
          <span class="toggle-icon">{{ groupStates.text ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates.text">
          <div class="group-item">
            <label>ASCII:</label>
            <span>{{ formatAscii(value) }}</span>
          </div>
          <div class="group-item">
            <label>UTF-8:</label>
            <span>{{ formatUtf8() }}</span>
          </div>
          <div class="group-item">
            <label>UTF-16:</label>
            <span>{{ formatUtf16() }}</span>
          </div>
        </div>
      </div>

      <!-- 4. 16-bit Values -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('16bit')">
          <span class="group-title">16-bit Values</span>
          <span class="toggle-icon">{{ groupStates['16bit'] ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates['16bit']">
          <div class="group-item">
            <label>16-bit LE:</label>
            <span>0x{{ formatHex(get16BitLE(), 4) }} ({{ get16BitLE() }})</span>
          </div>
          <div class="group-item">
            <label>16-bit BE:</label>
            <span>0x{{ formatHex(get16BitBE(), 4) }} ({{ get16BitBE() }})</span>
          </div>
          <div class="group-item">
            <label>Int16 LE:</label>
            <span>{{ getInt16LE() }}</span>
          </div>
          <div class="group-item">
            <label>Int16 BE:</label>
            <span>{{ getInt16BE() }}</span>
          </div>
        </div>
      </div>

      <!-- 5. 32-bit Values -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('32bit')">
          <span class="group-title">32-bit Values</span>
          <span class="toggle-icon">{{ groupStates['32bit'] ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates['32bit']">
          <div class="group-item">
            <label>32-bit LE:</label>
            <span>0x{{ formatHex(get32BitLE(), 8) }} ({{ get32BitLE() }})</span>
          </div>
          <div class="group-item">
            <label>32-bit BE:</label>
            <span>0x{{ formatHex(get32BitBE(), 8) }} ({{ get32BitBE() }})</span>
          </div>
          <div class="group-item">
            <label>Int32 LE:</label>
            <span>{{ getInt32LE() }}</span>
          </div>
          <div class="group-item">
            <label>Int32 BE:</label>
            <span>{{ getInt32BE() }}</span>
          </div>
        </div>
      </div>

      <!-- 6. 64-bit Values -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('64bit')">
          <span class="group-title">64-bit Values</span>
          <span class="toggle-icon">{{ groupStates['64bit'] ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates['64bit']">
          <div class="group-item">
            <label>64-bit LE:</label>
            <span>0x{{ formatHex(get64BitLE(), 16) }}</span>
          </div>
          <div class="group-item">
            <label>64-bit BE:</label>
            <span>0x{{ formatHex(get64BitBE(), 16) }}</span>
          </div>
          <div class="group-item">
            <label>Int64 LE:</label>
            <span>{{ getInt64LE() }}</span>
          </div>
          <div class="group-item">
            <label>Int64 BE:</label>
            <span>{{ getInt64BE() }}</span>
          </div>
        </div>
      </div>

      <!-- 7. Integer Values -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('integers')">
          <span class="group-title">Integer Values</span>
          <span class="toggle-icon">{{ groupStates.integers ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates.integers">
          <div class="group-item">
            <label>Signed Int8:</label>
            <span>{{ getSignedInt8() }}</span>
          </div>
          <div class="group-item">
            <label>Unsigned Int8:</label>
            <span>{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- 8. Float Values -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('floats')">
          <span class="group-title">Float Values</span>
          <span class="toggle-icon">{{ groupStates.floats ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates.floats">
          <div class="group-item">
            <label>Float LE:</label>
            <span>{{ formatFloat(getFloatLE()) }}</span>
          </div>
          <div class="group-item">
            <label>Float BE:</label>
            <span>{{ formatFloat(getFloatBE()) }}</span>
          </div>
          <div class="group-item">
            <label>Double LE:</label>
            <span>{{ formatFloat(getDoubleLE()) }}</span>
          </div>
          <div class="group-item">
            <label>Double BE:</label>
            <span>{{ formatFloat(getDoubleBE()) }}</span>
          </div>
        </div>
      </div>

      <!-- 9. Additional Info -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('additional')">
          <span class="group-title">Additional Info</span>
          <span class="toggle-icon">{{ groupStates.additional ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates.additional">
          <div class="group-item">
            <label>Bit Position:</label>
            <span>{{ actualOffset * 8 }} - {{ actualOffset * 8 + 7 }}</span>
          </div>
          <div class="group-item">
            <label>Page:</label>
            <span>0x{{ formatHex(Math.floor(actualOffset / 4096), 4) }}</span>
          </div>
          <div class="group-item">
            <label>Page Offset:</label>
            <span>0x{{ formatHex(actualOffset % 4096, 3) }}</span>
          </div>
        </div>
      </div>

      <!-- 10. Date/Time -->
      <div class="inspector-group">
        <div class="group-header" @click="toggleGroup('datetime')">
          <span class="group-title">Date/Time</span>
          <span class="toggle-icon">{{ groupStates.datetime ? '▼' : '▶' }}</span>
        </div>
        <div class="group-content" v-show="groupStates.datetime">
          <div class="group-item">
            <label>Unix Time:</label>
            <span>{{ formatUnixTime() }}</span>
          </div>
          <div class="group-item">
            <label>DOS Time:</label>
            <span>{{ formatDosTime() }}</span>
          </div>
          <div class="group-item">
            <label>FILETIME:</label>
            <span>{{ formatFileTime() }}</span>
          </div>
        </div>
      </div>

      <!-- Byte Type -->
      <div class="inspector-group">
        <div class="byte-type" :style="{ backgroundColor: getByteTypeColor() }">
          {{ getByteType() }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-inspector {
  width: 320px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
  overflow-y: auto;
  padding: 0;
  z-index: 10; /* Ensure it's above other elements */
}

.inspector-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-primary);
}

.title {
  font-weight: 600;
  color: var(--text-primary);
}

.lock-status {
  margin-left: 8px;
  color: var(--link-color);
  font-weight: 500;
}

.shortcut-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.inspector-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.inspector-group {
  margin-bottom: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background-color: var(--bg-primary);
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  margin-bottom: 4px;
}

.group-header:hover {
  background-color: var(--border-color);
}

.group-title {
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-icon {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.group-content {
  padding: 0 4px;
}

.group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  gap: 12px;
}

.group-item:hover {
  background-color: var(--bg-primary);
}

.group-item label {
  color: var(--text-secondary);
  font-size: 0.8rem;
  flex: 0 0 100px;
}

.group-item span {
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  text-align: right;
  flex: 1;
}

.byte-type {
  margin: 4px 0;
  padding: 4px 8px;
  border-radius: 4px;
  text-align: center;
  color: white;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.is-locked {
  border-left: 2px solid var(--link-color);
}

:root[class='dark-mode'] .data-inspector {
  background-color: var(--bg-secondary);
  border-color: var(--border-color);
}
</style>

<script>
export default {
  name: 'DataInspector',
  props: {
    offset: {
      type: Number,
      default: 0
    },
    actualOffset: {
      type: Number,
      default: 0
    },
    value: {
      type: Number,
      default: 0
    },
    fileBytes: {
      type: Uint8Array,
      required: true
    },
    isLocked: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      groupStates: {
        basic: true,
        datetime: true,
        bases: true,
        text: true,
        integers: true,
        '16bit': true,
        '32bit': true,
        '64bit': true,
        floats: true,
        additional: true
      }
    }
  },
  methods: {
    formatHex(value, padding = 2) {
      return value.toString(16).toUpperCase().padStart(padding, '0')
    },
    formatByte(value) {
      return value.toString(16).toUpperCase().padStart(2, '0')
    },
    formatBinary(value) {
      return value.toString(2).padStart(8, '0')
    },
    formatAscii(value) {
      return value >= 32 && value <= 126 ? String.fromCharCode(value) : '.'
    },
    get16BitLE() {
      if (this.offset + 1 >= this.fileBytes.length) return 0
      return this.fileBytes[this.offset] | (this.fileBytes[this.offset + 1] << 8)
    },
    get16BitBE() {
      if (this.offset + 1 >= this.fileBytes.length) return 0
      return (this.fileBytes[this.offset] << 8) | this.fileBytes[this.offset + 1]
    },
    get32BitLE() {
      if (this.offset + 3 >= this.fileBytes.length) return 0
      return this.fileBytes[this.offset] |
        (this.fileBytes[this.offset + 1] << 8) |
        (this.fileBytes[this.offset + 2] << 16) |
        (this.fileBytes[this.offset + 3] << 24)
    },
    get32BitBE() {
      if (this.offset + 3 >= this.fileBytes.length) return 0
      return (this.fileBytes[this.offset] << 24) |
        (this.fileBytes[this.offset + 1] << 16) |
        (this.fileBytes[this.offset + 2] << 8) |
        this.fileBytes[this.offset + 3]
    },
    get64BitLE() {
      if (this.offset + 7 >= this.fileBytes.length) return 0n
      const bytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) {
        bytes[i] = this.fileBytes[this.offset + i] || 0
      }
      return new DataView(bytes.buffer).getBigUint64(0, true)
    },
    get64BitBE() {
      if (this.offset + 7 >= this.fileBytes.length) return 0n
      const bytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) {
        bytes[i] = this.fileBytes[this.offset + i] || 0
      }
      return new DataView(bytes.buffer).getBigUint64(0, false)
    },
    getFloatLE() {
      if (this.offset + 3 >= this.fileBytes.length) return 0
      const bytes = new Uint8Array(4)
      for (let i = 0; i < 4; i++) {
        bytes[i] = this.fileBytes[this.offset + i] || 0
      }
      return new DataView(bytes.buffer).getFloat32(0, true)
    },
    getFloatBE() {
      if (this.offset + 3 >= this.fileBytes.length) return 0
      const bytes = new Uint8Array(4)
      for (let i = 0; i < 4; i++) {
        bytes[i] = this.fileBytes[this.offset + i] || 0
      }
      return new DataView(bytes.buffer).getFloat32(0, false)
    },
    getDoubleLE() {
      if (this.offset + 7 >= this.fileBytes.length) return 0
      const bytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) {
        bytes[i] = this.fileBytes[this.offset + i] || 0
      }
      return new DataView(bytes.buffer).getFloat64(0, true)
    },
    getDoubleBE() {
      if (this.offset + 7 >= this.fileBytes.length) return 0
      const bytes = new Uint8Array(8)
      for (let i = 0; i < 8; i++) {
        bytes[i] = this.fileBytes[this.offset + i] || 0
      }
      return new DataView(bytes.buffer).getFloat64(0, false)
    },
    getSignedInt8() {
      return (this.value << 24) >> 24
    },
    getInt16LE() {
      if (this.offset + 1 >= this.fileBytes.length) return 0
      const value = this.get16BitLE()
      return (value << 16) >> 16
    },
    getInt16BE() {
      if (this.offset + 1 >= this.fileBytes.length) return 0
      const value = this.get16BitBE()
      return (value << 16) >> 16
    },
    getInt32LE() {
      if (this.offset + 3 >= this.fileBytes.length) return 0
      return new Int32Array(new Uint32Array([this.get32BitLE()]).buffer)[0]
    },
    getInt32BE() {
      if (this.offset + 3 >= this.fileBytes.length) return 0
      return new Int32Array(new Uint32Array([this.get32BitBE()]).buffer)[0]
    },
    getInt64LE() {
      if (this.offset + 7 >= this.fileBytes.length) return 0n
      return BigInt.asIntN(64, this.get64BitLE())
    },
    getInt64BE() {
      if (this.offset + 7 >= this.fileBytes.length) return 0n
      return BigInt.asIntN(64, this.get64BitBE())
    },
    formatUtf8() {
      try {
        // Try to decode 1-4 bytes as UTF-8
        const bytes = []
        for (let i = 0; i < 4; i++) {
          if (this.offset + i < this.fileBytes.length) {
            bytes.push(this.fileBytes[this.offset + i])
          }
        }
        const text = new TextDecoder().decode(new Uint8Array(bytes))
        return text.charAt(0) || '.'
      } catch {
        return '.'
      }
    },
    formatFloat(value) {
      return Number.isFinite(value) ? value.toFixed(6) : 'N/A'
    },
    formatUtf16() {
      if (this.offset + 1 >= this.fileBytes.length) return '.'
      try {
        const bytes = new Uint8Array([this.fileBytes[this.offset], this.fileBytes[this.offset + 1]])
        return new TextDecoder('utf-16le').decode(bytes) || '.'
      } catch {
        return '.'
      }
    },
    getByteType() {
      if (this.value === 0) return 'NULL'
      if (this.value < 32) return 'Control'
      if (this.value === 127) return 'DEL'
      if (this.value >= 32 && this.value <= 126) return 'ASCII'
      if (this.value >= 128 && this.value <= 159) return 'C1 Control'
      if (this.value >= 160 && this.value <= 255) return 'Extended ASCII'
      return 'Unknown'
    },
    getByteTypeColor() {
      const types = {
        'NULL': '#dc3545',
        'Control': '#17a2b8',
        'DEL': '#fd7e14',
        'ASCII': '#007bff',
        'C1 Control': '#6f42c1',
        'Extended ASCII': '#28a745',
        'Unknown': '#6c757d'
      }
      return types[this.getByteType()]
    },
    toggleGroup(group) {
      this.groupStates[group] = !this.groupStates[group]
    },
    toBase64(value) {
      return btoa(String.fromCharCode(value))
    },
    formatUnixTime() {
      try {
        const timestamp = this.get32BitLE()
        if (timestamp > 0) {
          return new Date(timestamp * 1000).toISOString()
        }
        return 'Invalid timestamp'
      } catch {
        return 'Invalid timestamp'
      }
    },
    formatDosTime() {
      try {
        const dosDate = this.get16BitLE()
        const dosTime = this.get16BitLE()
        
        const year = ((dosDate >> 9) & 0x7F) + 1980
        const month = (dosDate >> 5) & 0x0F
        const day = dosDate & 0x1F
        const hours = (dosTime >> 11) & 0x1F
        const minutes = (dosTime >> 5) & 0x3F
        const seconds = (dosTime & 0x1F) * 2

        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ` +
               `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      } catch {
        return 'Invalid DOS date/time'
      }
    },
    formatFileTime() {
      try {
        const filetime = this.get64BitLE()
        const windowsEpoch = new Date('1601-01-01T00:00:00Z').getTime()
        const timestamp = windowsEpoch + Number(filetime) / 10000
        return new Date(timestamp).toISOString()
      } catch {
        return 'Invalid FILETIME'
      }
    }
  }
}
</script> 