import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, '..', 'prisma', 'seed-assets', 'parts');

const PARTS = [
  { slug: '60v-32ah-battery-pack', label: '60V 32Ah Battery', bg: '#B34700', fg: '#FFFFFF', extras: ['Side View'] },
  { slug: 'bldc-motor-1000w', label: '1000W Motor', bg: '#334155', fg: '#FFFFFF' },
  { slug: 'lcd-display-panel', label: 'LCD Display', bg: '#0f172a', fg: '#FFFFFF' },
  { slug: 'front-brake-pad-set', label: 'Brake Pads', bg: '#7c2d12', fg: '#FFFFFF' },
  { slug: 'tubeless-tyre-16', label: 'Tyre 16in', bg: '#1c1917', fg: '#FFFFFF' },
  { slug: '60v-5a-fast-charger', label: '60V Charger', bg: '#c2410c', fg: '#FFFFFF', extras: ['Detail View', 'In Use'] },
  { slug: 'headlight-assembly-led', label: 'LED Headlight', bg: '#fef08a', fg: '#1c1917', extras: ['Night Beam'] },
  { slug: 'rear-shock-absorber', label: 'Rear Shock', bg: '#475569', fg: '#FFFFFF', extras: ['Installed'] },
];

function partSvg(part, label) {
  return `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${part.bg}" />
            <stop offset="100%" stop-color="${part.bg}" stop-opacity="0.82" />
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#g)" />
        <rect x="32" y="32" width="120" height="36" rx="18" fill="rgba(255,255,255,0.14)" />
        <text x="92" y="56" text-anchor="middle" fill="#f97316" font-family="Arial, sans-serif" font-size="14" font-weight="700">PART</text>
        <text x="400" y="300" text-anchor="middle" fill="${part.fg}" font-family="Arial, sans-serif" font-size="42" font-weight="700">${escapeXml(part.label)}</text>
        <text x="400" y="360" text-anchor="middle" fill="${part.fg}" fill-opacity="0.75" font-family="Arial, sans-serif" font-size="22" font-weight="600">${escapeXml(label)}</text>
        <text x="400" y="560" text-anchor="middle" fill="${part.fg}" fill-opacity="0.55" font-family="Arial, sans-serif" font-size="18" font-weight="600">Crown Ev</text>
      </svg>`;
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
  await fs.promises.mkdir(outDir, { recursive: true });

  for (const part of PARTS) {
    const dest = path.join(outDir, `${part.slug}.webp`);
    await sharp(Buffer.from(partSvg(part, part.label))).webp({ quality: 88 }).toFile(dest);
    console.log('Wrote', dest);

    for (let i = 0; i < (part.extras?.length ?? 0); i++) {
      const extraDest = path.join(outDir, `${part.slug}-${i + 2}.webp`);
      await sharp(Buffer.from(partSvg(part, part.extras[i]))).webp({ quality: 88 }).toFile(extraDest);
      console.log('Wrote', extraDest);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
