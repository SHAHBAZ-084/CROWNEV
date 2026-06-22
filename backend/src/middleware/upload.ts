import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

const productsDir = path.resolve(env.uploadDir, 'products');
fs.mkdirSync(productsDir, { recursive: true });

/** Accept common uploads; product images are converted to WebP on save. */
const productInputMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (productInputMimes.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
});

const paymentsDir = path.resolve(env.uploadDir, 'payments');
fs.mkdirSync(paymentsDir, { recursive: true });

const paymentMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const paymentScreenshotUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, paymentsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (paymentMimes.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});
