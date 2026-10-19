import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const publicDir = path.resolve(rootDir, "public");
const appDir = path.resolve(rootDir, "src", "app");

// 1. High-Precision Master SVG (512x512)
// Designed for maximum clarity and brand impact at both 16x16 tab size and 512x512 app icon size.
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Radial Gradient (Deep Forest to Midnight Jade) -->
    <radialGradient id="bgGrad" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#1B5E46" />
      <stop offset="60%" stop-color="#0F3D2E" />
      <stop offset="100%" stop-color="#072219" />
    </radialGradient>

    <!-- Golden Ring Accent (Pure Gawa Ghee Gold) -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE68A" />
      <stop offset="50%" stop-color="#D97706" />
      <stop offset="100%" stop-color="#92400E" />
    </linearGradient>

    <!-- Fresh Organic Leaf Gradient -->
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6EE7B7" />
      <stop offset="45%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>

    <!-- Jamuna River Wave & Fish Splash Gradient -->
    <linearGradient id="waveGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#BAE6FD" />
      <stop offset="50%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>

    <!-- Crimson Brand Accent (সাদিয়া/সাধ্যের বাজার লাল) -->
    <linearGradient id="crimsonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F87171" />
      <stop offset="60%" stop-color="#DC2626" />
      <stop offset="100%" stop-color="#991B1B" />
    </linearGradient>

    <!-- Soft Drop Shadow for Emblem -->
    <filter id="badgeShadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Base Circle with Premium Rounded Border -->
  <circle cx="256" cy="256" r="240" fill="url(#bgGrad)" filter="url(#badgeShadow)" />
  
  <!-- Subtle Outer Gold Inset Ring -->
  <circle cx="256" cy="256" r="236" fill="none" stroke="url(#goldGrad)" stroke-width="6" opacity="0.85" />
  <circle cx="256" cy="256" r="226" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.35" />

  <!-- Center Artwork Container -->
  <g transform="translate(0, -6)">
    <!-- 1. Jamuna River Fish & Water Crest (Sweeping dynamic curve from bottom left to center) -->
    <path d="M 120 340 C 150 375, 220 385, 290 355 C 360 325, 395 260, 395 200 C 375 225, 335 250, 280 260 C 215 272, 160 300, 120 340 Z" 
          fill="url(#waveGrad)" opacity="0.95" />

    <!-- Secondary Water Ripple (Pure River Foam White) -->
    <path d="M 145 348 C 190 375, 260 370, 315 330 C 345 308, 365 275, 375 245 C 350 268, 305 285, 255 292 C 195 300, 158 326, 145 348 Z" 
          fill="#FAF8F5" opacity="0.85" />

    <!-- 2. Organic Leaf Motif (Symbolizing Pure 100% Chemical-Free Organic Food) -->
    <!-- Large sweeping leaf forming the left and top crown -->
    <path d="M 256 100 C 325 105, 370 170, 365 245 C 320 255, 240 235, 195 180 C 170 145, 205 105, 256 100 Z" 
          fill="url(#leafGrad)" />
    
    <!-- Central Leaf Vein -->
    <path d="M 256 102 C 265 140, 275 185, 320 225" 
          fill="none" stroke="#A7F3D0" stroke-width="4.5" stroke-linecap="round" opacity="0.75" />
    
    <!-- Side leaf sprout (Smaller organic seedling leaf) -->
    <path d="M 195 180 C 160 160, 140 125, 160 95 C 185 110, 195 145, 195 180 Z" 
          fill="#34D399" opacity="0.9" />

    <!-- 3. Crimson Morning Sun / Pure Harvest Berry Droplet -->
    <circle cx="365" cy="140" r="30" fill="url(#crimsonGrad)" />
    <circle cx="355" cy="132" r="8" fill="#FFFFFF" opacity="0.65" />

    <!-- 4. Monogram "SB" (Sadyer Bazar) in Authentic Clean Typography at Lower Center -->
    <g transform="translate(256, 400)">
      <!-- Background Plinth for readability -->
      <rect x="-96" y="-38" width="192" height="42" rx="21" fill="#072219" opacity="0.85" stroke="url(#goldGrad)" stroke-width="2" />
      
      <!-- Text: "সাধ্যের বাজার" or bold "SB" -->
      <text x="0" y="-10" 
            text-anchor="middle" 
            font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" 
            font-size="24" 
            font-weight="900" 
            letter-spacing="3" 
            fill="#FAF8F5">
        <tspan fill="#6EE7B7">S</tspan><tspan fill="#FFFFFF">ADYER</tspan>
      </text>
    </g>
  </g>
</svg>`;

// Helper: build standard multi-resolution ICO buffer from PNG buffers
function buildIcoBuffer(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;

  let totalSize = dirSize;
  for (const item of pngBuffers) {
    totalSize += item.buffer.length;
  }

  const ico = Buffer.alloc(totalSize);

  // Header
  ico.writeUInt16LE(0, 0); // Reserved
  ico.writeUInt16LE(1, 2); // 1 = ICO
  ico.writeUInt16LE(count, 4); // Number of images

  let currentOffset = dirSize;
  for (let i = 0; i < count; i++) {
    const { width, height, buffer } = pngBuffers[i];
    const entryOffset = headerSize + i * dirEntrySize;

    ico.writeUInt8(width === 256 ? 0 : width, entryOffset); // Width (0 means 256)
    ico.writeUInt8(height === 256 ? 0 : height, entryOffset + 1); // Height
    ico.writeUInt8(0, entryOffset + 2); // Colors (0 = no color palette)
    ico.writeUInt8(0, entryOffset + 3); // Reserved
    ico.writeUInt16LE(1, entryOffset + 4); // Color planes
    ico.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    ico.writeUInt32LE(buffer.length, entryOffset + 8); // Image data size
    ico.writeUInt32LE(currentOffset, entryOffset + 12); // Offset of data

    buffer.copy(ico, currentOffset);
    currentOffset += buffer.length;
  }

  return ico;
}

async function generateFavicons() {
  console.log("🎨 Generating Sadyer Bazar Brand Favicons & Icons...");

  const svgBuffer = Buffer.from(svgContent, "utf-8");

  // Write SVG files
  fs.writeFileSync(path.resolve(publicDir, "favicon.svg"), svgContent);
  fs.writeFileSync(path.resolve(publicDir, "icon.svg"), svgContent);
  console.log("✓ Saved public/favicon.svg and public/icon.svg");

  // Render PNG sizes
  const sizes = [16, 32, 48, 64, 180, 192, 512];
  const pngMap = {};

  for (const size of sizes) {
    const pngBuf = await sharp(svgBuffer)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toBuffer();
    pngMap[size] = pngBuf;
  }

  // 1. Standard PNG Icons in public/
  fs.writeFileSync(path.resolve(publicDir, "icon-192.png"), pngMap[192]);
  fs.writeFileSync(path.resolve(publicDir, "icon-512.png"), pngMap[512]);
  fs.writeFileSync(path.resolve(publicDir, "apple-touch-icon.png"), pngMap[180]);
  fs.writeFileSync(path.resolve(publicDir, "icon.png"), pngMap[192]);
  console.log("✓ Saved public/icon-192.png, icon-512.png, apple-touch-icon.png, icon.png");

  // 2. Next.js App Router root icons in src/app/
  fs.writeFileSync(path.resolve(appDir, "icon.png"), pngMap[192]);
  fs.writeFileSync(path.resolve(appDir, "apple-icon.png"), pngMap[180]);
  fs.writeFileSync(path.resolve(appDir, "icon.svg"), svgContent);
  console.log("✓ Saved src/app/icon.png, apple-icon.png, icon.svg");

  // 3. Multi-resolution favicon.ico (16x16, 32x32, 48x48)
  const icoBuffer = buildIcoBuffer([
    { width: 16, height: 16, buffer: pngMap[16] },
    { width: 32, height: 32, buffer: pngMap[32] },
    { width: 48, height: 48, buffer: pngMap[48] },
  ]);

  fs.writeFileSync(path.resolve(publicDir, "favicon.ico"), icoBuffer);
  fs.writeFileSync(path.resolve(appDir, "favicon.ico"), icoBuffer);
  console.log("✓ Built valid Windows multi-resolution favicon.ico in public/ and src/app/");

  // 4. Web App Manifest (site.webmanifest)
  const manifest = {
    name: "Sadyer Bazar (সাধ্যের বাজার)",
    short_name: "Sadyer Bazar",
    description: "Pure Organic Food, Fresh Jamuna River Fish & Nationwide Pre-Order Platform",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F5",
    theme_color: "#0F3D2E",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };

  fs.writeFileSync(
    path.resolve(publicDir, "site.webmanifest"),
    JSON.stringify(manifest, null, 2)
  );
  console.log("✓ Saved public/site.webmanifest");

  console.log("🎉 All favicons and application icons successfully generated!");
}

generateFavicons().catch((err) => {
  console.error("Error generating favicons:", err);
  process.exit(1);
});
