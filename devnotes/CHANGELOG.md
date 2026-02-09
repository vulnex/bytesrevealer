# BytesRevealer Changelog

All notable changes to BytesRevealer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
- **YARA Support** - Browser-based YARA rule scanning via libyara-wasm
- **Disassembly Support** - Basic disassembly via Capstone.js for common architectures
