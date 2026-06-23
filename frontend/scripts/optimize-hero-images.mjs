import { statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const outDir = join(__dirname, '..', 'public', 'images');

const HERO_WIDTH = 1280;
const HERO_HEIGHT = 720;
const MOBILE_WIDTH = 768;
const MOBILE_HEIGHT = 432;

const HERO_IMAGES = [
  {
    input: join(rootDir, "2006 Ducati Sport Classic _.jfif"),
    desktop: 'book-service-hero.webp',
    mobile: 'book-service-hero-sm.webp',
  },
  {
    input: join(rootDir, 'Husqvarna Vitpilen 250.jfif'),
    desktop: 'contact-hero.webp',
    mobile: 'contact-hero-sm.webp',
  },
];

function kb(path) {
  return `${Math.round(statSync(path).size / 1024)} KB`;
}

for (const { input, desktop, mobile } of HERO_IMAGES) {
  await sharp(input)
    .resize(HERO_WIDTH, HERO_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82, effort: 4 })
    .toFile(join(outDir, desktop));

  await sharp(input)
    .resize(MOBILE_WIDTH, MOBILE_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: 78, effort: 4 })
    .toFile(join(outDir, mobile));

  console.log(`${desktop}: ${kb(join(outDir, desktop))}, ${mobile}: ${kb(join(outDir, mobile))}`);
}
