import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useYaraStore } from './yara.js'

describe('YaraStore', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useYaraStore()
  })

  // ── Initial state ──

  it('starts with default state', () => {
    expect(store.currentRules).toBe('')
    expect(store.selectedRuleSet).toBeNull()
    expect(store.importedFileName).toBeNull()
    expect(store.isScanning).toBe(false)
    expect(store.scanProgress).toBe(0)
    expect(store.compileErrors).toEqual([])
    expect(store.consoleLogs).toEqual([])
    expect(store.matchedRules).toEqual([])
    expect(store.lastScanTimestamp).toBeNull()
    expect(store.lastScanDuration).toBeNull()
    expect(store.error).toBeNull()
    expect(store.highlightMatchesInHex).toBe(false)
  })

  // ── Getters ──

  describe('getters', () => {
    it('hasResults returns false when no matched rules', () => {
      expect(store.hasResults).toBe(false)
    })

    it('hasResults returns true when matched rules exist', () => {
      store.matchedRules = [{ ruleName: 'test', matches: [] }]
      expect(store.hasResults).toBe(true)
    })

    it('totalMatches counts all matches across rules', () => {
      expect(store.totalMatches).toBe(0)
      store.matchedRules = [
        { ruleName: 'rule1', matches: [{ offset: 0, length: 4 }, { offset: 10, length: 4 }] },
        { ruleName: 'rule2', matches: [{ offset: 20, length: 2 }] }
      ]
      expect(store.totalMatches).toBe(3)
    })

    it('totalMatches handles rules with no matches array', () => {
      store.matchedRules = [{ ruleName: 'rule1' }]
      expect(store.totalMatches).toBe(0)
    })

    it('hasCompileErrors returns false when no errors', () => {
      expect(store.hasCompileErrors).toBe(false)
    })

    it('hasCompileErrors returns true when errors exist', () => {
      store.compileErrors = [{ message: 'syntax error' }]
      expect(store.hasCompileErrors).toBe(true)
    })

    it('allMatchLocations flattens matches from all rules', () => {
      store.matchedRules = [
        {
          ruleName: 'rule1',
          matches: [
            { offset: 0, length: 4, stringIdentifier: '$a', data: 'ABCD' },
            { offset: 10, length: 2, stringIdentifier: '$b', data: 'EF' }
          ]
        },
        {
          ruleName: 'rule2',
          matches: [
            { offset: 20, length: 3, stringIdentifier: '$c', data: 'GHI' }
          ]
        }
      ]

      const locations = store.allMatchLocations
      expect(locations).toHaveLength(3)
      expect(locations[0]).toEqual({
        ruleName: 'rule1',
        offset: 0,
        length: 4,
        stringIdentifier: '$a',
        data: 'ABCD'
      })
      expect(locations[2].ruleName).toBe('rule2')
    })

    it('allMatchLocations returns empty array for rules with no matches', () => {
      store.matchedRules = [{ ruleName: 'rule1' }]
      expect(store.allMatchLocations).toEqual([])
    })

    it('matchHighlightBytes returns empty when highlight disabled', () => {
      store.matchedRules = [
        { ruleName: 'rule1', matches: [{ offset: 0, length: 3 }] }
      ]
      store.highlightMatchesInHex = false
      expect(store.matchHighlightBytes).toEqual([])
    })

    it('matchHighlightBytes returns byte indices when highlight enabled', () => {
      store.matchedRules = [
        { ruleName: 'rule1', matches: [{ offset: 5, length: 3 }] }
      ]
      store.highlightMatchesInHex = true
      expect(store.matchHighlightBytes).toEqual([5, 6, 7])
    })

    it('matchHighlightBytes deduplicates overlapping matches', () => {
      store.matchedRules = [
        {
          ruleName: 'rule1',
          matches: [
            { offset: 0, length: 3 },
            { offset: 2, length: 3 }
          ]
        }
      ]
      store.highlightMatchesInHex = true
      const bytes = store.matchHighlightBytes
      expect(bytes).toHaveLength(5) // 0,1,2,3,4
      expect(new Set(bytes).size).toBe(5)
    })

    it('serializableState includes all relevant fields', () => {
      store.currentRules = 'rule test { condition: true }'
      store.selectedRuleSet = 'custom'
      store.highlightMatchesInHex = true

      const state = store.serializableState
      expect(state.currentRules).toBe('rule test { condition: true }')
      expect(state.selectedRuleSet).toBe('custom')
      expect(state.highlightMatchesInHex).toBe(true)
      expect(state).not.toHaveProperty('isScanning')
      expect(state).not.toHaveProperty('scanProgress')
      expect(state).not.toHaveProperty('error')
    })
  })

  // ── Actions ──

  describe('actions', () => {
    it('setRules updates rules and clears selection', () => {
      store.selectedRuleSet = 'malware_common'
      store.importedFileName = 'test.yar'
      store.setRules('rule new { condition: true }')
      expect(store.currentRules).toBe('rule new { condition: true }')
      expect(store.selectedRuleSet).toBeNull()
      expect(store.importedFileName).toBeNull()
    })

    it('selectBuiltInRuleSet sets rules and selection', () => {
      store.selectBuiltInRuleSet('malware_common', 'rule malware { condition: true }')
      expect(store.selectedRuleSet).toBe('malware_common')
      expect(store.currentRules).toBe('rule malware { condition: true }')
      expect(store.importedFileName).toBeNull()
    })

    it('setImportedRules sets filename and rules', () => {
      store.selectedRuleSet = 'malware_common'
      store.setImportedRules('custom.yar', 'rule imported { condition: true }')
      expect(store.importedFileName).toBe('custom.yar')
      expect(store.currentRules).toBe('rule imported { condition: true }')
      expect(store.selectedRuleSet).toBeNull()
    })

    it('setScanResults stores results and metadata', () => {
      store.isScanning = true
      store.setScanResults({
        compileErrors: [{ message: 'warning' }],
        consoleLogs: ['log1'],
        matchedRules: [{ ruleName: 'test', matches: [] }],
        duration: 1234
      })

      expect(store.compileErrors).toEqual([{ message: 'warning' }])
      expect(store.consoleLogs).toEqual(['log1'])
      expect(store.matchedRules).toHaveLength(1)
      expect(store.lastScanDuration).toBe(1234)
      expect(store.lastScanTimestamp).toBeTruthy()
      expect(store.isScanning).toBe(false)
      expect(store.scanProgress).toBe(100)
      expect(store.error).toBeNull()
    })

    it('setScanResults handles missing fields', () => {
      store.setScanResults({})
      expect(store.compileErrors).toEqual([])
      expect(store.consoleLogs).toEqual([])
      expect(store.matchedRules).toEqual([])
      expect(store.lastScanDuration).toBeNull()
    })

    it('clearResults resets scan-related state', () => {
      store.compileErrors = [{ message: 'err' }]
      store.matchedRules = [{ ruleName: 'test', matches: [] }]
      store.lastScanTimestamp = '2024-01-01'
      store.lastScanDuration = 500
      store.scanProgress = 100

      store.clearResults()
      expect(store.compileErrors).toEqual([])
      expect(store.consoleLogs).toEqual([])
      expect(store.matchedRules).toEqual([])
      expect(store.lastScanTimestamp).toBeNull()
      expect(store.lastScanDuration).toBeNull()
      expect(store.scanProgress).toBe(0)
      expect(store.error).toBeNull()
    })

    it('reset clears all state', () => {
      store.currentRules = 'rule test { condition: true }'
      store.selectedRuleSet = 'malware_common'
      store.importedFileName = 'test.yar'
      store.isScanning = true
      store.scanProgress = 50
      store.highlightMatchesInHex = true
      store.matchedRules = [{ ruleName: 'test', matches: [] }]

      store.reset()
      expect(store.currentRules).toBe('')
      expect(store.selectedRuleSet).toBeNull()
      expect(store.importedFileName).toBeNull()
      expect(store.isScanning).toBe(false)
      expect(store.scanProgress).toBe(0)
      expect(store.matchedRules).toEqual([])
      expect(store.highlightMatchesInHex).toBe(false)
    })

    it('restoreFromSession restores saved state', () => {
      const saved = {
        currentRules: 'rule restored { condition: true }',
        selectedRuleSet: 'packers',
        importedFileName: null,
        compileErrors: [],
        consoleLogs: ['log'],
        matchedRules: [{ ruleName: 'restored', matches: [{ offset: 0, length: 4 }] }],
        lastScanTimestamp: '2024-06-15T12:00:00Z',
        lastScanDuration: 789,
        highlightMatchesInHex: true
      }

      store.restoreFromSession(saved)
      expect(store.currentRules).toBe('rule restored { condition: true }')
      expect(store.selectedRuleSet).toBe('packers')
      expect(store.consoleLogs).toEqual(['log'])
      expect(store.matchedRules).toHaveLength(1)
      expect(store.lastScanDuration).toBe(789)
      expect(store.highlightMatchesInHex).toBe(true)
    })

    it('restoreFromSession handles null input', () => {
      store.currentRules = 'existing'
      store.restoreFromSession(null)
      expect(store.currentRules).toBe('existing')
    })

    it('restoreFromSession handles empty object', () => {
      store.restoreFromSession({})
      expect(store.currentRules).toBe('')
      expect(store.selectedRuleSet).toBeNull()
      expect(store.matchedRules).toEqual([])
    })

    it('toggleHexHighlight toggles the flag', () => {
      expect(store.highlightMatchesInHex).toBe(false)
      store.toggleHexHighlight()
      expect(store.highlightMatchesInHex).toBe(true)
      store.toggleHexHighlight()
      expect(store.highlightMatchesInHex).toBe(false)
    })
  })
})
