import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger } from './logger.js'

describe('Logger', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      group: vi.spyOn(console, 'group').mockImplementation(() => {}),
      groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      time: vi.spyOn(console, 'time').mockImplementation(() => {}),
      timeEnd: vi.spyOn(console, 'timeEnd').mockImplementation(() => {})
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.removeItem('debugMode')
    localStorage.removeItem('forceDebugMode')
  })

  it('createLogger returns a logger with the given namespace', () => {
    const logger = createLogger('TestModule')
    expect(logger.namespace).toBe('TestModule')
  })

  it('methods exist on logger instance', () => {
    const logger = createLogger('Test')
    expect(typeof logger.log).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.group).toBe('function')
    expect(typeof logger.groupEnd).toBe('function')
    expect(typeof logger.time).toBe('function')
    expect(typeof logger.timeEnd).toBe('function')
  })

  it('does not log when disabled', () => {
    localStorage.removeItem('debugMode')
    const logger = createLogger('Quiet')
    logger.log('should not appear')
    logger.info('should not appear')
    logger.warn('should not appear')
    logger.debug('should not appear')
    expect(consoleSpy.log).not.toHaveBeenCalled()
    expect(consoleSpy.info).not.toHaveBeenCalled()
    expect(consoleSpy.warn).not.toHaveBeenCalled()
    expect(consoleSpy.debug).not.toHaveBeenCalled()
  })

  it('logs when debugMode is enabled', () => {
    localStorage.setItem('debugMode', 'true')
    const logger = createLogger('Active')
    logger.log('hello')
    expect(consoleSpy.log).toHaveBeenCalledWith('[Active]', 'hello')
  })

  it('info logs with namespace prefix', () => {
    localStorage.setItem('debugMode', 'true')
    const logger = createLogger('Mod')
    logger.info('data', 42)
    expect(consoleSpy.info).toHaveBeenCalledWith('[Mod]', 'data', 42)
  })

  it('warn logs with namespace prefix', () => {
    localStorage.setItem('debugMode', 'true')
    const logger = createLogger('Mod')
    logger.warn('caution')
    expect(consoleSpy.warn).toHaveBeenCalledWith('[Mod]', 'caution')
  })

  it('group and groupEnd delegate', () => {
    localStorage.setItem('debugMode', 'true')
    const logger = createLogger('G')
    logger.group('section')
    expect(consoleSpy.group).toHaveBeenCalledWith('[G] section')
    logger.groupEnd()
    expect(consoleSpy.groupEnd).toHaveBeenCalled()
  })

  it('time and timeEnd delegate', () => {
    localStorage.setItem('debugMode', 'true')
    const logger = createLogger('T')
    logger.time('op')
    expect(consoleSpy.time).toHaveBeenCalledWith('[T] op')
    logger.timeEnd('op')
    expect(consoleSpy.timeEnd).toHaveBeenCalledWith('[T] op')
  })
})
