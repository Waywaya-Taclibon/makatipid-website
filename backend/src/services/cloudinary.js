// Cloudinary wrapper for property photos. Secrets never leave the server.
// When the CLOUDINARY_* env vars are empty, uploads report "not configured"
// (503) — same pattern as the PayMongo service.
const cloudinary = require('cloudinary').v2;

const MAX_IMAGES_PER_PROPERTY = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FOLDER = 'makatipid/properties';

function isConfigured() {
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || '').trim() &&
      (process.env.CLOUDINARY_API_KEY || '').trim() &&
      (process.env.CLOUDINARY_API_SECRET || '').trim()
  );
}

function ensureConfigured() {
  cloudinary.config({
    cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
    api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
    api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
  });
}

// Uploads one in-memory file. Returns { url, publicId }.
function uploadBuffer(buffer, mimetype) {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        resource_type: 'image',
        // Web-ready on arrival: cap width, auto format/quality (fast browse page).
        transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// Best-effort delete; throws so callers can decide whether it matters.
function destroy(publicId) {
  ensureConfigured();
  return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

module.exports = {
  MAX_IMAGES_PER_PROPERTY,
  MAX_FILE_BYTES,
  ALLOWED_MIME,
  isConfigured,
  uploadBuffer,
  destroy,
};
