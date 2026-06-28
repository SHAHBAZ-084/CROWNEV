import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcesDir = join(__dirname, 'sources');
const outDir = join(__dirname, '..', 'public', 'images');

const FOUNDER_WIDTH = 400;
const FOUNDER_HEIGHT = 480;

/** Place source photos in frontend/scripts/sources/ before running. */
const FOUNDER_IMAGES = [
  {
    input: join(sourcesDir, 'about-founder-mohsin.jpg'),
    output: 'about-founder-mohsin.webp',
  },
  {
    input: join(sourcesDir, 'about-founder-sufi.jpg'),
    output: 'about-founder-sufi.webp',
  },
];

function kb(path) {
  return `${Math.round(statSync(path).size / 1024)} KB`;
}

let processed = 0;

for (const { input, output } of FOUNDER_IMAGES) {
  if (!existsSync(input)) {
    console.warn(`Skip (missing source): ${input}`);
    continue;
  }

  await sharp(input)
    .resize(FOUNDER_WIDTH, FOUNDER_HEIGHT, { fit: 'cover', position: 'top' })
    .webp({ quality: 82, effort: 4 })
    .toFile(join(outDir, output));

  console.log(`${output}: ${kb(join(outDir, output))}`);
  processed += 1;
}

if (processed === 0) {
  console.log('No founder sources found. Add images to frontend/scripts/sources/ and re-run.');
}
