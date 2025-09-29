/**
 * Format Index - Lightweight metadata for all formats
 * Used for searching and filtering without loading full definitions
 */

export const formatIndex = [
  // Archives
  { id: 'zip', name: 'ZIP Archive', extension: 'zip', category: 'archives' },
  { id: 'rar', name: 'RAR Archive', extension: 'rar', category: 'archives' },
  { id: 'tar', name: 'TAR Archive', extension: 'tar', category: 'archives' },
  { id: 'gzip', name: 'GZIP Compressed', extension: 'gz', category: 'archives' },
  { id: 'bzip2', name: 'BZIP2 Compressed', extension: 'bz2', category: 'archives' },
  { id: 'lzh', name: 'LZH Archive', extension: 'lzh', category: 'archives' },
  { id: 'cab', name: 'Microsoft Cabinet', extension: 'cab', category: 'archives' },

  // Images
  { id: 'png', name: 'PNG Image', extension: 'png', category: 'images', mimeType: 'image/png' },
  { id: 'jpeg', name: 'JPEG Image', extension: 'jpg', category: 'images', mimeType: 'image/jpeg' },
  { id: 'gif', name: 'GIF Image', extension: 'gif', category: 'images', mimeType: 'image/gif' },
  { id: 'bmp', name: 'BMP Image', extension: 'bmp', category: 'images', mimeType: 'image/bmp' },
  { id: 'ico', name: 'Icon File', extension: 'ico', category: 'images', mimeType: 'image/x-icon' },
  { id: 'tiff', name: 'TIFF Image', extension: 'tiff', category: 'images', mimeType: 'image/tiff' },
  { id: 'webp', name: 'WebP Image', extension: 'webp', category: 'images', mimeType: 'image/webp' },
  { id: 'psd', name: 'Photoshop Document', extension: 'psd', category: 'images' },
  { id: 'tga', name: 'TGA Image', extension: 'tga', category: 'images' },
  { id: 'pcx', name: 'PCX Image', extension: 'pcx', category: 'images' },

  // Executables
  { id: 'elf', name: 'ELF Executable', extension: 'elf', category: 'executable', description: 'Linux/Unix executable' },
  { id: 'pe', name: 'PE Executable', extension: 'exe', category: 'executable', description: 'Windows executable' },
  { id: 'mach_o', name: 'Mach-O', extension: 'o', category: 'executable', description: 'macOS executable' },
  { id: 'dex', name: 'Dalvik Executable', extension: 'dex', category: 'executable', description: 'Android executable' },
  { id: 'java_class', name: 'Java Class', extension: 'class', category: 'executable' },
  { id: 'pyc', name: 'Python Compiled', extension: 'pyc', category: 'executable' },
  { id: 'swf', name: 'Flash SWF', extension: 'swf', category: 'executable' },

  // Media
  { id: 'mp3', name: 'MP3 Audio', extension: 'mp3', category: 'media', mimeType: 'audio/mpeg' },
  { id: 'mp4', name: 'MP4 Video', extension: 'mp4', category: 'media', mimeType: 'video/mp4' },
  { id: 'avi', name: 'AVI Video', extension: 'avi', category: 'media', mimeType: 'video/x-msvideo' },
  { id: 'wav', name: 'WAV Audio', extension: 'wav', category: 'media', mimeType: 'audio/wav' },
  { id: 'ogg', name: 'OGG Media', extension: 'ogg', category: 'media', mimeType: 'audio/ogg' },
  { id: 'flac', name: 'FLAC Audio', extension: 'flac', category: 'media', mimeType: 'audio/flac' },
  { id: 'mkv', name: 'Matroska Video', extension: 'mkv', category: 'media', mimeType: 'video/x-matroska' },
  { id: 'mov', name: 'QuickTime Movie', extension: 'mov', category: 'media', mimeType: 'video/quicktime' },
  { id: 'flv', name: 'Flash Video', extension: 'flv', category: 'media' },

  // Network
  { id: 'pcap', name: 'PCAP Capture', extension: 'pcap', category: 'network', description: 'Network packet capture' },
  { id: 'pcapng', name: 'PCAPNG Capture', extension: 'pcapng', category: 'network', description: 'Next-gen packet capture' },
  { id: 'tcp_segment', name: 'TCP Segment', extension: 'tcp', category: 'network' },
  { id: 'udp_datagram', name: 'UDP Datagram', extension: 'udp', category: 'network' },
  { id: 'dns_packet', name: 'DNS Packet', extension: 'dns', category: 'network' },
  { id: 'http', name: 'HTTP Data', extension: 'http', category: 'network' },
  { id: 'tls', name: 'TLS/SSL', extension: 'tls', category: 'network' },

  // File Systems
  { id: 'mbr', name: 'Master Boot Record', extension: 'mbr', category: 'file_system' },
  { id: 'gpt', name: 'GPT Partition Table', extension: 'gpt', category: 'file_system' },
  { id: 'fat16', name: 'FAT16 Filesystem', extension: 'fat16', category: 'file_system' },
  { id: 'fat32', name: 'FAT32 Filesystem', extension: 'fat32', category: 'file_system' },
  { id: 'ntfs', name: 'NTFS Filesystem', extension: 'ntfs', category: 'file_system' },
  { id: 'ext2', name: 'EXT2 Filesystem', extension: 'ext2', category: 'file_system' },
  { id: 'ext4', name: 'EXT4 Filesystem', extension: 'ext4', category: 'file_system' },
  { id: 'hfs', name: 'HFS Filesystem', extension: 'hfs', category: 'file_system' },
  { id: 'apfs', name: 'APFS Filesystem', extension: 'apfs', category: 'file_system' },

  // Databases
  { id: 'sqlite3', name: 'SQLite Database', extension: 'db', category: 'database' },
  { id: 'leveldb', name: 'LevelDB Database', extension: 'ldb', category: 'database' },
  { id: 'bson', name: 'BSON Document', extension: 'bson', category: 'database' },
  { id: 'dbf', name: 'dBASE File', extension: 'dbf', category: 'database' },

  // Documents
  { id: 'pdf', name: 'PDF Document', extension: 'pdf', category: 'documents', mimeType: 'application/pdf' },
  { id: 'doc', name: 'Word Document', extension: 'doc', category: 'documents' },
  { id: 'xls', name: 'Excel Spreadsheet', extension: 'xls', category: 'documents' },
  { id: 'ppt', name: 'PowerPoint', extension: 'ppt', category: 'documents' },
  { id: 'rtf', name: 'Rich Text Format', extension: 'rtf', category: 'documents' },
  { id: 'odt', name: 'OpenDocument Text', extension: 'odt', category: 'documents' },

  // Serialization
  { id: 'json', name: 'JSON Data', extension: 'json', category: 'serialization', mimeType: 'application/json' },
  { id: 'xml', name: 'XML Document', extension: 'xml', category: 'serialization', mimeType: 'application/xml' },
  { id: 'yaml', name: 'YAML Document', extension: 'yaml', category: 'serialization' },
  { id: 'msgpack', name: 'MessagePack', extension: 'msgpack', category: 'serialization' },
  { id: 'protobuf', name: 'Protocol Buffers', extension: 'pb', category: 'serialization' },
  { id: 'asn1', name: 'ASN.1 Structure', extension: 'asn1', category: 'serialization' },

  // Games
  { id: 'doom_wad', name: 'DOOM WAD', extension: 'wad', category: 'games' },
  { id: 'quake_pak', name: 'Quake PAK', extension: 'pak', category: 'games' },
  { id: 'minecraft_nbt', name: 'Minecraft NBT', extension: 'nbt', category: 'games' },
  { id: 'valve_vpk', name: 'Valve VPK', extension: 'vpk', category: 'games' },
  { id: 'unity3d', name: 'Unity3D Asset', extension: 'unity3d', category: 'games' },

  // Firmware
  { id: 'uboot', name: 'U-Boot Image', extension: 'uboot', category: 'firmware' },
  { id: 'android_boot', name: 'Android Boot Image', extension: 'img', category: 'firmware' },
  { id: 'uefi', name: 'UEFI Firmware', extension: 'efi', category: 'firmware' },
  { id: 'cpio', name: 'CPIO Archive', extension: 'cpio', category: 'firmware' },

  // Security
  { id: 'der', name: 'DER Certificate', extension: 'der', category: 'security' },
  { id: 'pem', name: 'PEM Certificate', extension: 'pem', category: 'security' },
  { id: 'pgp', name: 'PGP Message', extension: 'pgp', category: 'security' },
  { id: 'ssh_key', name: 'SSH Key', extension: 'key', category: 'security' },

  // Fonts
  { id: 'ttf', name: 'TrueType Font', extension: 'ttf', category: 'fonts' },
  { id: 'otf', name: 'OpenType Font', extension: 'otf', category: 'fonts' },
  { id: 'woff', name: 'Web Open Font', extension: 'woff', category: 'fonts' },
  { id: 'woff2', name: 'WOFF2 Font', extension: 'woff2', category: 'fonts' },

  // Scientific
  { id: 'hdf5', name: 'HDF5 Data', extension: 'h5', category: 'scientific' },
  { id: 'netcdf', name: 'NetCDF Data', extension: 'nc', category: 'scientific' },
  { id: 'fits', name: 'FITS Data', extension: 'fits', category: 'scientific' },
  { id: 'dicom', name: 'DICOM Medical', extension: 'dcm', category: 'scientific' },

  // Hardware
  { id: 'edid', name: 'EDID Display Data', extension: 'edid', category: 'hardware' },
  { id: 'pci_ids', name: 'PCI IDs Database', extension: 'ids', category: 'hardware' },
  { id: 'usb_ids', name: 'USB IDs Database', extension: 'ids', category: 'hardware' },

  // Common/Misc formats would be added here...
]

// Export category counts for quick access
export const categoryCounts = formatIndex.reduce((acc, format) => {
  acc[format.category] = (acc[format.category] || 0) + 1
  return acc
}, {})

// Helper to search formats
export function searchFormats(query, category = null) {
  let results = formatIndex

  if (category) {
    results = results.filter(f => f.category === category)
  }

  if (query) {
    const q = query.toLowerCase()
    results = results.filter(f =>
      f.name?.toLowerCase().includes(q) ||
      f.id?.toLowerCase().includes(q) ||
      f.extension?.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q)
    )
  }

  return results
}

// Get format by ID
export function getFormatById(id) {
  return formatIndex.find(f => f.id === id)
}

// Get formats by category
export function getFormatsByCategory(category) {
  return formatIndex.filter(f => f.category === category)
}