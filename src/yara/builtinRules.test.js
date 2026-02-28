import { describe, it, expect } from 'vitest'
import { BUILTIN_RULE_SETS } from './builtinRules.js'

describe('BUILTIN_RULE_SETS', () => {
  it('exports an array of rule sets', () => {
    expect(Array.isArray(BUILTIN_RULE_SETS)).toBe(true)
    expect(BUILTIN_RULE_SETS.length).toBeGreaterThan(0)
  })

  it('contains all expected rule sets', () => {
    const ids = BUILTIN_RULE_SETS.map((rs) => rs.id)
    expect(ids).toContain('malware_common')
    expect(ids).toContain('crypto_indicators')
    expect(ids).toContain('packers')
    expect(ids).toContain('suspicious_strings')
  })

  it('has exactly 4 rule sets', () => {
    expect(BUILTIN_RULE_SETS).toHaveLength(4)
  })

  describe('each rule set', () => {
    BUILTIN_RULE_SETS.forEach((ruleSet) => {
      describe(`"${ruleSet.id}"`, () => {
        it('has required fields', () => {
          expect(ruleSet).toHaveProperty('id')
          expect(ruleSet).toHaveProperty('name')
          expect(ruleSet).toHaveProperty('description')
          expect(ruleSet).toHaveProperty('rules')
        })

        it('has non-empty id', () => {
          expect(typeof ruleSet.id).toBe('string')
          expect(ruleSet.id.length).toBeGreaterThan(0)
        })

        it('has non-empty name', () => {
          expect(typeof ruleSet.name).toBe('string')
          expect(ruleSet.name.length).toBeGreaterThan(0)
        })

        it('has non-empty description', () => {
          expect(typeof ruleSet.description).toBe('string')
          expect(ruleSet.description.length).toBeGreaterThan(0)
        })

        it('has non-empty rules containing "rule" keyword', () => {
          expect(typeof ruleSet.rules).toBe('string')
          expect(ruleSet.rules.length).toBeGreaterThan(0)
          expect(ruleSet.rules).toMatch(/rule\s+\w+/)
        })

        it('has rules containing "condition:" keyword', () => {
          expect(ruleSet.rules).toContain('condition:')
        })

        it('has rules containing "strings:" keyword', () => {
          expect(ruleSet.rules).toContain('strings:')
        })
      })
    })
  })

  it('has unique IDs across all rule sets', () => {
    const ids = BUILTIN_RULE_SETS.map((rs) => rs.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('has unique names across all rule sets', () => {
    const names = BUILTIN_RULE_SETS.map((rs) => rs.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(names.length)
  })
})
