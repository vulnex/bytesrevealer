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

/**
 * Build a minimal ELF64 little-endian image with a SHT_SYMTAB plus a
 * SHT_STRTAB and a SHF_ALLOC `.text` section so vaddr → fileOffset
 * translation has somewhere to land.
 */
function buildELF64WithSymbols(funcs) {
  // Layout decisions:
  // 0x000 — ELF header (64 bytes)
  // 0x100 — .text raw data (size 0x100), maps to vaddr 0x400000
  // 0x200 — .symtab raw data
  // 0x300 — .strtab raw data
  // 0x380 — .shstrtab raw data (section name strings)
  // 0x400 — section headers (5 sections × 64 bytes = 320 bytes)
  const ehSize = 64
  const shentsize = 64
  const symEntSize = 24
  const textOff = 0x100
  const textSize = 0x100
  const textAddr = 0x400000
  const symtabOff = 0x200
  const strtabOff = 0x300
  const shstrtabOff = 0x380
  const shoff = 0x400
  const numSections = 5
  const totalSize = shoff + numSections * shentsize + 0x40
  const bytes = new Uint8Array(totalSize)

  // ── ELF header ──
  bytes.set([0x7f, 0x45, 0x4c, 0x46], 0) // ELF magic
  bytes[4] = 2 // EI_CLASS = ELFCLASS64
  bytes[5] = 1 // EI_DATA = ELFDATA2LSB
  bytes[6] = 1 // EI_VERSION
  // e_type at 16 = ET_EXEC (2)
  writeU16LE(bytes, 16, 2)
  // e_machine at 18 = EM_X86_64 (0x3e)
  writeU16LE(bytes, 18, 0x3e)
  // e_version at 20
  writeU32LE(bytes, 20, 1)
  // e_entry at 24 (u64) — leave 0 for the test
  // e_phoff at 32 (u64) = 0 (no program headers)
  // e_shoff at 40 (u64) = shoff
  writeU32LE(bytes, 40, shoff)
  writeU32LE(bytes, 44, 0)
  // e_flags at 48 = 0
  // e_ehsize at 52 = 64
  writeU16LE(bytes, 52, ehSize)
  // e_phentsize at 54, e_phnum at 56 = 0
  // e_shentsize at 58 = 64
  writeU16LE(bytes, 58, shentsize)
  // e_shnum at 60
  writeU16LE(bytes, 60, numSections)
  // e_shstrndx at 62 = 4 (last section is .shstrtab)
  writeU16LE(bytes, 62, 4)

  // ── .shstrtab content ──
  // Layout: NUL + ".text\0" + ".symtab\0" + ".strtab\0" + ".shstrtab\0"
  const names = ['', '.text', '.symtab', '.strtab', '.shstrtab']
  const nameOffsets = []
  let cur = shstrtabOff
  for (const n of names) {
    nameOffsets.push(cur - shstrtabOff)
    for (let i = 0; i < n.length; i++) bytes[cur + i] = n.charCodeAt(i)
    bytes[cur + n.length] = 0
    cur += n.length + 1
  }
  const shstrtabSize = cur - shstrtabOff

  // ── .strtab content (function names) ──
  // Layout: NUL byte first (st_name=0 means no name), then each func name + NUL
  const funcNameOffsets = []
  let strCur = strtabOff
  bytes[strCur++] = 0
  for (const name of funcs) {
    funcNameOffsets.push(strCur - strtabOff)
    for (let i = 0; i < name.length; i++) bytes[strCur + i] = name.charCodeAt(i)
    bytes[strCur + name.length] = 0
    strCur += name.length + 1
  }
  const strtabSize = strCur - strtabOff

  // ── .symtab content ──
  // Entry 0: STN_UNDEF (all zeros).
  // Then one STT_FUNC entry per function, st_value = textAddr + i*0x10.
  const symCount = 1 + funcs.length
  const symSize = symCount * symEntSize
  const expected = {}
  for (let i = 0; i < funcs.length; i++) {
    const entryOff = symtabOff + (i + 1) * symEntSize
    // Elf64_Sym: name(4) info(1) other(1) shndx(2) value(8) size(8)
    writeU32LE(bytes, entryOff, funcNameOffsets[i])
    bytes[entryOff + 4] = 2 // st_info: STT_FUNC (type=2, binding=0)
    bytes[entryOff + 5] = 0 // st_other
    writeU16LE(bytes, entryOff + 6, 1) // st_shndx = 1 (.text)
    const vaddr = textAddr + i * 0x10
    writeU32LE(bytes, entryOff + 8, vaddr & 0xffffffff)
    writeU32LE(bytes, entryOff + 12, 0)
    // st_size: leave 0
    expected[funcs[i]] = textOff + (vaddr - textAddr)
  }

  // ── Section headers ──
  // 0: SHN_UNDEF (zero)
  // 1: .text
  // 2: .symtab
  // 3: .strtab
  // 4: .shstrtab
  function writeShdr(idx, fields) {
    const base = shoff + idx * shentsize
    writeU32LE(bytes, base, fields.name)
    writeU32LE(bytes, base + 4, fields.type)
    writeU32LE(bytes, base + 8, fields.flags) // 64-bit field but we only set the low 32
    writeU32LE(bytes, base + 16, fields.addr)
    writeU32LE(bytes, base + 24, fields.offset)
    writeU32LE(bytes, base + 32, fields.size)
    writeU32LE(bytes, base + 40, fields.link)
    writeU32LE(bytes, base + 56, fields.entsize)
  }
  // SHN_UNDEF stays all zeros — explicit no-op
  writeShdr(1, {
    name: nameOffsets[1],
    type: 1, // SHT_PROGBITS
    flags: 0x6, // SHF_ALLOC | SHF_EXECINSTR
    addr: textAddr,
    offset: textOff,
    size: textSize,
    link: 0,
    entsize: 0
  })
  writeShdr(2, {
    name: nameOffsets[2],
    type: 2, // SHT_SYMTAB
    flags: 0,
    addr: 0,
    offset: symtabOff,
    size: symSize,
    link: 3, // .strtab
    entsize: symEntSize
  })
  writeShdr(3, {
    name: nameOffsets[3],
    type: 3, // SHT_STRTAB
    flags: 0,
    addr: 0,
    offset: strtabOff,
    size: strtabSize,
    link: 0,
    entsize: 0
  })
  writeShdr(4, {
    name: nameOffsets[4],
    type: 3, // SHT_STRTAB
    flags: 0,
    addr: 0,
    offset: shstrtabOff,
    size: shstrtabSize,
    link: 0,
    entsize: 0
  })

  return { bytes, expected }
}

describe('extractSymbolNames', () => {
  it('returns an empty map for empty / null bytes', () => {
    expect(extractSymbolNames(null).size).toBe(0)
    expect(extractSymbolNames(new Uint8Array(0)).size).toBe(0)
  })

  it('returns an empty map for a non-PE / non-ELF prefix', () => {
    expect(extractSymbolNames(new Uint8Array([0xff, 0xff, 0xff, 0xff])).size).toBe(0)
  })

  it('parses a PE export directory and maps name → file offset', () => {
    const { bytes, expected } = buildPEWithExports(['CreateFileA', 'CloseHandle'])
    const map = extractSymbolNames(bytes)
    expect(map.size).toBe(2)
    expect(map.get(expected.CreateFileA)).toBe('CreateFileA')
    expect(map.get(expected.CloseHandle)).toBe('CloseHandle')
  })

  it('parses an ELF64 SHT_SYMTAB and maps function names → file offsets', () => {
    const { bytes, expected } = buildELF64WithSymbols(['main', 'helper'])
    const map = extractSymbolNames(bytes)
    expect(map.size).toBe(2)
    expect(map.get(expected.main)).toBe('main')
    expect(map.get(expected.helper)).toBe('helper')
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
