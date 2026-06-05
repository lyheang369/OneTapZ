import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';

// Persist an uploaded image and return a URL the frontend can render.
//
// Production (and any environment with a Blob token): upload to Vercel Blob,
// which is durable object storage — unlike the serverless /tmp filesystem,
// which is wiped between invocations. Returns an absolute https URL.
//
// Local development: write to server/uploads and return a relative /uploads
// path served by the Express static middleware.
export async function storeImage(file) {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '-').toLowerCase();

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(`profile-images/${safeName}`, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
      addRandomSuffix: true,
    });
    return url;
  }

  const dir = path.join(process.cwd(), 'server', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${safeName}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `/uploads/${filename}`;
}
