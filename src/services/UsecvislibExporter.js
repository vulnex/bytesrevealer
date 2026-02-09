/**
 * VULNEX -Bytes Revealer-
 *
 * File: UsecvislibExporter.js
 * Author: Simon Roses Femerling
 * Created: 2026-02-09
 * Last Modified: 2026-02-09
 * Version: 0.4
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { createLogger } from '../utils/logger'
import { calculateOptimizedEntropy } from '../utils/entropyOptimized'

const logger = createLogger('UsecvislibExporter')

const EXECUTABLE_TYPES = ['Windows Executable (PE)', 'ELF Binary', 'Mach-O Executable']

class UsecvislibExporter {
  constructor() {
    this.apiUrl = 'http://localhost:8003'
    this.apiKey = ''
    logger.info('UsecvislibExporter initialized')
  }

  // ── Offline Exports ──

  generateBinVisData({ fileBytes, entropy, hashes, detectedFileType, fileSignatures, coloredBytes, fileName }) {
    logger.info('Generating BinVis data for:', fileName)

    let entropyAnalysis
    try {
      entropyAnalysis = calculateOptimizedEntropy(fileBytes)
    } catch (error) {
      logger.error('Entropy calculation failed:', error)
      entropyAnalysis = { globalEntropy: 0, entropyValues: [], highEntropyRegions: [], byteFrequencies: new Array(256).fill(0), statistics: {} }
    }

    const regions = this._mapColoredBytesToRegions(coloredBytes)

    const sigDetails = fileSignatures && fileSignatures.length > 0 ? fileSignatures[0] : null

    return {
      format: 'usecvislib-binvis',
      version: '1.0',
      metadata: {
        fileName: fileName || 'unknown',
        fileSize: fileBytes ? fileBytes.length : 0,
        detectedType: detectedFileType || 'Unknown',
        generatedBy: 'VULNEX Bytes Revealer',
        generatedAt: new Date().toISOString(),
        hashes: hashes || {}
      },
      byteDistribution: {
        frequencies: Array.from(entropyAnalysis.byteFrequencies),
        totalBytes: entropyAnalysis.totalBytes || (fileBytes ? fileBytes.length : 0)
      },
      entropyAnalysis: {
        globalEntropy: entropyAnalysis.globalEntropy,
        blockSize: entropyAnalysis.blockSize,
        blocks: entropyAnalysis.entropyValues.map(v => ({
          offset: v.offset,
          entropy: parseFloat(v.entropy.toFixed(4)),
          size: v.size
        })),
        highEntropyRegions: entropyAnalysis.highEntropyRegions.map(r => ({
          start: r.start,
          end: r.end,
          entropy: parseFloat(r.entropy.toFixed(4))
        })),
        statistics: entropyAnalysis.statistics
      },
      regions,
      signatures: fileSignatures ? fileSignatures.map(sig => ({
        name: sig.name,
        extension: sig.extension,
        confidence: sig.confidence,
        offset: sig.offset,
        details: sig.details || {}
      })) : []
    }
  }

  generateAttackGraphConfig({ fileSignatures, detectedFileType, fileName, hashes, entropy }) {
    const sig = fileSignatures && fileSignatures.length > 0 ? fileSignatures[0] : null
    const sigName = sig ? sig.name : ''

    if (!EXECUTABLE_TYPES.some(t => sigName.includes(t))) {
      return { toml: null, error: 'Attack graph generation is only supported for PE, ELF, and Mach-O executables.' }
    }

    logger.info('Generating attack graph config for:', fileName)

    const details = sig.details || {}
    const detectedStr = typeof detectedFileType === 'string' ? detectedFileType : sigName
    const graph = {
      name: `Binary Analysis: ${fileName || 'binary'}`,
      description: `Attack graph for ${detectedStr}`,
      type: 'Attack Graph',
      version: '1.0.0',
      date: new Date().toISOString().slice(0, 10),
      author: 'VULNEX Bytes Revealer'
    }
    const hosts = []
    const vulnerabilities = []
    const privileges = []
    const exploits = []
    const networkEdges = []

    hosts.push({ id: 'binary', label: fileName || 'Binary', description: `Analyzed binary file (${detectedStr})`, zone: 'analysis' })

    if (sigName.includes('PE')) {
      hosts.push({ id: 'target_system', label: 'Target Windows', description: 'Windows target system', zone: 'target', os: 'Windows' })
      this._mapPEVulnerabilities(details, vulnerabilities, privileges, exploits, entropy)
    } else if (sigName.includes('ELF')) {
      hosts.push({ id: 'target_system', label: 'Target Linux', description: 'Linux target system', zone: 'target', os: 'Linux' })
      this._mapELFVulnerabilities(details, vulnerabilities, privileges, exploits, entropy)
    } else if (sigName.includes('Mach-O')) {
      hosts.push({ id: 'target_system', label: 'Target macOS', description: 'macOS target system', zone: 'target', os: 'macOS' })
      this._mapMachOVulnerabilities(details, vulnerabilities, privileges, exploits, entropy)
    }

    this._mapEntropyVulnerabilities(entropy, vulnerabilities, exploits)

    networkEdges.push({ from: 'binary', to: 'target_system', label: 'Execution' })

    const toml = this._serializeToToml(graph, hosts, vulnerabilities, privileges, exploits, networkEdges)
    const summary = {
      type: sigName,
      hosts: hosts.length,
      vulnerabilities: vulnerabilities.length,
      privileges: privileges.length,
      exploits: exploits.length
    }

    return { toml, summary }
  }

  // ── API Integration ──

  setApiUrl(url) {
    this.apiUrl = url.replace(/\/+$/, '')
    logger.info('API URL set to:', this.apiUrl)
  }

  setApiKey(key) {
    this.apiKey = key || ''
  }

  _authHeaders() {
    const headers = {}
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey
    }
    return headers
  }

  async testConnection() {
    logger.info('Testing connection to:', this.apiUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const healthRes = await fetch(`${this.apiUrl}/health`, { signal: controller.signal, headers: this._authHeaders() })
      if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`)
      const health = await healthRes.json()

      let styles = []
      try {
        const stylesRes = await fetch(`${this.apiUrl}/styles`, { signal: controller.signal, headers: this._authHeaders() })
        if (stylesRes.ok) {
          styles = await stylesRes.json()
        }
      } catch {
        logger.warn('Could not fetch styles')
      }

      return { available: true, version: health.version || 'unknown', styles: Array.isArray(styles) ? styles : [], error: null }
    } catch (error) {
      logger.error('Connection test failed:', error)
      const isCors = error instanceof TypeError && error.message === 'Failed to fetch'
      const errorMsg = isCors
        ? 'CORS error: The API server must allow cross-origin requests. Start USecVisLib with --cors-allow-origins flag.'
        : error.message
      return { available: false, version: null, styles: [], error: errorMsg }
    } finally {
      clearTimeout(timeout)
    }
  }

  async requestVisualization(fileBytes, { visType = 'entropy', style = 'bv_default', format = 'png' } = {}) {
    logger.info(`Requesting ${visType} visualization (${style}, ${format})`)
    const formData = new FormData()
    formData.append('file', new Blob([fileBytes], { type: 'application/octet-stream' }), 'binary.bin')

    const params = new URLSearchParams({ visualization_type: visType, style, format })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch(`${this.apiUrl}/visualize/binary?${params}`, {
        method: 'POST',
        headers: this._authHeaders(),
        body: formData,
        signal: controller.signal
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Visualization failed (${res.status}): ${text}`)
      }
      return await res.blob()
    } finally {
      clearTimeout(timeout)
    }
  }

  async requestAttackGraphVisualization(tomlConfig, { style = 'default', format = 'png' } = {}) {
    logger.info(`Requesting attack graph visualization (${style}, ${format})`)
    const formData = new FormData()
    formData.append('config', new Blob([tomlConfig], { type: 'text/plain' }), 'attack-graph.toml')
    formData.append('style', style)
    formData.append('format', format)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const res = await fetch(`${this.apiUrl}/visualize/attack-graph`, {
        method: 'POST',
        headers: this._authHeaders(),
        body: formData,
        signal: controller.signal
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Attack graph visualization failed (${res.status}): ${text}`)
      }
      return await res.blob()
    } finally {
      clearTimeout(timeout)
    }
  }

  // ── Download Helpers ──

  downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    this._triggerDownload(blob, filename)
  }

  downloadToml(tomlString, filename) {
    const blob = new Blob([tomlString], { type: 'text/plain' })
    this._triggerDownload(blob, filename)
  }

  downloadBlob(blob, filename) {
    this._triggerDownload(blob, filename)
  }

  // ── Private Helpers ──

  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  _mapColoredBytesToRegions(coloredBytes) {
    if (!coloredBytes || !Array.isArray(coloredBytes) || coloredBytes.length === 0) return []

    const regions = []
    let current = null

    for (let i = 0; i < coloredBytes.length; i++) {
      const entry = coloredBytes[i]
      const color = entry && entry.color ? entry.color : null
      const label = entry && entry.label ? entry.label : null

      if (color && label) {
        if (current && current.color === color && current.label === label) {
          current.end = i
        } else {
          if (current) regions.push(current)
          current = { start: i, end: i, color, label }
        }
      } else {
        if (current) {
          regions.push(current)
          current = null
        }
      }
    }

    if (current) regions.push(current)
    return regions
  }

  _mapPEVulnerabilities(details, vulnerabilities, privileges, exploits, entropy) {
    const chars = details.characteristics || []

    privileges.push({ id: 'priv_exec', label: 'Binary Execution', description: 'Execute the binary on target', host: 'target_system', level: 'user' })

    if (chars.includes('DLL')) {
      vulnerabilities.push({
        id: 'vuln_dll_hijack',
        label: 'DLL Hijacking Risk',
        description: 'Binary is a DLL, potentially vulnerable to DLL search order hijacking.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_dll_hijack',
        label: 'DLL Search Order Hijacking',
        description: 'DLL search order hijacking via malicious DLL placement.',
        vulnerability: 'vuln_dll_hijack',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }

    const ts = details.timestamp
    if (ts && (ts === '1970-01-01T00:00:00.000Z' || new Date(ts).getFullYear() < 2000)) {
      vulnerabilities.push({
        id: 'vuln_timestamp_anomaly',
        label: 'Timestamp Anomaly',
        description: `PE timestamp is suspicious: ${ts}. May indicate tampering or packing.`,
        cvss_vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N',
        affected_host: 'binary'
      })
    }

    const subsystem = details.subsystem || ''
    if (subsystem.includes('Native')) {
      privileges.push({ id: 'priv_kernel', label: 'Kernel Access', description: 'Kernel-level execution', host: 'target_system', level: 'kernel' })
    }

    if (!chars.includes('DLL')) {
      exploits.push({
        id: 'exp_exec',
        label: 'Binary Execution',
        description: 'Execute the PE binary on target system.',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }
  }

  _mapELFVulnerabilities(details, vulnerabilities, privileges, exploits, entropy) {
    const elfType = details.type || ''

    privileges.push({ id: 'priv_exec', label: 'Binary Execution', description: 'Execute the binary on target', host: 'target_system', level: 'user' })

    if (elfType === 'Executable') {
      vulnerabilities.push({
        id: 'vuln_suid_potential',
        label: 'SUID Privilege Escalation',
        description: 'ELF executable could be exploited if installed with SUID bit.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      privileges.push({ id: 'priv_root', label: 'Root Access', description: 'Root-level access via SUID', host: 'target_system', level: 'root' })
      exploits.push({
        id: 'exp_exec',
        label: 'Binary Execution',
        description: 'Execute the ELF binary on target system.',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
      exploits.push({
        id: 'exp_suid',
        label: 'SUID Exploitation',
        description: 'SUID exploitation for privilege escalation.',
        vulnerability: 'vuln_suid_potential',
        precondition: 'priv_exec',
        postcondition: 'priv_root'
      })
    }

    if (elfType === 'Shared object') {
      vulnerabilities.push({
        id: 'vuln_lib_injection',
        label: 'Library Injection Risk',
        description: 'Shared object may be susceptible to LD_PRELOAD or rpath injection.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_lib_inject',
        label: 'Library Injection',
        description: 'Library injection via LD_PRELOAD or rpath manipulation.',
        vulnerability: 'vuln_lib_injection',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }
  }

  _mapMachOVulnerabilities(details, vulnerabilities, privileges, exploits, entropy) {
    privileges.push({ id: 'priv_exec', label: 'Binary Execution', description: 'Execute the binary on target', host: 'target_system', level: 'user' })

    if (details.isDynamicallyLinked) {
      vulnerabilities.push({
        id: 'vuln_dylib_hijack',
        label: 'Dylib Hijacking Risk',
        description: 'Dynamically linked Mach-O binary may be vulnerable to dylib hijacking.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_dylib_hijack',
        label: 'Dylib Hijacking',
        description: 'Dylib hijacking via weak or missing library references.',
        vulnerability: 'vuln_dylib_hijack',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    } else {
      exploits.push({
        id: 'exp_exec',
        label: 'Binary Execution',
        description: 'Execute the Mach-O binary on target system.',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }
  }

  _mapEntropyVulnerabilities(entropy, vulnerabilities, exploits) {
    const globalEntropy = typeof entropy === 'number' ? entropy : (entropy && entropy.globalEntropy ? entropy.globalEntropy : null)
    if (globalEntropy !== null && globalEntropy > 7.5) {
      vulnerabilities.push({
        id: 'vuln_packing',
        label: 'Packing/Obfuscation Detected',
        description: `High global entropy (${globalEntropy.toFixed(2)}) suggests binary may be packed or obfuscated.`,
        cvss_vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N',
        affected_host: 'binary'
      })
    }
  }

  _serializeToToml(graph, hosts, vulnerabilities, privileges, exploits, networkEdges) {
    const lines = []

    lines.push('[graph]')
    for (const [k, v] of Object.entries(graph)) {
      lines.push(`${k} = "${this._escToml(v)}"`)
    }
    lines.push('')

    for (const h of hosts) {
      lines.push('[[hosts]]')
      this._pushTomlFields(lines, h)
      lines.push('')
    }

    for (const v of vulnerabilities) {
      lines.push('[[vulnerabilities]]')
      this._pushTomlFields(lines, v)
      lines.push('')
    }

    for (const p of privileges) {
      lines.push('[[privileges]]')
      this._pushTomlFields(lines, p)
      lines.push('')
    }

    for (const e of exploits) {
      lines.push('[[exploits]]')
      this._pushTomlFields(lines, e)
      lines.push('')
    }

    if (networkEdges && networkEdges.length > 0) {
      for (const ne of networkEdges) {
        lines.push('[[network_edges]]')
        this._pushTomlFields(lines, ne)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  _pushTomlFields(lines, obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue
      if (typeof v === 'number') {
        lines.push(`${k} = ${v}`)
      } else if (typeof v === 'boolean') {
        lines.push(`${k} = ${v}`)
      } else {
        lines.push(`${k} = "${this._escToml(v)}"`)
      }
    }
  }

  _escToml(str) {
    if (!str) return ''
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
  }
}

export const usecvislibExporter = new UsecvislibExporter()
export { UsecvislibExporter }
