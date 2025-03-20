import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

// Ensure we're using correct path
const publicDir = resolve('./public');

// Create the favicon SVG content
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <!-- Background -->
    <rect width="64" height="64" fill="#42b983" rx="12"/>
    
    <!-- Binary squares pattern -->
    <g fill="#ffffff">
        <!-- Row 1 -->
        <rect x="12" y="12" width="8" height="8" opacity="0.9"/>
        <rect x="24" y="12" width="8" height="8" opacity="0.3"/>
        <rect x="36" y="12" width="8" height="8" opacity="0.9"/>
        <rect x="48" y="12" width="8" height="8" opacity="0.3"/>
        
        <!-- Row 2 -->
        <rect x="12" y="24" width="8" height="8" opacity="0.3"/>
        <rect x="24" y="24" width="8" height="8" opacity="0.9"/>
        <rect x="36" y="24" width="8" height="8" opacity="0.3"/>
        <rect x="48" y="24" width="8" height="8" opacity="0.9"/>
        
        <!-- Row 3 -->
        <rect x="12" y="36" width="8" height="8" opacity="0.9"/>
        <rect x="24" y="36" width="8" height="8" opacity="0.3"/>
        <rect x="36" y="36" width="8" height="8" opacity="0.9"/>
        <rect x="48" y="36" width="8" height="8" opacity="0.3"/>
        
        <!-- Row 4 -->
        <rect x="12" y="48" width="8" height="8" opacity="0.3"/>
        <rect x="24" y="48" width="8" height="8" opacity="0.9"/>
        <rect x="36" y="48" width="8" height="8" opacity="0.3"/>
        <rect x="48" y="48" width="8" height="8" opacity="0.9"/>
    </g>
</svg>`;

// Ensure public directory exists
try {
    mkdirSync(publicDir, { recursive: true });
    console.log('Created public directory:', publicDir);
} catch (error) {
    console.log('Public directory already exists');
}

// Write favicon.svg
try {
    const faviconPath = join(publicDir, 'favicon.svg');
    writeFileSync(faviconPath, faviconSvg);
    console.log('Successfully created favicon at:', faviconPath);
} catch (error) {
    console.error('Error creating favicon:', error);
    process.exit(1);
}