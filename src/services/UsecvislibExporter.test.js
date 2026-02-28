import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the entropy module before importing the exporter
vi.mock('../utils/entropyOptimized', () => ({
  calculateOptimizedEntropy: vi.fn(() => ({
    globalEntropy: 5.5,
    blockSize: 256,
    totalBytes: 4,
    entropyValues: [{ offset: 0, entropy: 5.5, size: 256 }],
    highEntropyRegions: [{ start: 0, end: 100, entropy: 7.8 }],
    byteFrequencies: new Array(256).fill(1),
    statistics: { mean: 5.5, min: 3.0, max: 7.8 }
  }))
}))

import { UsecvislibExporter, usecvislibExporter } from './UsecvislibExporter.js'
import { calculateOptimizedEntropy } from '../utils/entropyOptimized'

describe('UsecvislibExporter', () => {
  let exporter

  beforeEach(() => {
    exporter = new UsecvislibExporter()
    vi.clearAllMocks()
  })

  // ── Singleton Export ──

  describe('module exports', () => {
    it('exports a singleton instance', () => {
      expect(usecvislibExporter).toBeInstanceOf(UsecvislibExporter)
    })

    it('exports the class itself', () => {
      expect(UsecvislibExporter).toBeTypeOf('function')
    })
  })

  // ── Constructor ──

  describe('constructor', () => {
    it('sets default apiUrl', () => {
      expect(exporter.apiUrl).toBe('http://localhost:8003')
    })

    it('sets empty apiKey', () => {
      expect(exporter.apiKey).toBe('')
    })
  })

  // ── setApiUrl ──

  describe('setApiUrl()', () => {
    it('accepts a valid http URL', () => {
      exporter.setApiUrl('http://example.com:8003')
      expect(exporter.apiUrl).toBe('http://example.com:8003')
    })

    it('accepts a valid https URL', () => {
      exporter.setApiUrl('https://api.example.com')
      expect(exporter.apiUrl).toBe('https://api.example.com')
    })

    it('strips trailing slashes', () => {
      exporter.setApiUrl('http://example.com:8003///')
      expect(exporter.apiUrl).toBe('http://example.com:8003')
    })

    it('allows localhost', () => {
      exporter.setApiUrl('http://localhost:9000')
      expect(exporter.apiUrl).toBe('http://localhost:9000')
    })

    it('allows 127.0.0.1', () => {
      exporter.setApiUrl('http://127.0.0.1:9000')
      expect(exporter.apiUrl).toBe('http://127.0.0.1:9000')
    })

    it('throws on invalid URL', () => {
      expect(() => exporter.setApiUrl('not-a-url')).toThrow('Invalid API URL: unable to parse')
    })

    it('throws on ftp protocol', () => {
      expect(() => exporter.setApiUrl('ftp://example.com')).toThrow(
        'protocol "ftp:" is not allowed'
      )
    })

    it('throws on 10.x.x.x private IP', () => {
      expect(() => exporter.setApiUrl('http://10.0.0.1')).toThrow('private/internal IP address')
    })

    it('throws on 172.16.x.x private IP', () => {
      expect(() => exporter.setApiUrl('http://172.16.0.1')).toThrow('private/internal IP address')
    })

    it('throws on 172.31.x.x private IP', () => {
      expect(() => exporter.setApiUrl('http://172.31.255.255')).toThrow(
        'private/internal IP address'
      )
    })

    it('throws on 192.168.x.x private IP', () => {
      expect(() => exporter.setApiUrl('http://192.168.1.1')).toThrow('private/internal IP address')
    })

    it('throws on 169.254.x.x link-local IP', () => {
      expect(() => exporter.setApiUrl('http://169.254.1.1')).toThrow('private/internal IP address')
    })

    it('throws on 127.x.x.x loopback (non-127.0.0.1)', () => {
      expect(() => exporter.setApiUrl('http://127.0.0.2')).toThrow('private/internal IP address')
    })

    it('allows public IP addresses', () => {
      exporter.setApiUrl('http://8.8.8.8:8003')
      expect(exporter.apiUrl).toBe('http://8.8.8.8:8003')
    })

    it('allows non-private 172 range (e.g., 172.32.0.1)', () => {
      exporter.setApiUrl('http://172.32.0.1:8003')
      expect(exporter.apiUrl).toBe('http://172.32.0.1:8003')
    })
  })

  // ── setApiKey ──

  describe('setApiKey()', () => {
    it('sets the API key', () => {
      exporter.setApiKey('my-secret-key')
      expect(exporter.apiKey).toBe('my-secret-key')
    })

    it('sets empty string for falsy input', () => {
      exporter.setApiKey(null)
      expect(exporter.apiKey).toBe('')

      exporter.setApiKey(undefined)
      expect(exporter.apiKey).toBe('')

      exporter.setApiKey('')
      expect(exporter.apiKey).toBe('')
    })
  })

  // ── _authHeaders ──

  describe('_authHeaders()', () => {
    it('returns empty object when no API key set', () => {
      expect(exporter._authHeaders()).toEqual({})
    })

    it('returns X-API-Key header when API key is set', () => {
      exporter.setApiKey('secret')
      expect(exporter._authHeaders()).toEqual({ 'X-API-Key': 'secret' })
    })
  })

  // ── generateBinVisData ──

  describe('generateBinVisData()', () => {
    const fileBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const baseInput = {
      fileBytes,
      entropy: 5.5,
      hashes: { md5: 'abc', sha256: 'def' },
      detectedFileType: 'PE Executable',
      fileSignatures: [
        { name: 'PE', extension: '.exe', confidence: 0.9, offset: 0, details: { arch: 'x64' } }
      ],
      coloredBytes: [],
      fileName: 'test.exe'
    }

    it('returns correct format and version', () => {
      const result = exporter.generateBinVisData(baseInput)
      expect(result.format).toBe('usecvislib-binvis')
      expect(result.version).toBe('1.0')
    })

    it('includes metadata with fileName', () => {
      const result = exporter.generateBinVisData(baseInput)
      expect(result.metadata.fileName).toBe('test.exe')
      expect(result.metadata.fileSize).toBe(4)
      expect(result.metadata.detectedType).toBe('PE Executable')
      expect(result.metadata.generatedBy).toBe('VULNEX Bytes Revealer')
      expect(result.metadata.generatedAt).toBeTruthy()
      expect(result.metadata.hashes).toEqual({ md5: 'abc', sha256: 'def' })
    })

    it('handles missing fileName', () => {
      const result = exporter.generateBinVisData({ ...baseInput, fileName: null })
      expect(result.metadata.fileName).toBe('unknown')
    })

    it('handles missing detectedFileType', () => {
      const result = exporter.generateBinVisData({ ...baseInput, detectedFileType: null })
      expect(result.metadata.detectedType).toBe('Unknown')
    })

    it('handles missing hashes', () => {
      const result = exporter.generateBinVisData({ ...baseInput, hashes: null })
      expect(result.metadata.hashes).toEqual({})
    })

    it('handles null fileBytes', () => {
      const result = exporter.generateBinVisData({ ...baseInput, fileBytes: null })
      expect(result.metadata.fileSize).toBe(0)
    })

    it('includes byte distribution', () => {
      const result = exporter.generateBinVisData(baseInput)
      expect(result.byteDistribution).toBeDefined()
      expect(result.byteDistribution.frequencies).toHaveLength(256)
      expect(result.byteDistribution.totalBytes).toBe(4)
    })

    it('includes entropy analysis with blocks', () => {
      const result = exporter.generateBinVisData(baseInput)
      expect(result.entropyAnalysis.globalEntropy).toBe(5.5)
      expect(result.entropyAnalysis.blockSize).toBe(256)
      expect(result.entropyAnalysis.blocks).toHaveLength(1)
      expect(result.entropyAnalysis.blocks[0]).toEqual({
        offset: 0,
        entropy: 5.5,
        size: 256
      })
    })

    it('includes high entropy regions', () => {
      const result = exporter.generateBinVisData(baseInput)
      expect(result.entropyAnalysis.highEntropyRegions).toHaveLength(1)
      expect(result.entropyAnalysis.highEntropyRegions[0]).toEqual({
        start: 0,
        end: 100,
        entropy: 7.8
      })
    })

    it('includes statistics', () => {
      const result = exporter.generateBinVisData(baseInput)
      expect(result.entropyAnalysis.statistics).toEqual({ mean: 5.5, min: 3.0, max: 7.8 })
    })

    it('maps file signatures', () => {
      const result = exporter.generateBinVisData(baseInput)
      expect(result.signatures).toHaveLength(1)
      expect(result.signatures[0]).toEqual({
        name: 'PE',
        extension: '.exe',
        confidence: 0.9,
        offset: 0,
        details: { arch: 'x64' }
      })
    })

    it('handles signatures with no details', () => {
      const input = {
        ...baseInput,
        fileSignatures: [{ name: 'Unknown', extension: '.bin', confidence: 0.5, offset: 0 }]
      }
      const result = exporter.generateBinVisData(input)
      expect(result.signatures[0].details).toEqual({})
    })

    it('handles null fileSignatures', () => {
      const result = exporter.generateBinVisData({ ...baseInput, fileSignatures: null })
      expect(result.signatures).toEqual([])
    })

    it('handles entropy calculation failure gracefully', () => {
      calculateOptimizedEntropy.mockImplementationOnce(() => {
        throw new Error('entropy failed')
      })
      const result = exporter.generateBinVisData(baseInput)
      expect(result.entropyAnalysis.globalEntropy).toBe(0)
      expect(result.entropyAnalysis.blocks).toEqual([])
      expect(result.entropyAnalysis.highEntropyRegions).toEqual([])
    })
  })

  // ── _mapColoredBytesToRegions ──

  describe('_mapColoredBytesToRegions()', () => {
    it('returns empty array for null input', () => {
      expect(exporter._mapColoredBytesToRegions(null)).toEqual([])
    })

    it('returns empty array for undefined input', () => {
      expect(exporter._mapColoredBytesToRegions(undefined)).toEqual([])
    })

    it('returns empty array for empty array', () => {
      expect(exporter._mapColoredBytesToRegions([])).toEqual([])
    })

    it('returns empty array for non-array input', () => {
      expect(exporter._mapColoredBytesToRegions('string')).toEqual([])
    })

    it('creates a single region from contiguous same-colored bytes', () => {
      const colored = [
        { color: '#ff0000', label: 'header' },
        { color: '#ff0000', label: 'header' },
        { color: '#ff0000', label: 'header' }
      ]
      const regions = exporter._mapColoredBytesToRegions(colored)
      expect(regions).toEqual([{ start: 0, end: 2, color: '#ff0000', label: 'header' }])
    })

    it('creates multiple regions for different colors', () => {
      const colored = [
        { color: '#ff0000', label: 'header' },
        { color: '#ff0000', label: 'header' },
        { color: '#00ff00', label: 'data' },
        { color: '#00ff00', label: 'data' }
      ]
      const regions = exporter._mapColoredBytesToRegions(colored)
      expect(regions).toHaveLength(2)
      expect(regions[0]).toEqual({ start: 0, end: 1, color: '#ff0000', label: 'header' })
      expect(regions[1]).toEqual({ start: 2, end: 3, color: '#00ff00', label: 'data' })
    })

    it('splits regions when label differs even if color is same', () => {
      const colored = [
        { color: '#ff0000', label: 'header' },
        { color: '#ff0000', label: 'footer' }
      ]
      const regions = exporter._mapColoredBytesToRegions(colored)
      expect(regions).toHaveLength(2)
    })

    it('skips entries without color or label', () => {
      const colored = [
        { color: '#ff0000', label: 'header' },
        { color: null, label: null },
        { color: '#ff0000', label: 'header' }
      ]
      const regions = exporter._mapColoredBytesToRegions(colored)
      expect(regions).toHaveLength(2)
      expect(regions[0]).toEqual({ start: 0, end: 0, color: '#ff0000', label: 'header' })
      expect(regions[1]).toEqual({ start: 2, end: 2, color: '#ff0000', label: 'header' })
    })

    it('skips entries with missing color', () => {
      const colored = [{ label: 'header' }, { color: '#ff0000', label: 'data' }]
      const regions = exporter._mapColoredBytesToRegions(colored)
      expect(regions).toHaveLength(1)
      expect(regions[0].start).toBe(1)
    })

    it('skips entries with missing label', () => {
      const colored = [{ color: '#ff0000' }, { color: '#ff0000', label: 'data' }]
      const regions = exporter._mapColoredBytesToRegions(colored)
      expect(regions).toHaveLength(1)
      expect(regions[0].start).toBe(1)
    })

    it('handles single-byte region', () => {
      const colored = [{ color: '#ff0000', label: 'single' }]
      const regions = exporter._mapColoredBytesToRegions(colored)
      expect(regions).toEqual([{ start: 0, end: 0, color: '#ff0000', label: 'single' }])
    })

    it('handles null entries in array', () => {
      const colored = [null, { color: '#ff0000', label: 'data' }, null]
      const regions = exporter._mapColoredBytesToRegions(colored)
      expect(regions).toHaveLength(1)
      expect(regions[0]).toEqual({ start: 1, end: 1, color: '#ff0000', label: 'data' })
    })
  })

  // ── generateAttackGraphConfig ──

  describe('generateAttackGraphConfig()', () => {
    const baseInput = {
      fileSignatures: [
        {
          name: 'Windows Executable (PE)',
          extension: '.exe',
          confidence: 0.95,
          offset: 0,
          details: {
            characteristics: [],
            security: {},
            timestamp: '2024-01-01T00:00:00.000Z'
          }
        }
      ],
      detectedFileType: 'PE Executable',
      fileName: 'malware.exe',
      hashes: {},
      entropy: 5.0
    }

    it('returns error for non-executable file types', () => {
      const result = exporter.generateAttackGraphConfig({
        ...baseInput,
        fileSignatures: [{ name: 'PNG Image', extension: '.png', confidence: 0.9, offset: 0 }]
      })
      expect(result.toml).toBeNull()
      expect(result.error).toContain('only supported for PE, ELF, and Mach-O')
    })

    it('returns error when fileSignatures is empty', () => {
      const result = exporter.generateAttackGraphConfig({
        ...baseInput,
        fileSignatures: []
      })
      expect(result.toml).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it('returns error when fileSignatures is null', () => {
      const result = exporter.generateAttackGraphConfig({
        ...baseInput,
        fileSignatures: null
      })
      expect(result.toml).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it('generates TOML for PE executable', () => {
      const result = exporter.generateAttackGraphConfig(baseInput)
      expect(result.toml).toBeTruthy()
      expect(result.toml).toContain('[graph]')
      expect(result.toml).toContain('Binary Analysis: malware.exe')
      expect(result.toml).toContain('[[hosts]]')
      expect(result.toml).toContain('Target Windows')
      expect(result.toml).toContain('[[network_edges]]')
      expect(result.summary).toBeDefined()
      expect(result.summary.type).toContain('PE')
      expect(result.summary.hosts).toBeGreaterThanOrEqual(2)
    })

    it('generates TOML for ELF executable', () => {
      const elfInput = {
        ...baseInput,
        fileSignatures: [
          {
            name: 'ELF Binary',
            extension: '',
            confidence: 0.95,
            offset: 0,
            details: { type: 'Executable' }
          }
        ]
      }
      const result = exporter.generateAttackGraphConfig(elfInput)
      expect(result.toml).toContain('Target Linux')
      expect(result.summary.type).toContain('ELF')
    })

    it('generates TOML for Mach-O executable', () => {
      const machoInput = {
        ...baseInput,
        fileSignatures: [
          {
            name: 'Mach-O',
            extension: '',
            confidence: 0.95,
            offset: 0,
            details: {}
          }
        ]
      }
      const result = exporter.generateAttackGraphConfig(machoInput)
      expect(result.toml).toContain('Target macOS')
      expect(result.summary.type).toContain('Mach-O')
    })

    it('includes graph metadata', () => {
      const result = exporter.generateAttackGraphConfig(baseInput)
      expect(result.toml).toContain('name = "Binary Analysis: malware.exe"')
      expect(result.toml).toContain('type = "Attack Graph"')
      expect(result.toml).toContain('version = "1.0.0"')
      expect(result.toml).toContain('author = "VULNEX Bytes Revealer"')
    })

    it('includes network edge from binary to target', () => {
      const result = exporter.generateAttackGraphConfig(baseInput)
      expect(result.toml).toContain('from = "binary"')
      expect(result.toml).toContain('to = "target_system"')
      expect(result.toml).toContain('label = "Execution"')
    })

    it('uses fallback for missing fileName', () => {
      const result = exporter.generateAttackGraphConfig({ ...baseInput, fileName: null })
      expect(result.toml).toContain('Binary Analysis: binary')
    })

    it('uses sigName as fallback when detectedFileType is not a string', () => {
      const result = exporter.generateAttackGraphConfig({
        ...baseInput,
        detectedFileType: { name: 'PE' }
      })
      expect(result.toml).toContain('Windows Executable (PE)')
    })

    it('returns summary with counts', () => {
      const result = exporter.generateAttackGraphConfig(baseInput)
      expect(result.summary).toHaveProperty('type')
      expect(result.summary).toHaveProperty('hosts')
      expect(result.summary).toHaveProperty('vulnerabilities')
      expect(result.summary).toHaveProperty('privileges')
      expect(result.summary).toHaveProperty('exploits')
    })
  })

  // ── PE Vulnerabilities ──

  describe('_mapPEVulnerabilities()', () => {
    let vulns, privs, exps

    beforeEach(() => {
      vulns = []
      privs = []
      exps = []
    })

    it('always adds priv_exec privilege', () => {
      exporter._mapPEVulnerabilities({}, vulns, privs, exps, 5.0)
      expect(privs.some((p) => p.id === 'priv_exec')).toBe(true)
    })

    it('always adds binary execution exploit for non-DLL', () => {
      exporter._mapPEVulnerabilities({ characteristics: [] }, vulns, privs, exps, 5.0)
      expect(exps.some((e) => e.id === 'exp_exec')).toBe(true)
    })

    it('detects DLL hijacking risk', () => {
      exporter._mapPEVulnerabilities({ characteristics: ['DLL'] }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_dll_hijack')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_dll_hijack')).toBe(true)
      // DLL should not get exp_exec
      expect(exps.some((e) => e.id === 'exp_exec')).toBe(false)
    })

    it('detects timestamp anomaly for epoch zero', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], timestamp: '1970-01-01T00:00:00.000Z' },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_timestamp_anomaly')).toBe(true)
    })

    it('detects timestamp anomaly for years before 2000', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], timestamp: '1999-12-31T00:00:00.000Z' },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_timestamp_anomaly')).toBe(true)
    })

    it('does not flag valid timestamp', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], timestamp: '2024-06-15T12:00:00.000Z' },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_timestamp_anomaly')).toBe(false)
    })

    it('detects Native subsystem for kernel privilege', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], subsystem: 'Native' },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(privs.some((p) => p.id === 'priv_kernel')).toBe(true)
      expect(privs.some((p) => p.id === 'priv_system')).toBe(true)
    })

    it('detects no ASLR', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], security: { aslr: false } },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_no_aslr')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_fixed_addr')).toBe(true)
    })

    it('detects no DEP', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], security: { dep: false } },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_no_dep')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_stack_exec')).toBe(true)
    })

    it('detects no CFG', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], security: { cfg: false } },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_no_cfg')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_cfg_bypass')).toBe(true)
    })

    it('detects SEH vulnerability when noSEH is false/missing', () => {
      exporter._mapPEVulnerabilities({ characteristics: [], security: {} }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_seh')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_seh_overwrite')).toBe(true)
    })

    it('does not flag SEH when noSEH is true', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], security: { noSEH: true } },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_seh')).toBe(false)
    })

    it('detects no code integrity enforcement', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], security: { forceIntegrity: false } },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_no_integrity')).toBe(true)
    })

    it('detects RWX sections', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], hasRWXSections: true },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_rwx')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_memory_corruption')).toBe(true)
      expect(privs.some((p) => p.id === 'priv_system')).toBe(true)
    })

    it('detects unsigned binary', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], hasCertificate: false },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_unsigned')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_unsigned_exec')).toBe(true)
    })

    it('detects debug info', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], hasDebugInfo: true },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_debug_info')).toBe(true)
    })

    it('detects .NET binary', () => {
      exporter._mapPEVulnerabilities({ characteristics: [], isNet: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_dotnet')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_decompile')).toBe(true)
    })

    it('detects partial ASLR for 64-bit without high entropy VA', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], is64bit: true, security: { highEntropyVA: false } },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_partial_aslr')).toBe(true)
    })

    it('does not flag partial ASLR for 32-bit', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], is64bit: false, security: { highEntropyVA: false } },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_partial_aslr')).toBe(false)
    })

    it('does not duplicate priv_system', () => {
      exporter._mapPEVulnerabilities(
        { characteristics: [], subsystem: 'Native', hasRWXSections: true },
        vulns,
        privs,
        exps,
        5.0
      )
      const systemPrivs = privs.filter((p) => p.id === 'priv_system')
      expect(systemPrivs).toHaveLength(1)
    })
  })

  // ── ELF Vulnerabilities ──

  describe('_mapELFVulnerabilities()', () => {
    let vulns, privs, exps

    beforeEach(() => {
      vulns = []
      privs = []
      exps = []
    })

    it('always adds priv_exec privilege', () => {
      exporter._mapELFVulnerabilities({}, vulns, privs, exps, 5.0)
      expect(privs.some((p) => p.id === 'priv_exec')).toBe(true)
    })

    it('detects SUID potential for Executable type', () => {
      exporter._mapELFVulnerabilities({ type: 'Executable' }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_suid_potential')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_suid')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_exec')).toBe(true)
    })

    it('detects library injection for Shared object type', () => {
      exporter._mapELFVulnerabilities({ type: 'Shared object' }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_lib_injection')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_lib_inject')).toBe(true)
    })

    it('detects no PIE', () => {
      exporter._mapELFVulnerabilities({ pie: false }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_no_pie')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_fixed_addr')).toBe(true)
    })

    it('detects executable stack', () => {
      exporter._mapELFVulnerabilities({ executableStack: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_exec_stack')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_stack_exec')).toBe(true)
      expect(privs.some((p) => p.id === 'priv_root')).toBe(true)
    })

    it('detects no RELRO', () => {
      exporter._mapELFVulnerabilities({ relro: 'none' }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_no_relro')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_got_overwrite')).toBe(true)
    })

    it('detects RWX segments', () => {
      exporter._mapELFVulnerabilities({ hasRWXSegments: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_rwx')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_memory_corruption')).toBe(true)
    })

    it('detects stripped binary', () => {
      exporter._mapELFVulnerabilities({ isStripped: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_stripped')).toBe(true)
    })

    it('detects rpath injection risk', () => {
      exporter._mapELFVulnerabilities({ rpath: '/usr/local/lib' }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_rpath')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_rpath_inject')).toBe(true)
    })

    it('detects runpath injection risk', () => {
      exporter._mapELFVulnerabilities({ runpath: '$ORIGIN/../lib' }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_rpath')).toBe(true)
    })

    it('includes both rpath and runpath in description', () => {
      exporter._mapELFVulnerabilities(
        { rpath: '/opt/lib', runpath: '/custom/lib' },
        vulns,
        privs,
        exps,
        5.0
      )
      const vuln = vulns.find((v) => v.id === 'vuln_rpath')
      expect(vuln.description).toContain('/opt/lib')
      expect(vuln.description).toContain('/custom/lib')
    })

    it('detects text relocations', () => {
      exporter._mapELFVulnerabilities({ textrel: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_textrel')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_textrel')).toBe(true)
    })

    it('adds priv_root for Executable type', () => {
      exporter._mapELFVulnerabilities({ type: 'Executable' }, vulns, privs, exps, 5.0)
      expect(privs.some((p) => p.id === 'priv_root')).toBe(true)
    })

    it('adds priv_root for Shared object type', () => {
      exporter._mapELFVulnerabilities({ type: 'Shared object' }, vulns, privs, exps, 5.0)
      expect(privs.some((p) => p.id === 'priv_root')).toBe(true)
    })

    it('does not duplicate priv_root', () => {
      exporter._mapELFVulnerabilities(
        { type: 'Executable', executableStack: true },
        vulns,
        privs,
        exps,
        5.0
      )
      const rootPrivs = privs.filter((p) => p.id === 'priv_root')
      expect(rootPrivs).toHaveLength(1)
    })
  })

  // ── Mach-O Vulnerabilities ──

  describe('_mapMachOVulnerabilities()', () => {
    let vulns, privs, exps

    beforeEach(() => {
      vulns = []
      privs = []
      exps = []
    })

    it('always adds priv_exec privilege', () => {
      exporter._mapMachOVulnerabilities({}, vulns, privs, exps, 5.0)
      expect(privs.some((p) => p.id === 'priv_exec')).toBe(true)
    })

    it('detects dylib hijacking for dynamically linked', () => {
      exporter._mapMachOVulnerabilities({ isDynamicallyLinked: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_dylib_hijack')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_dylib_hijack')).toBe(true)
    })

    it('adds binary execution exploit for statically linked', () => {
      exporter._mapMachOVulnerabilities({ isDynamicallyLinked: false }, vulns, privs, exps, 5.0)
      expect(exps.some((e) => e.id === 'exp_exec')).toBe(true)
      expect(vulns.some((v) => v.id === 'vuln_dylib_hijack')).toBe(false)
    })

    it('detects missing code signature', () => {
      exporter._mapMachOVulnerabilities({ hasCodeSignature: false }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_no_codesign')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_unsigned_exec')).toBe(true)
    })

    it('does not flag when code signature present', () => {
      exporter._mapMachOVulnerabilities({ hasCodeSignature: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_no_codesign')).toBe(false)
    })

    it('detects encrypted binary', () => {
      exporter._mapMachOVulnerabilities({ isEncrypted: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_encrypted')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_encryption_bypass')).toBe(true)
    })

    it('detects universal binary', () => {
      exporter._mapMachOVulnerabilities({ type: 'Universal Binary' }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_universal')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_cross_arch')).toBe(true)
    })

    it('detects RWX segments', () => {
      exporter._mapMachOVulnerabilities({ hasRWXSegments: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_rwx')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_memory_corruption')).toBe(true)
    })

    it('detects executable stack (allowStackExecution)', () => {
      exporter._mapMachOVulnerabilities({ allowStackExecution: true }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_stack_exec')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_stack_exec')).toBe(true)
      expect(privs.some((p) => p.id === 'priv_root')).toBe(true)
    })

    it('detects no PIE', () => {
      exporter._mapMachOVulnerabilities({ pie: false }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_no_pie')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_fixed_addr')).toBe(true)
    })

    it('detects weak dylib references', () => {
      exporter._mapMachOVulnerabilities(
        { weakDylibs: ['/usr/lib/libfoo.dylib', '/usr/lib/libbar.dylib'] },
        vulns,
        privs,
        exps,
        5.0
      )
      expect(vulns.some((v) => v.id === 'vuln_weak_dylib')).toBe(true)
      expect(exps.some((e) => e.id === 'exp_weak_dylib')).toBe(true)
      const vuln = vulns.find((v) => v.id === 'vuln_weak_dylib')
      expect(vuln.description).toContain('2 weak dylib(s)')
    })

    it('does not flag empty weakDylibs', () => {
      exporter._mapMachOVulnerabilities({ weakDylibs: [] }, vulns, privs, exps, 5.0)
      expect(vulns.some((v) => v.id === 'vuln_weak_dylib')).toBe(false)
    })

    it('adds priv_root for Dynamic Library fileType', () => {
      exporter._mapMachOVulnerabilities({ fileType: 'Dynamic Library' }, vulns, privs, exps, 5.0)
      expect(privs.some((p) => p.id === 'priv_root')).toBe(true)
    })
  })

  // ── Entropy Vulnerabilities ──

  describe('_mapEntropyVulnerabilities()', () => {
    let vulns, exps

    beforeEach(() => {
      vulns = []
      exps = []
    })

    it('detects packing for high entropy number > 7.5', () => {
      exporter._mapEntropyVulnerabilities(7.8, vulns, exps)
      expect(vulns.some((v) => v.id === 'vuln_packing')).toBe(true)
      expect(vulns[0].description).toContain('7.80')
    })

    it('does not flag entropy at exactly 7.5', () => {
      exporter._mapEntropyVulnerabilities(7.5, vulns, exps)
      expect(vulns.some((v) => v.id === 'vuln_packing')).toBe(false)
    })

    it('does not flag low entropy', () => {
      exporter._mapEntropyVulnerabilities(3.0, vulns, exps)
      expect(vulns.some((v) => v.id === 'vuln_packing')).toBe(false)
    })

    it('handles entropy as object with globalEntropy', () => {
      exporter._mapEntropyVulnerabilities({ globalEntropy: 7.9 }, vulns, exps)
      expect(vulns.some((v) => v.id === 'vuln_packing')).toBe(true)
    })

    it('handles null entropy', () => {
      exporter._mapEntropyVulnerabilities(null, vulns, exps)
      expect(vulns).toHaveLength(0)
    })

    it('handles undefined entropy', () => {
      exporter._mapEntropyVulnerabilities(undefined, vulns, exps)
      expect(vulns).toHaveLength(0)
    })

    it('handles entropy object without globalEntropy', () => {
      exporter._mapEntropyVulnerabilities({}, vulns, exps)
      expect(vulns).toHaveLength(0)
    })
  })

  // ── TOML Serialization ──

  describe('_serializeToToml()', () => {
    it('serializes graph section', () => {
      const toml = exporter._serializeToToml({ name: 'Test', version: '1.0' }, [], [], [], [], [])
      expect(toml).toContain('[graph]')
      expect(toml).toContain('name = "Test"')
      expect(toml).toContain('version = "1.0"')
    })

    it('serializes hosts as array of tables', () => {
      const toml = exporter._serializeToToml(
        {},
        [{ id: 'host1', label: 'Host One' }],
        [],
        [],
        [],
        []
      )
      expect(toml).toContain('[[hosts]]')
      expect(toml).toContain('id = "host1"')
      expect(toml).toContain('label = "Host One"')
    })

    it('serializes vulnerabilities', () => {
      const toml = exporter._serializeToToml({}, [], [{ id: 'vuln1', label: 'Vuln' }], [], [], [])
      expect(toml).toContain('[[vulnerabilities]]')
      expect(toml).toContain('id = "vuln1"')
    })

    it('serializes privileges', () => {
      const toml = exporter._serializeToToml({}, [], [], [{ id: 'priv1', level: 'user' }], [], [])
      expect(toml).toContain('[[privileges]]')
      expect(toml).toContain('id = "priv1"')
    })

    it('serializes exploits', () => {
      const toml = exporter._serializeToToml({}, [], [], [], [{ id: 'exp1', label: 'Exploit' }], [])
      expect(toml).toContain('[[exploits]]')
      expect(toml).toContain('id = "exp1"')
    })

    it('serializes network edges', () => {
      const toml = exporter._serializeToToml(
        {},
        [],
        [],
        [],
        [],
        [{ from: 'a', to: 'b', label: 'link' }]
      )
      expect(toml).toContain('[[network_edges]]')
      expect(toml).toContain('from = "a"')
      expect(toml).toContain('to = "b"')
    })

    it('omits network_edges section when empty', () => {
      const toml = exporter._serializeToToml({}, [], [], [], [], [])
      expect(toml).not.toContain('[[network_edges]]')
    })

    it('omits network_edges section when null', () => {
      const toml = exporter._serializeToToml({}, [], [], [], [], null)
      expect(toml).not.toContain('[[network_edges]]')
    })
  })

  // ── _pushTomlFields ──

  describe('_pushTomlFields()', () => {
    it('serializes string values with quotes', () => {
      const lines = []
      exporter._pushTomlFields(lines, { key: 'value' })
      expect(lines).toContain('key = "value"')
    })

    it('serializes number values without quotes', () => {
      const lines = []
      exporter._pushTomlFields(lines, { count: 42 })
      expect(lines).toContain('count = 42')
    })

    it('serializes boolean values without quotes', () => {
      const lines = []
      exporter._pushTomlFields(lines, { enabled: true })
      expect(lines).toContain('enabled = true')
    })

    it('skips null values', () => {
      const lines = []
      exporter._pushTomlFields(lines, { key: null })
      expect(lines).toHaveLength(0)
    })

    it('skips undefined values', () => {
      const lines = []
      exporter._pushTomlFields(lines, { key: undefined })
      expect(lines).toHaveLength(0)
    })
  })

  // ── _escToml ──

  describe('_escToml()', () => {
    it('returns empty string for falsy input', () => {
      expect(exporter._escToml('')).toBe('')
      expect(exporter._escToml(null)).toBe('')
      expect(exporter._escToml(undefined)).toBe('')
    })

    it('escapes backslashes', () => {
      expect(exporter._escToml('a\\b')).toBe('a\\\\b')
    })

    it('escapes double quotes', () => {
      expect(exporter._escToml('say "hi"')).toBe('say \\"hi\\"')
    })

    it('escapes newlines', () => {
      expect(exporter._escToml('line1\nline2')).toBe('line1\\nline2')
    })

    it('handles multiple escape characters together', () => {
      expect(exporter._escToml('a\\b\n"c"')).toBe('a\\\\b\\n\\"c\\"')
    })

    it('converts numbers to string', () => {
      expect(exporter._escToml(42)).toBe('42')
    })
  })

  // ── Download Helpers ──

  describe('download helpers', () => {
    let mockAnchor
    let originalCreateElement
    let originalCreateObjectURL
    let originalRevokeObjectURL
    let appendChildSpy
    let removeChildSpy

    beforeEach(() => {
      mockAnchor = { href: '', download: '', click: vi.fn() }
      originalCreateElement = document.createElement
      document.createElement = vi.fn((tag) => {
        if (tag === 'a') return mockAnchor
        return originalCreateElement.call(document, tag)
      })

      originalCreateObjectURL = URL.createObjectURL
      originalRevokeObjectURL = URL.revokeObjectURL
      URL.createObjectURL = vi.fn(() => 'blob:test-url')
      URL.revokeObjectURL = vi.fn()

      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
    })

    afterEach(() => {
      document.createElement = originalCreateElement
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    describe('downloadJson()', () => {
      it('creates a JSON blob and triggers download', () => {
        exporter.downloadJson({ key: 'value' }, 'test.json')
        expect(URL.createObjectURL).toHaveBeenCalled()
        expect(mockAnchor.download).toBe('test.json')
        expect(mockAnchor.click).toHaveBeenCalled()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
      })
    })

    describe('downloadToml()', () => {
      it('creates a text blob and triggers download', () => {
        exporter.downloadToml('[graph]\nname = "test"', 'config.toml')
        expect(URL.createObjectURL).toHaveBeenCalled()
        expect(mockAnchor.download).toBe('config.toml')
        expect(mockAnchor.click).toHaveBeenCalled()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
      })
    })

    describe('downloadBlob()', () => {
      it('triggers download with provided blob', () => {
        const blob = new Blob(['data'], { type: 'application/octet-stream' })
        exporter.downloadBlob(blob, 'data.bin')
        expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
        expect(mockAnchor.download).toBe('data.bin')
        expect(mockAnchor.click).toHaveBeenCalled()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
      })
    })

    describe('_triggerDownload()', () => {
      it('appends and removes anchor from document.body', () => {
        const blob = new Blob(['x'])
        exporter._triggerDownload(blob, 'file.txt')
        expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor)
        expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor)
      })
    })
  })

  // ── API Integration (testConnection) ──

  describe('testConnection()', () => {
    let fetchMock

    beforeEach(() => {
      fetchMock = vi.fn()
      globalThis.fetch = fetchMock
    })

    it('returns available: true on successful health check', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '2.0.0' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(['style1', 'style2'])
        })

      const result = await exporter.testConnection()
      expect(result.available).toBe(true)
      expect(result.version).toBe('2.0.0')
      expect(result.styles).toEqual(['style1', 'style2'])
      expect(result.error).toBeNull()
    })

    it('returns available: false when health check fails', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })

      const result = await exporter.testConnection()
      expect(result.available).toBe(false)
      expect(result.error).toContain('Health check failed: 500')
    })

    it('returns available: false on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      const result = await exporter.testConnection()
      expect(result.available).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('returns CORS error message for TypeError "Failed to fetch"', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const result = await exporter.testConnection()
      expect(result.available).toBe(false)
      expect(result.error).toContain('CORS error')
      expect(result.error).toContain('--cors-allow-origins')
    })

    it('uses default version when health response lacks version', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })

      const result = await exporter.testConnection()
      expect(result.version).toBe('unknown')
    })

    it('handles styles fetch failure gracefully', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '1.0' })
        })
        .mockRejectedValueOnce(new Error('styles failed'))

      const result = await exporter.testConnection()
      expect(result.available).toBe(true)
      expect(result.styles).toEqual([])
    })

    it('handles non-array styles response', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '1.0' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve('not-an-array')
        })

      const result = await exporter.testConnection()
      expect(result.styles).toEqual([])
    })

    it('includes auth headers in requests', async () => {
      exporter.setApiKey('test-key')
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '1.0' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([])
        })

      await exporter.testConnection()
      expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'X-API-Key': 'test-key' })
    })
  })

  // ── requestVisualization ──

  describe('requestVisualization()', () => {
    let fetchMock

    beforeEach(() => {
      fetchMock = vi.fn()
      globalThis.fetch = fetchMock
    })

    it('sends POST request with file data and default params', async () => {
      const blobResult = new Blob(['image-data'], { type: 'image/png' })
      fetchMock.mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(blobResult) })

      const fileBytes = new Uint8Array([1, 2, 3])
      const result = await exporter.requestVisualization(fileBytes)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toContain('/visualize/binary?')
      expect(url).toContain('visualization_type=entropy')
      expect(url).toContain('style=bv_default')
      expect(url).toContain('format=png')
      expect(options.method).toBe('POST')
      expect(result).toBe(blobResult)
    })

    it('uses custom visualization params', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob())
      })

      await exporter.requestVisualization(new Uint8Array([1]), {
        visType: 'hilbert',
        style: 'dark',
        format: 'svg'
      })

      const url = fetchMock.mock.calls[0][0]
      expect(url).toContain('visualization_type=hilbert')
      expect(url).toContain('style=dark')
      expect(url).toContain('format=svg')
    })

    it('throws on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request')
      })

      await expect(exporter.requestVisualization(new Uint8Array([1]))).rejects.toThrow(
        'Visualization failed (400): Bad request'
      )
    })
  })

  // ── requestAttackGraphVisualization ──

  describe('requestAttackGraphVisualization()', () => {
    let fetchMock

    beforeEach(() => {
      fetchMock = vi.fn()
      globalThis.fetch = fetchMock
    })

    it('sends POST request with TOML config', async () => {
      const blobResult = new Blob(['graph-image'])
      fetchMock.mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(blobResult) })

      const toml = '[graph]\nname = "test"'
      const result = await exporter.requestAttackGraphVisualization(toml)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toContain('/visualize/attack-graph')
      expect(options.method).toBe('POST')
      expect(result).toBe(blobResult)
    })

    it('uses custom style and format', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob())
      })

      await exporter.requestAttackGraphVisualization('[graph]', {
        style: 'dark',
        format: 'svg'
      })

      // The style and format are in the FormData, not the URL
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error')
      })

      await expect(exporter.requestAttackGraphVisualization('[graph]')).rejects.toThrow(
        'Attack graph visualization failed (500): Internal error'
      )
    })
  })

  // ── Full integration: generateAttackGraphConfig with PE details ──

  describe('attack graph integration - PE with all vulnerabilities', () => {
    it('generates comprehensive TOML for a vulnerable PE', () => {
      const result = exporter.generateAttackGraphConfig({
        fileSignatures: [
          {
            name: 'Windows Executable (PE)',
            extension: '.exe',
            confidence: 0.95,
            offset: 0,
            details: {
              characteristics: ['DLL'],
              security: {
                aslr: false,
                dep: false,
                cfg: false,
                noSEH: false,
                forceIntegrity: false,
                highEntropyVA: false
              },
              timestamp: '1970-01-01T00:00:00.000Z',
              subsystem: 'Native',
              hasRWXSections: true,
              hasCertificate: false,
              hasDebugInfo: true,
              isNet: true,
              is64bit: true
            }
          }
        ],
        detectedFileType: 'PE Executable',
        fileName: 'vuln.exe',
        hashes: {},
        entropy: 7.9
      })

      expect(result.toml).toBeTruthy()
      expect(result.summary.vulnerabilities).toBeGreaterThan(5)
      expect(result.summary.exploits).toBeGreaterThan(3)

      // Verify multiple vulnerability types present
      expect(result.toml).toContain('vuln_dll_hijack')
      expect(result.toml).toContain('vuln_no_aslr')
      expect(result.toml).toContain('vuln_no_dep')
      expect(result.toml).toContain('vuln_packing')
    })
  })

  // ── Full integration: BinVis with colored bytes ──

  describe('generateBinVisData with colored bytes regions', () => {
    it('maps colored bytes into regions correctly', () => {
      const result = exporter.generateBinVisData({
        fileBytes: new Uint8Array([1, 2, 3, 4, 5]),
        entropy: 4.0,
        hashes: {},
        detectedFileType: 'Unknown',
        fileSignatures: [],
        coloredBytes: [
          { color: '#ff0000', label: 'header' },
          { color: '#ff0000', label: 'header' },
          { color: '#00ff00', label: 'data' },
          { color: '#00ff00', label: 'data' },
          { color: '#0000ff', label: 'footer' }
        ],
        fileName: 'test.bin'
      })

      expect(result.regions).toHaveLength(3)
      expect(result.regions[0]).toEqual({
        start: 0,
        end: 1,
        color: '#ff0000',
        label: 'header'
      })
      expect(result.regions[1]).toEqual({
        start: 2,
        end: 3,
        color: '#00ff00',
        label: 'data'
      })
      expect(result.regions[2]).toEqual({
        start: 4,
        end: 4,
        color: '#0000ff',
        label: 'footer'
      })
    })
  })
})
