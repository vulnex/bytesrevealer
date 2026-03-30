# BytesRevealer Changelog

All notable changes to BytesRevealer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.4] - 2026-03-30 (Code Quality, A11y, Responsive & Dependency Upgrades)

### Added
- **ESLint & Prettier** — ESLint 9 flat config with vue/recommended, vitest plugin, eslint-config-prettier; Prettier with project conventions (no semi, single quotes, 100 char width, LF)
- **Pre-commit hook** — husky + lint-staged: JS/Vue files get eslint --fix + prettier --write, CSS/JSON/MD get prettier --write
- **GitHub Actions CI** — Workflow runs lint, format check, tests, and build on push to main and on pull requests
- **Comprehensive accessibility** across 21 components:
  - Tab navigation: role=tablist/tab/tabpanel, aria-selected, tabindex management
  - Dialogs: role=dialog, aria-modal, focus trapping with Tab/Shift+Tab cycling, Escape to close, focus restore (HelpDialog, ExportBytesDialog, ExportBytesRangeDialog)
  - Toasts: role=alert/status, aria-live=assertive/polite by severity
  - Buttons: aria-label on all icon-only buttons across 12 components
  - Forms: aria-label on all inputs/selects lacking visible labels
  - Progress bars: role=progressbar with aria-valuenow/min/max
  - Loading indicators: role=status, aria-live=polite
  - HexView: aria-label, role=grid on byte grid, tabindex=0
  - Context menu: role=menu with aria-label
  - Decorative elements: aria-hidden=true on icons/spinners
- **Responsive layout** for tablet (768px) and mobile (480px) across 17 files:
  - Tabs: horizontal scrolling, reduced padding on small screens
  - Hex/visual views: smaller fonts, hidden ASCII on phone, stacked side panels
  - Dialogs: full-width bottom sheets on phone with touch-friendly sizing
  - Grids: progressive column collapse (32→16→8 for byte grids)
  - String analysis: hidden columns, compact tables
  - Sessions/settings/export: stacked layouts on narrow screens
- **Gzip/Brotli pre-compression** — vite-plugin-compression2 generates .gz and .br files on build (main bundle 326KB→72KB brotli)
- **Bundle analyzer** — rollup-plugin-visualizer behind ANALYZE=true env var, new `build:analyze` script
- **786 new tests** (902→1688 total) across 3 new + 3 expanded test files:
  - `UsecvislibExporter.test.js` (154 tests, was 0%)
  - `FileChunkManager.test.js` (86 tests, was 0%)
  - `fileHandler.test.js` (+112 tests, 6.77%→~91%)
  - `SessionManager.test.js` (expanded, 22%→94%)
  - `metadataExtractor.test.js` (+133 tests, 40%→73%)
  - `advancedFileDetection.test.js` (+189 tests, 42%→75%)

### Changed
- **Vue 3.4.15 → 3.5.29** — Non-breaking minor bump
- **Pinia 2.1.7 → 3.0.4** — Major upgrade, zero source changes needed
- **Vite 5.4.20 → 7.3.1** — Major upgrade, zero config changes needed
- **@vitejs/plugin-vue 5.0.3 → 6.0.4**
- **yaml 2.3.4 → 2.8.2** (Vite 7 peer dependency)

### Fixed
- **153 ESLint warnings** — Added missing defineEmits to 8 Vue components, prefixed unused vars/params with _, removed dead imports, eslint-disable no-console in logger
- **7 Prettier formatting inconsistencies** across source files
- **README** — Fixed version (0.3→0.4), corrected license (MIT→Apache-2.0), fixed LICENSE.md→LICENSE link

### Technical Details
- New files:
  - `.github/workflows/ci.yml` — CI pipeline
  - `eslint.config.js` — ESLint 9 flat config
  - `prettier.config.js` — Prettier config
  - `.prettierignore` — Prettier ignore patterns
  - `.husky/pre-commit` — Pre-commit hook
  - `src/services/UsecvislibExporter.test.js` — 154 tests
  - `src/utils/FileChunkManager.test.js` — 86 tests
- ESLint config includes `caughtErrorsIgnorePattern: '^_'` for catch block variables
- All 1688 tests pass; production build succeeds with compressed assets
- Desktop layout completely unchanged by responsive additions

---

## [0.4] - 2026-03-30 (Component Decomposition & Test Expansion)

### Changed
- **App.vue Decomposition** — Extracted ~400 lines from the 995-line root component into 5 composables + external CSS:
  - `src/composables/useAppPreferences.js` — Theme, features, tab state, graph tab
  - `src/composables/useAnnotations.js` — Bookmarks/annotations CRUD, color management
  - `src/composables/useSearch.js` — Search pattern, type, navigation, worker integration
  - `src/composables/useFileProcessing.js` — File load, hash, entropy, signature detection
  - `src/composables/useSessionRestore.js` — Session load/save state mapping
  - `src/styles/app.css` — Extracted ~330 lines of scoped CSS

- **HexView.vue Decomposition** — Extracted 2 additional composables + external CSS:
  - `src/composables/useHexDisplay.js` — Row rendering, byte formatting, style computation
  - `src/composables/useHexNavigation.js` — Keyboard navigation, offset jumping, match cycling
  - `src/styles/hex-view.css` — Extracted ~290 lines of scoped CSS

- **StringAnalysisView.vue Decomposition** — Extracted 2 composables:
  - `src/composables/useStringExtraction.js` — Worker-based string extraction, fallback sync
  - `src/composables/useStringFilter.js` — Filter, sort, pagination, encoding selection

- **ExportBytesRangeDialog.vue Decomposition** — Extracted 2 composables:
  - `src/composables/useExportRange.js` — Range validation, selection, byte slicing
  - `src/composables/useExportFormat.js` — Language selection, format conversion, clipboard

- **ExportBytesDialog.vue** — Adopted `useExportFormat` composable + extracted CSS

- **VisualView.vue Decomposition** — Extracted 2 composables:
  - `src/composables/useVisualScroll.js` — Virtual scrolling, visible row calculation
  - `src/composables/useVisualInteraction.js` — Mouse selection, hover, byte styles

- **SessionControls.vue Decomposition** — Extracted 2 composables + external CSS:
  - `src/composables/useSessionStorage.js` — Storage usage display, file cache management
  - `src/composables/useSessionActions.js` — Session CRUD, import/export, verification, formatting
  - `src/styles/session-controls.css` — Extracted ~430 lines of scoped CSS

### Added
- **565 new unit tests** across 20 test files (from 337 to 902 total):
  - `useAppPreferences.test.js` (17), `useAnnotations.test.js` (20), `useSearch.test.js` (19)
  - `useFileProcessing.test.js` (27), `useSessionRestore.test.js` (11)
  - `useHexDisplay.test.js` (44), `useHexNavigation.test.js` (24)
  - `useStringExtraction.test.js` (36), `useStringFilter.test.js` (47)
  - `useExportRange.test.js` (54), `useExportFormat.test.js` (42)
  - `useVisualScroll.test.js` (35), `useVisualInteraction.test.js` (76)
  - `useSessionStorage.test.js` (15), `useSessionActions.test.js` (56)
  - `useByteInspector.test.js` (12), `useByteSelection.test.js` (12)
  - `useHexExport.test.js` (27), `useKaitaiIntegration.test.js` (21), `useHexVirtualScroll.test.js` (20)

### Fixed
- **17 security vulnerabilities** from deep code review (XSS, prototype pollution, ReDoS, etc.)

### Technical Details
- Composable count: 5 → 14 (useByteInspector, useByteSelection, useHexVirtualScroll, useHexExport, useKaitaiIntegration already existed)
- Extracted CSS files: app.css, hex-view.css, session-controls.css
- All 902 tests pass; no regressions across all decompositions
- Component line counts reduced: App.vue 995→595, HexView.vue 900→545, StringAnalysisView.vue 600→280, SessionControls.vue 978→280

---

## [0.4] - 2026-02-10 (YARA Rule Scanning)

### Added
- **YARA Rule Scanning** — Browser-based YARA pattern matching via `libyara-wasm` v1.2.1
  - New "YARA" tab with rule editor (`<textarea>`), built-in rule set selector, and `.yar` file import
  - 4 built-in rule sets: Common Malware Patterns, Crypto Indicators, Packers & Protectors, Suspicious Strings
  - Scan execution via Web Worker (lazy WASM initialization, kept warm for subsequent scans)
  - Results display with matched rules count, total matches, scan duration
  - Collapsible rule cards with match tables showing offset, string identifier, length, and data
  - "Go" button on each match navigates to the offset in Hex View (reuses `navigateToMatch` pattern)
  - "Highlight matches in Hex View" toggle for visual overlay of all match locations
  - Warning banner for files >50MB (scanning still works)
  - "No matches found" banner when scan completes with zero results
  - Compile error display (red for errors, yellow for warnings)
  - Progress bar during scan
  - Feature toggle checkbox in analysis preferences
  - Full session persistence (rules, results, settings saved/restored)
  - Export integration (YARA matches checkbox in Export Options)
  - Code-split `libyara-wasm` into separate ~1.1MB chunk, loaded only on first scan

### Fixed
- **HexView Sidebar Tab Overflow** — Bookmarks tab was clipped when right panel had 3+ tabs; added `flex-wrap: wrap`, reduced tab padding, added `white-space: nowrap`
- **FormatSelector Readonly Computed Warning** — `confidence` was a read-only `computed()` but two places wrote to it directly; changed to write to `formatStore.confidence` instead

### Technical Details
- New files:
  - `src/stores/yara.js` — Pinia store for YARA state (rules, results, scan status, session serialization)
  - `src/stores/yara.test.js` — 24 tests covering state, getters, actions, session restore
  - `src/yara/builtinRules.js` — 4 built-in rule sets (pure pattern matching, no PE/ELF modules)
  - `src/yara/builtinRules.test.js` — 33 tests validating rule set structure and YARA syntax
  - `src/workers/YaraWorker.js` — Web Worker with lazy libyara-wasm init, C++ collection extraction
  - `src/workers/YaraWorker.test.js` — 9 tests with mocked WASM responses
  - `src/components/YaraPanel.vue` — Full YARA UI (Options API, scoped CSS)
- Modified files:
  - `package.json` — Added `libyara-wasm@^1.2.1` dependency
  - `vite.config.js` — Added `libyara-wasm` to `manualChunks` for separate chunk
  - `src/App.vue` — YARA tab, feature toggle, navigation, session/reset integration
  - `src/services/SessionManager.js` — YARA state in session data
  - `src/components/ExportOptions.vue` — YARA matches export option
  - `src/components/HexView.vue` — CSS fix for sidebar tab overflow
  - `src/components/KsyManager/FormatSelector.vue` — Fixed readonly computed writes
- All 379 tests pass (313 existing + 66 new); production build succeeds

---

## [0.4] - 2026-02-10 (Cleanup & HexView Decomposition)

### Fixed
- **Attack Graph Export Bug** — Service worker was registered in dev mode, intercepting dynamic imports of `UsecvislibExporter.js` and `KaitaiRuntime.js` and returning cached HTML instead of JS modules. Added `import.meta.env.PROD` guard to service worker registration in `src/main.js`.

### Changed
- **HexView.vue Decomposition** — Extracted ~660 lines from the 1,571-line component into 5 composables:
  - `src/composables/useByteInspector.js` — Hover state, inspector lock, keyboard handler
  - `src/composables/useByteSelection.js` — Mouse drag selection, selection state
  - `src/composables/useHexVirtualScroll.js` — Virtual scrolling, visible rows, scroll handling
  - `src/composables/useHexExport.js` — Context menu, export dialogs, toast notifications
  - `src/composables/useKaitaiIntegration.js` — Kaitai struct parsing, format detection, structure navigation
  - Template and styles unchanged; formatting methods and navigation stay in Options API
- **Production Console Logging** — Added `console.log` and `console.info` to terser `pure_funcs` in `vite.config.js` so they are stripped in production builds; `console.warn` and `console.error` preserved for runtime diagnostics

### Removed
- **Dead Code** — Deleted unused legacy Vuex store (`src/store/index.js`, `src/store/modules/settings.js`) and unused `FileChunkManagerV2` (`src/utils/FileChunkManagerV2.js`)

### Technical Details
- New files:
  - `src/composables/useByteInspector.js`
  - `src/composables/useByteSelection.js`
  - `src/composables/useHexVirtualScroll.js`
  - `src/composables/useHexExport.js`
  - `src/composables/useKaitaiIntegration.js`
- Modified files:
  - `src/main.js` — Service worker PROD guard
  - `src/components/HexView.vue` — Rewired setup() to use composables
  - `vite.config.js` — Extended pure_funcs list
- Deleted files:
  - `src/store/index.js`, `src/store/modules/settings.js`, `src/utils/FileChunkManagerV2.js`
- All 221 existing tests pass; production build succeeds cleanly

---

## [0.4] - 2026-02-10 (Vitest Testing Infrastructure)

### Added
- **Vitest Testing Infrastructure**
  - Installed `vitest`, `happy-dom`, and `@vitest/coverage-v8` as dev dependencies
  - Created `vitest.config.js` merging with existing `vite.config.js` to inherit `@` alias, iconv-lite/zlib polyfills, and Vue plugin
  - Created `src/__tests__/setup.js` with `localStorage` safety guard for happy-dom environment
  - Added `test`, `test:watch`, `test:coverage` npm scripts
  - Added `coverage/` to `.gitignore`

- **221 Test Cases Across 12 Co-located Test Files**
  - Priority 1 — Pure functions (no mocking):
    - `src/services/ByteFormatter.test.js` (57 tests) — All format functions (JS, Python, C, Java, Go, Rust, ASM, data formats), `format()` dispatch, `getAvailableFormats()`, multi-line splitting, custom variable names
    - `src/utils/fileSignatures.test.js` (20 tests) — `detectFileTypes()` with PNG/PDF/ZIP/PE/ELF/Mach-O magic bytes, CAFEBABE disambiguation, `isMachOFatBinary()`, `isFileType()`
    - `src/utils/entropyOptimized.test.js` (14 tests) — Shannon entropy: all-zeros=0.0, uniform=8.0, two-value=1.0; result structure; custom blockSize; `generateEntropyVisualization()`
    - `src/utils/stringAnalyzer.test.js` (14 tests) — `escapeString()` HTML/control chars; `extractStrings()` ASCII extraction, minLength/maxLength, offset recording
    - `src/utils/fileHandler.test.js` (10 tests) — `formatFileSize()`, `validateFileSize()`, `FILE_LIMITS` constants
  - Priority 2 — Stores & services (Pinia setup / light mocking):
    - `src/stores/session.test.js` (24 tests) — All actions, getters (sortedSessions, currentSession), dirty tracking, auto-save toggle
    - `src/stores/settings.test.js` (9 tests) — `setBaseOffset()` validation/clamping, `currentOffset` getter
    - `src/stores/format.test.js` (15 tests) — Format lifecycle, auto-detection, caching Set operations, loading state
    - `src/services/SessionManager.test.js` (23 tests) — Pure methods: `generateId()`, `sanitizeForStorage()`, `createSessionData()`, `extractMetadata()`, `verifyFile()`
    - `src/utils/logger.test.js` (8 tests) — Logger creation, method delegation, debug mode toggle via localStorage
  - Priority 3 — Binary parsing (inline fixtures):
    - `src/utils/advancedFileDetection.test.js` (14 tests) — `findPEHeaderOffset()`, `analyzePEStructure()` 32/64-bit, `analyzeElfStructure()`, `analyzeMachOStructure()`, `detectSpecificFileType()`, `detectNestedFiles()`
    - `src/utils/metadataExtractor.test.js` (13 tests) — `extractMetadata()` dispatch, PNG IHDR parsing, PE/ELF/Mach-O header extraction, JPEG format detection

### Technical Details
- All 3 Pinia stores achieve 100% statement coverage
- `fileSignatures.js` achieves 100% line coverage
- `entropyOptimized.js` achieves 98% line coverage
- Tests use inline `Uint8Array` fixtures (no external binary files)
- New files:
  - `vitest.config.js` - Vitest configuration merging with Vite config
  - `src/__tests__/setup.js` - Global test setup
  - 12 co-located `*.test.js` files next to their source modules

---

## [0.4] - 2026-02-09 (Bookmarks & Annotations)

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
- ~~**Bookmarks & Annotations** - Mark and annotate byte offsets/ranges~~ (Done in 0.4)
- ~~**YARA Support** - Browser-based YARA rule scanning via libyara-wasm~~ (Done in 0.4)
- **Disassembly Support** - Basic disassembly via Capstone.js for common architectures
