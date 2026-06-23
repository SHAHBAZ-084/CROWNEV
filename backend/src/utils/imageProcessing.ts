import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

const productsDir = path.resolve(env.uploadDir, 'products');
const branchesDir = path.resolve(env.uploadDir, 'branches');
fs.mkdirSync(productsDir, { recursive: true });
fs.mkdirSync(branchesDir, { recursive: true });

const WEBP_QUALITY = 82;

export function productImagePublicUrl(filename: string) {
  return `/uploads/products/${filename}`;
}

export function branchImagePublicUrl(filename: string) {
  return `/uploads/branches/${filename}`;
}

/** Convert any supported raster image buffer to WebP and save under uploads/products. */
export async function saveProductImageAsWebp(input: Buffer): Promise<string> {
  const filename = `${uuidv4()}.webp`;
  const filepath = path.join(productsDir, filename);

  await sharp(input)
    .rotate()
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toFile(filepath);

  return filename;
}

/** Branch showroom photo — resized for cards, saved as WebP. */
export async function saveBranchImageAsWebp(input: Buffer): Promise<string> {
  const filename = `${uuidv4()}.webp`;
  const filepath = path.join(branchesDir, filename);

  await sharp(input)
    .rotate()
    .resize(960, 640, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toFile(filepath);

  return filename;
}

export async function deleteBranchImageFile(url: string) {
  if (!url.startsWith('/uploads/branches/')) return;
  const filepath = path.join(branchesDir, path.basename(url));
  try {
    await fs.promises.unlink(filepath);
  } catch {
    // file may already be gone
  }
}

export function assertWebpProductImageUrl(url: string) {
  if (!url.startsWith('/uploads/products/')) return;
  if (!url.toLowerCase().endsWith('.webp')) {
    throw new Error('Product images must be stored as WebP');
  }
}

export async function deleteProductImageFile(url: string) {
  if (!url.startsWith('/uploads/products/')) return;
  const filepath = path.join(productsDir, path.basename(url));
  try {
    await fs.promises.unlink(filepath);
  } catch {
    // file may already be gone
  }
}
