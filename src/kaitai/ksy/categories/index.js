/**
 * Auto-generated category index
 * Created: 2025-09-21T19:51:05.637Z
 */

export const categoryMetadata = {
  "3d_graphics": {
    name: "3D Graphics",
    count: 1,
    loader: () => import('./3d_graphics.js')
  },
  "archives": {
    name: "Archives",
    count: 17,
    loader: () => import('./archives.js')
  },
  "cad": {
    name: "CAD",
    count: 1,
    loader: () => import('./cad.js')
  },
  "common": {
    name: "Common",
    count: 7,
    loader: () => import('./common.js')
  },
  "database": {
    name: "Database",
    count: 4,
    loader: () => import('./database.js')
  },
  "executable": {
    name: "Executable",
    count: 11,
    loader: () => import('./executable.js')
  },
  "file_system": {
    name: "File System",
    count: 17,
    loader: () => import('./file_system.js')
  },
  "firmware": {
    name: "Firmware",
    count: 4,
    loader: () => import('./firmware.js')
  },
  "fonts": {
    name: "Fonts",
    count: 3,
    loader: () => import('./fonts.js')
  },
  "games": {
    name: "Games",
    count: 17,
    loader: () => import('./games.js')
  },
  "geospatial": {
    name: "Geospatial",
    count: 2,
    loader: () => import('./geospatial.js')
  },
  "hardware": {
    name: "Hardware",
    count: 3,
    loader: () => import('./hardware.js')
  },
  "images": {
    name: "Images",
    count: 17,
    loader: () => import('./images.js')
  },
  "logs": {
    name: "Logs",
    count: 7,
    loader: () => import('./logs.js')
  },
  "machine_code": {
    name: "Machine Code",
    count: 1,
    loader: () => import('./machine_code.js')
  },
  "macos": {
    name: "macOS",
    count: 8,
    loader: () => import('./macos.js')
  },
  "media": {
    name: "Media",
    count: 18,
    loader: () => import('./media.js')
  },
  "network": {
    name: "Network",
    count: 25,
    loader: () => import('./network.js')
  },
  "scientific": {
    name: "Scientific",
    count: 4,
    loader: () => import('./scientific.js')
  },
  "security": {
    name: "Security",
    count: 3,
    loader: () => import('./security.js')
  },
  "serialization": {
    name: "Serialization",
    count: 9,
    loader: () => import('./serialization.js')
  },
  "windows": {
    name: "Windows",
    count: 6,
    loader: () => import('./windows.js')
  },
};

// Get all category names
export const categoryNames = Object.keys(categoryMetadata);

// Load a specific category
export async function loadCategory(categoryKey) {
  const meta = categoryMetadata[categoryKey];
  if (!meta) {
    throw new Error(`Unknown category: ${categoryKey}`);
  }

  const module = await meta.loader();
  return module.default;
}

// Get format count
export function getTotalFormatCount() {
  return Object.values(categoryMetadata)
    .reduce((sum, cat) => sum + cat.count, 0);
}
