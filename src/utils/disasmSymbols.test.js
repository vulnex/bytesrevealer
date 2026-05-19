import { describe, it, expect } from 'vitest'
import { extractSymbolNames } from './disasmSymbols.js'

function writeU16LE(bytes, off, value) {
  bytes[off] = value & 0xff
  bytes[off + 1] = (value >> 8) & 0xff
}

function writeU32LE(bytes, off, value) {
  bytes[off] = value & 0xff
  bytes[off + 1] = (value >> 8) & 0xff
  bytes[off + 2] = (value >> 16) & 0xff
  bytes[off + 3] = (value >>> 24) & 0xff
}

function writeCString(bytes, off, s) {
  for (let i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i)
  bytes[off + s.length] = 0
  return off + s.length + 1
}

/**
 * Build a minimal valid PE32+ image with one section that owns:
 *  - the export directory
 *  - the function-RVAs array
 *  - the name-RVAs array
 *  - the name-ordinals array
 *  - the name strings themselves
 *  - the dummy function bodies at known RVAs
 *
 * Returns the bytes plus a map of {exportName -> expected fileOffset}.
 */
function buildPEWithExports(exports) {
  const peOffset = 0x80
  const optionalHeaderSize = 0xf0
  const sectionHeadersOffset = peOffset + 24 + optionalHeaderSize
  // Section: virtual base at 0x1000, raw base at 0x400, size 0x400.
  const sectionVirtualAddress = 0x1000
  const sectionPointerToRawData = 0x400
  const sectionSize = 0x400
  const totalSize = sectionPointerToRawData + sectionSize
  const bytes = new Uint8Array(totalSize)

  // MZ + e_lfanew
  bytes[0] = 0x4d
  bytes[1] = 0x5a
  writeU32LE(bytes, 0x3c, peOffset)

  // "PE\0\0"
  bytes[peOffset] = 0x50
  bytes[peOffset + 1] = 0x45

  const coffBase = peOffset + 4
  const optBase = peOffset + 24
  // Machine = AMD64
  writeU16LE(bytes, coffBase, 0x8664)
  writeU16LE(bytes, coffBase + 2, 1) // numberOfSections
  writeU16LE(bytes, coffBase + 16, optionalHeaderSize)
  // PE32+ optional header magic
  writeU16LE(bytes, optBase, 0x20b)
  // numberOfRvaAndSizes — make sure data directories include export (idx 0)
  writeU32LE(bytes, optBase + 108, 16)

  // Section header (single section)
  const secOff = sectionHeadersOffset
  // Name padded to 8 bytes
  bytes[secOff] = 0x2e
  bytes[secOff + 1] = 0x65
  bytes[secOff + 2] = 0x64
  bytes[secOff + 3] = 0x61
  bytes[secOff + 4] = 0x74
  bytes[secOff + 5] = 0x61
  writeU32LE(bytes, secOff + 8, sectionSize) // VirtualSize
  writeU32LE(bytes, secOff + 12, sectionVirtualAddress)
  writeU32LE(bytes, secOff + 16, sectionSize) // SizeOfRawData
  writeU32LE(bytes, secOff + 20, sectionPointerToRawData) // PointerToRawData

  // Lay out inside the section:
  //   0x00: IMAGE_EXPORT_DIRECTORY (40 bytes)
  //   0x40: function RVAs (4 * count)
  //   0x40 + 4*count: name RVAs (4 * count)
  //   that + 2*count: name ordinals (2 * count)
  //   then function bytes (1 byte each)
  //   then strings
  const count = exports.length
  const exportDirRawOff = sectionPointerToRawData
  const exportDirRVA = sectionVirtualAddress
  const funcsRawOff = exportDirRawOff + 0x40
  const funcsRVA = exportDirRVA + 0x40
  const namesRawOff = funcsRawOff + 4 * count
  const namesRVA = funcsRVA + 4 * count
  const ordsRawOff = namesRawOff + 4 * count
  const ordsRVA = namesRVA + 4 * count
  const funcBodyRawOff = ordsRawOff + 2 * count
  const funcBodyRVA = ordsRVA + 2 * count
  // Each function body 1 byte.
  let stringsRawOff = funcBodyRawOff + count
  const expected = {}

  for (let i = 0; i < count; i++) {
    // function RVA points to a unique body byte
    const funcRVA = funcBodyRVA + i
    writeU32LE(bytes, funcsRawOff + i * 4, funcRVA)
    // name RVA points to where we'll write the C string
    const nameRVA = sectionVirtualAddress + (stringsRawOff - sectionPointerToRawData) + i * 32
    writeU32LE(bytes, namesRawOff + i * 4, nameRVA)
    // ordinal = i (one-to-one)
    writeU16LE(bytes, ordsRawOff + i * 2, i)
    // C string at stringsRawOff + i*32
    writeCString(bytes, stringsRawOff + i * 32, exports[i])
    // expected file offset = where the function body byte lives
    expected[exports[i]] = funcBodyRawOff + i
  }

  // Write export directory: AddressOfFunctions/Names/NameOrdinals as RVAs
  writeU32LE(bytes, exportDirRawOff + 20, count) // NumberOfFunctions
  writeU32LE(bytes, exportDirRawOff + 24, count) // NumberOfNames
  writeU32LE(bytes, exportDirRawOff + 28, funcsRVA)
  writeU32LE(bytes, exportDirRawOff + 32, namesRVA)
  writeU32LE(bytes, exportDirRawOff + 36, ordsRVA)

  // Data directory entry 0 (Export Table) — its declared size must cover
  // the export tables themselves but NOT the function bodies, because
  // getPEExportSymbols treats any function RVA inside [exportRVA,
  // exportRVA+exportSize) as a forwarder and skips it. Tight-fit to the
  // end of the ordinals array.
  const exportTablesSize = 0x40 + 4 * count + 4 * count + 2 * count
  writeU32LE(bytes, optBase + 112, exportDirRVA)
  writeU32LE(bytes, optBase + 112 + 4, exportTablesSize)

  return { bytes, expected }
}

describe('extractSymbolNames', () => {
  it('returns an empty map for empty / null bytes', () => {
    expect(extractSymbolNames(null).size).toBe(0)
    expect(extractSymbolNames(new Uint8Array(0)).size).toBe(0)
  })

  it('returns an empty map for non-PE bytes', () => {
    expect(extractSymbolNames(new Uint8Array([0x7f, 0x45, 0x4c, 0x46])).size).toBe(0)
  })

  it('parses a PE export directory and maps name → file offset', () => {
    const { bytes, expected } = buildPEWithExports(['CreateFileA', 'CloseHandle'])
    const map = extractSymbolNames(bytes)
    expect(map.size).toBe(2)
    expect(map.get(expected.CreateFileA)).toBe('CreateFileA')
    expect(map.get(expected.CloseHandle)).toBe('CloseHandle')
  })

  it('keeps the first name when two exports share a function offset', () => {
    // The build helper assigns unique RVAs; this test fakes a collision
    // by patching the second name's ordinal to point at the first function.
    const { bytes, expected } = buildPEWithExports(['DoThing', 'DoThingAlias'])
    // Find the ordinals array. Easier path: rebuild manually with a known
    // collision via the existing helpers — but our helper allocates 1
    // body byte per export, so we can repoint the second ordinal at the
    // first function's index.
    // Section base: 0x400 + 0x40 (export dir) + 4*2 (funcs) + 4*2 (names)
    //              = 0x400 + 0x40 + 8 + 8 = 0x450
    const ordsRawOff = 0x400 + 0x40 + 4 * 2 + 4 * 2
    bytes[ordsRawOff + 2] = 0 // second name's ordinal = 0
    bytes[ordsRawOff + 3] = 0
    const map = extractSymbolNames(bytes)
    expect(map.size).toBe(1)
    expect(map.get(expected.DoThing)).toBe('DoThing')
  })
})
