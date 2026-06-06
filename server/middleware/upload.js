import multer from 'multer';

// Keep the uploaded file in memory; storeImage() decides where it lands
// (durable Vercel Blob in production, local disk in development).
const storage = multer.memoryStorage();

// Strict allowlist of safe raster image types. SVG is intentionally excluded:
// it can carry executable scripts and would enable stored XSS when served.
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, WebP, or GIF images are allowed.'));
    }
    cb(null, true);
  },
});
