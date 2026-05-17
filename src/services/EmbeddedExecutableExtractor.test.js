import { describe, it, expect, vi } from 'vitest'
import {
  extractEmbedded,
  suggestFilename,
  peExtensionFor,
  EXTRACTION_SLICE_SIZE
} from './EmbeddedExecutableExtractor.js'

describe('peExtensionFor', () => {
  it('returns exe for plain executable', () => {
    expect(peExtensionFor(0)).toBe('exe')
    expect(peExtensionFor(0x0002)).toBe('exe')
  })

  it('returns dll when IMAGE_FILE_DLL is set', () => {
    expect(peExtensionFor(0x2000)).toBe('dll')
    expect(peExtensionFor(0x2002)).toBe('dll')
    // DLL flag wins over SYSTEM flag
    expect(peExtensionFor(0x3000)).toBe('dll')
  })

  it('returns sys when IMAGE_FILE_SYSTEM is set without DLL', () => {
    expect(peExtensionFor(0x1000)).toBe('sys')
    expect(peExtensionFor(0x1002)).toBe('sys')
  })

  it('returns exe when characteristics is undefined', () => {
    expect(peExtensionFor(undefined)).toBe('exe')
    expect(peExtensionFor(null)).toBe('exe')
  })
})

describe('suggestFilename', () => {
  it('builds PE exe filename with arch token', () => {
    const name = suggestFilename({
      format: 'PE',
      offset: 0x12340,
      details: { machine: 0x8664, characteristics: 0 }
    })
    expect(name).toBe('embedded_PE_x86-64_0x00012340.exe')
  })

  it('uses dll extension when Characteristics has IMAGE_FILE_DLL', () => {
    const name = suggestFilename({
      format: 'PE',
      offset: 0x100,
      details: { machine: 0x014c, characteristics: 0x2000 }
    })
    expect(name).toBe('embedded_PE_i386_0x00000100.dll')
  })

  it('uses sys extension when IMAGE_FILE_SYSTEM is set without DLL', () => {
    const name = suggestFilename({
      format: 'PE',
      offset: 0x200,
      details: { machine: 0xaa64, characteristics: 0x1000 }
    })
    expect(name).toBe('embedded_PE_ARM64_0x00000200.sys')
  })

  it('falls back to unknown-arch when machine type unknown', () => {
    const name = suggestFilename({
      format: 'PE',
      offset: 0x10,
      details: { machine: 0xdead, characteristics: 0 }
    })
    expect(name).toBe('embedded_PE_unknown-arch_0x00000010.exe')
  })

  it('builds ELF filename with no extension', () => {
    const name = suggestFilename({
      format: 'ELF',
      offset: 0x12340,
      details: { machine: 0x3e }
    })
    expect(name).toBe('embedded_ELF_x86-64_0x00012340')
  })

  it('builds Mach-O thin filename', () => {
    const name = suggestFilename({
      format: 'Mach-O',
      offset: 0x500,
      details: { cputype: 0x0100000c }
    })
    expect(name).toBe('embedded_MachO_ARM64_0x00000500')
  })

  it('builds Mach-O Fat filename with no arch token', () => {
    const name = suggestFilename({
      format: 'Mach-O Fat',
      offset: 0x800,
      details: {}
    })
    expect(name).toBe('embedded_MachO-Fat_0x00000800')
  })

  it('widens offset hex to 16 digits when above 32-bit range', () => {
    const name = suggestFilename({
      format: 'PE',
      offset: 0x100000000,
      details: { machine: 0x8664, characteristics: 0 }
    })
    expect(name).toBe('embedded_PE_x86-64_0x0000000100000000.exe')
  })
})

describe('extractEmbedded', () => {
  function makeSource(length, fill = 0xaa) {
    const buf = new Uint8Array(length).fill(fill)
    // Mark a sentinel range so we can verify which bytes were extracted
    for (let i = 0; i < length; i++) buf[i] = i & 0xff
    return buf
  }

  it('returns a Blob with the correct bytes and filename', async () => {
    const source = makeSource(0x4000)
    const finding = {
      format: 'PE',
      offset: 0x1000,
      fileSize: 0x800,
      extractable: true,
      details: { machine: 0x8664, characteristics: 0 }
    }
    const { blob, filename } = await extractEmbedded({ fileBytes: source, finding })
    expect(blob.size).toBe(0x800)
    expect(blob.type).toBe('application/vnd.microsoft.portable-executable')
    expect(filename).toBe('embedded_PE_x86-64_0x00001000.exe')
    // Verify content
    const buf = new Uint8Array(await blob.arrayBuffer())
    for (let i = 0; i < buf.length; i++) {
      expect(buf[i]).toBe((0x1000 + i) & 0xff)
    }
  })

  it('uses octet-stream MIME for non-PE formats', async () => {
    const source = makeSource(0x1000)
    const finding = {
      format: 'ELF',
      offset: 0,
      fileSize: 0x100,
      extractable: true,
      details: { machine: 0x3e }
    }
    const { blob } = await extractEmbedded({ fileBytes: source, finding })
    expect(blob.type).toBe('application/octet-stream')
  })

  it('clamps fileSize against actual source length (truncated embed)', async () => {
    const source = makeSource(0x800)
    const finding = {
      format: 'ELF',
      offset: 0x600,
      fileSize: 0x1000, // would run past EOF
      extractable: true,
      details: { machine: 0x3e }
    }
    const { blob } = await extractEmbedded({ fileBytes: source, finding })
    expect(blob.size).toBe(0x200) // only 0x800 - 0x600 = 0x200 available
  })

  it('streams in 1 MB slices and reports progress', async () => {
    // 3.5 MB extraction triggers 4 slices (1 MB, 1 MB, 1 MB, 0.5 MB)
    const SIZE = 3.5 * 1024 * 1024
    const source = makeSource(SIZE + 0x100)
    const finding = {
      format: 'PE',
      offset: 0,
      fileSize: SIZE,
      extractable: true,
      details: { machine: 0x8664, characteristics: 0 }
    }
    const onProgress = vi.fn()
    const { blob } = await extractEmbedded({ fileBytes: source, finding, onProgress })
    expect(blob.size).toBe(SIZE)
    // 4 slices expected
    expect(onProgress).toHaveBeenCalledTimes(4)
    // Last call should report full completion
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]
    expect(lastCall[0]).toBe(SIZE)
    expect(lastCall[1]).toBe(SIZE)
  })

  it('honours AbortSignal between slices', async () => {
    const SIZE = EXTRACTION_SLICE_SIZE * 3
    const source = makeSource(SIZE)
    const controller = new AbortController()
    const finding = {
      format: 'PE',
      offset: 0,
      fileSize: SIZE,
      extractable: true,
      details: { machine: 0x8664, characteristics: 0 }
    }
    const onProgress = vi.fn(() => {
      // Abort after the first slice
      if (onProgress.mock.calls.length === 1) controller.abort()
    })
    await expect(
      extractEmbedded({ fileBytes: source, finding, onProgress, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('throws if finding.extractable is false', async () => {
    const source = makeSource(0x100)
    await expect(
      extractEmbedded({
        fileBytes: source,
        finding: {
          format: 'PE',
          offset: 0,
          fileSize: 100,
          extractable: false,
          extractError: 'headers too large'
        }
      })
    ).rejects.toThrow(/headers too large/)
  })

  it('throws on invalid offset or fileSize', async () => {
    const source = makeSource(0x100)
    await expect(
      extractEmbedded({
        fileBytes: source,
        finding: { format: 'PE', offset: -1, fileSize: 10, extractable: true, details: {} }
      })
    ).rejects.toThrow()
    await expect(
      extractEmbedded({
        fileBytes: source,
        finding: { format: 'PE', offset: 0, fileSize: 0, extractable: true, details: {} }
      })
    ).rejects.toThrow()
  })

  it('returns no validationWarning when extracted header is valid', async () => {
    // Build a minimal valid ELF64 LE x86-64 header inside the source.
    const source = new Uint8Array(0x1000)
    const elf = new Uint8Array(64)
    elf[0] = 0x7f
    elf[1] = 0x45
    elf[2] = 0x4c
    elf[3] = 0x46
    elf[4] = 2 // 64-bit
    elf[5] = 1 // little-endian
    elf[6] = 1 // EI_VERSION
    elf[0x12] = 0x3e // e_machine = x86-64 (LE)
    elf[0x13] = 0x00
    source.set(elf, 0x100)
    const finding = {
      format: 'ELF',
      offset: 0x100,
      fileSize: 0x40,
      extractable: true,
      details: { machine: 0x3e }
    }
    const { validationWarning } = await extractEmbedded({ fileBytes: source, finding })
    expect(validationWarning).toBeUndefined()
  })

  it('attaches validationWarning when extracted header is corrupt', async () => {
    // PE format claimed, but bytes are all zero — validatePE will reject.
    const source = makeSource(0x1000)
    const finding = {
      format: 'PE',
      offset: 0x100,
      fileSize: 0x200,
      extractable: true,
      details: { machine: 0x8664, characteristics: 0 }
    }
    // makeSource fills with i & 0xff so byte at 0x100 is 0 (not 'M'). validatePE will fail.
    const { blob, validationWarning } = await extractEmbedded({ fileBytes: source, finding })
    expect(blob.size).toBe(0x200)
    expect(validationWarning).toMatch(/re-validation of extracted PE/)
  })

  it('supports a chunked-file wrapper with async slice()', async () => {
    const data = new Uint8Array(0x2000)
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff
    // Mimic the chunked wrapper exposed by FileChunkManager.initialize
    const chunked = {
      length: data.length,
      isChunked: true,
      slice: async (start, end) => data.subarray(start, end)
    }
    const finding = {
      format: 'ELF',
      offset: 0x100,
      fileSize: 0x400,
      extractable: true,
      details: { machine: 0x3e }
    }
    const { blob } = await extractEmbedded({ fileBytes: chunked, finding })
    const buf = new Uint8Array(await blob.arrayBuffer())
    expect(buf.length).toBe(0x400)
    expect(buf[0]).toBe(0x00) // 0x100 & 0xff = 0x00
    expect(buf[1]).toBe(0x01)
  })
})
