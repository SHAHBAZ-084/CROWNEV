/**
 * Seed admin catalog parts from prisma/seed-assets/products-catalog.json.
 * Creates Product (PART) + ProductImage only — no branch listing / shop visibility.
 *
 * Usage:
 *   npm run db:seed-parts
 *   npm run db:seed-parts -- --skip-images
 *   npm run db:seed-parts -- --limit 50
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { PrismaClient, ProductType } from '@prisma/client';
import { slugify } from '../src/utils/crypto.js';

const prisma = new PrismaClient();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDir, '..');
const MANIFEST = path.join(backendRoot, 'prisma/seed-assets/products-catalog.json');
const PARTS_UPLOAD_DIR = path.resolve(backendRoot, 'uploads/parts');
const IMAGE_RAW_BASE =
  'https://raw.githubusercontent.com/SHAHBAZ-084/crown-eve-center/main/backend/uploads/parts/';
const CONCURRENCY = 8;

type CatalogProduct = {
  serial_no: number;
  item_code: string;
  model: string;
  description: string;
  name: string;
  cp_price: number;
  price: number;
  pdfPage?: number;
  imageFile?: string | null;
};

type Manifest = {
  products: CatalogProduct[];
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    skipImages: args.includes('--skip-images'),
    refreshImages: args.includes('--refresh-images'),
    limit: (() => {
      const idx = args.indexOf('--limit');
      if (idx === -1 || !args[idx + 1]) return undefined;
      const n = parseInt(args[idx + 1], 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
  };
}

async function ensureImageWebp(itemCode: string, imageFile: string | null | undefined, refresh: boolean) {
  if (!imageFile) return null;

  await fs.promises.mkdir(PARTS_UPLOAD_DIR, { recursive: true });
  const safeName = `${itemCode.replace(/[^a-zA-Z0-9-_]/g, '_')}.webp`;
  const destPath = path.join(PARTS_UPLOAD_DIR, safeName);
  const publicUrl = `/uploads/parts/${safeName}`;

  if (!refresh && fs.existsSync(destPath)) {
    return publicUrl;
  }

  const rawUrl = `${IMAGE_RAW_BASE}${encodeURIComponent(imageFile)}`;
  const response = await fetch(rawUrl);
  if (!response.ok) {
    console.warn(`  ⚠ Image missing for ${itemCode}: ${imageFile} (${response.status})`);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await sharp(buffer).webp({ quality: 82 }).toFile(destPath);
  return publicUrl;
}

function partSpecs(p: CatalogProduct) {
  return {
    serial_no: String(p.serial_no),
    item_code: p.item_code,
    model: p.model,
    cp_price: p.cp_price,
    unit: 'piece',
  };
}

async function upsertCatalogPart(p: CatalogProduct, imageUrl: string | null) {
  const slug = slugify(p.item_code);
  const specs = partSpecs(p);

  const product = await prisma.product.upsert({
    where: { slug },
    create: {
      name: p.name.slice(0, 255),
      slug,
      type: ProductType.PART,
      price: p.price || p.cp_price || 0,
      description: p.description || null,
      specs,
      isActive: true,
    },
    update: {
      name: p.name.slice(0, 255),
      price: p.price || p.cp_price || 0,
      description: p.description || null,
      specs,
      isActive: true,
    },
    select: { id: true, createdAt: true },
  });

  if (imageUrl) {
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: imageUrl,
        isPrimary: true,
        sortOrder: 0,
      },
    });
  }

  const ageMs = Date.now() - new Date(product.createdAt).getTime();
  return ageMs < 3000 ? 'created' : 'updated';
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let index = 0;
  async function loop() {
    while (index < items.length) {
      const i = index++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, loop));
}

async function main() {
  const { skipImages, refreshImages, limit } = parseArgs();

  if (!fs.existsSync(MANIFEST)) {
    throw new Error(`Missing ${MANIFEST}. Download products-catalog.json into prisma/seed-assets/.`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest;
  let products = manifest.products ?? [];
  if (limit) products = products.slice(0, limit);

  console.log(`Seeding ${products.length} catalog parts (images: ${skipImages ? 'skipped' : 'webp'}, concurrency ${CONCURRENCY})…`);

  const stats = { created: 0, updated: 0, images: 0, done: 0, failed: 0 };

  await runPool(products, CONCURRENCY, async (p) => {
    try {
      let imageUrl: string | null = null;
      if (!skipImages && p.imageFile) {
        imageUrl = await ensureImageWebp(p.item_code, p.imageFile, refreshImages);
        if (imageUrl) stats.images += 1;
      }

      const result = await upsertCatalogPart(p, imageUrl);
      if (result === 'created') stats.created += 1;
      else stats.updated += 1;
    } catch (err) {
      stats.failed += 1;
      console.error(`  ✗ ${p.item_code}:`, err instanceof Error ? err.message : err);
    } finally {
      stats.done += 1;
      if (stats.done % 100 === 0 || stats.done === products.length) {
        console.log(`Progress: ${stats.done}/${products.length}`);
      }
    }
  });

  console.log('\nDone.');
  console.log(`Created: ${stats.created} | Updated: ${stats.updated} | Images: ${stats.images} | Failed: ${stats.failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
