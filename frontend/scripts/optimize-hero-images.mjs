import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcesDir = join(__dirname, 'sources');
const outDir = join(__dirname, '..', 'public', 'images');

const HERO_WIDTH = 1280;
const HERO_HEIGHT = 720;
const MOBILE_WIDTH = 768;
const MOBILE_HEIGHT = 432;

/** Place source photos in frontend/scripts/sources/ before running. */
const HERO_IMAGES = [
  {
    input: join(sourcesDir, 'book-service-hero.jpg'),
    desktop: 'book-service-hero.webp',
    mobile: 'book-service-hero-sm.webp',
  },
  {
    input: join(sourcesDir, 'contact-hero.jpg'),
    desktop: 'contact-hero.webp',
    mobile: 'contact-hero-sm.webp',
  },
];

function kb(path) {
  return `${Math.round(statSync(path).size / 1024)} KB`;
}

let processed = 0;

for (const { input, desktop, mobile } of HERO_IMAGES) {
  if (!existsSync(input)) {
    console.warn(`Skip (missing source): ${input}`);
    continue;
  }

  await sharp(input)
    .resize(HERO_WIDTH, HERO_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82, effort: 4 })
    .toFile(join(outDir, desktop));

  await sharp(input)
    .resize(MOBILE_WIDTH, MOBILE_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: 78, effort: 4 })
    .toFile(join(outDir, mobile));

  console.log(`${desktop}: ${kb(join(outDir, desktop))}, ${mobile}: ${kb(join(outDir, mobile))}`);
  processed += 1;
}

if (processed === 0) {
  console.log('No hero sources found. Add images to frontend/scripts/sources/ and re-run.');
}
