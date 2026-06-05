import multer from 'multer';

// Keep the uploaded file in memory; storeImage() decides where it lands
// (durable Vercel Blob in production, local disk in development).
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'));
    }
    cb(null, true);
  },
});
