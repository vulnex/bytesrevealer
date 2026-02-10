import { describe, it, expect } from 'vitest'
import { extractResults } from './YaraWorker.js'

/**
 * Helper to create a mock collection with .size() / .get(i) interface,
 * mimicking the C++ collection objects returned by libyara-wasm.
 */
function mockCollection(items) {
  return {
    size: () => items.length,
    get: (i) => items[i]
  }
}

describe('YaraWorker extractResults', () => {
  it('extracts compile errors from collection', () => {
    const rawResult = {
      compileErrors: mockCollection([
        { type: 'error', lineNumber: 5, message: 'syntax error' },
        { type: 'warning', lineNumber: 10, message: 'unused variable' }
      ]),
      consoleLogs: mockCollection([]),
      matchedRules: mockCollection([])
    }

    const result = extractResults(rawResult)
    expect(result.compileErrors).toHaveLength(2)
    expect(result.compileErrors[0]).toEqual({
      type: 'error',
      lineNumber: 5,
      message: 'syntax error'
    })
    expect(result.compileErrors[1].type).toBe('warning')
  })

  it('extracts console logs from collection', () => {
    const rawResult = {
      compileErrors: mockCollection([]),
      consoleLogs: mockCollection(['log line 1', 'log line 2']),
      matchedRules: mockCollection([])
    }

    const result = extractResults(rawResult)
    expect(result.consoleLogs).toEqual(['log line 1', 'log line 2'])
  })

  it('extracts matched rules with resolved matches', () => {
    const rawResult = {
      compileErrors: mockCollection([]),
      consoleLogs: mockCollection([]),
      matchedRules: mockCollection([
        {
          ruleName: 'Suspicious_PE',
          tags: ['malware'],
          meta: { author: 'test' },
          resolvedMatches: mockCollection([
            {
              location: 100,
              matchLength: 14,
              stringIdentifier: '$api1',
              data: 'VirtualAlloc'
            },
            {
              location: 500,
              matchLength: 14,
              stringIdentifier: '$api2',
              data: 'VirtualProtect'
            }
          ])
        }
      ])
    }

    const result = extractResults(rawResult)
    expect(result.matchedRules).toHaveLength(1)
    expect(result.matchedRules[0].ruleName).toBe('Suspicious_PE')
    expect(result.matchedRules[0].tags).toEqual(['malware'])
    expect(result.matchedRules[0].matches).toHaveLength(2)
    expect(result.matchedRules[0].matches[0]).toEqual({
      offset: 100,
      length: 14,
      stringIdentifier: '$api1',
      data: 'VirtualAlloc'
    })
  })

  it('handles rules with no resolvedMatches', () => {
    const rawResult = {
      compileErrors: mockCollection([]),
      consoleLogs: mockCollection([]),
      matchedRules: mockCollection([
        { ruleName: 'Empty_Rule' }
      ])
    }

    const result = extractResults(rawResult)
    expect(result.matchedRules).toHaveLength(1)
    expect(result.matchedRules[0].ruleName).toBe('Empty_Rule')
    expect(result.matchedRules[0].matches).toEqual([])
  })

  it('handles completely empty raw result', () => {
    const result = extractResults({})
    expect(result.compileErrors).toEqual([])
    expect(result.consoleLogs).toEqual([])
    expect(result.matchedRules).toEqual([])
  })

  it('handles raw result with null collections', () => {
    const result = extractResults({
      compileErrors: null,
      consoleLogs: null,
      matchedRules: null
    })
    expect(result.compileErrors).toEqual([])
    expect(result.consoleLogs).toEqual([])
    expect(result.matchedRules).toEqual([])
  })

  it('handles multiple matched rules', () => {
    const rawResult = {
      compileErrors: mockCollection([]),
      consoleLogs: mockCollection([]),
      matchedRules: mockCollection([
        {
          ruleName: 'Rule_A',
          resolvedMatches: mockCollection([
            { location: 0, matchLength: 4, stringIdentifier: '$a', data: 'test' }
          ])
        },
        {
          ruleName: 'Rule_B',
          resolvedMatches: mockCollection([
            { location: 50, matchLength: 8, stringIdentifier: '$b', data: 'deadbeef' },
            { location: 100, matchLength: 8, stringIdentifier: '$b', data: 'cafebabe' }
          ])
        }
      ])
    }

    const result = extractResults(rawResult)
    expect(result.matchedRules).toHaveLength(2)
    expect(result.matchedRules[0].matches).toHaveLength(1)
    expect(result.matchedRules[1].matches).toHaveLength(2)
  })

  it('uses default values for missing match fields', () => {
    const rawResult = {
      compileErrors: mockCollection([]),
      consoleLogs: mockCollection([]),
      matchedRules: mockCollection([
        {
          resolvedMatches: mockCollection([{}])
        }
      ])
    }

    const result = extractResults(rawResult)
    expect(result.matchedRules[0].ruleName).toBe('Rule_0')
    expect(result.matchedRules[0].matches[0]).toEqual({
      offset: 0,
      length: 0,
      stringIdentifier: '',
      data: ''
    })
  })

  it('uses default values for missing compile error fields', () => {
    const rawResult = {
      compileErrors: mockCollection([{ message: 'some error' }]),
      consoleLogs: mockCollection([]),
      matchedRules: mockCollection([])
    }

    const result = extractResults(rawResult)
    expect(result.compileErrors[0]).toEqual({
      type: 'error',
      lineNumber: 0,
      message: 'some error'
    })
  })
})
