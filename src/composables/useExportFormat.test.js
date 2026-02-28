import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { useExportFormat } from './useExportFormat'

describe('useExportFormat', () => {
  describe('initial state', () => {
    it('selectedLanguage defaults to javascript', () => {
      const { selectedLanguage } = useExportFormat()
      expect(selectedLanguage.value).toBe('javascript')
    })

    it('selectedFormat defaults to js-uint8array', () => {
      const { selectedFormat } = useExportFormat()
      expect(selectedFormat.value).toBe('js-uint8array')
    })

    it('options have correct defaults', () => {
      const { options } = useExportFormat()
      expect(options.value).toEqual({
        variableName: 'data',
        splitLines: true,
        bytesPerLine: 16,
        includeOffset: false,
        uppercase: true
      })
    })
  })

  describe('languages', () => {
    it('has 10 languages', () => {
      const { languages } = useExportFormat()
      expect(languages).toHaveLength(10)
    })

    it('each language has id and name', () => {
      const { languages } = useExportFormat()
      for (const lang of languages) {
        expect(lang).toHaveProperty('id')
        expect(lang).toHaveProperty('name')
        expect(typeof lang.id).toBe('string')
        expect(typeof lang.name).toBe('string')
      }
    })

    it('includes expected language ids', () => {
      const { languages } = useExportFormat()
      const ids = languages.map((l) => l.id)
      expect(ids).toContain('javascript')
      expect(ids).toContain('python')
      expect(ids).toContain('c')
      expect(ids).toContain('java')
      expect(ids).toContain('csharp')
      expect(ids).toContain('go')
      expect(ids).toContain('rust')
      expect(ids).toContain('assembler')
      expect(ids).toContain('clang')
      expect(ids).toContain('data')
    })
  })

  describe('formats', () => {
    it('has formats for every language', () => {
      const { languages, formats } = useExportFormat()
      for (const lang of languages) {
        expect(formats[lang.id]).toBeDefined()
        expect(formats[lang.id].length).toBeGreaterThan(0)
      }
    })

    it('each format has id and name', () => {
      const { formats } = useExportFormat()
      for (const langFormats of Object.values(formats)) {
        for (const fmt of langFormats) {
          expect(fmt).toHaveProperty('id')
          expect(fmt).toHaveProperty('name')
          expect(typeof fmt.id).toBe('string')
          expect(typeof fmt.name).toBe('string')
        }
      }
    })

    it('javascript has 4 formats', () => {
      const { formats } = useExportFormat()
      expect(formats.javascript).toHaveLength(4)
    })

    it('python has 4 formats', () => {
      const { formats } = useExportFormat()
      expect(formats.python).toHaveLength(4)
    })

    it('data has 9 formats', () => {
      const { formats } = useExportFormat()
      expect(formats.data).toHaveLength(9)
    })

    it('all format ids are unique', () => {
      const { formats } = useExportFormat()
      const allIds = Object.values(formats)
        .flat()
        .map((f) => f.id)
      expect(new Set(allIds).size).toBe(allIds.length)
    })
  })

  describe('currentFormats', () => {
    it('returns javascript formats by default', () => {
      const { currentFormats, formats } = useExportFormat()
      expect(currentFormats.value).toEqual(formats.javascript)
    })

    it('updates when selectedLanguage changes', () => {
      const { selectedLanguage, currentFormats, formats } = useExportFormat()
      selectedLanguage.value = 'python'
      expect(currentFormats.value).toEqual(formats.python)
    })

    it('returns empty array for unknown language', () => {
      const { selectedLanguage, currentFormats } = useExportFormat()
      selectedLanguage.value = 'nonexistent'
      expect(currentFormats.value).toEqual([])
    })
  })

  describe('syntaxClass', () => {
    it('returns syntax-javascript for javascript', () => {
      const { syntaxClass } = useExportFormat()
      expect(syntaxClass.value).toBe('syntax-javascript')
    })

    it('returns syntax-python for python', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'python'
      expect(syntaxClass.value).toBe('syntax-python')
    })

    it('returns syntax-plain for data', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'data'
      expect(syntaxClass.value).toBe('syntax-plain')
    })

    it('returns syntax-asm for assembler', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'assembler'
      expect(syntaxClass.value).toBe('syntax-asm')
    })

    it('returns syntax-c for clang', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'clang'
      expect(syntaxClass.value).toBe('syntax-c')
    })

    it('returns syntax-c for c', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'c'
      expect(syntaxClass.value).toBe('syntax-c')
    })

    it('returns syntax-go for go', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'go'
      expect(syntaxClass.value).toBe('syntax-go')
    })

    it('returns syntax-rust for rust', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'rust'
      expect(syntaxClass.value).toBe('syntax-rust')
    })

    it('returns syntax-java for java', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'java'
      expect(syntaxClass.value).toBe('syntax-java')
    })

    it('returns syntax-csharp for csharp', () => {
      const { selectedLanguage, syntaxClass } = useExportFormat()
      selectedLanguage.value = 'csharp'
      expect(syntaxClass.value).toBe('syntax-csharp')
    })
  })

  describe('language change watcher', () => {
    it('auto-selects first format when language changes to python', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'python'
      await nextTick()
      expect(selectedFormat.value).toBe('py-bytes')
    })

    it('auto-selects first format when language changes to c', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'c'
      await nextTick()
      expect(selectedFormat.value).toBe('c-array')
    })

    it('auto-selects first format when language changes to java', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'java'
      await nextTick()
      expect(selectedFormat.value).toBe('java-array')
    })

    it('auto-selects first format when language changes to csharp', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'csharp'
      await nextTick()
      expect(selectedFormat.value).toBe('csharp-array')
    })

    it('auto-selects first format when language changes to go', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'go'
      await nextTick()
      expect(selectedFormat.value).toBe('go-slice')
    })

    it('auto-selects first format when language changes to rust', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'rust'
      await nextTick()
      expect(selectedFormat.value).toBe('rust-vec')
    })

    it('auto-selects first format when language changes to assembler', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'assembler'
      await nextTick()
      expect(selectedFormat.value).toBe('asm-db')
    })

    it('auto-selects first format when language changes to clang', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'clang'
      await nextTick()
      expect(selectedFormat.value).toBe('clang-array')
    })

    it('auto-selects first format when language changes to data', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'data'
      await nextTick()
      expect(selectedFormat.value).toBe('hex')
    })

    it('auto-selects first format when switching back to javascript', async () => {
      const { selectedLanguage, selectedFormat } = useExportFormat()
      selectedLanguage.value = 'python'
      await nextTick()
      expect(selectedFormat.value).toBe('py-bytes')

      selectedLanguage.value = 'javascript'
      await nextTick()
      expect(selectedFormat.value).toBe('js-uint8array')
    })
  })

  describe('options mutability', () => {
    it('variableName can be changed', () => {
      const { options } = useExportFormat()
      options.value.variableName = 'buffer'
      expect(options.value.variableName).toBe('buffer')
    })

    it('splitLines can be toggled', () => {
      const { options } = useExportFormat()
      options.value.splitLines = false
      expect(options.value.splitLines).toBe(false)
    })

    it('bytesPerLine can be changed', () => {
      const { options } = useExportFormat()
      options.value.bytesPerLine = 32
      expect(options.value.bytesPerLine).toBe(32)
    })

    it('includeOffset can be toggled', () => {
      const { options } = useExportFormat()
      options.value.includeOffset = true
      expect(options.value.includeOffset).toBe(true)
    })

    it('uppercase can be toggled', () => {
      const { options } = useExportFormat()
      options.value.uppercase = false
      expect(options.value.uppercase).toBe(false)
    })
  })

  describe('instance isolation', () => {
    it('separate instances have independent state', async () => {
      const instance1 = useExportFormat()
      const instance2 = useExportFormat()

      instance1.selectedLanguage.value = 'python'
      await nextTick()

      expect(instance1.selectedLanguage.value).toBe('python')
      expect(instance2.selectedLanguage.value).toBe('javascript')
      expect(instance1.selectedFormat.value).toBe('py-bytes')
      expect(instance2.selectedFormat.value).toBe('js-uint8array')
    })

    it('options changes do not leak between instances', () => {
      const instance1 = useExportFormat()
      const instance2 = useExportFormat()

      instance1.options.value.variableName = 'buffer'
      expect(instance2.options.value.variableName).toBe('data')
    })
  })
})
