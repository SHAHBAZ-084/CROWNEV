import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

const productsDir = path.resolve(env.uploadDir, 'products');
fs.mkdirSync(productsDir, { recursive: true });

const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, productsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
});
