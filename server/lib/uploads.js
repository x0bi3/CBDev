import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
export const productUploadDir = resolve(root, 'uploads', 'products');

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function ensureUploadDirs() {
  if (!existsSync(productUploadDir)) {
    mkdirSync(productUploadDir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, productUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED.has(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${safeExt}`);
  },
});

export const productImageUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});
