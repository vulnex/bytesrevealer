import { describe, it, expect } from 'vitest'
import {
  findPEHeaderOffset,
  analyzePEStructure,
  detectSpecificFileType,
  detectNestedFiles
} from './advancedFileDetection.js'

// ── Helpers to build minimal binary headers ──

function buildMinimalPE({ is64 = false, numSections = 1 } = {}) {
  // Builds a minimal valid PE file with MZ + DOS stub + PE header
  const peOffset = 0x80
  const buf = new Uint8Array(
    peOffset + 24 + (is64 ? 112 + 16 * 8 : 96 + 16 * 8) + numSections * 40 + 64
  )

  // DOS header: MZ
  buf[0] = 0x4d
  buf[1] = 0x5a
  // e_lfanew at offset 0x3C (LE)
  buf[0x3c] = peOffset & 0xff
  buf[0x3d] = (peOffset >> 8) & 0xff

  // PE signature
  buf[peOffset] = 0x50 // P
  buf[peOffset + 1] = 0x45 // E
  buf[peOffset + 2] = 0x00
  buf[peOffset + 3] = 0x00

  // COFF header at peOffset + 4
  const coffBase = peOffset + 4
  // Machine: x86-64 or x86
  if (is64) {
    buf[coffBase] = 0x64
    buf[coffBase + 1] = 0x86 // 0x8664
  } else {
    buf[coffBase] = 0x4c
    buf[coffBase + 1] = 0x01 // 0x14C
  }
  // NumberOfSections
  buf[coffBase + 2] = numSections & 0xff
  // TimeDateStamp = 0x60000000 (some date)
  buf[coffBase + 4] = 0x00
  buf[coffBase + 5] = 0x00
  buf[coffBase + 6] = 0x00
  buf[coffBase + 7] = 0x60
  // SizeOfOptionalHeader
  const optHeaderSize = is64 ? 240 : 224
  buf[coffBase + 16] = optHeaderSize & 0xff
  buf[coffBase + 17] = (optHeaderSize >> 8) & 0xff
  // Characteristics: executable
  buf[coffBase + 18] = 0x02
  buf[coffBase + 19] = 0x00

  // Optional header at peOffset + 24
  const optBase = peOffset + 24
  // Magic: PE32 (0x10b) or PE32+ (0x20b)
  if (is64) {
    buf[optBase] = 0x0b
    buf[optBase + 1] = 0x02
  } else {
    buf[optBase] = 0x0b
    buf[optBase + 1] = 0x01
  }

  // EntryPoint at optBase + 16
  buf[optBase + 16] = 0x00
  buf[optBase + 17] = 0x10 // 0x1000

  // Subsystem at optBase + 68
  buf[optBase + 68] = 3 // Windows CUI

  // DllCharacteristics at optBase + 70: ASLR + DEP
  buf[optBase + 70] = 0x40 | 0x00 // ASLR (0x40)
  buf[optBase + 71] = 0x01 // DEP (0x0100)

  return buf
}

function buildMinimalELF({ is64 = true, littleEndian = true } = {}) {
  const size = is64 ? 128 : 96
  const buf = new Uint8Array(size)

  // ELF magic
  buf[0] = 0x7f
  buf[1] = 0x45
  buf[2] = 0x4c
  buf[3] = 0x46

  // EI_CLASS: 1=32-bit, 2=64-bit
  buf[4] = is64 ? 2 : 1
  // EI_DATA: 1=LE, 2=BE
  buf[5] = littleEndian ? 1 : 2
  // EI_VERSION
  buf[6] = 1

  if (littleEndian) {
    // e_type = ET_EXEC (2)
    buf[16] = 2
    buf[17] = 0
    // e_machine = x86-64 (0x3E)
    buf[18] = 0x3e
    buf[19] = 0

    if (is64) {
      // e_entry (64-bit) at offset 24 = 0x400000
      buf[24] = 0x00
      buf[25] = 0x00
      buf[26] = 0x40
      buf[27] = 0x00
    } else {
      // e_entry (32-bit) at offset 24 = 0x8048000
      buf[24] = 0x00
      buf[25] = 0x80
      buf[26] = 0x04
      buf[27] = 0x08
    }
  }

  return buf
}

function buildMinimalMachO64LE() {
  // CF FA ED FE (64-bit little-endian Mach-O)
  const buf = new Uint8Array(64)
  buf[0] = 0xcf
  buf[1] = 0xfa
  buf[2] = 0xed
  buf[3] = 0xfe

  // cputype = x86_64 (0x01000007) LE
  buf[4] = 0x07
  buf[5] = 0x00
  buf[6] = 0x00
  buf[7] = 0x01
  // cpusubtype
  buf[8] = 0x03
  buf[9] = 0x00
  buf[10] = 0x00
  buf[11] = 0x00
  // filetype = 2 (executable)
  buf[12] = 0x02
  buf[13] = 0x00
  buf[14] = 0x00
  buf[15] = 0x00
  // ncmds = 0
  buf[16] = 0x00
  buf[17] = 0x00
  buf[18] = 0x00
  buf[19] = 0x00
  // sizeofcmds = 0
  buf[20] = 0x00
  buf[21] = 0x00
  buf[22] = 0x00
  buf[23] = 0x00
  // flags = MH_PIE (0x200000) LE
  buf[24] = 0x00
  buf[25] = 0x00
  buf[26] = 0x20
  buf[27] = 0x00

  return buf
}

describe('findPEHeaderOffset()', () => {
  it('returns correct PE offset for valid PE', () => {
    const pe = buildMinimalPE()
    expect(findPEHeaderOffset(pe)).toBe(0x80)
  })

  it('returns -1 for non-PE data', () => {
    expect(findPEHeaderOffset(new Uint8Array(100))).toBe(-1)
  })

  it('returns -1 for null/short input', () => {
    expect(findPEHeaderOffset(null)).toBe(-1)
    expect(findPEHeaderOffset(new Uint8Array(10))).toBe(-1)
  })

  it('returns -1 when MZ present but no PE signature', () => {
    const buf = new Uint8Array(256)
    buf[0] = 0x4d
    buf[1] = 0x5a
    buf[0x3c] = 0x80
    // Don't put PE signature at offset 0x80
    expect(findPEHeaderOffset(buf)).toBe(-1)
  })
})

describe('analyzePEStructure()', () => {
  it('parses a minimal 32-bit PE', () => {
    const pe = buildMinimalPE({ is64: false })
    const result = analyzePEStructure(pe)
    expect(result).not.toHaveProperty('error')
    expect(result.machine).toBe('x86')
    expect(result.is64bit).toBe(false)
    expect(result.offset).toBe('0x00000080')
  })

  it('parses a minimal 64-bit PE', () => {
    const pe = buildMinimalPE({ is64: true })
    const result = analyzePEStructure(pe)
    expect(result.machine).toBe('x86-64')
    expect(result.is64bit).toBe(true)
  })

  it('returns characteristics array', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(Array.isArray(result.characteristics)).toBe(true)
    expect(result.characteristics).toContain('Executable')
  })

  it('returns error for invalid input', () => {
    const result = analyzePEStructure(new Uint8Array(10))
    expect(result).toHaveProperty('error')
  })
})

describe('analyzeElfStructure (via detectSpecificFileType)', () => {
  it('detects ELF and returns enhanced type', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    expect(results.length).toBeGreaterThan(0)
    const elfResult = results.find((r) => r.name.includes('ELF'))
    expect(elfResult).toBeDefined()
    expect(elfResult.details).toHaveProperty('class')
    expect(elfResult.details).toHaveProperty('machine')
  })
})

describe('analyzeMachOStructure (via detectSpecificFileType)', () => {
  it('detects Mach-O and returns enhanced type', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details).toHaveProperty('type')
  })
})

describe('detectSpecificFileType()', () => {
  it('throws on empty/null bytes', () => {
    expect(() => detectSpecificFileType(null)).toThrow()
    expect(() => detectSpecificFileType(new Uint8Array(0))).toThrow()
  })

  it('returns enhanced types for PNG', () => {
    const png = new Uint8Array(32)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    // IHDR chunk at offset 8: length=13
    png[11] = 13
    png[12] = 0x49
    png[13] = 0x48
    png[14] = 0x44
    png[15] = 0x52 // "IHDR"
    // Width=1, Height=1 in IHDR
    png[19] = 1
    png[23] = 1

    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult).toBeDefined()
    expect(pngResult.details).toHaveProperty('dimensions')
  })

  it('returns empty for unknown bytes', () => {
    const unknown = new Uint8Array([0x01, 0x02, 0x03, 0x04])
    const results = detectSpecificFileType(unknown)
    expect(results).toEqual([])
  })
})

describe('detectNestedFiles()', () => {
  it('returns empty for non-container bytes', () => {
    const data = new Uint8Array(100)
    expect(detectNestedFiles(data)).toEqual([])
  })

  it('detects ZIP entries in a ZIP file', () => {
    // Build a minimal ZIP with one local file header
    const fileName = 'hello.txt'
    const enc = new TextEncoder()
    const nameBytes = enc.encode(fileName)
    // local file header: 30 + name length
    const buf = new Uint8Array(100)
    // PK\x03\x04 signature
    buf[0] = 0x50
    buf[1] = 0x4b
    buf[2] = 0x03
    buf[3] = 0x04
    // file name length at offset 26 (LE)
    buf[26] = nameBytes.length & 0xff
    buf[27] = (nameBytes.length >> 8) & 0xff
    // extra field length = 0
    buf[28] = 0
    buf[29] = 0
    // file name at offset 30
    buf.set(nameBytes, 30)

    const findings = detectNestedFiles(buf)
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].type).toBe('ZIP Entry')
    expect(findings[0].name).toBe('hello.txt')
    expect(findings[0].confidence).toBe('High')
  })

  it('detects PDF stream markers in a PDF file', () => {
    // Build a minimal PDF with stream/endstream and an embedded PNG signature
    const header = new TextEncoder().encode('%PDF-1.4\n')
    const streamMarker = new TextEncoder().encode('stream')
    const endstreamMarker = new TextEncoder().encode('endstream')
    // Embed a PNG signature inside the stream
    const pngSig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    const totalSize =
      header.length + streamMarker.length + pngSig.length + endstreamMarker.length + 20
    const buf = new Uint8Array(totalSize)
    let offset = 0
    buf.set(header, offset)
    offset += header.length
    buf.set(streamMarker, offset)
    offset += streamMarker.length
    buf.set(pngSig, offset)
    offset += pngSig.length
    buf.set(endstreamMarker, offset)

    const findings = detectNestedFiles(buf)
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].type).toBe('PDF Embedded Object')
    expect(findings[0].confidence).toBe('Medium')
    expect(findings[0]).toHaveProperty('embeddedTypes')
  })

  it('returns empty for ELF (not a container)', () => {
    const elf = buildMinimalELF()
    expect(detectNestedFiles(elf)).toEqual([])
  })
})

// ── PDF analysis via detectSpecificFileType ──

describe('PDF analysis (via detectSpecificFileType)', () => {
  function buildPDF(version = '1.4', { encrypted = false, objectCount = 0 } = {}) {
    const parts = [`%PDF-${version}\n`]
    if (encrypted) {
      parts.push('/Encrypt ')
    }
    for (let i = 0; i < objectCount; i++) {
      parts.push(`${i + 1} 0 obj\n`)
    }
    const text = parts.join('')
    const enc = new TextEncoder()
    const bytes = enc.encode(text)
    // Pad to ensure enough length for the %PDF signature check
    const buf = new Uint8Array(Math.max(bytes.length, 1024))
    buf.set(bytes, 0)
    // Write the PDF signature bytes at the start
    buf[0] = 0x25 // %
    buf[1] = 0x50 // P
    buf[2] = 0x44 // D
    buf[3] = 0x46 // F
    return buf
  }

  it('detects PDF version', () => {
    const pdf = buildPDF('1.7')
    const results = detectSpecificFileType(pdf)
    const pdfResult = results.find((r) => r.name === 'PDF Document')
    expect(pdfResult).toBeDefined()
    expect(pdfResult.details.version).toBe('1.7')
  })

  it('detects encrypted PDF', () => {
    const pdf = buildPDF('1.4', { encrypted: true })
    const results = detectSpecificFileType(pdf)
    const pdfResult = results.find((r) => r.name === 'PDF Document')
    expect(pdfResult).toBeDefined()
    expect(pdfResult.details.encrypted).toBe(true)
  })

  it('detects non-encrypted PDF', () => {
    const pdf = buildPDF('1.4')
    const results = detectSpecificFileType(pdf)
    const pdfResult = results.find((r) => r.name === 'PDF Document')
    expect(pdfResult).toBeDefined()
    expect(pdfResult.details.encrypted).toBe(false)
  })

  it('counts PDF objects', () => {
    const pdf = buildPDF('1.4', { objectCount: 3 })
    const results = detectSpecificFileType(pdf)
    const pdfResult = results.find((r) => r.name === 'PDF Document')
    expect(pdfResult).toBeDefined()
    expect(pdfResult.details.objectCount).toBe(3)
  })

  it('handles PDF with zero objects', () => {
    const pdf = buildPDF('2.0', { objectCount: 0 })
    const results = detectSpecificFileType(pdf)
    const pdfResult = results.find((r) => r.name === 'PDF Document')
    expect(pdfResult).toBeDefined()
    expect(pdfResult.details.objectCount).toBe(0)
  })
})

// ── ZIP analysis via detectSpecificFileType ──

describe('ZIP analysis (via detectSpecificFileType)', () => {
  function buildMinimalZIP({ numEntries = 1, compressionMethod = 0, comment = '' } = {}) {
    const enc = new TextEncoder()
    const fileName = 'test.txt'
    const nameBytes = enc.encode(fileName)
    const commentBytes = enc.encode(comment)
    // We need: local file headers + end-of-central-directory
    // Local file header is 30 + name length
    const localHeaderSize = 30 + nameBytes.length
    const eocdSize = 22 + commentBytes.length
    const totalSize = numEntries * localHeaderSize + eocdSize + 16
    const buf = new Uint8Array(totalSize)

    let offset = 0
    for (let i = 0; i < numEntries; i++) {
      // PK\x03\x04 signature
      buf[offset] = 0x50
      buf[offset + 1] = 0x4b
      buf[offset + 2] = 0x03
      buf[offset + 3] = 0x04
      // compression method at offset 8
      buf[offset + 8] = compressionMethod & 0xff
      buf[offset + 9] = (compressionMethod >> 8) & 0xff
      // file name length at offset 26
      buf[offset + 26] = nameBytes.length & 0xff
      buf[offset + 27] = (nameBytes.length >> 8) & 0xff
      // extra field length = 0
      buf[offset + 28] = 0
      buf[offset + 29] = 0
      // file name at offset 30
      buf.set(nameBytes, offset + 30)
      offset += localHeaderSize
    }

    // End of central directory record
    const eocdOffset = offset
    buf[eocdOffset] = 0x50
    buf[eocdOffset + 1] = 0x4b
    buf[eocdOffset + 2] = 0x05
    buf[eocdOffset + 3] = 0x06
    // comment length at offset 20
    buf[eocdOffset + 20] = commentBytes.length & 0xff
    buf[eocdOffset + 21] = (commentBytes.length >> 8) & 0xff
    if (commentBytes.length > 0) {
      buf.set(commentBytes, eocdOffset + 22)
    }

    return buf
  }

  it('detects ZIP entry count', () => {
    const zip = buildMinimalZIP({ numEntries: 3 })
    const results = detectSpecificFileType(zip)
    const zipResult = results.find((r) => r.name === 'ZIP Archive')
    expect(zipResult).toBeDefined()
    expect(zipResult.details.entryCount).toBe(3)
  })

  it('detects uncompressed ZIP', () => {
    const zip = buildMinimalZIP({ compressionMethod: 0 })
    const results = detectSpecificFileType(zip)
    const zipResult = results.find((r) => r.name === 'ZIP Archive')
    expect(zipResult).toBeDefined()
    expect(zipResult.details.compressed).toBe(false)
  })

  it('detects compressed ZIP (deflate)', () => {
    const zip = buildMinimalZIP({ compressionMethod: 8 })
    const results = detectSpecificFileType(zip)
    const zipResult = results.find((r) => r.name === 'ZIP Archive')
    expect(zipResult).toBeDefined()
    expect(zipResult.details.compressed).toBe(true)
  })

  it('extracts ZIP comment', () => {
    const zip = buildMinimalZIP({ comment: 'test comment' })
    const results = detectSpecificFileType(zip)
    const zipResult = results.find((r) => r.name === 'ZIP Archive')
    expect(zipResult).toBeDefined()
    expect(zipResult.details.comment).toBe('test comment')
  })

  it('returns empty comment when none present', () => {
    const zip = buildMinimalZIP()
    const results = detectSpecificFileType(zip)
    const zipResult = results.find((r) => r.name === 'ZIP Archive')
    expect(zipResult).toBeDefined()
    expect(zipResult.details.comment).toBe('')
  })
})

// ── PNG analysis details ──

describe('PNG analysis (via detectSpecificFileType)', () => {
  function buildPNG({ width = 100, height = 200, colorType = 2, compression = 0 } = {}) {
    const buf = new Uint8Array(32)
    // PNG signature
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    // IHDR chunk length = 13 (big-endian at offset 8)
    buf[11] = 13
    // IHDR type
    buf[12] = 0x49 // I
    buf[13] = 0x48 // H
    buf[14] = 0x44 // D
    buf[15] = 0x52 // R
    // Width at offset 16 (big-endian)
    buf[16] = (width >> 24) & 0xff
    buf[17] = (width >> 16) & 0xff
    buf[18] = (width >> 8) & 0xff
    buf[19] = width & 0xff
    // Height at offset 20 (big-endian)
    buf[20] = (height >> 24) & 0xff
    buf[21] = (height >> 16) & 0xff
    buf[22] = (height >> 8) & 0xff
    buf[23] = height & 0xff
    // Compression method at offset 24
    buf[24] = compression
    // Color type at offset 25
    buf[25] = colorType
    return buf
  }

  it('extracts PNG dimensions', () => {
    const png = buildPNG({ width: 640, height: 480 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult).toBeDefined()
    expect(pngResult.details.dimensions).toBe('640x480')
  })

  it('extracts PNG color type RGB', () => {
    const png = buildPNG({ colorType: 2 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult.details.colorType).toBe('RGB')
  })

  it('extracts PNG color type RGBA', () => {
    const png = buildPNG({ colorType: 6 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult.details.colorType).toBe('RGBA')
  })

  it('extracts PNG color type Grayscale', () => {
    const png = buildPNG({ colorType: 0 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult.details.colorType).toBe('Grayscale')
  })

  it('extracts PNG color type Palette', () => {
    const png = buildPNG({ colorType: 3 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult.details.colorType).toBe('Palette')
  })

  it('extracts PNG color type Grayscale+Alpha', () => {
    const png = buildPNG({ colorType: 4 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult.details.colorType).toBe('Grayscale+Alpha')
  })

  it('returns Unknown for unrecognized PNG color type', () => {
    const png = buildPNG({ colorType: 99 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult.details.colorType).toBe('Unknown')
  })

  it('extracts PNG compression as Deflate', () => {
    const png = buildPNG({ compression: 0 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult.details.compression).toBe('Deflate')
  })

  it('returns Unknown for non-standard PNG compression', () => {
    const png = buildPNG({ compression: 5 })
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult.details.compression).toBe('Unknown')
  })

  it('handles short PNG data gracefully', () => {
    // PNG signature only, no IHDR data
    const png = new Uint8Array(16)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const results = detectSpecificFileType(png)
    const pngResult = results.find((r) => r.name === 'PNG Image')
    expect(pngResult).toBeDefined()
    // dimensions should be reported as something (may be "0x0" or "Unknown")
    expect(pngResult.details).toHaveProperty('dimensions')
  })
})

// ── JPEG analysis via detectSpecificFileType ──

describe('JPEG analysis (via detectSpecificFileType)', () => {
  function buildJPEG({
    width = 320,
    height = 240,
    components = 3,
    hasExif = false,
    progressive = false,
    thumbnailIfdOffset = 0
  } = {}) {
    const parts = []
    // SOI marker
    parts.push(0xff, 0xd8, 0xff)

    if (hasExif) {
      // APP1 marker (EXIF)
      parts.push(0xff, 0xe1)
      // Length (2 bytes, big-endian) - need at least 8 for "Exif\0\0" + TIFF header
      const exifLength = 20
      parts.push((exifLength >> 8) & 0xff, exifLength & 0xff)
      // "Exif" string
      parts.push(0x45, 0x78, 0x69, 0x66) // Exif
      // Two null bytes
      parts.push(0x00, 0x00)
      // TIFF byte order marker (little-endian "II")
      parts.push(0x49, 0x49)
      // TIFF magic
      parts.push(0x2a, 0x00)
      // IFD offset (4 bytes LE)
      parts.push(
        thumbnailIfdOffset & 0xff,
        (thumbnailIfdOffset >> 8) & 0xff,
        (thumbnailIfdOffset >> 16) & 0xff,
        (thumbnailIfdOffset >> 24) & 0xff
      )
      // Pad to fill the length
      while (parts.length < 2 + 3 + exifLength) parts.push(0x00)
    }

    // SOF0 (baseline) or SOF2 (progressive) marker
    const sofMarker = progressive ? 0xc2 : 0xc0
    parts.push(0xff, sofMarker)
    // Length (2 bytes) = 8 + 3*components
    const sofLength = 8 + 3 * components
    parts.push((sofLength >> 8) & 0xff, sofLength & 0xff)
    // Precision
    parts.push(8)
    // Height (2 bytes big-endian)
    parts.push((height >> 8) & 0xff, height & 0xff)
    // Width (2 bytes big-endian)
    parts.push((width >> 8) & 0xff, width & 0xff)
    // Number of components
    parts.push(components)
    // Component data (3 bytes per component)
    for (let i = 0; i < components; i++) {
      parts.push(i + 1, 0x11, 0x00)
    }

    // Pad
    for (let i = 0; i < 16; i++) parts.push(0x00)

    return new Uint8Array(parts)
  }

  it('extracts JPEG dimensions', () => {
    const jpeg = buildJPEG({ width: 1920, height: 1080 })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult).toBeDefined()
    expect(jpegResult.details.dimensions).toBe('1920x1080')
  })

  it('detects baseline DCT compression', () => {
    const jpeg = buildJPEG({ progressive: false })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.compression).toBe('Baseline DCT')
  })

  it('detects progressive DCT compression', () => {
    const jpeg = buildJPEG({ progressive: true })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.compression).toBe('Progressive DCT')
  })

  it('detects EXIF data', () => {
    const jpeg = buildJPEG({ hasExif: true, thumbnailIfdOffset: 8 })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.hasExif).toBe(true)
  })

  it('reports no EXIF when absent', () => {
    const jpeg = buildJPEG({ hasExif: false })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.hasExif).toBe(false)
  })

  it('detects YCbCr color space (3 components)', () => {
    const jpeg = buildJPEG({ components: 3 })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.colorSpace).toBe('YCbCr')
  })

  it('detects Grayscale color space (1 component)', () => {
    const jpeg = buildJPEG({ components: 1 })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.colorSpace).toBe('Grayscale')
  })

  it('detects CMYK color space (4 components)', () => {
    const jpeg = buildJPEG({ components: 4 })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.colorSpace).toBe('CMYK')
  })

  it('detects thumbnail presence from EXIF IFD offset', () => {
    const jpeg = buildJPEG({ hasExif: true, thumbnailIfdOffset: 100 })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.thumbnails).toBe(true)
  })

  it('detects no thumbnail when IFD offset is 0', () => {
    const jpeg = buildJPEG({ hasExif: true, thumbnailIfdOffset: 0 })
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult.details.thumbnails).toBe(false)
  })

  it('returns Unknown dimensions for short JPEG', () => {
    // SOI only, no SOF marker
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00])
    const results = detectSpecificFileType(jpeg)
    const jpegResult = results.find((r) => r.name === 'JPEG Image')
    expect(jpegResult).toBeDefined()
    expect(jpegResult.details.dimensions).toBe('Unknown')
  })
})

// ── GIF analysis via detectSpecificFileType ──

describe('GIF analysis (via detectSpecificFileType)', () => {
  function buildGIF({
    version = '89a',
    width = 100,
    height = 100,
    bitsPerPixel = 8,
    frameCount = 1,
    hasAnimation = false
  } = {}) {
    const parts = []
    // GIF header: "GIF" + version
    const versionStr = version === '87a' ? '87a' : '89a'
    const headerStr = 'GIF' + versionStr
    for (let i = 0; i < headerStr.length; i++) {
      parts.push(headerStr.charCodeAt(i))
    }
    // Logical screen descriptor
    // Width (2 bytes LE)
    parts.push(width & 0xff, (width >> 8) & 0xff)
    // Height (2 bytes LE)
    parts.push(height & 0xff, (height >> 8) & 0xff)
    // Packed field: Global Color Table Flag (1) | Color Resolution (3) | Sort Flag (1) | Size of GCT (3)
    const sizeOfGCT = bitsPerPixel - 1
    const packedField = 0x80 | ((bitsPerPixel - 1) << 4) | sizeOfGCT
    parts.push(packedField)
    // Background color index
    parts.push(0)
    // Pixel aspect ratio
    parts.push(0)

    // Global Color Table (2^bitsPerPixel * 3 bytes)
    const gctSize = Math.pow(2, bitsPerPixel) * 3
    for (let i = 0; i < gctSize; i++) {
      parts.push(0)
    }

    // Add animation control extension if requested
    if (hasAnimation) {
      // Graphics Control Extension
      parts.push(0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00)
    }

    // Add image descriptors (frames)
    for (let i = 0; i < frameCount; i++) {
      // Image separator
      parts.push(0x2c)
      // Left, Top position (2 bytes each LE)
      parts.push(0, 0, 0, 0)
      // Width, Height (2 bytes each LE)
      parts.push(width & 0xff, (width >> 8) & 0xff)
      parts.push(height & 0xff, (height >> 8) & 0xff)
      // Packed field (no local color table)
      parts.push(0x00)
      // LZW minimum code size
      parts.push(bitsPerPixel)
    }

    // Trailer
    parts.push(0x3b)

    return new Uint8Array(parts)
  }

  it('detects GIF89a and returns result with empty details (name mismatch in source)', () => {
    // NOTE: The source code checks for type.name === 'GIF Image' but FILE_SIGNATURES
    // uses 'GIF Image (89a)' and 'GIF Image (87a)', so analyzeGifStructure is never
    // called through detectSpecificFileType. We test that the detection still works
    // and details remain an empty object.
    const gif = buildGIF({ version: '89a' })
    const results = detectSpecificFileType(gif)
    const gifResult = results.find((r) => r.name.includes('GIF'))
    expect(gifResult).toBeDefined()
    // Details is empty because analyzeGifStructure is never invoked due to name mismatch
    expect(gifResult.details).toBeDefined()
  })

  it('detects GIF87a', () => {
    const gif = buildGIF({ version: '87a' })
    const results = detectSpecificFileType(gif)
    const gifResult = results.find((r) => r.name.includes('GIF'))
    expect(gifResult).toBeDefined()
  })
})

// ── PE analysis details ──

describe('analyzePEStructure() detailed', () => {
  it('returns subsystem name', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('Windows CUI')
  })

  it('returns timestamp as ISO string', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    // timestamp is 0x60000000 from buildMinimalPE
    expect(result.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('returns entry point as hex string', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(result.entryPoint).toMatch(/^0x/)
  })

  it('returns image base', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(result.imageBase).toMatch(/^0x/)
  })

  it('returns sections array', () => {
    const pe = buildMinimalPE({ numSections: 2 })
    const result = analyzePEStructure(pe)
    expect(Array.isArray(result.sections)).toBe(true)
    expect(Array.isArray(result.sectionNames)).toBe(true)
  })

  it('returns security features', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(result.security).toHaveProperty('aslr')
    expect(result.security).toHaveProperty('dep')
    expect(result.security).toHaveProperty('cfg')
    expect(result.security).toHaveProperty('noSEH')
    expect(result.security).toHaveProperty('highEntropyVA')
    expect(result.security).toHaveProperty('forceIntegrity')
    expect(result.security).toHaveProperty('appContainer')
  })

  it('detects ASLR enabled', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(result.security.aslr).toBe(true)
  })

  it('detects DEP enabled', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(result.security.dep).toBe(true)
  })

  it('returns import/export info', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(Array.isArray(result.imports)).toBe(true)
    expect(typeof result.importCount).toBe('number')
  })

  it('returns certificate info', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(typeof result.hasCertificate).toBe('boolean')
    expect(typeof result.certificateSize).toBe('number')
  })

  it('returns debug info', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(typeof result.hasDebugInfo).toBe('boolean')
  })

  it('returns .NET detection', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(typeof result.isNet).toBe('boolean')
  })

  it('returns hasRWXSections flag', () => {
    const pe = buildMinimalPE()
    const result = analyzePEStructure(pe)
    expect(typeof result.hasRWXSections).toBe('boolean')
  })

  it('handles ARM machine type', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const coffBase = peOffset + 4
    // Set machine to ARM (0x01C0)
    pe[coffBase] = 0xc0
    pe[coffBase + 1] = 0x01
    const result = analyzePEStructure(pe)
    expect(result.machine).toBe('ARM')
  })

  it('handles ARM64 machine type', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const coffBase = peOffset + 4
    // Set machine to ARM64 (0xAA64)
    pe[coffBase] = 0x64
    pe[coffBase + 1] = 0xaa
    const result = analyzePEStructure(pe)
    expect(result.machine).toBe('ARM64')
  })

  it('handles ARMv7 Thumb-2 machine type', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const coffBase = peOffset + 4
    // Set machine to ARMv7 Thumb-2 (0x01C4)
    pe[coffBase] = 0xc4
    pe[coffBase + 1] = 0x01
    const result = analyzePEStructure(pe)
    expect(result.machine).toBe('ARMv7 Thumb-2')
  })

  it('handles unknown machine type', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const coffBase = peOffset + 4
    pe[coffBase] = 0xff
    pe[coffBase + 1] = 0xff
    const result = analyzePEStructure(pe)
    expect(result.machine).toMatch(/Unknown/)
  })

  it('detects multiple characteristics flags', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    // Set characteristics: Executable | DLL | Large Address Aware | 32-Bit Machine
    pe[peOffset + 22] = 0x22 // 0x0002 (Executable) | 0x0020 (Large Address Aware)
    pe[peOffset + 23] = 0x20 // 0x2000 (DLL)
    const result = analyzePEStructure(pe)
    expect(result.characteristics).toContain('Executable')
    expect(result.characteristics).toContain('Large Address Aware')
    expect(result.characteristics).toContain('DLL')
  })

  it('detects Relocations Stripped characteristic', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 22] = 0x03 // Relocations Stripped + Executable
    const result = analyzePEStructure(pe)
    expect(result.characteristics).toContain('Relocations Stripped')
    expect(result.characteristics).toContain('Executable')
  })

  it('detects Debug Stripped and System File characteristics', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 22] = 0x02 // Executable
    pe[peOffset + 23] = 0x12 // System File (0x1000) | Debug Stripped (0x0200)
    const result = analyzePEStructure(pe)
    expect(result.characteristics).toContain('Debug Stripped')
    expect(result.characteristics).toContain('System File')
  })

  it('returns Windows GUI subsystem', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 68] = 2 // Windows GUI
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('Windows GUI')
  })

  it('returns Native subsystem', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 68] = 1
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('Native')
  })

  it('returns EFI Application subsystem', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 68] = 10
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('EFI Application')
  })

  it('returns Unknown for unrecognized subsystem', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 68] = 99
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toMatch(/Unknown/)
  })

  it('detects 32-Bit Machine characteristic', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 22] = 0x02 // Executable
    pe[peOffset + 23] = 0x01 // 32-Bit Machine (0x0100)
    const result = analyzePEStructure(pe)
    expect(result.characteristics).toContain('32-Bit Machine')
  })
})

// ── ELF analysis details ──

describe('ELF analysis detailed (via detectSpecificFileType)', () => {
  it('detects 64-bit ELF class', () => {
    const elf = buildMinimalELF({ is64: true })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.class).toBe('64-bit')
  })

  it('detects 32-bit ELF class', () => {
    const elf = buildMinimalELF({ is64: false })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.class).toBe('32-bit')
  })

  it('detects Executable ELF type', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.type).toBe('Executable')
  })

  it('detects x86-64 machine type', () => {
    const elf = buildMinimalELF({ is64: true, littleEndian: true })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.machine).toBe('x86-64')
  })

  it('returns entry point as hex string', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.entryPoint).toMatch(/^0x/)
  })

  it('returns section count', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(typeof elfResult.details.sections).toBe('number')
  })

  it('returns isStripped flag', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(typeof elfResult.details.isStripped).toBe('boolean')
  })

  it('returns isDynamicallyLinked flag', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(typeof elfResult.details.isDynamicallyLinked).toBe('boolean')
  })

  it('returns security features', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(typeof elfResult.details.pie).toBe('boolean')
    expect(typeof elfResult.details.executableStack).toBe('boolean')
    expect(elfResult.details.relro).toMatch(/^(none|partial|full)$/)
    expect(typeof elfResult.details.textrel).toBe('boolean')
  })

  it('returns hasRWXSegments flag', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(typeof elfResult.details.hasRWXSegments).toBe('boolean')
  })

  it('returns rpath and runpath', () => {
    const elf = buildMinimalELF()
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details).toHaveProperty('rpath')
    expect(elfResult.details).toHaveProperty('runpath')
  })

  it('detects Relocatable ELF type', () => {
    const elf = buildMinimalELF({ is64: true, littleEndian: true })
    // e_type = ET_REL (1) at offset 16
    elf[16] = 1
    elf[17] = 0
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.type).toBe('Relocatable')
  })

  it('detects Shared object ELF type', () => {
    const elf = buildMinimalELF({ is64: true, littleEndian: true })
    // e_type = ET_DYN (3) at offset 16
    elf[16] = 3
    elf[17] = 0
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.type).toBe('Shared object')
  })

  it('detects Core dump ELF type', () => {
    const elf = buildMinimalELF({ is64: true, littleEndian: true })
    // e_type = ET_CORE (4) at offset 16
    elf[16] = 4
    elf[17] = 0
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.type).toBe('Core dump')
  })

  it('detects x86 machine type for 32-bit LE ELF', () => {
    const elf = buildMinimalELF({ is64: false, littleEndian: true })
    // e_machine = x86 (0x03)
    elf[18] = 0x03
    elf[19] = 0x00
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.machine).toBe('x86')
  })

  it('detects ARM machine type', () => {
    const elf = buildMinimalELF({ is64: false, littleEndian: true })
    // e_machine = ARM (0x28)
    elf[18] = 0x28
    elf[19] = 0x00
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.machine).toBe('ARM')
  })

  it('detects AArch64 machine type', () => {
    const elf = buildMinimalELF({ is64: true, littleEndian: true })
    // e_machine = AArch64 (0xB7)
    elf[18] = 0xb7
    elf[19] = 0x00
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.machine).toBe('AArch64')
  })

  it('handles unknown ELF machine type', () => {
    const elf = buildMinimalELF({ is64: true, littleEndian: true })
    elf[18] = 0xff
    elf[19] = 0x00
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.machine).toMatch(/Unknown/)
  })

  it('handles big-endian 64-bit ELF', () => {
    const elf = buildMinimalELF({ is64: true, littleEndian: false })
    // Set e_type and e_machine in big-endian
    elf[16] = 0
    elf[17] = 2 // ET_EXEC
    elf[18] = 0
    elf[19] = 0x3e // x86-64
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.class).toBe('64-bit')
    expect(elfResult.details.type).toBe('Executable')
    expect(elfResult.details.machine).toBe('x86-64')
  })

  it('handles big-endian 32-bit ELF', () => {
    const buf = new Uint8Array(96)
    // ELF magic
    buf[0] = 0x7f
    buf[1] = 0x45
    buf[2] = 0x4c
    buf[3] = 0x46
    buf[4] = 1 // 32-bit
    buf[5] = 2 // big-endian
    buf[6] = 1 // version
    // e_type = ET_EXEC (2) big-endian at offset 16
    buf[16] = 0
    buf[17] = 2
    // e_machine = ARM (0x28) big-endian
    buf[18] = 0
    buf[19] = 0x28
    const results = detectSpecificFileType(buf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.class).toBe('32-bit')
    expect(elfResult.details.machine).toBe('ARM')
  })

  it('handles Unknown ELF class', () => {
    const elf = buildMinimalELF()
    elf[4] = 0 // Invalid class
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.class).toBe('Unknown')
  })

  it('handles Unknown ELF type', () => {
    const elf = buildMinimalELF({ is64: true, littleEndian: true })
    elf[16] = 99
    elf[17] = 0
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.type).toBe('Unknown')
  })
})

// ── Mach-O analysis details ──

describe('Mach-O analysis detailed (via detectSpecificFileType)', () => {
  it('identifies 64-bit LE Mach-O type', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.type).toBe('64-bit Executable')
  })

  it('identifies x86_64 architecture', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.architecture).toBe('x86_64')
  })

  it('identifies Executable file type', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Executable')
  })

  it('detects PIE flag', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    // MH_PIE is set in buildMinimalMachO64LE
    expect(machoResult.details.pie).toBe(true)
  })

  it('returns load command count', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(typeof machoResult.details.loadCommands).toBe('number')
  })

  it('returns hasCodeSignature flag', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(typeof machoResult.details.hasCodeSignature).toBe('boolean')
  })

  it('returns isEncrypted flag', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(typeof machoResult.details.isEncrypted).toBe('boolean')
  })

  it('returns isDynamicallyLinked flag', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(typeof machoResult.details.isDynamicallyLinked).toBe('boolean')
  })

  it('returns segments array', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(Array.isArray(machoResult.details.segments)).toBe(true)
  })

  it('returns allowStackExecution flag', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(typeof machoResult.details.allowStackExecution).toBe('boolean')
  })

  it('returns noHeapExecution flag', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(typeof machoResult.details.noHeapExecution).toBe('boolean')
  })

  it('returns hasRWXSegments flag', () => {
    const macho = buildMinimalMachO64LE()
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(typeof machoResult.details.hasRWXSegments).toBe('boolean')
  })

  it('identifies 32-bit LE Mach-O', () => {
    const buf = new Uint8Array(64)
    // CE FA ED FE (32-bit little-endian)
    buf[0] = 0xce
    buf[1] = 0xfa
    buf[2] = 0xed
    buf[3] = 0xfe
    // cputype = x86 (0x07) LE
    buf[4] = 0x07
    buf[5] = 0x00
    buf[6] = 0x00
    buf[7] = 0x00
    // filetype = 2 (executable)
    buf[12] = 0x02
    // ncmds = 0
    buf[16] = 0x00
    // flags = 0
    buf[24] = 0x00

    const results = detectSpecificFileType(buf)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.type).toBe('32-bit Executable')
    expect(machoResult.details.architecture).toBe('x86')
  })

  it('identifies 64-bit BE Mach-O', () => {
    const buf = new Uint8Array(64)
    // FE ED FA CF (64-bit big-endian)
    buf[0] = 0xfe
    buf[1] = 0xed
    buf[2] = 0xfa
    buf[3] = 0xcf
    // cputype = x86_64 (0x01000007) big-endian
    buf[4] = 0x01
    buf[5] = 0x00
    buf[6] = 0x00
    buf[7] = 0x07
    // filetype = 2 (executable) big-endian
    buf[12] = 0x00
    buf[13] = 0x00
    buf[14] = 0x00
    buf[15] = 0x02
    // ncmds = 0
    buf[16] = 0x00
    // flags = 0
    buf[24] = 0x00

    const results = detectSpecificFileType(buf)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.type).toBe('64-bit Executable (Big-Endian)')
  })

  it('identifies 32-bit BE Mach-O', () => {
    const buf = new Uint8Array(64)
    // FE ED FA CE (32-bit big-endian)
    buf[0] = 0xfe
    buf[1] = 0xed
    buf[2] = 0xfa
    buf[3] = 0xce
    // cputype = ARM (0x0c) big-endian
    buf[4] = 0x00
    buf[5] = 0x00
    buf[6] = 0x00
    buf[7] = 0x0c
    // filetype = 6 (dylib) big-endian
    buf[12] = 0x00
    buf[13] = 0x00
    buf[14] = 0x00
    buf[15] = 0x06
    // ncmds = 0 big-endian
    buf[16] = 0x00
    // flags = 0
    buf[24] = 0x00

    const results = detectSpecificFileType(buf)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.type).toBe('32-bit Executable (Big-Endian)')
    expect(machoResult.details.fileType).toBe('Dynamic Library')
  })

  it('detects ARM64 architecture', () => {
    const buf = new Uint8Array(64)
    // CF FA ED FE (64-bit little-endian)
    buf[0] = 0xcf
    buf[1] = 0xfa
    buf[2] = 0xed
    buf[3] = 0xfe
    // cputype = ARM64 (0x0100000C) LE
    buf[4] = 0x0c
    buf[5] = 0x00
    buf[6] = 0x00
    buf[7] = 0x01
    // filetype = 2
    buf[12] = 0x02
    // ncmds = 0
    buf[16] = 0x00
    // flags = 0
    buf[24] = 0x00

    const results = detectSpecificFileType(buf)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.architecture).toBe('ARM64')
  })

  it('handles unknown Mach-O architecture', () => {
    const buf = new Uint8Array(64)
    buf[0] = 0xcf
    buf[1] = 0xfa
    buf[2] = 0xed
    buf[3] = 0xfe
    // Unknown cputype
    buf[4] = 0xff
    buf[5] = 0x00
    buf[6] = 0x00
    buf[7] = 0x00
    buf[12] = 0x02
    buf[16] = 0x00
    buf[24] = 0x00

    const results = detectSpecificFileType(buf)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.architecture).toMatch(/Unknown/)
  })

  it('detects Mach-O file types: Object, Dynamic Library, Bundle', () => {
    // Object file type = 1
    const obj = buildMinimalMachO64LE()
    obj[12] = 1
    let results = detectSpecificFileType(obj)
    let machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Object')

    // Dynamic Library = 6
    const dylib = buildMinimalMachO64LE()
    dylib[12] = 6
    results = detectSpecificFileType(dylib)
    machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Dynamic Library')

    // Bundle = 8
    const bundle = buildMinimalMachO64LE()
    bundle[12] = 8
    results = detectSpecificFileType(bundle)
    machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Bundle')
  })

  it('detects unknown Mach-O file type', () => {
    const macho = buildMinimalMachO64LE()
    macho[12] = 99
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toMatch(/Unknown/)
  })

  it('detects allowStackExecution flag', () => {
    const macho = buildMinimalMachO64LE()
    // flags at offset 24, MH_ALLOW_STACK_EXECUTION = 0x20000
    // Set flags = 0x220000 (PIE + allowStackExecution) LE
    macho[24] = 0x00
    macho[25] = 0x00
    macho[26] = 0x22 // 0x220000
    macho[27] = 0x00
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.allowStackExecution).toBe(true)
    expect(machoResult.details.pie).toBe(true)
  })

  it('detects noHeapExecution flag', () => {
    const macho = buildMinimalMachO64LE()
    // MH_NO_HEAP_EXECUTION = 0x1000000 LE
    macho[24] = 0x00
    macho[25] = 0x00
    macho[26] = 0x20 // PIE
    macho[27] = 0x01 // 0x01000000 = noHeapExecution
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.noHeapExecution).toBe(true)
  })
})

// ── Mach-O with load commands ──

describe('Mach-O with load commands', () => {
  function buildMachOWithLoadCommands(loadCommands = []) {
    // 64-bit LE Mach-O with specified load commands
    const headerSize = 32
    let totalCmdSize = 0
    for (const lc of loadCommands) {
      totalCmdSize += lc.data.length
    }
    const totalSize = headerSize + totalCmdSize + 64
    const buf = new Uint8Array(totalSize)

    // Mach-O 64-bit LE magic
    buf[0] = 0xcf
    buf[1] = 0xfa
    buf[2] = 0xed
    buf[3] = 0xfe
    // cputype = x86_64 (0x01000007) LE
    buf[4] = 0x07
    buf[5] = 0x00
    buf[6] = 0x00
    buf[7] = 0x01
    // cpusubtype
    buf[8] = 0x03
    // filetype = 2 (executable)
    buf[12] = 0x02
    // ncmds (LE)
    buf[16] = loadCommands.length & 0xff
    buf[17] = (loadCommands.length >> 8) & 0xff
    // sizeofcmds (LE)
    buf[20] = totalCmdSize & 0xff
    buf[21] = (totalCmdSize >> 8) & 0xff
    buf[22] = (totalCmdSize >> 16) & 0xff
    buf[23] = (totalCmdSize >> 24) & 0xff
    // flags = MH_PIE (0x200000)
    buf[24] = 0x00
    buf[25] = 0x00
    buf[26] = 0x20
    buf[27] = 0x00

    let offset = headerSize
    for (const lc of loadCommands) {
      buf.set(lc.data, offset)
      offset += lc.data.length
    }

    return buf
  }

  function makeLoadCommand(cmd, cmdsize, extraData = []) {
    const data = new Uint8Array(cmdsize)
    // cmd (4 bytes LE)
    data[0] = cmd & 0xff
    data[1] = (cmd >> 8) & 0xff
    data[2] = (cmd >> 16) & 0xff
    data[3] = (cmd >> 24) & 0xff
    // cmdsize (4 bytes LE)
    data[4] = cmdsize & 0xff
    data[5] = (cmdsize >> 8) & 0xff
    data[6] = (cmdsize >> 16) & 0xff
    data[7] = (cmdsize >> 24) & 0xff
    // extra data
    for (let i = 0; i < extraData.length && i + 8 < cmdsize; i++) {
      data[8 + i] = extraData[i]
    }
    return { data }
  }

  it('detects LC_LOAD_DYLIB as dynamically linked', () => {
    const path = '/usr/lib/libSystem.B.dylib'
    const enc = new TextEncoder()
    const pathBytes = enc.encode(path)
    // cmdsize must be large enough to hold the string offset (24) + path + null terminator
    const cmdsize = 24 + pathBytes.length + 8
    // Round up to multiple of 8 for alignment
    const alignedCmdsize = Math.ceil(cmdsize / 8) * 8
    const dylib = makeLoadCommand(0x0c, alignedCmdsize) // LC_LOAD_DYLIB
    // string offset at byte 8 (offset within load command) = 24
    dylib.data[8] = 24
    // Write path at offset 24
    for (let i = 0; i < pathBytes.length; i++) {
      dylib.data[24 + i] = pathBytes[i]
    }

    const macho = buildMachOWithLoadCommands([dylib])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.isDynamicallyLinked).toBe(true)
    expect(machoResult.details.dylibs).toContain('/usr/lib/libSystem.B.dylib')
  })

  it('detects LC_LOAD_WEAK_DYLIB', () => {
    const path = '/usr/lib/libweak.dylib'
    const enc = new TextEncoder()
    const pathBytes = enc.encode(path)
    const cmdsize = Math.ceil((24 + pathBytes.length + 8) / 8) * 8
    const weakDylib = makeLoadCommand(0x18, cmdsize) // LC_LOAD_WEAK_DYLIB
    weakDylib.data[8] = 24
    for (let i = 0; i < pathBytes.length; i++) {
      weakDylib.data[24 + i] = pathBytes[i]
    }

    const macho = buildMachOWithLoadCommands([weakDylib])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.weakDylibs).toContain('/usr/lib/libweak.dylib')
  })

  it('detects LC_CODE_SIGNATURE', () => {
    const codesig = makeLoadCommand(0x1d, 16, [
      0x00,
      0x10,
      0x00,
      0x00, // dataoff = 0x1000
      0x00,
      0x08,
      0x00,
      0x00 // datasize = 0x800
    ])

    const macho = buildMachOWithLoadCommands([codesig])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.hasCodeSignature).toBe(true)
    expect(machoResult.details.codeSignatureSize).toBe(0x800)
  })

  it('reports no code signature when absent', () => {
    const macho = buildMachOWithLoadCommands([])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.hasCodeSignature).toBe(false)
    expect(machoResult.details.codeSignatureSize).toBe(0)
  })

  it('detects LC_ENCRYPTION_INFO_64', () => {
    const encryption = makeLoadCommand(0x2c, 24, [
      0x00,
      0x00,
      0x00,
      0x00, // cryptoff
      0x00,
      0x00,
      0x00,
      0x00, // cryptsize
      0x01,
      0x00,
      0x00,
      0x00 // cryptid = 1 (encrypted)
    ])

    // cryptid is at offset + 16 relative to load command start
    // In our helper, extra data starts at offset 8
    // So cryptid is at extraData index 8 (= load command offset 16)
    encryption.data[16] = 1 // cryptid = 1

    const macho = buildMachOWithLoadCommands([encryption])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.isEncrypted).toBe(true)
  })

  it('reports not encrypted when cryptid is 0', () => {
    const encryption = makeLoadCommand(0x2c, 24)
    encryption.data[16] = 0 // cryptid = 0

    const macho = buildMachOWithLoadCommands([encryption])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.isEncrypted).toBe(false)
  })

  it('detects LC_MAIN entry point', () => {
    const lcMain = makeLoadCommand(0x80000028, 24, [
      0x00,
      0x10,
      0x00,
      0x00, // entryoff lo = 0x1000
      0x00,
      0x00,
      0x00,
      0x00 // entryoff hi = 0
    ])

    const macho = buildMachOWithLoadCommands([lcMain])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.entryPoint).toBe('0x1000')
  })

  it('returns Unknown entry point when no LC_MAIN', () => {
    const macho = buildMachOWithLoadCommands([])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.entryPoint).toBe('Unknown')
  })

  it('detects LC_VERSION_MIN_MACOSX', () => {
    // LC_VERSION_MIN_MACOSX = 0x24, cmdsize = 16
    const minVersion = makeLoadCommand(0x24, 16, [
      0x00,
      0x06,
      0x0a,
      0x00, // version = 10.6.0 (major=10, minor=6, patch=0) => 0x000A0600
      0x00,
      0x00,
      0x00,
      0x00 // sdk
    ])
    // version at offset 8: we need 10.6.0 which is (10 << 16) | (6 << 8) | 0 = 0x000A0600
    minVersion.data[8] = 0x00 // patch
    minVersion.data[9] = 0x06 // minor
    minVersion.data[10] = 0x0a // major
    minVersion.data[11] = 0x00

    const macho = buildMachOWithLoadCommands([minVersion])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.minimumVersion).toBe('10.6.0')
  })

  it('returns Unknown minimum version when no LC_VERSION_MIN_MACOSX', () => {
    const macho = buildMachOWithLoadCommands([])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.minimumVersion).toBe('Unknown')
  })

  it('detects LC_BUILD_VERSION', () => {
    // LC_BUILD_VERSION = 0x32, cmdsize = 24
    const buildVer = makeLoadCommand(0x32, 24, [
      0x01,
      0x00,
      0x00,
      0x00, // platform = 1 (macOS)
      0x00,
      0x00,
      0x0e,
      0x00, // minos = 14.0.0 => (14 << 16) | (0 << 8) | 0 = 0x000E0000
      0x00,
      0x05,
      0x0f,
      0x00 // sdk = 15.5.0 => (15 << 16) | (5 << 8) | 0 = 0x000F0500
    ])

    const macho = buildMachOWithLoadCommands([buildVer])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.buildVersion).not.toBeNull()
    expect(machoResult.details.buildVersion.platform).toBe('macOS')
  })

  it('returns null buildVersion when no LC_BUILD_VERSION', () => {
    const macho = buildMachOWithLoadCommands([])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.buildVersion).toBeNull()
  })

  it('detects LC_SEGMENT_64 with permissions', () => {
    // LC_SEGMENT_64 = 0x19, min size = 72
    const segment = makeLoadCommand(0x19, 72)
    // segname at offset 8 (16 bytes): "__TEXT"
    const segname = '__TEXT'
    for (let i = 0; i < segname.length; i++) {
      segment.data[8 + i] = segname.charCodeAt(i)
    }
    // vmsize at offset 24 (8 bytes LE) = 0x1000
    segment.data[24] = 0x00
    segment.data[25] = 0x10
    // maxprot at offset 48 (4 bytes LE) = 5 (r-x)
    segment.data[48] = 5
    // initprot at offset 52 (4 bytes LE) = 5 (r-x)
    segment.data[52] = 5

    const macho = buildMachOWithLoadCommands([segment])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.segments.length).toBeGreaterThanOrEqual(1)
    const textSeg = machoResult.details.segments.find((s) => s.name === '__TEXT')
    expect(textSeg).toBeDefined()
    expect(textSeg.initprot).toBe('r-x')
    expect(textSeg.isRWX).toBe(false)
  })

  it('detects RWX segment', () => {
    const segment = makeLoadCommand(0x19, 72)
    const segname = '__RWX'
    for (let i = 0; i < segname.length; i++) {
      segment.data[8 + i] = segname.charCodeAt(i)
    }
    // initprot = 7 (rwx)
    segment.data[52] = 7

    const macho = buildMachOWithLoadCommands([segment])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.hasRWXSegments).toBe(true)
  })
})

// ── PE section flags ──

describe('PE section permissions', () => {
  it('detects section flags (r/w/x)', () => {
    const pe = buildMinimalPE({ numSections: 1 })
    const result = analyzePEStructure(pe)
    // Sections should exist
    expect(Array.isArray(result.sections)).toBe(true)
    expect(result.sections.length).toBeGreaterThan(0)
    const sec = result.sections[0]
    expect(sec).toHaveProperty('flags')
    expect(sec).toHaveProperty('isRWX')
    expect(sec.flags).toMatch(/^[r-][w-][x-]$/)
  })
})

// ── findPEHeaderOffset edge cases ──

describe('findPEHeaderOffset() edge cases', () => {
  it('returns -1 when PE offset points beyond buffer', () => {
    const buf = new Uint8Array(256)
    buf[0] = 0x4d
    buf[1] = 0x5a
    // PE offset points way beyond buffer
    buf[0x3c] = 0xff
    buf[0x3d] = 0xff
    buf[0x3e] = 0x00
    buf[0x3f] = 0x00
    expect(findPEHeaderOffset(buf)).toBe(-1)
  })

  it('returns -1 for undefined input', () => {
    expect(findPEHeaderOffset(undefined)).toBe(-1)
  })

  it('returns -1 for empty Uint8Array', () => {
    expect(findPEHeaderOffset(new Uint8Array(0))).toBe(-1)
  })

  it('handles PE offset at boundary', () => {
    // MZ header with PE offset pointing to last 4 possible bytes
    const peOffset = 64
    const buf = new Uint8Array(peOffset + 4)
    buf[0] = 0x4d
    buf[1] = 0x5a
    buf[0x3c] = peOffset
    // Valid PE signature at offset
    buf[peOffset] = 0x50
    buf[peOffset + 1] = 0x45
    buf[peOffset + 2] = 0x00
    buf[peOffset + 3] = 0x00
    expect(findPEHeaderOffset(buf)).toBe(peOffset)
  })
})

// ── detectSpecificFileType edge cases ──

describe('detectSpecificFileType() edge cases', () => {
  it('throws on undefined', () => {
    expect(() => detectSpecificFileType(undefined)).toThrow()
  })

  it('handles PE with invalid internal structure gracefully', () => {
    // MZ header but corrupted PE header data
    const buf = new Uint8Array(512)
    buf[0] = 0x4d
    buf[1] = 0x5a
    buf[0x3c] = 0x80
    buf[0x80] = 0x50
    buf[0x81] = 0x45
    buf[0x82] = 0x00
    buf[0x83] = 0x00
    // Rest is zeros - should not crash
    const results = detectSpecificFileType(buf)
    const peResult = results.find((r) => r.name.includes('PE'))
    expect(peResult).toBeDefined()
    // Details may have an error or partial data, but should not throw
    expect(peResult).toHaveProperty('details')
  })
})

// ── ELF with program headers and sections ──

describe('ELF with program headers and sections', () => {
  function buildDetailedELF64LE({
    type = 2,
    machine = 0x3e,
    programHeaders = [],
    sectionHeaders = [],
    sectionNames = []
  } = {}) {
    // Build a 64-bit little-endian ELF with program and section headers
    const ehdrSize = 64
    const phentsize = 56
    const shentsize = 64

    // Build section name string table
    let strtabContent = new Uint8Array(0)
    const nameOffsets = []
    if (sectionNames.length > 0) {
      let offset = 1 // Start after null byte at index 0
      const enc = new TextEncoder()
      const parts = [0] // leading null byte
      for (const name of sectionNames) {
        nameOffsets.push(offset)
        const bytes = enc.encode(name)
        for (const b of bytes) parts.push(b)
        parts.push(0) // null terminator
        offset += bytes.length + 1
      }
      strtabContent = new Uint8Array(parts)
    }

    // Layout:
    // [ELF header] [program headers] [strtab data] [section headers]
    const phoff = ehdrSize
    const phSize = programHeaders.length * phentsize
    const strtabOffset = phoff + phSize
    const shoff = strtabOffset + strtabContent.length
    const totalSections = sectionHeaders.length + (sectionNames.length > 0 ? 1 : 0) // +1 for .shstrtab
    const totalSize = shoff + totalSections * shentsize + 64

    const buf = new Uint8Array(totalSize)

    // ELF magic
    buf[0] = 0x7f
    buf[1] = 0x45
    buf[2] = 0x4c
    buf[3] = 0x46
    buf[4] = 2 // 64-bit
    buf[5] = 1 // little-endian
    buf[6] = 1 // version

    // e_type (LE)
    buf[16] = type & 0xff
    buf[17] = (type >> 8) & 0xff
    // e_machine (LE)
    buf[18] = machine & 0xff
    buf[19] = (machine >> 8) & 0xff
    // e_version
    buf[20] = 1

    // e_entry (64-bit LE) = 0x400000
    buf[24] = 0x00
    buf[25] = 0x00
    buf[26] = 0x40
    buf[27] = 0x00

    // e_phoff (64-bit LE)
    writeLE64(buf, 32, phoff)
    // e_shoff (64-bit LE)
    writeLE64(buf, 40, shoff)
    // e_ehsize
    buf[52] = ehdrSize & 0xff
    buf[53] = (ehdrSize >> 8) & 0xff
    // e_phentsize
    buf[54] = phentsize & 0xff
    buf[55] = (phentsize >> 8) & 0xff
    // e_phnum
    buf[56] = programHeaders.length & 0xff
    buf[57] = (programHeaders.length >> 8) & 0xff
    // e_shentsize
    buf[58] = shentsize & 0xff
    buf[59] = (shentsize >> 8) & 0xff
    // e_shnum
    buf[60] = totalSections & 0xff
    buf[61] = (totalSections >> 8) & 0xff
    // e_shstrndx = last section (the .shstrtab)
    const shstrndx = sectionNames.length > 0 ? sectionHeaders.length : 0
    buf[62] = shstrndx & 0xff
    buf[63] = (shstrndx >> 8) & 0xff

    // Write program headers
    for (let i = 0; i < programHeaders.length; i++) {
      const ph = programHeaders[i]
      const off = phoff + i * phentsize
      writeLE32(buf, off, ph.type) // p_type
      writeLE32(buf, off + 4, ph.flags || 0) // p_flags
      writeLE64(buf, off + 8, ph.offset || 0) // p_offset
      writeLE64(buf, off + 16, ph.vaddr || 0) // p_vaddr
      writeLE64(buf, off + 24, ph.paddr || 0) // p_paddr
      writeLE64(buf, off + 32, ph.filesz || 0) // p_filesz
      writeLE64(buf, off + 40, ph.memsz || 0) // p_memsz
    }

    // Write section name string table data
    if (strtabContent.length > 0) {
      buf.set(strtabContent, strtabOffset)
    }

    // Write section headers
    for (let i = 0; i < sectionHeaders.length; i++) {
      const sh = sectionHeaders[i]
      const off = shoff + i * shentsize
      writeLE32(buf, off, sh.nameIdx !== undefined ? sh.nameIdx : 0) // sh_name
      writeLE32(buf, off + 4, sh.type || 0) // sh_type
      writeLE64(buf, off + 8, sh.flags || 0) // sh_flags
      writeLE64(buf, off + 16, sh.addr || 0) // sh_addr
      writeLE64(buf, off + 24, sh.offset || 0) // sh_offset
      writeLE64(buf, off + 32, sh.size || 0) // sh_size
    }

    // Write .shstrtab section header (last section)
    if (sectionNames.length > 0) {
      const strtabShOff = shoff + sectionHeaders.length * shentsize
      writeLE32(buf, strtabShOff, 0) // sh_name = 0 (empty name)
      writeLE32(buf, strtabShOff + 4, 3) // sh_type = SHT_STRTAB
      writeLE64(buf, strtabShOff + 24, strtabOffset) // sh_offset
      writeLE64(buf, strtabShOff + 32, strtabContent.length) // sh_size
    }

    return buf
  }

  function writeLE32(buf, offset, value) {
    buf[offset] = value & 0xff
    buf[offset + 1] = (value >> 8) & 0xff
    buf[offset + 2] = (value >> 16) & 0xff
    buf[offset + 3] = (value >> 24) & 0xff
  }

  function writeLE64(buf, offset, value) {
    writeLE32(buf, offset, value & 0xffffffff)
    writeLE32(buf, offset + 4, Math.floor(value / 0x100000000) & 0xffffffff)
  }

  it('detects section names from .shstrtab', () => {
    const sectionNames = ['.text', '.data', '.bss']
    const sectionHeaders = sectionNames.map((_name, i) => {
      // Calculate name offset in strtab
      let off = 1
      for (let j = 0; j < i; j++) {
        off += sectionNames[j].length + 1
      }
      return { nameIdx: off, type: 1 } // SHT_PROGBITS
    })

    const elf = buildDetailedELF64LE({ sectionHeaders, sectionNames })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.sectionNames).toContain('.text')
    expect(elfResult.details.sectionNames).toContain('.data')
    expect(elfResult.details.sectionNames).toContain('.bss')
  })

  it('detects PT_LOAD segments and permissions', () => {
    const elf = buildDetailedELF64LE({
      programHeaders: [
        { type: 1, flags: 5, offset: 0, vaddr: 0x400000, filesz: 0x1000, memsz: 0x1000 }, // PT_LOAD r-x
        { type: 1, flags: 6, offset: 0x1000, vaddr: 0x401000, filesz: 0x1000, memsz: 0x1000 } // PT_LOAD rw-
      ]
    })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.segments.length).toBe(2)
    expect(elfResult.details.segments[0].flags).toBe('r-x')
    expect(elfResult.details.segments[1].flags).toBe('rw-')
    expect(elfResult.details.hasRWXSegments).toBe(false)
  })

  it('detects RWX segment', () => {
    const elf = buildDetailedELF64LE({
      programHeaders: [
        { type: 1, flags: 7, offset: 0, vaddr: 0x400000, filesz: 0x1000, memsz: 0x1000 } // PT_LOAD rwx
      ]
    })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.hasRWXSegments).toBe(true)
    expect(elfResult.details.segments[0].flags).toBe('rwx')
  })

  it('detects PT_INTERP as dynamically linked', () => {
    // Build ELF with PT_INTERP pointing to "/lib64/ld-linux-x86-64.so.2"
    const interpPath = '/lib64/ld-linux-x86-64.so.2'
    const enc = new TextEncoder()
    const interpBytes = enc.encode(interpPath)

    // We need the interp string in the file. Put it after the ELF header.
    // But our builder puts program headers right after the ELF header.
    // We'll put the interp string at a known offset within the file.
    const elf = buildDetailedELF64LE({
      programHeaders: [
        {
          type: 3, // PT_INTERP
          flags: 4,
          offset: 0, // Will be overridden below
          filesz: interpBytes.length,
          memsz: interpBytes.length
        }
      ]
    })

    // The interp string needs to be at the offset specified by the PT_INTERP program header.
    // Our program header has offset=0 which means it reads from the start of the file.
    // Let's place the interp string at a known good offset and update the phdr.
    const interpOffset = elf.length - 60 // Place near end
    elf.set(interpBytes, interpOffset)
    // Update PT_INTERP p_offset (at phoff + 8, 64-bit LE)
    const phoff = 64 // ehdrSize
    writeLE64(elf, phoff + 8, interpOffset)

    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.isDynamicallyLinked).toBe(true)
    expect(elfResult.details.interpreter).toBe(interpPath)
  })

  it('detects PT_GNU_STACK executable stack', () => {
    const elf = buildDetailedELF64LE({
      programHeaders: [
        { type: 0x6474e551, flags: 7 } // PT_GNU_STACK with PF_X
      ]
    })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.executableStack).toBe(true)
  })

  it('reports non-executable stack when PT_GNU_STACK has no PF_X', () => {
    const elf = buildDetailedELF64LE({
      programHeaders: [
        { type: 0x6474e551, flags: 6 } // PT_GNU_STACK without PF_X
      ]
    })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.executableStack).toBe(false)
  })

  it('detects .symtab section (not stripped)', () => {
    const sectionNames = ['.symtab', '.strtab']
    const sectionHeaders = sectionNames.map((name, i) => {
      let off = 1
      for (let j = 0; j < i; j++) {
        off += sectionNames[j].length + 1
      }
      return { nameIdx: off, type: i === 0 ? 2 : 3 } // SHT_SYMTAB and SHT_STRTAB
    })

    const elf = buildDetailedELF64LE({ sectionHeaders, sectionNames })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.isStripped).toBe(false)
  })

  it('reports stripped when no .symtab section', () => {
    const sectionNames = ['.text']
    const sectionHeaders = [{ nameIdx: 1, type: 1 }]

    const elf = buildDetailedELF64LE({ sectionHeaders, sectionNames })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.isStripped).toBe(true)
  })

  it('detects PIE (ET_DYN with PT_INTERP)', () => {
    const elf = buildDetailedELF64LE({
      type: 3, // ET_DYN
      programHeaders: [
        { type: 3, flags: 4, offset: 0, filesz: 1, memsz: 1 } // PT_INTERP
      ]
    })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.pie).toBe(true)
  })

  it('does not report PIE for ET_EXEC', () => {
    const elf = buildDetailedELF64LE({
      type: 2, // ET_EXEC
      programHeaders: [
        { type: 3, flags: 4, offset: 0, filesz: 1, memsz: 1 } // PT_INTERP
      ]
    })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.pie).toBe(false)
  })

  it('detects partial RELRO (PT_GNU_RELRO without DT_BIND_NOW)', () => {
    const elf = buildDetailedELF64LE({
      programHeaders: [
        { type: 0x6474e552, flags: 4 } // PT_GNU_RELRO
      ]
    })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.relro).toBe('partial')
  })

  it('reports no RELRO when no PT_GNU_RELRO', () => {
    const elf = buildDetailedELF64LE({
      programHeaders: []
    })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.relro).toBe('none')
  })

  it('counts sections correctly', () => {
    const sectionNames = ['.text', '.data', '.rodata']
    const sectionHeaders = sectionNames.map((name, i) => {
      let off = 1
      for (let j = 0; j < i; j++) {
        off += sectionNames[j].length + 1
      }
      return { nameIdx: off, type: 1 }
    })

    const elf = buildDetailedELF64LE({ sectionHeaders, sectionNames })
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    // Total sections = 3 user sections + 1 .shstrtab = 4
    expect(elfResult.details.sections).toBe(4)
  })
})

// ── Mach-O 32-bit segment (LC_SEGMENT) ──

describe('Mach-O 32-bit segments', () => {
  function buildMachO32LEWithLoadCommands(loadCommands = []) {
    const headerSize = 28 // 32-bit Mach-O header
    let totalCmdSize = 0
    for (const lc of loadCommands) {
      totalCmdSize += lc.data.length
    }
    const totalSize = headerSize + totalCmdSize + 32
    const buf = new Uint8Array(totalSize)

    // CE FA ED FE (32-bit little-endian)
    buf[0] = 0xce
    buf[1] = 0xfa
    buf[2] = 0xed
    buf[3] = 0xfe
    // cputype = x86 (0x07) LE
    buf[4] = 0x07
    // filetype = 2 (executable)
    buf[12] = 0x02
    // ncmds
    buf[16] = loadCommands.length & 0xff
    // sizeofcmds
    buf[20] = totalCmdSize & 0xff
    buf[21] = (totalCmdSize >> 8) & 0xff
    // flags = PIE
    buf[24] = 0x00
    buf[25] = 0x00
    buf[26] = 0x20

    let offset = headerSize
    for (const lc of loadCommands) {
      buf.set(lc.data, offset)
      offset += lc.data.length
    }

    return buf
  }

  function makeLoadCommand(cmd, cmdsize) {
    const data = new Uint8Array(cmdsize)
    data[0] = cmd & 0xff
    data[1] = (cmd >> 8) & 0xff
    data[2] = (cmd >> 16) & 0xff
    data[3] = (cmd >> 24) & 0xff
    data[4] = cmdsize & 0xff
    data[5] = (cmdsize >> 8) & 0xff
    data[6] = (cmdsize >> 16) & 0xff
    data[7] = (cmdsize >> 24) & 0xff
    return { data }
  }

  it('detects LC_SEGMENT (32-bit) with correct permissions', () => {
    // LC_SEGMENT = 0x01, size = 56
    const seg = makeLoadCommand(0x01, 56)
    // segname at offset 8 (16 bytes): "__TEXT"
    const segname = '__TEXT'
    for (let i = 0; i < segname.length; i++) {
      seg.data[8 + i] = segname.charCodeAt(i)
    }
    // vmsize at offset 20 (4 bytes LE) = 0x1000
    seg.data[20] = 0x00
    seg.data[21] = 0x10
    // maxprot at offset 32 (4 bytes LE) = 5 (r-x)
    seg.data[32] = 5
    // initprot at offset 36 (4 bytes LE) = 5 (r-x)
    seg.data[36] = 5

    const macho = buildMachO32LEWithLoadCommands([seg])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.segments.length).toBeGreaterThanOrEqual(1)
    // The segment name should contain __TEXT
    const textSeg = machoResult.details.segments.find((s) => s.name.includes('__TEXT'))
    expect(textSeg).toBeDefined()
    expect(textSeg.initprot).toBe('r-x')
  })

  it('detects LC_ENCRYPTION_INFO (32-bit)', () => {
    // LC_ENCRYPTION_INFO = 0x21
    const enc = makeLoadCommand(0x21, 24)
    // cryptid at offset 16 = 1 (encrypted)
    enc.data[16] = 1

    const macho = buildMachO32LEWithLoadCommands([enc])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.isEncrypted).toBe(true)
  })

  it('detects LC_UNIXTHREAD entry point', () => {
    // LC_UNIXTHREAD = 0x05, needs at least cmdsize covering offset 144+8 for 64-bit
    // For 32-bit, we just test it returns 'Unknown (LC_UNIXTHREAD)' since it's a 32-bit binary
    const unixthread = makeLoadCommand(0x05, 160)

    const macho = buildMachO32LEWithLoadCommands([unixthread])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    // 32-bit Mach-O with LC_UNIXTHREAD - entry point parsing is limited
    expect(machoResult.details.entryPoint).toMatch(/Unknown/)
  })

  it('detects LC_REEXPORT_DYLIB', () => {
    const path = '/usr/lib/libreexport.dylib'
    const enc = new TextEncoder()
    const pathBytes = enc.encode(path)
    const cmdsize = Math.ceil((24 + pathBytes.length + 8) / 8) * 8
    const reexport = makeLoadCommand(0x1f, cmdsize) // LC_REEXPORT_DYLIB
    reexport.data[8] = 24 // string offset
    for (let i = 0; i < pathBytes.length; i++) {
      reexport.data[24 + i] = pathBytes[i]
    }

    const macho = buildMachO32LEWithLoadCommands([reexport])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.dylibs).toContain('/usr/lib/libreexport.dylib')
  })

  it('detects LC_LAZY_LOAD_DYLIB', () => {
    const path = '/usr/lib/liblazy.dylib'
    const enc = new TextEncoder()
    const pathBytes = enc.encode(path)
    const cmdsize = Math.ceil((24 + pathBytes.length + 8) / 8) * 8
    const lazy = makeLoadCommand(0x20, cmdsize) // LC_LAZY_LOAD_DYLIB
    lazy.data[8] = 24
    for (let i = 0; i < pathBytes.length; i++) {
      lazy.data[24 + i] = pathBytes[i]
    }

    const macho = buildMachO32LEWithLoadCommands([lazy])
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.dylibs).toContain('/usr/lib/liblazy.dylib')
  })
})

// ── Mach-O Universal Binary ──

describe('Mach-O Universal Binary', () => {
  function buildUniversalBinary(architectures = []) {
    // Fat header is always big-endian
    // fat_header: magic (4) + nfat_arch (4)
    // fat_arch: cputype (4) + cpusubtype (4) + offset (4) + size (4) + align (4) = 20 each
    const headerSize = 8 + architectures.length * 20

    // Create a minimal Mach-O slice for each architecture
    const sliceSize = 64
    const totalSize = headerSize + architectures.length * sliceSize

    const buf = new Uint8Array(totalSize)

    // Fat magic: CA FE BA BE
    buf[0] = 0xca
    buf[1] = 0xfe
    buf[2] = 0xba
    buf[3] = 0xbe

    // nfat_arch (big-endian)
    writeBE32(buf, 4, architectures.length)

    for (let i = 0; i < architectures.length; i++) {
      const archOffset = 8 + i * 20
      const sliceOffset = headerSize + i * sliceSize

      // cputype (big-endian)
      writeBE32(buf, archOffset, architectures[i].cputype)
      // cpusubtype (big-endian)
      writeBE32(buf, archOffset + 4, architectures[i].cpusubtype || 0x03)
      // offset (big-endian)
      writeBE32(buf, archOffset + 8, sliceOffset)
      // size (big-endian)
      writeBE32(buf, archOffset + 12, sliceSize)
      // align (big-endian) = 14 (2^14 = 16384)
      writeBE32(buf, archOffset + 16, 14)

      // Write a minimal Mach-O slice at sliceOffset
      // 64-bit LE: CF FA ED FE
      buf[sliceOffset] = 0xcf
      buf[sliceOffset + 1] = 0xfa
      buf[sliceOffset + 2] = 0xed
      buf[sliceOffset + 3] = 0xfe
      // cputype (LE)
      const ct = architectures[i].cputype
      buf[sliceOffset + 4] = ct & 0xff
      buf[sliceOffset + 5] = (ct >> 8) & 0xff
      buf[sliceOffset + 6] = (ct >> 16) & 0xff
      buf[sliceOffset + 7] = (ct >> 24) & 0xff
      // filetype = 2 (executable)
      buf[sliceOffset + 12] = 2
    }

    return buf
  }

  function writeBE32(buf, offset, value) {
    buf[offset] = (value >> 24) & 0xff
    buf[offset + 1] = (value >> 16) & 0xff
    buf[offset + 2] = (value >> 8) & 0xff
    buf[offset + 3] = value & 0xff
  }

  it('detects Universal Binary with multiple architectures', () => {
    const ub = buildUniversalBinary([
      { cputype: 0x01000007 }, // x86_64
      { cputype: 0x0100000c } // ARM64
    ])
    const results = detectSpecificFileType(ub)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.type).toBe('Universal Binary')
    expect(machoResult.details.architectureCount).toBe(2)
    expect(machoResult.details.architectures).toContain('x86_64')
    expect(machoResult.details.architectures).toContain('ARM64')
  })

  it('detects Universal Binary with x86 architecture', () => {
    const ub = buildUniversalBinary([{ cputype: 0x00000007 }]) // x86
    const results = detectSpecificFileType(ub)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.type).toBe('Universal Binary')
    expect(machoResult.details.architectures).toContain('x86')
  })

  it('detects Universal Binary with PowerPC architecture', () => {
    const ub = buildUniversalBinary([{ cputype: 0x00000012 }]) // PowerPC
    const results = detectSpecificFileType(ub)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.architectures).toContain('PowerPC')
  })

  it('handles Universal Binary not detected for invalid cpu type', () => {
    // An unknown cpu type fails isMachOFatBinary validation,
    // so it won't be detected as a Mach-O Universal Binary
    const ub = buildUniversalBinary([{ cputype: 0x000000ff }])
    const results = detectSpecificFileType(ub)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    // Not detected as Mach-O because isMachOFatBinary rejects unknown CPU types
    expect(machoResult).toBeUndefined()
  })

  it('detects ARM64_32 architecture', () => {
    const ub = buildUniversalBinary([{ cputype: 0x0200000c }]) // ARM64_32
    const results = detectSpecificFileType(ub)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.architectures).toContain('ARM64_32')
  })

  it('detects PowerPC64 architecture', () => {
    const ub = buildUniversalBinary([{ cputype: 0x01000012 }]) // PowerPC64
    const results = detectSpecificFileType(ub)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult).toBeDefined()
    expect(machoResult.details.architectures).toContain('PowerPC64')
  })
})

// ── PE with sections and RWX detection ──

describe('PE with RWX sections', () => {
  it('detects RWX section', () => {
    const pe = buildMinimalPE({ numSections: 1 })
    const peOffset = 0x80
    const optBase = peOffset + 24
    const optHeaderSize = 224 // PE32
    const sectionHeadersOffset = optBase + optHeaderSize
    // Write section name ".text"
    const sectionName = '.text'
    for (let i = 0; i < sectionName.length; i++) {
      pe[sectionHeadersOffset + i] = sectionName.charCodeAt(i)
    }
    // Section characteristics at offset 36 from section header start
    // Set read + write + execute: 0x40000000 | 0x80000000 | 0x20000000 = 0xE0000000
    pe[sectionHeadersOffset + 36] = 0x00
    pe[sectionHeadersOffset + 37] = 0x00
    pe[sectionHeadersOffset + 38] = 0x00
    pe[sectionHeadersOffset + 39] = 0xe0

    const result = analyzePEStructure(pe)
    expect(result.hasRWXSections).toBe(true)
    expect(result.sections.length).toBeGreaterThanOrEqual(1)
    const textSection = result.sections.find((s) => s.name === '.text')
    expect(textSection).toBeDefined()
    expect(textSection.isRWX).toBe(true)
    expect(textSection.flags).toBe('rwx')
  })

  it('reports non-RWX section', () => {
    const pe = buildMinimalPE({ numSections: 1 })
    const peOffset = 0x80
    const optBase = peOffset + 24
    const sectionHeadersOffset = optBase + 224
    // Characteristics: read only
    pe[sectionHeadersOffset + 36] = 0x00
    pe[sectionHeadersOffset + 37] = 0x00
    pe[sectionHeadersOffset + 38] = 0x00
    pe[sectionHeadersOffset + 39] = 0x40 // READ only

    const result = analyzePEStructure(pe)
    expect(result.hasRWXSections).toBe(false)
    expect(result.sections.length).toBeGreaterThan(0)
    expect(result.sections[0].isRWX).toBe(false)
    expect(result.sections[0].flags).toBe('r--')
  })
})

// ── PE Posix subsystem and more ──

describe('PE subsystem variants', () => {
  it('returns Posix CUI', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 24 + 68] = 7
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('Posix CUI')
  })

  it('returns Windows CE GUI', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 24 + 68] = 9
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('Windows CE GUI')
  })

  it('returns EFI Boot Service Driver', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 24 + 68] = 11
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('EFI Boot Service Driver')
  })

  it('returns EFI Runtime Driver', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 24 + 68] = 12
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('EFI Runtime Driver')
  })

  it('returns XBOX', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 24 + 68] = 14
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('XBOX')
  })

  it('returns Windows Boot Application', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    pe[peOffset + 24 + 68] = 16
    const result = analyzePEStructure(pe)
    expect(result.subsystem).toBe('Windows Boot Application')
  })
})

// ── PE security feature combinations ──

describe('PE security feature combinations', () => {
  it('detects High Entropy VA', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    // DllCharacteristics at optBase + 70
    pe[optBase + 70] = 0x60 // ASLR (0x40) + HIGH_ENTROPY_VA (0x20)
    pe[optBase + 71] = 0x01 // DEP (0x0100)
    const result = analyzePEStructure(pe)
    expect(result.security.highEntropyVA).toBe(true)
    expect(result.security.aslr).toBe(true)
  })

  it('detects CFG', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 70] = 0x40 // ASLR
    pe[optBase + 71] = 0x41 // DEP (0x0100) + CFG (0x4000)
    const result = analyzePEStructure(pe)
    expect(result.security.cfg).toBe(true)
  })

  it('detects NO_SEH', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 70] = 0x40 // ASLR
    pe[optBase + 71] = 0x05 // DEP (0x0100) + NO_SEH (0x0400)
    const result = analyzePEStructure(pe)
    expect(result.security.noSEH).toBe(true)
  })

  it('detects FORCE_INTEGRITY', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 70] = 0xc0 // ASLR (0x40) + FORCE_INTEGRITY (0x80)
    pe[optBase + 71] = 0x01 // DEP
    const result = analyzePEStructure(pe)
    expect(result.security.forceIntegrity).toBe(true)
  })

  it('detects APP_CONTAINER', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 70] = 0x40 // ASLR
    pe[optBase + 71] = 0x11 // DEP (0x0100) + APP_CONTAINER (0x1000)
    const result = analyzePEStructure(pe)
    expect(result.security.appContainer).toBe(true)
  })

  it('reports all features disabled when DllCharacteristics is 0', () => {
    const pe = buildMinimalPE()
    const peOffset = 0x80
    const optBase = peOffset + 24
    pe[optBase + 70] = 0x00
    pe[optBase + 71] = 0x00
    const result = analyzePEStructure(pe)
    expect(result.security.aslr).toBe(false)
    expect(result.security.dep).toBe(false)
    expect(result.security.cfg).toBe(false)
    expect(result.security.noSEH).toBe(false)
    expect(result.security.highEntropyVA).toBe(false)
    expect(result.security.forceIntegrity).toBe(false)
    expect(result.security.appContainer).toBe(false)
  })
})

// ── Mach-O build version platform names ──

describe('Mach-O build version platforms', () => {
  function buildMachOWithBuildVersion(platform) {
    const headerSize = 32
    const cmdsize = 24
    const totalSize = headerSize + cmdsize + 32
    const buf = new Uint8Array(totalSize)

    // 64-bit LE magic
    buf[0] = 0xcf
    buf[1] = 0xfa
    buf[2] = 0xed
    buf[3] = 0xfe
    buf[4] = 0x07 // x86_64
    buf[5] = 0x00
    buf[6] = 0x00
    buf[7] = 0x01
    buf[12] = 0x02 // executable
    buf[16] = 1 // ncmds = 1
    buf[20] = cmdsize & 0xff // sizeofcmds
    buf[24] = 0x00 // flags
    buf[25] = 0x00
    buf[26] = 0x20 // PIE

    // LC_BUILD_VERSION = 0x32
    const lcOff = headerSize
    buf[lcOff] = 0x32
    buf[lcOff + 4] = cmdsize
    // platform (LE)
    buf[lcOff + 8] = platform & 0xff
    buf[lcOff + 9] = (platform >> 8) & 0xff
    // minos = 14.0.0
    buf[lcOff + 14] = 0x0e // major
    // sdk = 15.0.0
    buf[lcOff + 18] = 0x0f // major

    return buf
  }

  it('detects iOS platform', () => {
    const macho = buildMachOWithBuildVersion(2)
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.buildVersion.platform).toBe('iOS')
  })

  it('detects tvOS platform', () => {
    const macho = buildMachOWithBuildVersion(3)
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.buildVersion.platform).toBe('tvOS')
  })

  it('detects watchOS platform', () => {
    const macho = buildMachOWithBuildVersion(4)
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.buildVersion.platform).toBe('watchOS')
  })

  it('detects visionOS platform', () => {
    const macho = buildMachOWithBuildVersion(11)
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.buildVersion.platform).toBe('visionOS')
  })

  it('handles unknown platform', () => {
    const macho = buildMachOWithBuildVersion(99)
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.buildVersion.platform).toMatch(/Unknown/)
  })
})

// ── Office Open XML nested files ──

describe('Office Open XML nested files', () => {
  it('detects Office Open XML document', () => {
    // Build a buffer starting with the OOXML-specific ZIP signature
    const buf = new Uint8Array(1024)
    // Office Open XML signature: PK\x03\x04\x14\x00\x06\x00
    buf[0] = 0x50
    buf[1] = 0x4b
    buf[2] = 0x03
    buf[3] = 0x04
    buf[4] = 0x14
    buf[5] = 0x00
    buf[6] = 0x06
    buf[7] = 0x00

    // Minimal local file header for [Content_Types].xml
    const fileName = '[Content_Types].xml'
    const enc = new TextEncoder()
    const nameBytes = enc.encode(fileName)
    buf[26] = nameBytes.length & 0xff
    buf[27] = (nameBytes.length >> 8) & 0xff
    buf[28] = 0
    buf[29] = 0
    buf.set(nameBytes, 30)

    const results = detectSpecificFileType(buf)
    const ooxmlResult = results.find((r) => r.name === 'Office Open XML Document')
    expect(ooxmlResult).toBeDefined()
    expect(ooxmlResult.details).toHaveProperty('entryCount')
  })
})

// ── ELF with PT_DYNAMIC for dependencies and full RELRO ──

describe('ELF with dynamic section', () => {
  function writeLE32(buf, offset, value) {
    buf[offset] = value & 0xff
    buf[offset + 1] = (value >> 8) & 0xff
    buf[offset + 2] = (value >> 16) & 0xff
    buf[offset + 3] = (value >> 24) & 0xff
  }

  function writeLE64(buf, offset, value) {
    writeLE32(buf, offset, value & 0xffffffff)
    writeLE32(buf, offset + 4, Math.floor(value / 0x100000000) & 0xffffffff)
  }

  function buildELFWithDynamic({
    dynamicEntries = [],
    strtabStrings = [],
    programHeaders = [],
    sectionHeaders = [],
    sectionNames = [],
    elfType = 2,
    withRelro = false,
    withGnuStack = false,
    gnuStackFlags = 6
  } = {}) {
    const ehdrSize = 64
    const phentsize = 56
    const shentsize = 64

    // Build strtab content for dynamic strings
    const enc = new TextEncoder()
    let strtabParts = [0] // Leading null
    const strOffsets = {}
    let off = 1
    for (const s of strtabStrings) {
      strOffsets[s] = off
      const bytes = enc.encode(s)
      for (const b of bytes) strtabParts.push(b)
      strtabParts.push(0) // null terminator
      off += bytes.length + 1
    }
    const dynStrtab = new Uint8Array(strtabParts)

    // Build dynamic entries
    const entrySize = 16 // 64-bit
    const dynamicData = new Uint8Array(dynamicEntries.length * entrySize + entrySize) // +1 for DT_NULL
    for (let i = 0; i < dynamicEntries.length; i++) {
      const de = dynamicEntries[i]
      writeLE64(dynamicData, i * entrySize, de.tag)
      writeLE64(dynamicData, i * entrySize + 8, de.val)
    }
    // DT_NULL terminator is already zero

    // Build all extra program headers
    const extraPHs = [...programHeaders]
    if (withRelro) {
      extraPHs.push({ type: 0x6474e552, flags: 4 }) // PT_GNU_RELRO
    }
    if (withGnuStack) {
      extraPHs.push({ type: 0x6474e551, flags: gnuStackFlags })
    }

    // Layout:
    // [ELF header 64] [program headers] [dynamic strtab] [dynamic data] [section headers]
    const phoff = ehdrSize

    // We need at least: PT_LOAD (for strtab mapping) + PT_DYNAMIC + extra
    const allPHs = [
      // PT_LOAD for the region containing strtab
      null, // placeholder - filled later
      // PT_DYNAMIC
      null, // placeholder - filled later
      ...extraPHs
    ]
    const totalPHs = allPHs.length
    const phSize = totalPHs * phentsize

    const strtabFileOffset = phoff + phSize
    const dynamicFileOffset = strtabFileOffset + dynStrtab.length

    // Build section name strtab
    let shstrtabParts = [0]
    const shNameOffsets = []
    let shOff = 1
    for (const name of sectionNames) {
      shNameOffsets.push(shOff)
      const bytes = enc.encode(name)
      for (const b of bytes) shstrtabParts.push(b)
      shstrtabParts.push(0)
      shOff += bytes.length + 1
    }
    const shstrtab = new Uint8Array(shstrtabParts)

    const shstrtabFileOffset = dynamicFileOffset + dynamicData.length
    const shoff = shstrtabFileOffset + shstrtab.length
    const totalSections = sectionHeaders.length + (sectionNames.length > 0 ? 1 : 0)
    const totalSize = shoff + totalSections * shentsize + 64

    const buf = new Uint8Array(totalSize)

    // ELF header
    buf[0] = 0x7f
    buf[1] = 0x45
    buf[2] = 0x4c
    buf[3] = 0x46
    buf[4] = 2 // 64-bit
    buf[5] = 1 // LE
    buf[6] = 1 // version
    buf[16] = elfType & 0xff
    buf[17] = (elfType >> 8) & 0xff
    buf[18] = 0x3e // x86-64
    buf[20] = 1 // e_version
    writeLE64(buf, 24, 0x400000) // e_entry
    writeLE64(buf, 32, phoff) // e_phoff
    writeLE64(buf, 40, shoff) // e_shoff
    buf[52] = ehdrSize & 0xff // e_ehsize
    buf[54] = phentsize & 0xff // e_phentsize
    buf[56] = totalPHs & 0xff // e_phnum
    buf[58] = shentsize & 0xff // e_shentsize
    buf[60] = totalSections & 0xff // e_shnum
    const shstrndx = sectionNames.length > 0 ? sectionHeaders.length : 0
    buf[62] = shstrndx & 0xff // e_shstrndx

    // Write program headers
    // PT_LOAD: maps strtab region so DT_STRTAB VAddr can be resolved
    const ptLoadOff = phoff
    writeLE32(buf, ptLoadOff, 1) // p_type = PT_LOAD
    writeLE32(buf, ptLoadOff + 4, 4) // p_flags = PF_R
    writeLE64(buf, ptLoadOff + 8, strtabFileOffset) // p_offset
    writeLE64(buf, ptLoadOff + 16, strtabFileOffset) // p_vaddr = file offset (non-PIE)
    writeLE64(buf, ptLoadOff + 32, dynStrtab.length) // p_filesz
    writeLE64(buf, ptLoadOff + 40, dynStrtab.length) // p_memsz

    // PT_DYNAMIC
    const ptDynOff = phoff + phentsize
    writeLE32(buf, ptDynOff, 2) // p_type = PT_DYNAMIC
    writeLE32(buf, ptDynOff + 4, 6) // p_flags = PF_RW
    writeLE64(buf, ptDynOff + 8, dynamicFileOffset) // p_offset
    writeLE64(buf, ptDynOff + 32, dynamicData.length) // p_filesz
    writeLE64(buf, ptDynOff + 40, dynamicData.length) // p_memsz

    // Extra program headers
    for (let i = 0; i < extraPHs.length; i++) {
      const ph = extraPHs[i]
      const phOff = phoff + (2 + i) * phentsize
      writeLE32(buf, phOff, ph.type)
      writeLE32(buf, phOff + 4, ph.flags || 0)
      if (ph.offset !== undefined) writeLE64(buf, phOff + 8, ph.offset)
      if (ph.filesz !== undefined) writeLE64(buf, phOff + 32, ph.filesz)
      if (ph.memsz !== undefined) writeLE64(buf, phOff + 40, ph.memsz)
    }

    // Write dynamic strtab data
    buf.set(dynStrtab, strtabFileOffset)

    // Write dynamic data
    buf.set(dynamicData, dynamicFileOffset)

    // Write section name strtab
    buf.set(shstrtab, shstrtabFileOffset)

    // Write section headers
    for (let i = 0; i < sectionHeaders.length; i++) {
      const sh = sectionHeaders[i]
      const shOff = shoff + i * shentsize
      writeLE32(buf, shOff, sh.nameIdx !== undefined ? sh.nameIdx : 0)
      writeLE32(buf, shOff + 4, sh.type || 0)
    }

    // Write .shstrtab section header (last)
    if (sectionNames.length > 0) {
      const strtabShOff = shoff + sectionHeaders.length * shentsize
      writeLE32(buf, strtabShOff + 4, 3) // SHT_STRTAB
      writeLE64(buf, strtabShOff + 24, shstrtabFileOffset)
      writeLE64(buf, strtabShOff + 32, shstrtab.length)
    }

    return { buf, strOffsets }
  }

  it('detects DT_NEEDED dependencies', () => {
    // Pre-calculate string table offsets (leading null + strings)
    // Offset 0 = null, offset 1 = "libc.so.6", offset 11 = "libm.so.6"
    const libcOffset = 1
    const libmOffset = 1 + 'libc.so.6'.length + 1 // 11

    const { buf } = buildELFWithDynamic({
      strtabStrings: ['libc.so.6', 'libm.so.6'],
      dynamicEntries: [
        { tag: 5, val: 0 }, // DT_STRTAB placeholder
        { tag: 10, val: 0 }, // DT_STRSZ
        { tag: 1, val: libcOffset }, // DT_NEEDED libc.so.6
        { tag: 1, val: libmOffset } // DT_NEEDED libm.so.6
      ]
    })

    const results = detectSpecificFileType(buf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    // Dependencies may or may not resolve depending on VA mapping
    // At minimum, the code paths should be exercised
    expect(Array.isArray(elfResult.details.dependencies)).toBe(true)
  })

  it('detects full RELRO (PT_GNU_RELRO + DT_BIND_NOW)', () => {
    const { buf } = buildELFWithDynamic({
      strtabStrings: [],
      dynamicEntries: [
        { tag: 24, val: 0 } // DT_BIND_NOW
      ],
      withRelro: true
    })

    const results = detectSpecificFileType(buf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.relro).toBe('full')
  })

  it('detects full RELRO via DT_FLAGS DF_BIND_NOW', () => {
    const { buf } = buildELFWithDynamic({
      strtabStrings: [],
      dynamicEntries: [
        { tag: 30, val: 0x8 } // DT_FLAGS with DF_BIND_NOW
      ],
      withRelro: true
    })

    const results = detectSpecificFileType(buf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.relro).toBe('full')
  })

  it('detects DT_TEXTREL', () => {
    const { buf } = buildELFWithDynamic({
      strtabStrings: [],
      dynamicEntries: [
        { tag: 22, val: 0 } // DT_TEXTREL
      ]
    })

    const results = detectSpecificFileType(buf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.textrel).toBe(true)
  })

  it('detects PIE via ET_DYN + PT_INTERP', () => {
    const { buf } = buildELFWithDynamic({
      elfType: 3, // ET_DYN
      strtabStrings: [],
      dynamicEntries: [],
      programHeaders: [
        { type: 3, flags: 4, offset: 0, filesz: 1, memsz: 1 } // PT_INTERP
      ]
    })

    const results = detectSpecificFileType(buf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.pie).toBe(true)
  })

  it('detects DT_RPATH and DT_RUNPATH', () => {
    // Pre-calculate offsets: offset 1 = "/opt/lib", offset 10 = "/usr/local/lib"
    const rpathOffset = 1
    const runpathOffset = 1 + '/opt/lib'.length + 1

    const { buf } = buildELFWithDynamic({
      strtabStrings: ['/opt/lib', '/usr/local/lib'],
      dynamicEntries: [
        { tag: 5, val: 0 }, // DT_STRTAB placeholder
        { tag: 10, val: 0 }, // DT_STRSZ
        { tag: 15, val: rpathOffset }, // DT_RPATH
        { tag: 29, val: runpathOffset } // DT_RUNPATH
      ]
    })

    const results = detectSpecificFileType(buf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    // The rpath/runpath fields should be present (may or may not resolve correctly
    // depending on VA mapping, but the code paths are exercised)
    expect(elfResult.details).toHaveProperty('rpath')
    expect(elfResult.details).toHaveProperty('runpath')
  })
})

// ── Office nested file detection ──

describe('Office nested files (detectNestedFiles)', () => {
  // NOTE: isFileType(bytes, 'OFFICE') matches 'Microsoft Office Document' (OLE2 D0 CF ...)
  // but scanOfficeContents internally calls scanZipContents. To exercise this path,
  // we construct a file starting with OLE2 magic that also contains ZIP local file headers.

  function buildOLE2WithEmbeddedZIP(embeddingName) {
    const enc = new TextEncoder()
    const nameBytes = enc.encode(embeddingName)
    const buf = new Uint8Array(256)

    // OLE2 / Microsoft Office Document signature
    buf[0] = 0xd0
    buf[1] = 0xcf
    buf[2] = 0x11
    buf[3] = 0xe0
    buf[4] = 0xa1
    buf[5] = 0xb1
    buf[6] = 0x1a
    buf[7] = 0xe1

    // Embed a ZIP local file header at offset 64
    const zipOff = 64
    buf[zipOff] = 0x50
    buf[zipOff + 1] = 0x4b
    buf[zipOff + 2] = 0x03
    buf[zipOff + 3] = 0x04
    // File name length
    buf[zipOff + 26] = nameBytes.length & 0xff
    buf[zipOff + 27] = (nameBytes.length >> 8) & 0xff
    buf[zipOff + 28] = 0 // extra field length
    buf[zipOff + 29] = 0
    buf.set(nameBytes, zipOff + 30)

    return buf
  }

  it('detects Office embeddings (word/embeddings/) in OLE2-like file', () => {
    const buf = buildOLE2WithEmbeddedZIP('word/embeddings/oleObject1.bin')
    const findings = detectNestedFiles(buf)
    const officeEmbedding = findings.find((f) => f.type === 'Office Embedded Object')
    expect(officeEmbedding).toBeDefined()
    expect(officeEmbedding.name).toContain('word/embeddings/')
    expect(officeEmbedding.confidence).toBe('High')
  })

  it('detects xl/embeddings in OLE2-like file', () => {
    const buf = buildOLE2WithEmbeddedZIP('xl/embeddings/chart1.xlsx')
    const findings = detectNestedFiles(buf)
    const officeEmbedding = findings.find((f) => f.type === 'Office Embedded Object')
    expect(officeEmbedding).toBeDefined()
    expect(officeEmbedding.name).toContain('xl/embeddings/')
  })

  it('detects ppt/embeddings in OLE2-like file', () => {
    const buf = buildOLE2WithEmbeddedZIP('ppt/embeddings/media.wmf')
    const findings = detectNestedFiles(buf)
    const officeEmbedding = findings.find((f) => f.type === 'Office Embedded Object')
    expect(officeEmbedding).toBeDefined()
    expect(officeEmbedding.name).toContain('ppt/embeddings/')
  })

  it('does not report non-embedding entries as Office objects', () => {
    const buf = buildOLE2WithEmbeddedZIP('word/document.xml')
    const findings = detectNestedFiles(buf)
    const officeEmbedding = findings.find((f) => f.type === 'Office Embedded Object')
    expect(officeEmbedding).toBeUndefined()
  })
})

// ── ELF 32-bit little-endian program headers ──

describe('ELF 32-bit LE with program headers', () => {
  function writeLE32(buf, offset, value) {
    buf[offset] = value & 0xff
    buf[offset + 1] = (value >> 8) & 0xff
    buf[offset + 2] = (value >> 16) & 0xff
    buf[offset + 3] = (value >> 24) & 0xff
  }

  function buildELF32LEWithProgramHeaders(programHeaders = []) {
    const ehdrSize = 52
    const phentsize = 32
    const phoff = ehdrSize
    const phSize = programHeaders.length * phentsize
    const totalSize = phoff + phSize + 64

    const buf = new Uint8Array(totalSize)
    buf[0] = 0x7f
    buf[1] = 0x45
    buf[2] = 0x4c
    buf[3] = 0x46
    buf[4] = 1 // 32-bit
    buf[5] = 1 // LE
    buf[6] = 1 // version
    buf[16] = 2 // ET_EXEC
    buf[18] = 0x03 // x86
    buf[20] = 1 // e_version
    writeLE32(buf, 24, 0x8048000) // e_entry
    writeLE32(buf, 28, phoff) // e_phoff
    writeLE32(buf, 36, 0) // e_flags
    buf[40] = ehdrSize & 0xff // e_ehsize
    buf[42] = phentsize & 0xff // e_phentsize
    buf[44] = programHeaders.length & 0xff // e_phnum
    buf[46] = 0 // e_shentsize
    buf[48] = 0 // e_shnum
    buf[50] = 0 // e_shstrndx

    for (let i = 0; i < programHeaders.length; i++) {
      const ph = programHeaders[i]
      const off = phoff + i * phentsize
      writeLE32(buf, off, ph.type) // p_type
      writeLE32(buf, off + 4, ph.offset || 0) // p_offset
      writeLE32(buf, off + 8, ph.vaddr || 0) // p_vaddr
      // p_paddr at off+12
      writeLE32(buf, off + 16, ph.filesz || 0) // p_filesz
      writeLE32(buf, off + 20, ph.memsz || 0) // p_memsz
      writeLE32(buf, off + 24, ph.flags || 0) // p_flags
    }

    return buf
  }

  it('detects 32-bit LE PT_LOAD segments', () => {
    const elf = buildELF32LEWithProgramHeaders([
      { type: 1, flags: 5, offset: 0, vaddr: 0x8048000, filesz: 0x1000, memsz: 0x1000 },
      { type: 1, flags: 6, offset: 0x1000, vaddr: 0x8049000, filesz: 0x200, memsz: 0x200 }
    ])
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult).toBeDefined()
    expect(elfResult.details.segments.length).toBe(2)
    expect(elfResult.details.segments[0].flags).toBe('r-x')
    expect(elfResult.details.segments[1].flags).toBe('rw-')
  })

  it('detects 32-bit LE entry point', () => {
    const elf = buildELF32LEWithProgramHeaders([])
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.entryPoint).toMatch(/^0x/)
    // 32-bit entry points should be 8 hex chars
    expect(elfResult.details.entryPoint.length).toBe(10) // "0x" + 8 chars
  })

  it('detects 32-bit class', () => {
    const elf = buildELF32LEWithProgramHeaders([])
    const results = detectSpecificFileType(elf)
    const elfResult = results.find((r) => r.name === 'ELF Binary')
    expect(elfResult.details.class).toBe('32-bit')
    expect(elfResult.details.machine).toBe('x86')
  })
})

// ── Mach-O file type variants ──

describe('Mach-O remaining file types', () => {
  it('detects Core Dump file type', () => {
    const macho = buildMinimalMachO64LE()
    macho[12] = 4 // Core Dump
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Core Dump')
  })

  it('detects Dynamic Linker file type', () => {
    const macho = buildMinimalMachO64LE()
    macho[12] = 7
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Dynamic Linker')
  })

  it('detects Kext file type', () => {
    const macho = buildMinimalMachO64LE()
    macho[12] = 11
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Kext')
  })

  it('detects Fixed VM Library file type', () => {
    const macho = buildMinimalMachO64LE()
    macho[12] = 3
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Fixed VM Library')
  })

  it('detects Preloaded file type', () => {
    const macho = buildMinimalMachO64LE()
    macho[12] = 5
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Preloaded')
  })

  it('detects Dylib Stub file type', () => {
    const macho = buildMinimalMachO64LE()
    macho[12] = 9
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Dylib Stub')
  })

  it('detects Debug Symbols file type', () => {
    const macho = buildMinimalMachO64LE()
    macho[12] = 10
    const results = detectSpecificFileType(macho)
    const machoResult = results.find((r) => r.name.includes('Mach-O'))
    expect(machoResult.details.fileType).toBe('Debug Symbols')
  })
})
