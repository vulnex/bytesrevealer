# Bytes Revealer

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/vulnex/bytesrevealer/actions/workflows/ci.yml/badge.svg)](https://github.com/vulnex/bytesrevealer/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/vulnex/bytesrevealer)](https://github.com/vulnex/bytesrevealer/releases/latest)

![BytesRevealer Screenshot](BytesRevealer.png)

**Live demo:** https://bytesrevealer.online/

**Version:** 0.5

Bytes Revealer is a powerful reverse engineering and binary analysis tool designed for security researchers, forensic analysts, and developers. With features like hex view, visual representation, string extraction, entropy calculation, and file signature detection, it helps users uncover hidden data inside files. Whether you are analyzing malware, debugging binaries, or investigating unknown file formats, Bytes Revealer makes it easy to explore, search, and extract valuable information from any binary file.

Bytes Revealer does NOT store any file or data. All analysis is performed in your browser.

**Current Limitation:** Files less than 50MB can perform all analysis, files bigger up to 1.5GB will only do Visual View and Hex View analysis.

## Features

### File Analysis

- Chunked file processing for memory efficiency
- Real-time progress tracking
- File signature detection with advanced PE/ELF analysis
- Hash calculations (MD5, SHA-1, SHA-256)
- Entropy and Bytes Frequency analysis
- Progressive loading for files up to 1.5GB

### Paste Data Input

- Analyze byte fragments without writing them to disk
- Auto-detects hex, C/Python escape sequences (`\x41`, `\101`, `0x41`), base64, xxd/hexdump output, and plain text
- Pasted bytes flow through the same analysis pipeline as uploaded files

### Embedded Executable Detection

- Full-file scan for PE, ELF, and Mach-O binaries hidden at arbitrary offsets
- Structural validation per format to suppress false positives
- Runs in a Web Worker; cancellable; gated by a settings toggle
- Per-finding "Extract" button carves the embedded binary out as a standalone download
- Filename suggestion derived from PE Characteristics (`.exe`/`.dll`/`.sys`) and detected architecture

### Multiple Views

#### File View

- Comprehensive file information and metadata
- Advanced file signatures detection
- Hash values with multiple algorithms
- Entropy calculation and visualization
- Statistical analysis with byte frequency
- Detailed file signature information
- Nested file detection (archives, embedded files)

#### Visual View

- Binary data visualization with colored squares
- Toggle between blue and hex-categorized color schemes
- ASCII or Bytes searching
- Data distribution view
- Highlighted pattern matching
- Jump-to-offset functionality
- Data Inspector View
- Color palette for byte annotation

#### Hex View

- Professional hex editor interface
- Byte-level inspection with color coding
- Context menu for copying bytes in multiple formats
- Highlighted pattern matching
- ASCII representation
- ASCII or Bytes searching
- Jump-to-offset functionality
- Data Inspector View
- Toggle byte coloring (🎨 button)
- Uppercase/lowercase toggle (AA/aa button)

#### String Analysis

- ASCII, UTF-8, and UTF-16 string extraction
- String length and type analysis
- String type categorization
- Advanced filtering and sorting
- Regular expression search support
- String pattern recognition
- Export capabilities with full string data

### YARA Rule Scanning

- Browser-based YARA pattern matching via libyara-wasm
- Built-in rule sets: Common Malware, Crypto Indicators, Packers & Protectors, Suspicious Strings
- Custom rule editor with `.yar` file import
- Match navigation to hex offsets
- Highlight matches overlay in Hex View
- Feature toggle and session persistence

### Bookmarks & Annotations

- Add bookmarks at specific byte offsets
- Annotate byte ranges with labels and notes
- 8-color palette for visual categorization
- Filter, sort, and navigate bookmarks/annotations
- Visual indicators in Hex View and Visual View
- Full session persistence

### Session Management

- Save and restore analysis sessions with IndexedDB
- Export sessions to `.brsession` files for sharing/backup
- Import sessions from `.brsession` files
- Session metadata tracking (name, file info, timestamps)
- Unsaved changes indicator with dirty state tracking
- Auto-detection of file changes when restoring

### Kaitai Struct Integration

- Support for 100+ binary file formats
- Automatic format detection
- Structured binary parsing
- Format search and loading
- Category-based format organization

### Binary Analysis

- Deep PE (Windows) analysis: sections, imports, exports, security features (ASLR, DEP, CFG)
- Deep ELF (Linux) analysis: segments, dependencies, security features (PIE, RELRO, stack)
- Mach-O (macOS) analysis: load commands, universal binary support
- USecVisLib attack graph export for PE/ELF/Mach-O executables

### Export Options

- Enhanced JSON export with timestamps
- Comprehensive data export including:
  - File metadata and hashes
  - File signatures with full details
  - String analysis summary (always included)
  - Optional full string data
  - Entropy and byte frequency data
- Timestamped filenames for multiple exports

### Settings

- Dark mode (default) and Light mode
- Base offset configuration
- Performance optimizations

### Search Capabilities

- Hex pattern search
- ASCII/UTF-8 string search
- Regular expression support
- Case-sensitive/insensitive options
- Highlighted search results
- Search progress tracking
- Cancelable search operations

### Data Inspector

- Comprehensive byte information on Visual and Hex views
- Press L to lock/unlock inspector on a byte
- Multiple data representations:
  - Basic (hex, decimal, binary, octal)
  - Number formats (signed/unsigned)
  - Text encodings (ASCII, UTF-8, UTF-16)
  - 16-bit, 32-bit, 64-bit values
  - Integer and Float interpretations
  - Date/Time formats
  - Additional encoding formats

### User Interface Enhancements

- Help dialog with tabs (Changelog, User Manual, License, About)
- Improved file input with clear button
- Performance indicators for large files
- Chunk loading indicators
- Format loading indicators
- Toast notifications for operations
- Context menus in Hex View
- Export dialog for byte ranges
- Keyboard shortcuts support

## Technical Details

### Built With

- Vue.js 3.5 (Composition API + Composables)
- Pinia 3 (State Management)
- Vite 7 (Build Tool)
- Web Workers for performance
- IndexedDB for session persistence
- libyara-wasm for YARA scanning
- Kaitai Struct for binary format parsing

### Code Quality

- ESLint 9 with vue/recommended and vitest plugins
- Prettier with pre-commit hooks (husky + lint-staged)
- GitHub Actions CI (lint, format, test, build)
- 1688 tests across 37 test files (Vitest + happy-dom)
- Comprehensive accessibility (ARIA roles, focus trapping, keyboard nav)
- Responsive design for tablet and mobile

### Performance Features

- Chunked file processing (256KB chunks)
- Web Worker implementation (search, strings, YARA)
- Memory optimization with LRU eviction
- Cancelable operations
- Progress tracking
- Gzip/Brotli pre-compression
- Code splitting (lazy-loaded WASM, format categories)

## Getting Started

### Prerequisites

```bash
# Node.js 22+ is required
node -v
```

### Docker Usage

For detailed Docker deployment instructions, see [DOCKER_USAGE.md](DOCKER_USAGE.md).

**Quick start with the default Node.js setup:**

```bash
docker compose build
docker compose up -d
```

Now open your browser: http://localhost:8080/

To stop the docker container:

```bash
docker compose down
```

**Alternative nginx variant:**

The project also includes nginx-based Docker configurations (`docker-compose.nginx.yml` and `docker-compose.nginx-simple.yml`). See `build-nginx.sh` for building the nginx variant.

### Installation

```bash
# Clone the repository
git clone https://github.com/vulnex/bytesrevealer

# Navigate to project directory
cd bytesrevealer

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
# Build the application
npm run build

# Preview production build
npm run preview
```

## Development

Available scripts:

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:analyze` - Build with bundle analyzer
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run lint:fix` - Lint and fix code
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Usage

1. **File Upload**
   - Click "Choose File" or drag and drop a file
   - Progress bar shows upload and analysis status

2. **Analysis Views**
   - Switch between views using the tab interface
   - Each view provides different analysis perspectives
   - Real-time updates as you navigate

3. **Search Functions**
   - Use the search bar for pattern matching
   - Toggle between hex and string search modes
   - Results are highlighted in the current view

4. **String Analysis**
   - View extracted strings with type and length
   - Filter strings by type or content
   - Sort by various criteria
   - Export results in multiple formats

## Performance Considerations

- Large files are processed in chunks
- Web Workers handle intensive operations
- Memory usage is optimized
- Operations can be canceled if needed

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.

## Security Considerations

Bytes Revealer performs all file analysis locally in your browser. Files are not uploaded to any server or stored externally.

The only outbound network calls are for the optional USecVisLib attack-graph export feature (configured in `src/services/UsecvislibExporter.js`), which sends data to a user-configured API URL (default: `http://localhost:8003`). This feature is disabled by default and must be explicitly enabled and configured by the user.

To report security vulnerabilities, please see [SECURITY.md](SECURITY.md).

## Author

**Simon Roses Femerling** - VULNEX

- Website: https://vulnex.com
- Blog: https://www.simonroses.com

## Changelog

### Version 0.5 (July 2026)

- Full-file scanner detects PE/ELF/Mach-O binaries hidden at any offset
- Extract embedded executables as standalone downloads
- Paste Data input for analyzing byte fragments without disk writes
- File-load pipeline overhaul: ~150× faster analysis for typical executables
- Test suite grown to 2088 tests
- Dependency security updates

### Version 0.4 (March 2026)

- ESLint 9, Prettier, pre-commit hook (husky + lint-staged), GitHub Actions CI
- Comprehensive accessibility across 21 components (ARIA roles, focus trapping, keyboard nav)
- Responsive layout for tablet and mobile across 17 files
- Upgraded Vue 3.4→3.5, Pinia 2→3, Vite 5→7
- Gzip/brotli pre-compression and bundle analyzer
- Test suite expanded from 902 to 1688 tests (+87%)
- Fixed 153 lint warnings, 7 Prettier inconsistencies, README license correction

### Version 0.3 (September 2025)

- Added Kaitai Struct integration for 100+ binary formats
- Implemented progressive loading for files up to 1.5GB
- Enhanced Visual View with toggleable color schemes
- Added context menu in Hex View for copying bytes
- Improved JSON export with timestamps and comprehensive data
- Added string analysis summary to all JSON exports
- New help dialog with tabs (Changelog, User Manual, License, About)
- Added color scheme toggle buttons in Visual and Hex views
- Implemented chunk loading indicators
- Enhanced dark mode (now default)
- Improved UI with better error handling
- Added help button with separator in header
- Performance optimizations for large files
- Bug fixes and stability improvements

### Version 0.2 (April 2025)

- Introduced String Analysis view
- Added entropy calculation and visualization
- Implemented file signature detection
- Added hash calculations (MD5, SHA-1, SHA-256)
- Enhanced search capabilities with regex support
- Added data inspector for detailed byte analysis
- Improved memory optimization

### Version 0.1 (February 2025)

- Initial release
- Basic hex viewer functionality
- Visual byte representation
- File analysis with basic metadata
- Search functionality for hex and ASCII patterns

## Future Enhancements

- Disassembly support via Capstone.js (coming in the next release)
- Additional file format support
- More visualization options
- Pattern recognition improvements
- Advanced string analysis features
- Collaboration features
- More keyboard shortcuts
- Diff/compare functionality
