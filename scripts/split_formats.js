#!/usr/bin/env node

/**
 * Script to split generated_formats.js into category-based chunks
 * This reduces bundle size by allowing lazy loading per category
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORMATS_FILE = path.join(__dirname, '../src/kaitai/ksy/presets/generated_formats.js');
const OUTPUT_DIR = path.join(__dirname, '../src/kaitai/ksy/categories');

// Read and parse the formats file
async function readFormats() {
  const content = await fs.readFile(FORMATS_FILE, 'utf-8');

  // Extract the formats array
  const match = content.match(/export const generatedFormats = (\[[\s\S]*\]);/);
  if (!match) {
    throw new Error('Could not find generatedFormats export');
  }

  // Parse the formats using Function constructor (safer than eval)
  const formatsArrayStr = match[1];
  const formats = new Function('return ' + formatsArrayStr)();

  return formats;
}

// Group formats by category
function groupByCategory(formats) {
  const categories = {};

  for (const format of formats) {
    const category = format.category || 'uncategorized';
    const categoryKey = category.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (!categories[categoryKey]) {
      categories[categoryKey] = {
        name: category,
        formats: []
      };
    }

    categories[categoryKey].formats.push(format);
  }

  return categories;
}

// Write category files
async function writeCategoryFiles(categories) {
  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Create index file that exports category metadata
  let indexContent = `/**
 * Auto-generated category index
 * Created: ${new Date().toISOString()}
 */

export const categoryMetadata = {
`;

  const categoryPromises = [];

  for (const [key, data] of Object.entries(categories)) {
    console.log(`Creating ${key}.js with ${data.formats.length} formats...`);

    // Create category file
    // Ensure key starts with letter for valid JS variable name
    const safeKey = key.match(/^\d/) ? `cat_${key}` : key;
    const fileContent = `/**
 * Kaitai Formats - ${data.name}
 * ${data.formats.length} formats
 * Auto-generated: ${new Date().toISOString()}
 */

export const ${safeKey}Formats = ${JSON.stringify(data.formats, null, 2)};

export default {
  category: "${data.name}",
  formats: ${safeKey}Formats
};
`;

    categoryPromises.push(
      fs.writeFile(path.join(OUTPUT_DIR, `${key}.js`), fileContent)
    );

    // Add to index
    indexContent += `  "${key}": {
    name: "${data.name}",
    count: ${data.formats.length},
    loader: () => import('./${key}.js')
  },
`;
  }

  indexContent += `};

// Get all category names
export const categoryNames = Object.keys(categoryMetadata);

// Load a specific category
export async function loadCategory(categoryKey) {
  const meta = categoryMetadata[categoryKey];
  if (!meta) {
    throw new Error(\`Unknown category: \${categoryKey}\`);
  }

  const module = await meta.loader();
  return module.default;
}

// Get format count
export function getTotalFormatCount() {
  return Object.values(categoryMetadata)
    .reduce((sum, cat) => sum + cat.count, 0);
}
`;

  categoryPromises.push(
    fs.writeFile(path.join(OUTPUT_DIR, 'index.js'), indexContent)
  );

  await Promise.all(categoryPromises);
}

// Main function
async function main() {
  try {
    console.log('Reading generated_formats.js...');
    const formats = await readFormats();
    console.log(`Found ${formats.length} formats`);

    console.log('Grouping by category...');
    const categories = groupByCategory(formats);
    console.log(`Found ${Object.keys(categories).length} categories`);

    console.log('Writing category files...');
    await writeCategoryFiles(categories);

    // Calculate size reduction
    const originalSize = (await fs.stat(FORMATS_FILE)).size;
    let totalNewSize = 0;

    for (const [key] of Object.entries(categories)) {
      const filePath = path.join(OUTPUT_DIR, `${key}.js`);
      const stats = await fs.stat(filePath);
      totalNewSize += stats.size;
    }

    console.log('\n=== Results ===');
    console.log(`Original file: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`Split files total: ${(totalNewSize / 1024).toFixed(2)} KB`);
    console.log(`Categories created: ${Object.keys(categories).length}`);

    // List categories with counts
    console.log('\nCategories:');
    for (const [key, data] of Object.entries(categories)) {
      console.log(`  ${key}: ${data.formats.length} formats`);
    }

    console.log('\n✅ Successfully split formats into category chunks!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();