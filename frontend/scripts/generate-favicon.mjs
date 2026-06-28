/**
 * Build tab icons from the site logo — tight crop so the mark reads larger at 16–32px.
 * Run: node scripts/generate-favicon.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const logoPath = path.join(root, 'public/images/logo.webp');
const publicDir = path.join(root, 'public');

const trimmed = await sharp(logoPath).trim({ threshold: 15 }).toBuffer({ resolveWithObject: true });
const { data, info } = trimmed;

// Crop upper emblem (crown + CROWN wordmark) — omit small footer text so the mark fills the tab icon.
const cropHeight = Math.round(info.height * 0.62);
const cropWidth = Math.min(info.width, cropHeight);
const cropLeft = Math.floor((info.width - cropWidth) / 2);

const emblem = await sharp(data)
  .extract({ left: cropLeft, top: 0, width: cropWidth, height: cropHeight })
  .png()
  .toBuffer();

const side = Math.max(cropWidth, cropHeight);
const padX = Math.floor((side - cropWidth) / 2);
const padY = Math.floor((side - cropHeight) / 2);

const square = await sharp(emblem)
  .extend({
    top: padY,
    bottom: side - cropHeight - padY,
    left: padX,
    right: side - cropWidth - padX,
    background: { r: 0, g: 0, b: 0, alpha: 1 },
  })
  .png()
  .toBuffer();

const sizes = [
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of sizes) {
  await sharp(square).resize(size, size, { fit: 'cover' }).png().toFile(path.join(publicDir, name));
  console.log(`Wrote public/${name} (${size}x${size})`);
}

await sharp(square).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(publicDir, 'favicon-512.png'));
console.log('Wrote public/favicon-512.png');
