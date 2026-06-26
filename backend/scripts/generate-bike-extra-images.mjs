import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const bikesDir = path.join(root, '..', 'prisma', 'seed-assets', 'bikes');

/** Bikes that get extra gallery images for seed data. */
const BIKE_EXTRAS = [
  { slug: 'crown-eve-pro-x1', variants: ['detail', 'ride'] },
  { slug: 'crown-eve-lite-s2', variants: ['detail'] },
  { slug: 'crown-eve-delivery-max', variants: ['cargo'] },
  { slug: 'crown-eve-city-cruiser', variants: ['profile'] },
];

async function writeVariant(srcPath, destPath, variant) {
  const meta = await sharp(srcPath).metadata();
  const width = meta.width ?? 800;
  const height = meta.height ?? 600;

  if (variant === 'detail') {
    await sharp(srcPath)
      .extract({
        left: Math.floor(width * 0.25),
        top: Math.floor(height * 0.1),
        width: Math.floor(width * 0.5),
        height: Math.floor(height * 0.75),
      })
      .resize(800, 600, { fit: 'cover' })
      .webp({ quality: 88 })
      .toFile(destPath);
    return;
  }

  if (variant === 'ride') {
    await sharp(srcPath)
      .modulate({ brightness: 1.08, saturation: 1.12 })
      .blur(0.3)
      .webp({ quality: 88 })
      .toFile(destPath);
    return;
  }

  if (variant === 'cargo' || variant === 'profile') {
    await sharp(srcPath)
      .extract({
        left: variant === 'cargo' ? 0 : Math.floor(width * 0.15),
        top: Math.floor(height * 0.05),
        width: Math.floor(width * 0.7),
        height: Math.floor(height * 0.9),
      })
      .resize(800, 600, { fit: 'cover' })
      .modulate({ brightness: variant === 'cargo' ? 0.95 : 1.05 })
      .webp({ quality: 88 })
      .toFile(destPath);
  }
}

async function main() {
  for (const bike of BIKE_EXTRAS) {
    const src = path.join(bikesDir, `${bike.slug}.webp`);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing bike image: ${src}`);
    }

    for (let i = 0; i < bike.variants.length; i++) {
      const dest = path.join(bikesDir, `${bike.slug}-${i + 2}.webp`);
      await writeVariant(src, dest, bike.variants[i]);
      console.log('Wrote', dest);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
