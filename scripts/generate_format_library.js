#!/usr/bin/env node

/**
 * Generate comprehensive KSY format library from all available KSY files
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORMATS_DIR = path.join(__dirname, '../src/kaitai/formats');
const OUTPUT_FILE = path.join(__dirname, '../src/kaitai/ksy/presets/generated_formats.js');

// Category mapping based on directory names
const CATEGORY_MAPPING = {
  '3d': '3D Graphics',
  'archive': 'Archives',
  'cad': 'CAD',
  'common': 'Common',
  'custom': 'Custom',
  'database': 'Database',
  'executable': 'Executable',
  'filesystem': 'File System',
  'firmware': 'Firmware',
  'font': 'Fonts',
  'game': 'Games',
  'geospatial': 'Geospatial',
  'hardware': 'Hardware',
  'image': 'Images',
  'log': 'Logs',
  'machine_code': 'Machine Code',
  'macos': 'macOS',
  'media': 'Media',
  'network': 'Network',
  'scientific': 'Scientific',
  'security': 'Security',
  'serialization': 'Serialization',
  'windows': 'Windows'
};

function findKsyFiles(dir) {
  const files = [];
  
  function scanDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (item.endsWith('.ksy')) {
        files.push(fullPath);
      }
    }
  }
  
  scanDir(dir);
  return files;
}

function parseKsyFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(content);
    
    if (!parsed || !parsed.meta || !parsed.meta.id) {
      console.warn(`Skipping ${filePath}: missing meta.id`);
      return null;
    }
    
    const relativePath = path.relative(FORMATS_DIR, filePath);
    const category = relativePath.split(path.sep)[0];
    
    // Extract file extensions
    let extensions = [];
    if (parsed.meta['file-extension']) {
      if (Array.isArray(parsed.meta['file-extension'])) {
        extensions = parsed.meta['file-extension'];
      } else {
        extensions = [parsed.meta['file-extension']];
      }
    }
    
    // Create format definition
    const format = {
      id: `ksy_${parsed.meta.id}`,
      name: parsed.meta.title || parsed.meta.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      content: content,
      category: CATEGORY_MAPPING[category] || 'Other',
      originalCategory: category,
      filePath: relativePath,
      metadata: {
        isGenerated: true,
        fileExtensions: extensions.filter(ext => ext && ext.length > 0),
        description: parsed.meta.title || '',
        license: parsed.meta.license,
        endian: parsed.meta.endian
      }
    };
    
    // Try to determine file signature from KSY content
    if (parsed.seq) {
      const magicFields = parsed.seq.filter(field => 
        field.id === 'magic' || 
        field.id === 'signature' || 
        field.contents
      );
      
      if (magicFields.length > 0) {
        const magic = magicFields[0];
        if (magic.contents) {
          let bytes = [];
          if (Array.isArray(magic.contents)) {
            bytes = magic.contents.map(b => typeof b === 'string' ? parseInt(b, 16) : b);
          } else if (typeof magic.contents === 'string') {
            // Convert string to bytes
            bytes = Array.from(magic.contents).map(c => c.charCodeAt(0));
          }
          
          if (bytes.length > 0) {
            format.metadata.signature = {
              offset: 0,
              bytes: bytes
            };
          }
        }
      }
    }
    
    return format;
  } catch (error) {
    console.warn(`Error parsing ${filePath}:`, error.message);
    return null;
  }
}

function generateFormatLibrary() {
  console.log('Scanning for KSY files...');
  const ksyFiles = findKsyFiles(FORMATS_DIR);
  console.log(`Found ${ksyFiles.length} KSY files`);
  
  const formats = [];
  const categoryStats = {};
  
  for (const file of ksyFiles) {
    const format = parseKsyFile(file);
    if (format) {
      formats.push(format);
      
      const cat = format.category;
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    }
  }
  
  console.log('Category statistics:');
  Object.entries(categoryStats)
    .sort(([,a], [,b]) => b - a)
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count} formats`);
    });
  
  // Generate JavaScript file
  const jsContent = `/**
 * Auto-generated KSY format library
 * Generated from ${formats.length} KSY files
 * Categories: ${Object.keys(categoryStats).length}
 * 
 * DO NOT EDIT - This file is auto-generated
 * Run 'node scripts/generate_format_library.js' to regenerate
 */

export const generatedFormats = [
${formats.map(format => `  {
    id: ${JSON.stringify(format.id)},
    name: ${JSON.stringify(format.name)},
    category: ${JSON.stringify(format.category)},
    metadata: {
      isGenerated: true,
      fileExtensions: ${JSON.stringify(format.metadata.fileExtensions)},
      description: ${JSON.stringify(format.metadata.description)},
      originalCategory: ${JSON.stringify(format.originalCategory)},
      filePath: ${JSON.stringify(format.filePath)}${format.metadata.signature ? `,
      signature: ${JSON.stringify(format.metadata.signature)}` : ''}${format.metadata.endian ? `,
      endian: ${JSON.stringify(format.metadata.endian)}` : ''}
    },
    content: \`${format.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`
  }`).join(',\n')}
];

/**
 * Get all generated formats
 */
export function getGeneratedFormats() {
  return generatedFormats;
}

/**
 * Get formats by category
 */
export function getFormatsByCategory(category) {
  return generatedFormats.filter(f => f.category === category);
}

/**
 * Get format by ID
 */
export function getGeneratedFormat(id) {
  return generatedFormats.find(f => f.id === id) || null;
}

/**
 * Get all categories
 */
export function getCategories() {
  return [...new Set(generatedFormats.map(f => f.category))].sort();
}

/**
 * Format statistics
 */
export const formatStats = {
  totalFormats: ${formats.length},
  categories: ${JSON.stringify(categoryStats, null, 2)}
};

export default {
  generatedFormats,
  getGeneratedFormats,
  getFormatsByCategory,
  getGeneratedFormat,
  getCategories,
  formatStats
};
`;

  // Write the file
  fs.writeFileSync(OUTPUT_FILE, jsContent);
  console.log(`Generated ${OUTPUT_FILE} with ${formats.length} formats`);
  
  return {
    totalFormats: formats.length,
    categories: Object.keys(categoryStats).length,
    categoryStats
  };
}

// Run the generator
try {
  const result = generateFormatLibrary();
  console.log('Format library generation completed successfully!');
  console.log(`Total formats: ${result.totalFormats}`);
  console.log(`Total categories: ${result.categories}`);
} catch (error) {
  console.error('Error generating format library:', error);
  process.exit(1);
}