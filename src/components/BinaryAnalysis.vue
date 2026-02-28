/** * VULNEX -Bytes Revealer- * * File: BinaryAnalysis.vue * Author: Simon Roses Femerling *
Created: 2026-02-09 * Version: 0.1 * License: Apache-2.0 * Copyright (c) 2025 VULNEX. All rights
reserved. * https://www.vulnex.com */

<template>
  <div v-if="binaryDetails" class="binary-analysis">
    <h3>Binary Analysis</h3>

    <!-- Header Info -->
    <div class="ba-section">
      <div class="ba-section-title">Header</div>
      <div class="ba-grid">
        <div v-for="(value, key) in headerFields" :key="key" class="ba-field">
          <span class="ba-label">{{ key }}</span>
          <span class="ba-value">{{ value }}</span>
        </div>
      </div>
    </div>

    <!-- Security Features -->
    <div v-if="securityFeatures.length > 0" class="ba-section">
      <div class="ba-section-title">Security Features</div>
      <div class="ba-security-grid">
        <div
          v-for="feat in securityFeatures"
          :key="feat.name"
          class="ba-security-item"
          :class="feat.cls"
        >
          <span class="ba-security-icon">{{ feat.icon }}</span>
          <span class="ba-security-name">{{ feat.name }}</span>
          <span class="ba-security-status">{{ feat.status }}</span>
        </div>
      </div>
    </div>

    <!-- Sections -->
    <div v-if="sectionRows.length > 0" class="ba-section">
      <div class="ba-section-title">Sections ({{ sectionRows.length }})</div>
      <table class="ba-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Virtual Size</th>
            <th>Raw Size</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(sec, i) in sectionRows" :key="i" :class="{ 'ba-row-warn': sec.isRWX }">
            <td class="ba-mono">{{ sec.name }}</td>
            <td class="ba-mono">{{ sec.virtualSize }}</td>
            <td class="ba-mono">{{ sec.rawSize }}</td>
            <td>
              <code class="ba-perm" :class="{ 'ba-perm-rwx': sec.isRWX }">{{ sec.flags }}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Imports -->
    <div v-if="importList.length > 0" class="ba-section">
      <div class="ba-section-title">Imports ({{ importList.length }} {{ importLabel }})</div>
      <div class="ba-imports">
        <code v-for="(name, i) in importList" :key="i" class="ba-import-item">{{ name }}</code>
      </div>
    </div>

    <!-- Exports -->
    <div v-if="exportInfo" class="ba-section">
      <div class="ba-section-title">Exports</div>
      <div class="ba-grid">
        <div v-if="exportInfo.dllName" class="ba-field">
          <span class="ba-label">DLL Name</span>
          <span class="ba-value ba-mono">{{ exportInfo.dllName }}</span>
        </div>
        <div class="ba-field">
          <span class="ba-label">Functions</span>
          <span class="ba-value">{{ exportInfo.numberOfFunctions }}</span>
        </div>
        <div class="ba-field">
          <span class="ba-label">Named Exports</span>
          <span class="ba-value">{{ exportInfo.numberOfNames }}</span>
        </div>
      </div>
    </div>

    <!-- Dependencies (ELF/Mach-O) -->
    <div v-if="dependencyList.length > 0" class="ba-section">
      <div class="ba-section-title">Dependencies ({{ dependencyList.length }})</div>
      <div class="ba-imports">
        <code v-for="(name, i) in dependencyList" :key="i" class="ba-import-item">{{ name }}</code>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BinaryAnalysis',
  props: {
    fileSignatures: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    executableSig() {
      return (
        this.fileSignatures.find(
          (s) =>
            s.name &&
            (s.name.includes('Windows Executable (PE)') ||
              s.name === 'ELF Binary' ||
              s.name.includes('Mach-O'))
        ) || null
      )
    },

    binaryDetails() {
      if (!this.executableSig) return null
      const d = this.executableSig.details
      if (!d || d.error) return null
      return d
    },

    fileFormat() {
      if (!this.executableSig) return ''
      const n = this.executableSig.name
      if (n.includes('PE')) return 'PE'
      if (n.includes('ELF')) return 'ELF'
      if (n.includes('Mach-O')) return 'MachO'
      return ''
    },

    headerFields() {
      const d = this.binaryDetails
      if (!d) return {}
      const f = {}

      if (this.fileFormat === 'PE') {
        if (d.machine) f['Machine'] = d.machine
        if (d.is64bit !== undefined)
          f['Architecture'] = d.is64bit ? '64-bit (PE32+)' : '32-bit (PE32)'
        if (d.subsystem) f['Subsystem'] = d.subsystem
        if (d.entryPoint) f['Entry Point'] = d.entryPoint
        if (d.imageBase) f['Image Base'] = d.imageBase
        if (d.timestamp) f['Timestamp'] = d.timestamp
        if (d.characteristics) f['Characteristics'] = d.characteristics.join(', ')
        if (d.isNet) f['.NET Assembly'] = 'Yes'
        if (d.hasCertificate !== undefined)
          f['Authenticode Signed'] = d.hasCertificate ? `Yes (${d.certificateSize} bytes)` : 'No'
        if (d.hasDebugInfo !== undefined) f['Debug Info'] = d.hasDebugInfo ? 'Present' : 'Stripped'
      } else if (this.fileFormat === 'ELF') {
        if (d.class) f['Class'] = d.class
        if (d.type) f['Type'] = d.type
        if (d.machine) f['Machine'] = d.machine
        if (d.entryPoint) f['Entry Point'] = d.entryPoint
        if (d.interpreter) f['Interpreter'] = d.interpreter
        if (d.sections !== undefined)
          f['Sections'] =
            typeof d.sections === 'number' ? d.sections : (d.sectionNames || []).length
        if (d.isStripped !== undefined) f['Stripped'] = d.isStripped ? 'Yes' : 'No'
        if (d.rpath) f['RPATH'] = d.rpath
        if (d.runpath) f['RUNPATH'] = d.runpath
      } else if (this.fileFormat === 'MachO') {
        if (d.type) f['Type'] = d.type
        if (d.architecture) f['Architecture'] = d.architecture
        if (d.fileType) f['File Type'] = d.fileType
        if (d.entryPoint) f['Entry Point'] = d.entryPoint
        if (d.minimumVersion) f['Min Version'] = d.minimumVersion
        if (d.buildVersion) {
          f['Platform'] = d.buildVersion.platform
          f['Min OS'] = d.buildVersion.minos
          f['SDK'] = d.buildVersion.sdk
        }
        if (d.hasCodeSignature !== undefined) f['Code Signed'] = d.hasCodeSignature ? 'Yes' : 'No'
        if (d.isEncrypted !== undefined) f['Encrypted'] = d.isEncrypted ? 'Yes' : 'No'
        if (d.loadCommands !== undefined) f['Load Commands'] = d.loadCommands
      }

      return f
    },

    securityFeatures() {
      const d = this.binaryDetails
      if (!d) return []
      const feats = []

      if (this.fileFormat === 'PE') {
        const s = d.security || {}
        feats.push({
          name: 'ASLR',
          status: s.aslr ? 'Enabled' : 'Disabled',
          icon: s.aslr ? '+' : '!',
          cls: s.aslr ? 'ba-sec-ok' : 'ba-sec-bad'
        })
        feats.push({
          name: 'DEP/NX',
          status: s.dep ? 'Enabled' : 'Disabled',
          icon: s.dep ? '+' : '!',
          cls: s.dep ? 'ba-sec-ok' : 'ba-sec-bad'
        })
        feats.push({
          name: 'CFG',
          status: s.cfg ? 'Enabled' : 'Disabled',
          icon: s.cfg ? '+' : '!',
          cls: s.cfg ? 'ba-sec-ok' : 'ba-sec-bad'
        })
        feats.push({
          name: 'High Entropy VA',
          status: s.highEntropyVA ? 'Enabled' : 'Disabled',
          icon: s.highEntropyVA ? '+' : '!',
          cls: s.highEntropyVA ? 'ba-sec-ok' : 'ba-sec-warn'
        })
        feats.push({
          name: 'SEH',
          status: s.noSEH ? 'Not Used' : 'Used',
          icon: s.noSEH ? '+' : '~',
          cls: s.noSEH ? 'ba-sec-ok' : 'ba-sec-info'
        })
        feats.push({
          name: 'Force Integrity',
          status: s.forceIntegrity ? 'Enabled' : 'Disabled',
          icon: s.forceIntegrity ? '+' : '~',
          cls: s.forceIntegrity ? 'ba-sec-ok' : 'ba-sec-info'
        })
        if (d.hasRWXSections)
          feats.push({ name: 'RWX Sections', status: 'Detected', icon: '!', cls: 'ba-sec-bad' })
      } else if (this.fileFormat === 'ELF') {
        if (d.pie !== undefined)
          feats.push({
            name: 'PIE/ASLR',
            status: d.pie ? 'Enabled' : 'Disabled',
            icon: d.pie ? '+' : '!',
            cls: d.pie ? 'ba-sec-ok' : 'ba-sec-bad'
          })
        if (d.relro)
          feats.push({
            name: 'RELRO',
            status: d.relro,
            icon: d.relro === 'full' ? '+' : d.relro === 'partial' ? '~' : '!',
            cls:
              d.relro === 'full'
                ? 'ba-sec-ok'
                : d.relro === 'partial'
                  ? 'ba-sec-warn'
                  : 'ba-sec-bad'
          })
        if (d.executableStack !== undefined)
          feats.push({
            name: 'NX Stack',
            status: d.executableStack ? 'Disabled (Exec Stack)' : 'Enabled',
            icon: d.executableStack ? '!' : '+',
            cls: d.executableStack ? 'ba-sec-bad' : 'ba-sec-ok'
          })
        if (d.textrel !== undefined)
          feats.push({
            name: 'TEXTREL',
            status: d.textrel ? 'Present' : 'None',
            icon: d.textrel ? '!' : '+',
            cls: d.textrel ? 'ba-sec-bad' : 'ba-sec-ok'
          })
        if (d.hasRWXSegments)
          feats.push({ name: 'RWX Segments', status: 'Detected', icon: '!', cls: 'ba-sec-bad' })
      } else if (this.fileFormat === 'MachO') {
        if (d.pie !== undefined)
          feats.push({
            name: 'PIE/ASLR',
            status: d.pie ? 'Enabled' : 'Disabled',
            icon: d.pie ? '+' : '!',
            cls: d.pie ? 'ba-sec-ok' : 'ba-sec-bad'
          })
        if (d.allowStackExecution !== undefined)
          feats.push({
            name: 'Stack Execution',
            status: d.allowStackExecution ? 'Allowed' : 'Blocked',
            icon: d.allowStackExecution ? '!' : '+',
            cls: d.allowStackExecution ? 'ba-sec-bad' : 'ba-sec-ok'
          })
        if (d.noHeapExecution !== undefined)
          feats.push({
            name: 'Heap Execution',
            status: d.noHeapExecution ? 'Blocked' : 'Allowed',
            icon: d.noHeapExecution ? '+' : '~',
            cls: d.noHeapExecution ? 'ba-sec-ok' : 'ba-sec-info'
          })
        if (d.hasRWXSegments)
          feats.push({ name: 'RWX Segments', status: 'Detected', icon: '!', cls: 'ba-sec-bad' })
      }

      return feats
    },

    sectionRows() {
      const d = this.binaryDetails
      if (!d) return []

      if (this.fileFormat === 'PE') {
        const secs = d.sections
        if (!Array.isArray(secs)) return []
        return secs.map((s) => ({
          name: s.name || '?',
          virtualSize: s.virtualSize !== undefined ? `0x${s.virtualSize.toString(16)}` : '-',
          rawSize: s.sizeOfRawData !== undefined ? `0x${s.sizeOfRawData.toString(16)}` : '-',
          flags: s.flags || '---',
          isRWX: !!s.isRWX
        }))
      }

      if (this.fileFormat === 'MachO') {
        const segs = d.segments
        if (!Array.isArray(segs)) return []
        return segs.map((s) => ({
          name: s.name || '?',
          virtualSize: s.vmsize !== undefined ? `0x${s.vmsize.toString(16)}` : '-',
          rawSize: '-',
          flags: s.initprot || '---',
          isRWX: !!s.isRWX
        }))
      }

      // ELF segments
      if (this.fileFormat === 'ELF') {
        const segs = d.segments
        if (!Array.isArray(segs)) return []
        return segs.map((s) => ({
          name: s.type || 'PT_LOAD',
          virtualSize: s.memsz !== undefined ? `0x${s.memsz.toString(16)}` : '-',
          rawSize: '-',
          flags: s.flags || '---',
          isRWX: s.flags === 'rwx'
        }))
      }

      return []
    },

    importList() {
      const d = this.binaryDetails
      if (!d) return []

      if (this.fileFormat === 'PE') {
        return Array.isArray(d.imports) ? d.imports : []
      }

      return []
    },

    importLabel() {
      if (this.fileFormat === 'PE') return 'DLLs'
      return 'libraries'
    },

    dependencyList() {
      const d = this.binaryDetails
      if (!d) return []

      if (this.fileFormat === 'ELF') {
        return Array.isArray(d.dependencies) ? d.dependencies : []
      }

      if (this.fileFormat === 'MachO') {
        return Array.isArray(d.dylibs) ? d.dylibs : []
      }

      return []
    },

    exportInfo() {
      const d = this.binaryDetails
      if (!d || !d.exports) return null
      if (typeof d.exports !== 'object') return null
      return d.exports
    }
  }
}
</script>

<style scoped>
.binary-analysis {
  margin-top: 24px;
  margin-bottom: 24px;
}

.binary-analysis h3 {
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.ba-section {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.ba-section-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

/* Header grid */
.ba-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.ba-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ba-label {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ba-value {
  color: var(--text-primary);
  font-size: 0.95rem;
  word-break: break-all;
}

.ba-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9rem;
}

/* Security features */
.ba-security-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ba-security-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 0.9rem;
  white-space: nowrap;
}

.ba-security-icon {
  font-weight: 700;
  font-size: 1rem;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.ba-security-name {
  font-weight: 600;
  flex-shrink: 0;
}

.ba-security-status {
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding-left: 4px;
}

.ba-sec-ok {
  background-color: rgba(72, 187, 120, 0.12);
  border: 1px solid rgba(72, 187, 120, 0.3);
}
.ba-sec-ok .ba-security-icon {
  color: rgb(72, 187, 120);
}
.ba-sec-ok .ba-security-name {
  color: rgb(72, 187, 120);
}

.ba-sec-bad {
  background-color: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
}
.ba-sec-bad .ba-security-icon {
  color: rgb(239, 68, 68);
}
.ba-sec-bad .ba-security-name {
  color: rgb(239, 68, 68);
}

.ba-sec-warn {
  background-color: rgba(237, 137, 54, 0.12);
  border: 1px solid rgba(237, 137, 54, 0.3);
}
.ba-sec-warn .ba-security-icon {
  color: rgb(237, 137, 54);
}
.ba-sec-warn .ba-security-name {
  color: rgb(237, 137, 54);
}

.ba-sec-info {
  background-color: rgba(99, 179, 237, 0.12);
  border: 1px solid rgba(99, 179, 237, 0.3);
}
.ba-sec-info .ba-security-icon {
  color: rgb(99, 179, 237);
}
.ba-sec-info .ba-security-name {
  color: rgb(99, 179, 237);
}

/* Sections table */
.ba-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.ba-table th {
  text-align: left;
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 6px 12px;
  border-bottom: 2px solid var(--border-color);
}

.ba-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.ba-table tr:last-child td {
  border-bottom: none;
}

.ba-row-warn {
  background-color: rgba(239, 68, 68, 0.08);
}

.ba-perm {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--bg-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
}

.ba-perm-rwx {
  background-color: rgba(239, 68, 68, 0.2);
  color: rgb(239, 68, 68);
  font-weight: 600;
}

/* Imports */
.ba-imports {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ba-import-item {
  padding: 4px 10px;
  border-radius: 4px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  color: var(--text-primary);
}
</style>
