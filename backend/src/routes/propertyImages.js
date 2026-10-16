const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const cloudinary = require('../services/cloudinary');

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: cloudinary.MAX_FILE_BYTES, files: cloudinary.MAX_IMAGES_PER_PROPERTY },
  fileFilter: (req, file, cb) => {
    if (cloudinary.ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    const err = new Error('Only JPEG, PNG, or WebP photos are allowed.');
    err.status = 400;
    return cb(err);
  },
});

function toImageResponse(row) {
  return { id: row.id, url: row.image_url, sortOrder: row.sort_order };
}

async function requireOwnedProperty(propertyId, userId) {
  const [rows] = await pool.query('SELECT id, owner_id FROM properties WHERE id = ? LIMIT 1', [propertyId]);
  if (rows.length === 0) {
    const err = new Error(`Property not found with id ${propertyId}`);
    err.status = 404;
    throw err;
  }
  if (rows[0].owner_id !== userId) {
    const err = new Error('You do not own this property');
    err.status = 403;
    throw err;
  }
  return rows[0];
}

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.array('photos', cloudinary.MAX_IMAGES_PER_PROPERTY)(req, res, (err) => {
      if (!err) return resolve();
      if (err.code === 'LIMIT_FILE_SIZE') {
        const sized = new Error('Each photo must be 5 MB or smaller.');
        sized.status = 400;
        return reject(sized);
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        const many = new Error(`You can upload at most ${cloudinary.MAX_IMAGES_PER_PROPERTY} photos per property.`);
        many.status = 400;
        return reject(many);
      }
      if (!err.status) err.status = 400;
      return reject(err);
    });
  });
}

// POST /api/properties/:propertyId/images — owner uploads up to the remaining slots.
router.post('/', async (req, res, next) => {
  try {
    if (!cloudinary.isConfigured()) {
      return res.status(503).json({ message: 'Photo upload is not configured on the server.' });
    }
    await requireOwnedProperty(req.params.propertyId, req.user.id);
    await runUpload(req, res);
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: 'No photos were attached (field name "photos").' });
    }
    const [existing] = await pool.query('SELECT id FROM property_images WHERE property_id = ?', [
      req.params.propertyId,
    ]);
    if (existing.length + files.length > cloudinary.MAX_IMAGES_PER_PROPERTY) {
      return res.status(400).json({
        message: `This property already has ${existing.length} photo(s). You can keep at most ${cloudinary.MAX_IMAGES_PER_PROPERTY}. Remove one first.`,
      });
    }
    const created = [];
    for (let i = 0; i < files.length; i += 1) {
      const uploaded = await cloudinary.uploadBuffer(files[i].buffer, files[i].mimetype);
      const sortOrder = existing.length + i;
      const [result] = await pool.query(
        'INSERT INTO property_images (property_id, image_url, public_id, sort_order) VALUES (?, ?, ?, ?)',
        [req.params.propertyId, uploaded.url, uploaded.publicId, sortOrder]
      );
      created.push({ id: result.insertId, url: uploaded.url, sortOrder });
    }
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/properties/:propertyId/images/:imageId — owner removes one photo.
router.delete('/:imageId', async (req, res, next) => {
  try {
    await requireOwnedProperty(req.params.propertyId, req.user.id);
    const [rows] = await pool.query('SELECT id, public_id FROM property_images WHERE id = ? AND property_id = ? LIMIT 1', [
      req.params.imageId,
      req.params.propertyId,
    ]);
    if (rows.length === 0) return res.status(404).json({ message: 'Photo not found' });
    try {
      await cloudinary.destroy(rows[0].public_id);
    } catch (e) {
      // Cloudinary record already gone (or unconfigured): still remove our row.
      // eslint-disable-next-line no-console
      console.warn('Cloudinary destroy failed, removing row anyway:', e.message);
    }
    await pool.query('DELETE FROM property_images WHERE id = ?', [req.params.imageId]);
    const [remaining] = await pool.query(
      'SELECT id, image_url, sort_order FROM property_images WHERE property_id = ? ORDER BY sort_order, id',
      [req.params.propertyId]
    );
    return res.json(remaining.map(toImageResponse));
  } catch (err) {
    return next(err);
  }
});

// PUT /api/properties/:propertyId/images/order — owner reorders (first = cover).
router.put('/order', async (req, res, next) => {
  try {
    await requireOwnedProperty(req.params.propertyId, req.user.id);
    const { order } = req.body || {};
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ message: 'Body must be { order: [imageId, ...] }.' });
    }
    const [existing] = await pool.query('SELECT id FROM property_images WHERE property_id = ?', [
      req.params.propertyId,
    ]);
    const known = new Set(existing.map((r) => r.id));
    if (order.length !== existing.length || !order.every((id) => known.has(Number(id)))) {
      return res.status(400).json({ message: 'Order must list exactly the current photo ids.' });
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < order.length; i += 1) {
        await conn.query('UPDATE property_images SET sort_order = ? WHERE id = ? AND property_id = ?', [
          i,
          Number(order[i]),
          req.params.propertyId,
        ]);
      }
      await conn.commit();
    } catch (e) {
      try {
        await conn.rollback();
      } catch {
        // ignore
      }
      throw e;
    } finally {
      conn.release();
    }
    const [rows] = await pool.query(
      'SELECT id, image_url, sort_order FROM property_images WHERE property_id = ? ORDER BY sort_order, id',
      [req.params.propertyId]
    );
    return res.json(rows.map(toImageResponse));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
