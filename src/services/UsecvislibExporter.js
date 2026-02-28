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

const EXECUTABLE_TYPES = ['Windows Executable (PE)', 'ELF Binary', 'Mach-O']

class UsecvislibExporter {
  constructor() {
    this.apiUrl = 'http://localhost:8003'
    this.apiKey = ''
    logger.info('UsecvislibExporter initialized')
  }

  // ── Offline Exports ──

  generateBinVisData({
    fileBytes,
    entropy: _entropy,
    hashes,
    detectedFileType,
    fileSignatures,
    coloredBytes,
    fileName
  }) {
    logger.info('Generating BinVis data for:', fileName)

    let entropyAnalysis
    try {
      entropyAnalysis = calculateOptimizedEntropy(fileBytes)
    } catch (error) {
      logger.error('Entropy calculation failed:', error)
      entropyAnalysis = {
        globalEntropy: 0,
        entropyValues: [],
        highEntropyRegions: [],
        byteFrequencies: new Array(256).fill(0),
        statistics: {}
      }
    }

    const regions = this._mapColoredBytesToRegions(coloredBytes)

    const _sigDetails = fileSignatures && fileSignatures.length > 0 ? fileSignatures[0] : null

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
        blocks: entropyAnalysis.entropyValues.map((v) => ({
          offset: v.offset,
          entropy: parseFloat(v.entropy.toFixed(4)),
          size: v.size
        })),
        highEntropyRegions: entropyAnalysis.highEntropyRegions.map((r) => ({
          start: r.start,
          end: r.end,
          entropy: parseFloat(r.entropy.toFixed(4))
        })),
        statistics: entropyAnalysis.statistics
      },
      regions,
      signatures: fileSignatures
        ? fileSignatures.map((sig) => ({
            name: sig.name,
            extension: sig.extension,
            confidence: sig.confidence,
            offset: sig.offset,
            details: sig.details || {}
          }))
        : []
    }
  }

  generateAttackGraphConfig({ fileSignatures, detectedFileType, fileName, hashes: _hashes, entropy }) {
    const sig = fileSignatures && fileSignatures.length > 0 ? fileSignatures[0] : null
    const sigName = sig ? sig.name : ''

    if (!EXECUTABLE_TYPES.some((t) => sigName.includes(t))) {
      return {
        toml: null,
        error: 'Attack graph generation is only supported for PE, ELF, and Mach-O executables.'
      }
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

    hosts.push({
      id: 'binary',
      label: fileName || 'Binary',
      description: `Analyzed binary file (${detectedStr})`,
      zone: 'analysis'
    })

    if (sigName.includes('PE')) {
      hosts.push({
        id: 'target_system',
        label: 'Target Windows',
        description: 'Windows target system',
        zone: 'target',
        os: 'Windows'
      })
      this._mapPEVulnerabilities(details, vulnerabilities, privileges, exploits, entropy)
    } else if (sigName.includes('ELF')) {
      hosts.push({
        id: 'target_system',
        label: 'Target Linux',
        description: 'Linux target system',
        zone: 'target',
        os: 'Linux'
      })
      this._mapELFVulnerabilities(details, vulnerabilities, privileges, exploits, entropy)
    } else if (sigName.includes('Mach-O')) {
      hosts.push({
        id: 'target_system',
        label: 'Target macOS',
        description: 'macOS target system',
        zone: 'target',
        os: 'macOS'
      })
      this._mapMachOVulnerabilities(details, vulnerabilities, privileges, exploits, entropy)
    }

    this._mapEntropyVulnerabilities(entropy, vulnerabilities, exploits)

    networkEdges.push({ from: 'binary', to: 'target_system', label: 'Execution' })

    const toml = this._serializeToToml(
      graph,
      hosts,
      vulnerabilities,
      privileges,
      exploits,
      networkEdges
    )
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
    // Validate URL can be parsed
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('Invalid API URL: unable to parse')
    }

    // Only allow http: and https: protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `Invalid API URL: protocol "${parsed.protocol}" is not allowed (only http: and https:)`
      )
    }

    // Block private/internal IP ranges (except localhost/127.0.0.1 which is the default)
    const hostname = parsed.hostname
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'

    if (!isLocalhost) {
      // Resolve hostname to check for private IPs
      // Block 127.x.x.x (loopback, except 127.0.0.1 handled above)
      // Block 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x
      const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
      if (ipv4Match) {
        const [, a, b, _c, _d] = ipv4Match.map(Number)
        const isPrivate =
          a === 10 ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && b === 168) ||
          (a === 169 && b === 254) ||
          a === 127

        if (isPrivate) {
          throw new Error(
            `Invalid API URL: private/internal IP address "${hostname}" is not allowed`
          )
        }
      }
    }

    // Explicitly block AWS metadata endpoint
    if (hostname === '169.254.169.254') {
      throw new Error('Invalid API URL: AWS metadata endpoint is not allowed')
    }

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
      const healthRes = await fetch(`${this.apiUrl}/health`, {
        signal: controller.signal,
        headers: this._authHeaders()
      })
      if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`)
      const health = await healthRes.json()

      let styles = []
      try {
        const stylesRes = await fetch(`${this.apiUrl}/styles`, {
          signal: controller.signal,
          headers: this._authHeaders()
        })
        if (stylesRes.ok) {
          styles = await stylesRes.json()
        }
      } catch {
        logger.warn('Could not fetch styles')
      }

      return {
        available: true,
        version: health.version || 'unknown',
        styles: Array.isArray(styles) ? styles : [],
        error: null
      }
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

  async requestVisualization(
    fileBytes,
    { visType = 'entropy', style = 'bv_default', format = 'png' } = {}
  ) {
    logger.info(`Requesting ${visType} visualization (${style}, ${format})`)
    const formData = new FormData()
    formData.append(
      'file',
      new Blob([fileBytes], { type: 'application/octet-stream' }),
      'binary.bin'
    )

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

  _mapPEVulnerabilities(details, vulnerabilities, privileges, exploits, _entropy3) {
    const chars = details.characteristics || []
    const security = details.security || {}

    privileges.push({
      id: 'priv_exec',
      label: 'Binary Execution',
      description: 'Execute the binary on target',
      host: 'target_system',
      level: 'user'
    })

    // 1. DLL Hijacking
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

    // 2. Timestamp anomaly
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

    // 3. Native subsystem
    const subsystem = details.subsystem || ''
    if (subsystem.includes('Native')) {
      privileges.push({
        id: 'priv_kernel',
        label: 'Kernel Access',
        description: 'Kernel-level execution',
        host: 'target_system',
        level: 'kernel'
      })
    }

    // 4. No ASLR
    if (security.aslr === false) {
      vulnerabilities.push({
        id: 'vuln_no_aslr',
        label: 'No ASLR (DYNAMIC_BASE missing)',
        description:
          'Binary lacks ASLR support, loaded at predictable address enabling reliable exploitation.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_fixed_addr',
        label: 'Fixed Address Exploitation',
        description: 'Exploit predictable load address due to missing ASLR.',
        vulnerability: 'vuln_no_aslr',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // 5. No DEP/NX
    if (security.dep === false) {
      vulnerabilities.push({
        id: 'vuln_no_dep',
        label: 'No DEP/NX (NX_COMPAT missing)',
        description: 'Binary lacks DEP/NX support, allowing code execution on data pages.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_stack_exec',
        label: 'Stack-Based Code Execution',
        description: 'Execute shellcode on stack due to missing DEP/NX protection.',
        vulnerability: 'vuln_no_dep',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // 6. No CFG
    if (security.cfg === false) {
      vulnerabilities.push({
        id: 'vuln_no_cfg',
        label: 'No Control Flow Guard',
        description: 'Binary lacks Control Flow Guard, allowing indirect call target manipulation.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_cfg_bypass',
        label: 'Control Flow Hijacking',
        description: 'Hijack control flow via indirect call target corruption.',
        vulnerability: 'vuln_no_cfg',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // 7. SEH exploitation (when noSEH is false, SEH is used)
    if (!security.noSEH) {
      vulnerabilities.push({
        id: 'vuln_seh',
        label: 'SEH Chain Exploitation',
        description:
          'Binary uses Structured Exception Handling, potentially vulnerable to SEH overwrite attacks.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_seh_overwrite',
        label: 'SEH Chain Overwrite',
        description: 'Overwrite SEH chain to redirect exception handling for code execution.',
        vulnerability: 'vuln_seh',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // 8. No code integrity enforcement
    if (security.forceIntegrity === false) {
      vulnerabilities.push({
        id: 'vuln_no_integrity',
        label: 'No Code Integrity Enforcement',
        description: 'Binary does not enforce code integrity checks at load time.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N',
        affected_host: 'target_system'
      })
    }

    // 9. RWX sections
    if (details.hasRWXSections) {
      vulnerabilities.push({
        id: 'vuln_rwx',
        label: 'RWX Memory Sections',
        description:
          'Binary contains sections with read-write-execute permissions, enabling code injection.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_memory_corruption',
        label: 'Memory Corruption Exploitation',
        description: 'Exploit RWX memory sections for arbitrary code execution.',
        vulnerability: 'vuln_rwx',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // 10. Unsigned binary
    if (details.hasCertificate === false) {
      vulnerabilities.push({
        id: 'vuln_unsigned',
        label: 'Unsigned Binary',
        description:
          'Binary lacks Authenticode signature, allowing modification without detection.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_unsigned_exec',
        label: 'Unsigned Code Execution',
        description: 'Execute modified unsigned binary without signature verification.',
        vulnerability: 'vuln_unsigned',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }

    // 11. Debug info present
    if (details.hasDebugInfo) {
      vulnerabilities.push({
        id: 'vuln_debug_info',
        label: 'Debug Information Present',
        description:
          'Binary contains debug information, aiding reverse engineering and vulnerability discovery.',
        cvss_vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N',
        affected_host: 'binary'
      })
    }

    // 12. .NET managed binary
    if (details.isNet) {
      vulnerabilities.push({
        id: 'vuln_dotnet',
        label: '.NET Managed Binary',
        description: 'Binary is a .NET assembly, easily decompilable to source code.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
        affected_host: 'binary'
      })
      exploits.push({
        id: 'exp_decompile',
        label: 'Managed Code Decompilation',
        description: 'Decompile .NET assembly to recover source code and embedded secrets.',
        vulnerability: 'vuln_dotnet',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }

    // 13. Partial ASLR (64-bit without high entropy VA)
    if (details.is64bit && !security.highEntropyVA) {
      vulnerabilities.push({
        id: 'vuln_partial_aslr',
        label: 'Partial ASLR (no High Entropy VA)',
        description:
          '64-bit binary without HIGH_ENTROPY_VA limits ASLR randomization to 32-bit address space.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:N',
        affected_host: 'target_system'
      })
    }

    // Privilege escalation paths
    if (subsystem.includes('Native') || details.hasRWXSections) {
      if (!privileges.some((p) => p.id === 'priv_system')) {
        privileges.push({
          id: 'priv_system',
          label: 'SYSTEM Access',
          description: 'Escalated privileges via native subsystem or RWX memory exploitation',
          host: 'target_system',
          level: 'system'
        })
      }
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

  _mapELFVulnerabilities(details, vulnerabilities, privileges, exploits, _entropy4) {
    const elfType = details.type || ''

    privileges.push({
      id: 'priv_exec',
      label: 'Binary Execution',
      description: 'Execute the binary on target',
      host: 'target_system',
      level: 'user'
    })

    if (elfType === 'Executable') {
      vulnerabilities.push({
        id: 'vuln_suid_potential',
        label: 'SUID Privilege Escalation',
        description: 'ELF executable could be exploited if installed with SUID bit.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
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

    // No PIE — fixed load address
    if (details.pie === false) {
      vulnerabilities.push({
        id: 'vuln_no_pie',
        label: 'No ASLR (PIE disabled)',
        description:
          'Binary is not position-independent, loaded at fixed address enabling reliable exploitation.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_fixed_addr',
        label: 'Fixed Address Exploitation',
        description: 'Exploit fixed load address due to missing PIE.',
        vulnerability: 'vuln_no_pie',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // Executable stack
    if (details.executableStack) {
      vulnerabilities.push({
        id: 'vuln_exec_stack',
        label: 'Executable Stack',
        description: 'PT_GNU_STACK has execute permission, enabling stack-based code execution.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_stack_exec',
        label: 'Stack-Based Code Execution',
        description: 'Execute shellcode on stack due to executable stack permission.',
        vulnerability: 'vuln_exec_stack',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // No RELRO — GOT overwrite
    if (details.relro === 'none') {
      vulnerabilities.push({
        id: 'vuln_no_relro',
        label: 'No RELRO Protection',
        description: 'Binary lacks RELRO, allowing GOT overwrite attacks.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_got_overwrite',
        label: 'GOT Overwrite Exploitation',
        description: 'Overwrite Global Offset Table entries to redirect control flow.',
        vulnerability: 'vuln_no_relro',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // RWX memory segments
    if (details.hasRWXSegments) {
      vulnerabilities.push({
        id: 'vuln_rwx',
        label: 'RWX Memory Segments',
        description:
          'Binary contains segments with read-write-execute permissions, enabling code injection.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_memory_corruption',
        label: 'Memory Corruption Exploitation',
        description: 'Exploit RWX memory segments for arbitrary code execution.',
        vulnerability: 'vuln_rwx',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // Stripped binary
    if (details.isStripped) {
      vulnerabilities.push({
        id: 'vuln_stripped',
        label: 'Stripped Binary',
        description: 'Symbol table removed, hindering reverse engineering and forensic analysis.',
        cvss_vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N',
        affected_host: 'binary'
      })
    }

    // Rpath / Runpath injection
    if (details.rpath || details.runpath) {
      const paths = [details.rpath, details.runpath].filter(Boolean).join(', ')
      vulnerabilities.push({
        id: 'vuln_rpath',
        label: 'Rpath/Runpath Injection Risk',
        description: `Binary specifies library search paths (${paths}), potentially exploitable for library injection.`,
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_rpath_inject',
        label: 'Library Path Injection',
        description: 'Inject malicious library via rpath/runpath controlled directory.',
        vulnerability: 'vuln_rpath',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }

    // Text relocations
    if (details.textrel) {
      vulnerabilities.push({
        id: 'vuln_textrel',
        label: 'Text Relocations Present',
        description: 'Binary requires text relocations, making code sections writable at runtime.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_textrel',
        label: 'Code Section Modification',
        description: 'Modify writable code sections due to text relocations.',
        vulnerability: 'vuln_textrel',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    // Privilege escalation path for executable stack or shared object
    if (details.executableStack || elfType === 'Shared object') {
      if (!privileges.some((p) => p.id === 'priv_root')) {
        privileges.push({
          id: 'priv_root',
          label: 'Root Access',
          description: 'Escalated privileges via stack execution or library injection',
          host: 'target_system',
          level: 'root'
        })
      }
    }
    // Also add priv_root for SUID path if not yet added
    if (elfType === 'Executable' && !privileges.some((p) => p.id === 'priv_root')) {
      privileges.push({
        id: 'priv_root',
        label: 'Root Access',
        description: 'Root-level access via SUID',
        host: 'target_system',
        level: 'root'
      })
    }
  }

  _mapMachOVulnerabilities(details, vulnerabilities, privileges, exploits, _entropy5) {
    privileges.push({
      id: 'priv_exec',
      label: 'Binary Execution',
      description: 'Execute the binary on target',
      host: 'target_system',
      level: 'user'
    })

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

    if (!details.hasCodeSignature) {
      vulnerabilities.push({
        id: 'vuln_no_codesign',
        label: 'Missing Code Signature',
        description: 'Binary lacks code signature, allowing modification without detection.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_unsigned_exec',
        label: 'Unsigned Code Execution',
        description: 'Execute modified unsigned binary without Gatekeeper detection.',
        vulnerability: 'vuln_no_codesign',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }

    if (details.isEncrypted) {
      vulnerabilities.push({
        id: 'vuln_encrypted',
        label: 'Encrypted Binary',
        description:
          'Binary uses encryption (cryptid set), indicating protected or App Store binary.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:H/I:N/A:N',
        affected_host: 'binary'
      })
      exploits.push({
        id: 'exp_encryption_bypass',
        label: 'Encryption Analysis Bypass',
        description: 'Decrypt binary at runtime to analyze protected code.',
        vulnerability: 'vuln_encrypted',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    if (details.type === 'Universal Binary') {
      vulnerabilities.push({
        id: 'vuln_universal',
        label: 'Multi-Architecture Binary',
        description:
          'Universal binary contains multiple architecture slices, expanding attack surface.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N',
        affected_host: 'binary'
      })
      exploits.push({
        id: 'exp_cross_arch',
        label: 'Cross-Architecture Exploitation',
        description: 'Target weaker architecture slice in universal binary.',
        vulnerability: 'vuln_universal',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }

    if (details.hasRWXSegments) {
      vulnerabilities.push({
        id: 'vuln_rwx',
        label: 'RWX Memory Segments',
        description:
          'Binary contains segments with read-write-execute permissions, enabling code injection.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_memory_corruption',
        label: 'Memory Corruption Exploitation',
        description: 'Exploit RWX memory segments for arbitrary code execution.',
        vulnerability: 'vuln_rwx',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    if (details.allowStackExecution) {
      vulnerabilities.push({
        id: 'vuln_stack_exec',
        label: 'Executable Stack',
        description:
          'Binary allows stack execution (MH_ALLOW_STACK_EXECUTION), enabling stack-based attacks.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_stack_exec',
        label: 'Stack-Based Code Execution',
        description: 'Execute shellcode on stack due to executable stack permission.',
        vulnerability: 'vuln_stack_exec',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    if (details.pie === false) {
      vulnerabilities.push({
        id: 'vuln_no_pie',
        label: 'No ASLR (PIE disabled)',
        description:
          'Binary is not position-independent, loaded at fixed address enabling reliable exploitation.',
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_fixed_addr',
        label: 'Fixed Address Exploitation',
        description: 'Exploit fixed load address due to missing PIE flag.',
        vulnerability: 'vuln_no_pie',
        precondition: 'priv_exec',
        postcondition: 'priv_exec'
      })
    }

    const weakDylibs = details.weakDylibs || []
    if (weakDylibs.length > 0) {
      vulnerabilities.push({
        id: 'vuln_weak_dylib',
        label: 'Weak Dylib References',
        description: `Binary references ${weakDylibs.length} weak dylib(s) that may not be present, enabling injection.`,
        cvss_vector: 'CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
        affected_host: 'target_system'
      })
      exploits.push({
        id: 'exp_weak_dylib',
        label: 'Weak Dylib Injection',
        description: 'Inject malicious dylib in place of missing weak dependency.',
        vulnerability: 'vuln_weak_dylib',
        precondition: 'binary',
        postcondition: 'priv_exec'
      })
    }

    // Add root privilege escalation path for dylibs and stack execution
    if (details.fileType === 'Dynamic Library' || details.allowStackExecution) {
      privileges.push({
        id: 'priv_root',
        label: 'Root Access',
        description: 'Escalated privileges via dylib injection or stack execution',
        host: 'target_system',
        level: 'root'
      })
    }
  }

  _mapEntropyVulnerabilities(entropy, vulnerabilities, _exploits) {
    const globalEntropy =
      typeof entropy === 'number'
        ? entropy
        : entropy && entropy.globalEntropy
          ? entropy.globalEntropy
          : null
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
