import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';

// Detect the real image type from the file's magic bytes. The client-supplied
// mimetype is never trusted for what we store/serve — an attacker could claim
// image/png while uploading an SVG carrying script (stored XSS). Returns a
// server-derived { mime, ext } for known-safe raster formats, or null.
function sniffImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

// Persist an uploaded image and return a URL the frontend can render.
//
// Production (any env with a Blob token): upload to Vercel Blob — durable
// object storage, unlike the serverless /tmp filesystem which is wiped between
// invocations. Served from a separate *.public.blob.vercel-storage.com origin.
// Local development: write to server/uploads, served by Express static.
//
// The content type and extension are derived from the file's actual bytes, not
// the client request, so a mislabeled/malicious file is rejected.
export async function storeImage(file) {
  const type = sniffImageType(file.buffer);
  if (!type) {
    const error = new Error('Unsupported or invalid image file.');
    error.status = 400;
    throw error;
  }

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${type.ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(`profile-images/${filename}`, file.buffer, {
      access: 'public',
      contentType: type.mime,
      addRandomSuffix: true,
    });
    return url;
  }

  const dir = path.join(process.cwd(), 'server', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `/uploads/${filename}`;
}
