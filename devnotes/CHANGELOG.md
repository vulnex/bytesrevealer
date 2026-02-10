# BytesRevealer Changelog

All notable changes to BytesRevealer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.4.5] - 2026-02-09

### Added
- **Bookmarks & Annotations**
  - Right-click context menu items: "Add Bookmark Here" (single offset) and "Annotate Selection" (byte range with note)
  - New `BookmarksPanel.vue` component in the Hex View right panel with "Bookmarks" tab
  - Two collapsible sections (Bookmarks, Annotations) with filter input and sort dropdown (by offset/name/date)
  - Inline edit dialog for label, note (annotations only), and color (8-color palette)
  - Click-to-navigate: clicking an item scrolls the hex view to that offset
  - Visual indicators in both Hex View and Visual View:
    - Bookmarked byte: 2px solid top-border in bookmark color
    - Annotated range: translucent background + 2px solid bottom-border in annotation color
    - ColoredBytes (paint tool) override annotation background; bookmark borders always visible
  - O(1) bookmark offset lookup via `bookmarkMap` computed property
  - Full session persistence: bookmarks and annotations saved/restored via SessionManager
  - Dirty-tracking watcher for annotations to trigger session auto-save
  - Toast notifications on bookmark/annotation creation
  - Data model: Bookmark `{ id, offset, label, color, created }`, Annotation `{ id, startOffset, endOffset, label, note, color, created }`

### Technical Details
- New files:
  - `src/components/BookmarksPanel.vue` - Bookmarks & Annotations panel with filter/sort/edit/delete
- Modified files:
  - `src/App.vue` - annotations data, 6 CRUD methods, props/events wiring, session restore/reset, dirty watcher
  - `src/components/HexContextMenu.vue` - selectionStart/selectionEnd/clickedOffset props, add-bookmark/add-annotation emits and menu items
  - `src/components/HexView.vue` - bookmarks/annotations props, BookmarksPanel tab, updated getByteStyles(), clickedOffset capture, event forwarding
  - `src/components/VisualView.vue` - bookmarks/annotations props, bookmarkMap computed, updated getByteStyles()
  - `src/services/SessionManager.js` - annotations array in session data and updateSession preservation

---

## [0.4.4] - 2026-02-09

### Added
- **Deep PE (Windows) Binary Analysis**
  - Little-endian PE reading utilities (`readPEUint16/32/64`) with bounds checking
  - Full COFF + Optional Header parser (`getPEHeaderInfo`) supporting both PE32 and PE32+ (64-bit)
  - RVA-to-file-offset mapper (`rvaToFileOffset`) via section header walking — fixes the existing `getPEImportCount` bug which used RVAs as raw file offsets
  - Data directory parser (`getPEDataDirectories`) for all 16 PE data directory entries
  - Section header parser (`getPESections`) with names, raw sizes, and rwx permission flags (IMAGE_SCN_MEM_READ/WRITE/EXECUTE)
  - Security feature detection (`getPESecurityFeatures`): ASLR (DYNAMIC_BASE), High Entropy VA, DEP/NX (NX_COMPAT), Control Flow Guard, SEH usage, Force Integrity, App Container
  - Import directory parser (`getPEImports`) resolving DLL names through proper RVA-to-offset mapping
  - Export directory parser (`getPEExports`) returning DLL name, function count, and name count
  - Authenticode certificate detection (`getPECertificateInfo`) from Data Directory[4] (file offset, not RVA)
  - Debug directory detection (`getPEDebugInfo`) from Data Directory[6]
  - .NET CLR detection (`getPEIsNet`) from Data Directory[14]
  - `analyzePEStructure()` now returns 18 fields (up from 6): machine, is64bit, entryPoint, imageBase, sections with rwx, sectionNames, hasRWXSections, imports (DLL names), importCount, exports, security features, hasCertificate, certificateSize, hasDebugInfo, isNet

- **Expanded PE Attack Graph Vulnerabilities**
  - PE vulnerability mapper now checks 13 conditions (up from 4):
    - No ASLR (vuln_no_aslr) → Fixed Address Exploitation
    - No DEP/NX (vuln_no_dep) → Stack-Based Code Execution
    - No Control Flow Guard (vuln_no_cfg) → Control Flow Hijacking
    - SEH Chain Exploitation (vuln_seh) → SEH Chain Overwrite
    - No Code Integrity Enforcement (vuln_no_integrity)
    - RWX Memory Sections (vuln_rwx) → Memory Corruption Exploitation
    - Unsigned Binary (vuln_unsigned) → Unsigned Code Execution
    - Debug Information Present (vuln_debug_info)
    - .NET Managed Binary (vuln_dotnet) → Managed Code Decompilation
    - Partial ASLR (vuln_partial_aslr) for 64-bit without HIGH_ENTROPY_VA
  - Added priv_system escalation path for Native subsystem or RWX sections

- **Self-Contained PE Metadata Extractor**
  - Replaced 9 undefined function calls in `extractPEMetadata()` with a fully self-contained implementation (~170 lines)
  - Parses: DOS header, COFF header (machine, timestamp, characteristics), Optional header (magic, entryPoint, imageBase, subsystem, DllCharacteristics), sections with rwx flags, imports (DLL names), exports (count), certificate presence, debug info, .NET detection, security features
  - Wired into `detectSpecificFileType()` PE branch for metadata export (matching ELF/Mach-O)

- **Binary Analysis UI Section**
  - New `BinaryAnalysis.vue` component providing a dedicated, structured view for PE/ELF/Mach-O analysis results
  - Header info grid: machine, architecture, subsystem, entry point, image base, timestamp, signing status, debug info
  - Color-coded security feature badges: green (enabled), red (disabled/missing), orange (warnings), blue (informational)
  - Sections table with name, virtual size, raw size, and permission flags (RWX rows highlighted in red)
  - Import DLL names displayed as tags; export function/name counts
  - ELF dependencies and Mach-O dylibs shown in dedicated Dependencies section
  - Placed after File Signatures in the File Analysis tab for immediate visibility

- **Improved File Signature Rendering**
  - `formatValue()` now handles booleans (Yes/No), arrays of objects (name with flags), and plain objects (key-value pairs) instead of showing `[object Object]`
  - `flattenMetadata()` now recursively flattens arrays of objects by name/index for structured metadata display

### Fixed
- **PE Parsing Correctness**
  - Fixed `getPECharacteristics()` missing COFF flags: Relocations Stripped (0x0001), 32-Bit Machine (0x0100), Debug Stripped (0x0200), System File (0x1000)
  - Fixed `getPEImportCount()` using RVAs as raw file offsets (new `rvaToFileOffset` resolves through section headers)
  - Fixed `detectSpecificFileType()` PE branch missing `extractMetadata()` call (ELF and Mach-O had it)
  - Fixed `FileSignatures.vue` rendering nested objects/arrays as `[object Object]`

### Technical Details
- New files:
  - `src/components/BinaryAnalysis.vue` - Dedicated binary analysis UI component
- Modified files:
  - `src/utils/advancedFileDetection.js` - PE core utilities (4 readers + 11 parsers), enriched analyzePEStructure(), fixed getPECharacteristics(), wired metadata extraction
  - `src/services/UsecvislibExporter.js` - Expanded _mapPEVulnerabilities() from 4 to 13 conditions with priv_system escalation
  - `src/utils/metadataExtractor.js` - Self-contained extractPEMetadata() replacing 9 undefined stub calls
  - `src/components/FileAnalysis.vue` - Wired BinaryAnalysis component after FileSignatures
  - `src/components/FileSignatures.vue` - Fixed formatValue() and flattenMetadata() for complex types

---

## [0.4.3] - 2026-02-09

### Added
- **Deep ELF Binary Analysis**
  - Endianness-aware parsing utilities (`readElfUint16/32/64`) supporting both little-endian and big-endian ELF binaries
  - Full ELF header parser (`getElfHeaderInfo`) for both 32-bit and 64-bit formats
  - Program header walking (`getElfProgramHeaders`) with type name mapping (PT_LOAD, PT_DYNAMIC, PT_GNU_STACK, etc.)
  - Section header parsing (`getElfSections`) with `.shstrtab` string table name resolution
  - Shared library dependency extraction (`getElfDependencies`) via DT_NEEDED entries with VA-to-file-offset mapping
  - Security feature detection (`getElfSecurityFeatures`): PIE, executable stack (PT_GNU_STACK), RELRO (none/partial/full), TEXTREL
  - Interpreter path extraction (`getElfInterpreter`) from PT_INTERP
  - Rpath/Runpath extraction (`getElfRpath`) from DT_RPATH/DT_RUNPATH
  - Stripped binary detection (`getElfIsStripped`) via .symtab presence check
  - Segment permission analysis (`getElfSegmentPermissions`) with RWX detection
  - `analyzeElfStructure()` now returns 17 fields (up from 5): sectionNames, isDynamicallyLinked, interpreter, dependencies, segments, hasRWXSegments, pie, executableStack, relro, textrel, isStripped, rpath, runpath

- **Expanded ELF Attack Graph Vulnerabilities**
  - ELF vulnerability mapper now checks 9 conditions (up from 2):
    - No PIE (vuln_no_pie) → Fixed Address Exploitation
    - Executable Stack (vuln_exec_stack) → Stack-Based Code Execution
    - No RELRO (vuln_no_relro) → GOT Overwrite Exploitation
    - RWX Segments (vuln_rwx) → Memory Corruption Exploitation
    - Stripped Binary (vuln_stripped) → Anti-Analysis indicator
    - Rpath/Runpath Injection (vuln_rpath) → Library Path Injection
    - Text Relocations (vuln_textrel) → Code Section Modification
  - Added priv_root escalation path for executable stack and shared object types

- **Self-Contained ELF Metadata Extractor**
  - Replaced 7 stub function calls in `extractELFMetadata()` with a fully self-contained implementation (same pattern as Mach-O)
  - Parses: ELF header, program headers, section headers, DT_NEEDED dependencies, interpreter path, rpath/runpath, security features (PIE, RELRO, executable stack)
  - Wired into `detectSpecificFileType()` ELF branch for metadata export

### Fixed
- **ELF Parsing Correctness**
  - Fixed `countElfSections()` which was hardcoded to offsets 48-49 (only correct for 64-bit little-endian)
  - Fixed `getElfEntryPoint()` which used wrong offset (28) for 32-bit ELF (e_entry is at offset 24 for both 32/64-bit)
  - Fixed `getElfType()` and `getElfMachine()` which were hardcoded to little-endian byte order

### Technical Details
- Modified files:
  - `src/utils/advancedFileDetection.js` - ELF core utilities, 8 new helper functions, enriched analyzeElfStructure(), fixed existing helpers
  - `src/services/UsecvislibExporter.js` - Expanded _mapELFVulnerabilities() from 2 to 9 conditions
  - `src/utils/metadataExtractor.js` - Self-contained extractELFMetadata() replacing stub calls

---

## [0.4.2] - 2026-02-09

### Fixed
- **Mach-O Universal Binary Detection**
  - Fixed CAFEBABE magic byte disambiguation: Mach-O fat/universal binaries were misidentified as Java class files since both formats share the same 4-byte magic
  - Added `isMachOFatBinary()` function that validates fat header (nfat_arch count, CPU type entries) to distinguish from Java class files
  - Added redundant post-check override after `file-type` library to ensure Mach-O fat binaries are never misidentified
  - Fixed all Mach-O analysis functions (type, architecture, segments, load commands, dynamic linking, min version) to use correct byte order (fat headers are always big-endian)
  - Fixed `isMachOUniversal()` which was reading bytes in wrong endianness and never matched
  - Fixed `getUniversalArchitectures()` to read CPU types in big-endian from fat_arch entries
  - Added missing little-endian Mach-O signatures (CFFAEDFE/CEFAEDFE) used by modern macOS binaries
  - Universal binary analysis now parses first architecture slice for detailed load command info

- **USecVisLib Attack Graph Export**
  - Fixed attack graph export not working for Mach-O binaries: `EXECUTABLE_TYPES` matcher required exact `'Mach-O Executable'` which didn't match new signature names like `'Mach-O Universal Binary'`
  - Changed to broader `'Mach-O'` match to support all Mach-O variants (Universal Binary, 32-bit, 64-bit, big-endian)

### Technical Details
- Modified files:
  - `src/utils/fileSignatures.js` - CAFEBABE disambiguation, `isMachOFatBinary()` export, little-endian Mach-O signatures
  - `src/utils/fileHandler.js` - Pre-check and post-check overrides for fat binary detection, fixed Mach-O byte comparisons
  - `src/utils/advancedFileDetection.js` - Endianness-aware Mach-O helpers, universal binary slice parsing, fixed type name matching
  - `src/services/UsecvislibExporter.js` - Broadened Mach-O executable type matching

---

## [0.4.1] - 2026-02-09

### Added
- **USecVisLib Integration**
  - New `UsecvislibExporter` service for exporting analysis data to USecVisLib formats
  - Binary Visualization Data (JSON) export with entropy analysis, byte distribution, and colored byte regions
  - Attack Graph Config (TOML) export for PE/ELF/Mach-O executables with hosts, vulnerabilities, privileges, exploits, and network edges following USecVisLib schema
  - Direct API visualization via USecVisLib REST API with type selection (entropy, distribution, windrose, heatmap), style presets, and format output (PNG/SVG/PDF)
  - API key authentication support for secured USecVisLib instances
  - CORS error detection with helpful diagnostic messaging
  - Info icon linking to USecVisLib GitHub repository

### Changed
- ExportOptions.vue updated with USecVisLib Export section (template, script, scoped styles)
- Export version bumped to 0.4
- Code-split UsecvislibExporter via dynamic `import()` for zero impact on initial bundle

### Technical Details
- New files:
  - `src/services/UsecvislibExporter.js` - USecVisLib export service (offline + API)
- Modified files:
  - `src/components/ExportOptions.vue` - USecVisLib UI section with 3 export modes

---

## [0.4] - 2026-01-03

### Added
- **Session Management System**
  - Save and restore analysis sessions with IndexedDB persistence
  - New "Sessions" tab in the UI for managing saved sessions
  - Export sessions to `.brsession` files for sharing/backup
  - Import sessions from `.brsession` files
  - Session metadata tracking (name, file info, timestamps, tags)
  - Unsaved changes indicator with dirty state tracking
  - Auto-detection of file changes when restoring sessions

- **Session Data Preservation**
  - Saves UI state (active tabs, feature toggles)
  - Saves search patterns and search type
  - Saves highlighted and colored byte ranges
  - Saves base offset configuration
  - Saves analysis results (entropy, hashes, file signatures)
  - Saves detected file type information
  - Saves format parsing state (selected format, auto-detection status)
  - Placeholder for annotations (notes, bookmarks, tags)

- **Storage Management**
  - Detailed storage breakdown showing sessions vs file cache usage
  - Clear file cache functionality to reclaim space from BytesRevealerChunks
  - Storage usage display with actual session sizes

- **Session Restore UX**
  - Session restore banner showing loaded session info
  - File View tab accessible with cached session data
  - Conditional display of byte-dependent vs cached statistics

### Changed
- Updated version to 0.4
- Copyright year now dynamically shows current year (2025-{currentYear})
- Improved IndexedDB error handling with sanitization for non-clonable objects

### Fixed
- Fixed "could not be cloned" IndexedDB errors by sanitizing complex objects
- Fixed storage display showing total IndexedDB instead of session-only usage
- Fixed file cache clear blocked by open database connections
- Fixed session delete not refreshing storage display

### Technical Details
- New files:
  - `src/stores/session.js` - Pinia store for session state
  - `src/services/SessionManager.js` - IndexedDB persistence layer
  - `src/components/SessionControls.vue` - Session management UI
- Modified files:
  - `src/App.vue` - Session integration and restore handling
  - `src/components/FileAnalysis.vue` - Support for session data display

---

## [0.3] - 2025-12-XX

### Added
- Progressive file loading for large files (>50MB)
- BytesRevealerChunks IndexedDB for chunked file storage
- Kaitai Struct format parsing with 200+ binary formats
- Format auto-detection based on file signatures
- KSY format library with categorized formats
- Bundle optimization with code splitting
- PWA support for offline usage

### Changed
- Improved performance for large file handling
- Optimized bundle size with lazy loading

---

## [0.2] - 2025-XX-XX

### Added
- Copy bytes as various formats (hex, decimal, binary, C array, etc.)
- Search functionality with hex, text, and regex support
- Byte highlighting and coloring
- Multiple visualization views (hex, binary, text)
- Entropy calculation and display
- Hash calculations (MD5, SHA1, SHA256)
- File signature detection

### Changed
- Enhanced hex viewer with configurable bytes per row
- Improved UI responsiveness

---

## [0.1] - 2025-XX-XX

### Added
- Initial release
- Basic hex viewer
- File loading via drag & drop and file picker
- Multiple encoding support (ASCII, UTF-8, UTF-16, etc.)
- Dark/light theme support
- Basic file information display

---

## Planned Features

See [enhancement-action-plan.md](./enhancement-action-plan.md) for upcoming features:

- ~~**USecVisLib Integration** - Export to BinVis visualization formats~~ (Done in 0.4.1)
- ~~**Bookmarks & Annotations** - Mark and annotate byte offsets/ranges~~ (Done in 0.4.5)
- **YARA Support** - Browser-based YARA rule scanning via libyara-wasm
- **Disassembly Support** - Basic disassembly via Capstone.js for common architectures
