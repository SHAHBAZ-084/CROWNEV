/**
 * Social share preview image (1200×630) for WhatsApp, Facebook, etc.
 * Run: node scripts/generate-og-image.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const logoPath = path.join(root, 'public/images/logo-lg.webp');
const outJpg = path.join(root, 'public/images/og-share.jpg');
const outWebp = path.join(root, 'public/images/og-share.webp');

const width = 1200;
const height = 630;

const logo = await sharp(logoPath).trim({ threshold: 15 }).resize(520, null, { fit: 'inside' }).png().toBuffer();
const logoMeta = await sharp(logo).metadata();

const overlay = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1c1917"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ea580c"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="64" y="64" width="${width - 128}" height="${height - 128}" rx="28" fill="none" stroke="url(#accent)" stroke-width="3" opacity="0.45"/>
  <text x="600" y="500" text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600">Shop EV bikes · Book service · Find a branch</text>
  <text x="600" y="548" text-anchor="middle" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="26">crownevcenter.com</text>
</svg>
`);

const logoLeft = Math.floor((width - (logoMeta.width ?? 520)) / 2);
const logoTop = 72;

const composed = await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: { r: 15, g: 23, b: 42, alpha: 1 },
  },
})
  .composite([
    { input: overlay, top: 0, left: 0 },
    { input: logo, top: logoTop, left: logoLeft },
  ])
  .jpeg({ quality: 88, mozjpeg: true })
  .toBuffer();

await sharp(composed).jpeg({ quality: 88, mozjpeg: true }).toFile(outJpg);
await sharp(composed).webp({ quality: 85 }).toFile(outWebp);

console.log('Wrote public/images/og-share.jpg');
console.log('Wrote public/images/og-share.webp');
