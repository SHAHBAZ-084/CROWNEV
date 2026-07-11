/**
 * Build tab + Google Search favicons from the site logo.
 * Google requires square icons ≥48px and crawls /favicon.ico or link rel="icon".
 * Run: node scripts/generate-favicon.mjs
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const logoPath = path.join(root, 'public/images/logo.webp');
const publicDir = path.join(root, 'public');

/** Pack PNG buffers into a multi-size .ico (PNG-embedded, Vista+ format). */
function encodeIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let dataOffset = 6 + count * 16;

  for (const buf of pngBuffers) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    entries.push(entry);
    dataOffset += buf.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

const trimmed = await sharp(logoPath).trim({ threshold: 15 }).toBuffer({ resolveWithObject: true });
const { data, info } = trimmed;

// Crown emblem only — no wordmark — so the mark fills Google's circular favicon slot.
const cropHeight = Math.round(info.height * 0.38);
const cropWidth = Math.min(info.width, Math.round(cropHeight * 1.05));
const cropLeft = Math.floor((info.width - cropWidth) / 2);

const emblem = await sharp(data)
  .extract({ left: cropLeft, top: 0, width: cropWidth, height: cropHeight })
  .png()
  .toBuffer();

const side = Math.max(cropWidth, cropHeight);
const pad = Math.round(side * 0.06);
const paddedSide = side + pad * 2;

const square = await sharp(emblem)
  .extend({
    top: pad,
    bottom: paddedSide - cropHeight - pad,
    left: pad + Math.floor((side - cropWidth) / 2),
    right: paddedSide - cropWidth - pad - Math.floor((side - cropWidth) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 1 },
  })
  .png()
  .toBuffer();

const pngSizes = [
  { name: 'favicon-16.png', size: 16 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-48.png', size: 48 },
  { name: 'favicon-96.png', size: 96 },
  { name: 'apple-touch-icon.png', size: 180 },
];

const icoBuffers = [];

for (const { name, size } of pngSizes) {
  const buf = await sharp(square).resize(size, size, { fit: 'cover' }).png().toBuffer();
  await fs.promises.writeFile(path.join(publicDir, name), buf);
  console.log(`Wrote public/${name} (${size}x${size})`);
  if (size <= 48) icoBuffers.push(buf);
}

await sharp(square).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(publicDir, 'favicon-512.png'));
console.log('Wrote public/favicon-512.png');

const ico = encodeIco(icoBuffers);
await fs.promises.writeFile(path.join(publicDir, 'favicon.ico'), ico);
console.log('Wrote public/favicon.ico');
