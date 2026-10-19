const express = require('express');
const { pool } = require('../db');
const { parseDateOnly, toDateOnlyString, manilaTodayDateOnly, toDateTimeString, HOLD_MINUTES } = require('../utils/pricing');

const router = express.Router();

const MAX_PRICE = 10000000;
const MAX_DEPOSIT = 10000000;
const VALID_INTERNET = new Set(['INCLUDED', 'AVAILABLE', 'NONE']);

// Shared server-side validation (POST + PUT). Returns an error message or null.
function validatePropertyInput(b) {
  const lotName = typeof b.lotName === 'string' ? b.lotName.trim() : '';
  const address = typeof b.address === 'string' ? b.address.trim() : '';
  if (!lotName || !address) return 'lotName and address are required';
  if (lotName.length > 255 || address.length > 255) return 'Name and address must be 255 characters or fewer';
  const price = Number(b.price);
  if (!Number.isFinite(price) || price <= 0) return 'Price must be a positive number';
  if (price > MAX_PRICE) return `Price must not exceed ${MAX_PRICE}`;
  if (b.securityDeposit != null && b.securityDeposit !== '') {
    const dep = Number(b.securityDeposit);
    if (!Number.isFinite(dep) || dep < 0) return 'Security deposit must be zero or more';
    if (dep > MAX_DEPOSIT) return `Security deposit must not exceed ${MAX_DEPOSIT}`;
  }
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180';
  if (b.availableUntil != null && b.availableUntil !== '') {
    const until = parseDateOnly(b.availableUntil);
    if (!until) return 'availableUntil must be a valid YYYY-MM-DD date';
    if (until < manilaTodayDateOnly()) return 'availableUntil cannot be in the past';
  }
  if (b.internet != null && b.internet !== '' && !VALID_INTERNET.has(String(b.internet))) {
    return 'internet must be INCLUDED, AVAILABLE, or NONE';
  }
  return null;
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function boolOrNull(v) {
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

// `includeContact` keeps owner phone/email/socials out of anonymous responses.
// Public search is browsable by anyone, so contact details are only attached
// when a valid member token came with the request.
function toResponse(row, occupied, images, includeContact = true) {
  return {
    id: row.id,
    lotName: row.lot_name,
    address: row.address,
    price: Number(row.price),
    lat: Number(row.lat),
    lng: Number(row.lng),
    ownerId: row.owner_id,
    ownerName: row.owner_name || null,
    // Contact details shown in the renter's Contact Owner modal. Any field the
    // owner hasn't filled in comes back null and the modal shows a placeholder.
    ownerContact: includeContact
      ? {
          name: row.owner_name || null,
          phone: row.owner_phone || null,
          email: row.owner_email || null,
          facebook: row.owner_facebook || null,
          instagram: row.owner_instagram || null,
        }
      : null,
    occupied: Boolean(occupied),
    archived: Boolean(row.archived),
    availableUntil: row.available_until || null,
    securityDeposit: numOrNull(row.security_deposit),
    internet: row.internet || null,
    electricityIncluded: boolOrNull(row.electricity_included),
    waterIncluded: boolOrNull(row.water_included),
    petsAllowed: boolOrNull(row.pets_allowed),
    smokingAllowed: boolOrNull(row.smoking_allowed),
    modificationsAllowed: boolOrNull(row.modifications_allowed),
    images: Array.isArray(images) ? images : [],
  };
}

// Batch-loads photos for a set of properties (first = cover). Returns Map<propertyId, image[]>.
async function imagesByPropertyIds(ids) {
  const map = new Map(ids.map((id) => [id, []]));
  if (ids.length === 0) return map;
  const [rows] = await pool.query(
    'SELECT id, property_id, image_url, sort_order FROM property_images WHERE property_id IN (?) ORDER BY property_id, sort_order, id',
    [ids]
  );
  for (const r of rows) {
    if (map.has(r.property_id)) {
      map.get(r.property_id).push({ id: r.id, url: r.image_url, sortOrder: r.sort_order });
    }
  }
  return map;
}

const SELECT_ALL = `
  SELECT p.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
         u.facebook AS owner_facebook, u.instagram AS owner_instagram
  FROM properties p
  LEFT JOIN users u ON u.id = p.owner_id
`;

async function occupiedSet() {
  const [rows] = await pool.query("SELECT DISTINCT property_id FROM rentallog WHERE status = 'ACTIVE'");
  return new Set(rows.map((r) => r.property_id));
}

async function isOccupied(propertyId) {
  const [rows] = await pool.query(
    "SELECT id FROM rentallog WHERE property_id = ? AND status = 'ACTIVE' LIMIT 1",
    [propertyId]
  );
  return rows.length > 0;
}

async function findById(id) {
  const [rows] = await pool.query(`${SELECT_ALL} WHERE p.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

// Idempotency lookup for POST /: a retried add must return the original row.
async function findOwnedByClientRequestId(ownerId, clientRequestId) {
  const [rows] = await pool.query(
    `${SELECT_ALL} WHERE p.owner_id = ? AND p.client_request_id = ? LIMIT 1`,
    [ownerId, clientRequestId]
  );
  return rows[0] || null;
}

async function respondWithExisting(existing, res) {
  const images = await imagesByPropertyIds([existing.id]);
  return res.json(toResponse(existing, false, images.get(existing.id), true));
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(SELECT_ALL);
    const occupied = await occupiedSet();
    const images = await imagesByPropertyIds(rows.map((p) => p.id));
    const includeContact = Boolean(req.user);
    return res.json(rows.map((p) => toResponse(p, occupied.has(p.id), images.get(p.id), includeContact)));
  } catch (err) {
    return next(err);
  }
});

router.get('/available', async (req, res, next) => {
  try {
    const [rows] = await pool.query(SELECT_ALL);
    const occupied = await occupiedSet();
    const images = await imagesByPropertyIds(rows.map((p) => p.id));
    const includeContact = Boolean(req.user);
    return res.json(
      rows
        .filter((p) => !p.archived)
        .map((p) => toResponse(p, occupied.has(p.id), images.get(p.id), includeContact))
    );
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Public search
// ---------------------------------------------------------------------------

const MAX_SEARCH_LIMIT = 60;
const DEFAULT_SEARCH_LIMIT = 24;

const SEARCH_SORTS = {
  newest: 'p.id DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
};

/** Escapes LIKE wildcards so a visitor's `%` can't match every row. */
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Accepts only plain string query values (Express gives arrays for repeats). */
function queryString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function queryNumber(value, { min = 0 } = {}) {
  const raw = queryString(value);
  if (raw === '') return { ok: true, value: undefined };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) return { ok: false };
  return { ok: true, value: n };
}

/** Returns { ok: true, value: 1|0|undefined } or { ok: false }. */
function queryBool(value) {
  const raw = queryString(value).toLowerCase();
  if (raw === '') return { ok: true, value: undefined };
  if (raw === '1' || raw === 'true') return { ok: true, value: 1 };
  if (raw === '0' || raw === 'false') return { ok: true, value: 0 };
  return { ok: false };
}

/**
 * Turns the query string into a parameterised WHERE clause.
 *
 * The date window mirrors the checkout rules in payments.js exactly: a
 * non-ENDED booking or a live PENDING payment hold that overlaps the range
 * blocks the property, and `available_until` caps the far end. Anything looser
 * would show places that later reject the booking.
 */
function buildSearchWhere(query) {
  const where = ['p.archived = 0'];
  const params = [];

  const q = queryString(query.q);
  if (q.length > 255) return { error: 'Search text is too long' };
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push('(p.address LIKE ? OR p.lot_name LIKE ?)');
    params.push(like, like);
  }

  const rawStart = queryString(query.start);
  const rawEnd = queryString(query.end);
  if (Boolean(rawStart) !== Boolean(rawEnd)) {
    return { error: 'start and end must be provided together' };
  }
  if (rawStart && rawEnd) {
    const start = parseDateOnly(rawStart);
    const end = parseDateOnly(rawEnd);
    if (!start || !end) return { error: 'start and end must be valid YYYY-MM-DD dates' };
    if (start > end) return { error: 'start must be on or before end' };
    if (end < manilaTodayDateOnly()) return { error: 'end must not be in the past' };

    const startStr = toDateOnlyString(start);
    const endStr = toDateOnlyString(end);

    where.push(`NOT EXISTS (
      SELECT 1 FROM rentallog r
      WHERE r.property_id = p.id AND UPPER(r.status) <> 'ENDED'
        AND r.start_date <= ? AND (r.end_date IS NULL OR r.end_date >= ?)
    )`);
    params.push(endStr, startStr);

    where.push(`NOT EXISTS (
      SELECT 1 FROM payments pay
      WHERE pay.property_id = p.id AND pay.status = 'PENDING'
        AND pay.created_at > ?
        AND pay.start_date <= ? AND pay.end_date >= ?
    )`);
    const cutoff = toDateTimeString(new Date(Date.now() - HOLD_MINUTES * 60 * 1000));
    params.push(cutoff, endStr, startStr);

    where.push('(p.available_until IS NULL OR p.available_until >= ?)');
    params.push(endStr);
  }

  const minPrice = queryNumber(query.minPrice);
  if (!minPrice.ok) return { error: 'minPrice must be a non-negative number' };
  if (minPrice.value !== undefined) {
    where.push('p.price >= ?');
    params.push(minPrice.value);
  }

  const maxPrice = queryNumber(query.maxPrice);
  if (!maxPrice.ok) return { error: 'maxPrice must be a non-negative number' };
  if (maxPrice.value !== undefined) {
    where.push('p.price <= ?');
    params.push(maxPrice.value);
  }

  const maxDeposit = queryNumber(query.maxDeposit);
  if (!maxDeposit.ok) return { error: 'maxDeposit must be a non-negative number' };
  if (maxDeposit.value !== undefined) {
    where.push('(p.security_deposit IS NULL OR p.security_deposit <= ?)');
    params.push(maxDeposit.value);
  }

  const internet = queryString(query.internet);
  if (internet) {
    if (!VALID_INTERNET.has(internet)) {
      return { error: 'internet must be INCLUDED, AVAILABLE, or NONE' };
    }
    where.push('p.internet = ?');
    params.push(internet);
  }

  const booleanFilters = [
    ['pets', 'p.pets_allowed'],
    ['smoking', 'p.smoking_allowed'],
    ['modifications', 'p.modifications_allowed'],
    ['electricity', 'p.electricity_included'],
    ['water', 'p.water_included'],
  ];
  for (const [key, column] of booleanFilters) {
    const parsed = queryBool(query[key]);
    if (!parsed.ok) return { error: `${key} must be true or false` };
    if (parsed.value !== undefined) {
      where.push(`${column} = ?`);
      params.push(parsed.value);
    }
  }

  return { where: where.join(' AND '), params };
}

router.get('/search', async (req, res, next) => {
  try {
    const query = req.query || {};
    const built = buildSearchWhere(query);
    if (built.error) return res.status(400).json({ message: built.error });

    const sortKey = queryString(query.sort) || 'newest';
    const orderBy = SEARCH_SORTS[sortKey];
    if (!orderBy) {
      return res.status(400).json({ message: `sort must be one of: ${Object.keys(SEARCH_SORTS).join(', ')}` });
    }

    // Coerced to integers here, so inlining them is safe and avoids driver
    // differences around LIMIT placeholders.
    const limit = Math.min(
      Math.max(Math.floor(Number(queryString(query.limit)) || DEFAULT_SEARCH_LIMIT), 1),
      MAX_SEARCH_LIMIT
    );
    const offset = Math.max(Math.floor(Number(queryString(query.offset)) || 0), 0);

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM properties p WHERE ${built.where}`,
      built.params
    );
    const [rows] = await pool.query(
      `${SELECT_ALL} WHERE ${built.where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
      built.params
    );

    const occupied = await occupiedSet();
    const images = await imagesByPropertyIds(rows.map((p) => p.id));
    const includeContact = Boolean(req.user);

    return res.json({
      items: rows.map((p) => toResponse(p, occupied.has(p.id), images.get(p.id), includeContact)),
      total: Number(countRows[0].total) || 0,
      limit,
      offset,
    });
  } catch (err) {
    return next(err);
  }
});

// Destination autocomplete: distinct addresses from what's actually listed, so
// the landing box never suggests a place that doesn't exist here.
router.get('/suggestions', async (req, res, next) => {
  try {
    const q = queryString(req.query.q);
    if (q) {
      const [rows] = await pool.query(
        `SELECT DISTINCT address FROM properties
         WHERE archived = 0 AND address LIKE ?
         ORDER BY address
         LIMIT 8`,
        [`%${escapeLike(q)}%`]
      );
      return res.json(rows.map((r) => r.address));
    }
    const [rows] = await pool.query(
      `SELECT DISTINCT address FROM properties
       WHERE archived = 0
       ORDER BY address
       LIMIT 8`
    );
    return res.json(rows.map((r) => r.address));
  } catch (err) {
    return next(err);
  }
});

router.get('/mine', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${SELECT_ALL} WHERE p.owner_id = ?`, [req.user.id]);
    const occupied = await occupiedSet();
    const images = await imagesByPropertyIds(rows.map((p) => p.id));
    return res.json(rows.map((p) => toResponse(p, occupied.has(p.id), images.get(p.id), true)));
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await findById(req.params.id);
    if (!row) return res.status(404).json({ message: `Property not found with id ${req.params.id}` });
    const images = await imagesByPropertyIds([row.id]);
    return res.json(toResponse(row, await isOccupied(row.id), images.get(row.id), Boolean(req.user)));
  } catch (err) {
    return next(err);
  }
});

function pickPropertyFields(body) {
  return [
    body.lotName ?? null,
    body.address ?? null,
    body.price ?? null,
    body.lat ?? null,
    body.lng ?? null,
    body.availableUntil ?? null,
    body.securityDeposit ?? null,
    body.internet ?? null,
    body.electricityIncluded ?? null,
    body.waterIncluded ?? null,
    body.petsAllowed ?? null,
    body.smokingAllowed ?? null,
    body.modificationsAllowed ?? null,
  ];
}

router.post('/', async (req, res, next) => {
  let clientRequestId = null;
  try {
    const b = req.body || {};
    if (!b.lotName || !b.address || b.price == null || b.lat == null || b.lng == null) {
      return res.status(400).json({ message: 'lotName, address, price, lat and lng are required' });
    }
    const validationError = validatePropertyInput(b);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    if (b.clientRequestId != null) {
      if (typeof b.clientRequestId !== 'string' || b.clientRequestId.length > 64) {
        return res.status(400).json({ message: 'clientRequestId must be a string of 64 characters or fewer' });
      }
      clientRequestId = b.clientRequestId.trim() || null;
    }
    // A retry of an add that already reached the database returns the original
    // property instead of inserting a second one (lost response / double event).
    if (clientRequestId) {
      const existing = await findOwnedByClientRequestId(req.user.id, clientRequestId);
      if (existing) return await respondWithExisting(existing, res);
    }
    const [result] = await pool.query(
      `INSERT INTO properties
        (lot_name, address, price, lat, lng, owner_id, archived, available_until, security_deposit,
         internet, electricity_included, water_included, pets_allowed, smoking_allowed, modifications_allowed,
         client_request_id)
       VALUES (?, ?, ?, ?, ?, ?, FALSE, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.lotName, b.address, b.price, b.lat, b.lng, req.user.id,
        b.availableUntil ?? null, b.securityDeposit ?? null, b.internet ?? null,
        b.electricityIncluded ?? null, b.waterIncluded ?? null, b.petsAllowed ?? null,
        b.smokingAllowed ?? null, b.modificationsAllowed ?? null, clientRequestId]
    );
    const row = await findById(result.insertId);
    return res.json(toResponse(row, false, [], true));
  } catch (err) {
    // Concurrent double-submit: the unique index rejects the loser; return the
    // row the winning request inserted.
    if (clientRequestId && (err.errno === 1062 || err.code === 'ER_DUP_ENTRY')) {
      try {
        const existing = await findOwnedByClientRequestId(req.user.id, clientRequestId);
        if (existing) return await respondWithExisting(existing, res);
      } catch (lookupErr) {
        // Fall through to the original error if the lookup itself fails.
      }
    }
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const row = await findById(req.params.id);
    if (!row) return res.status(404).json({ message: `Property not found with id ${req.params.id}` });
    if (row.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not own this property' });
    }
    const b = req.body || {};
    const validationError = validatePropertyInput({ ...b, lotName: b.lotName ?? row.lot_name, address: b.address ?? row.address, price: b.price ?? row.price, lat: b.lat ?? row.lat, lng: b.lng ?? row.lng });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    // Price / availability locks: existing paid bookings were sold at the old
    // price and inside the old window, so they must not be silently rewritten.
    const [logs] = await pool.query(
      "SELECT start_date, end_date FROM rentallog WHERE property_id = ? AND UPPER(status) != 'ENDED'",
      [req.params.id]
    );
    if (logs.length > 0) {
      const newPrice = Number(b.price ?? row.price);
      if (Number(newPrice) !== Number(row.price)) {
        return res.status(409).json({
          message: 'Price cannot be changed while there are active or upcoming bookings. It applies to already-paid stays.',
        });
      }
      const newUntilRaw = b.availableUntil !== undefined ? b.availableUntil : row.available_until;
      if (newUntilRaw != null && newUntilRaw !== '') {
        const newUntil = parseDateOnly(newUntilRaw);
        if (newUntil) {
          const strands = logs.some((l) => {
            const end = parseDateOnly(l.end_date);
            // Open-ended (null end) bookings always extend past any new cutoff.
            if (!end) return true;
            return end > newUntil;
          });
          if (strands) {
            return res.status(409).json({
              message: 'availableUntil cannot be shortened past an existing booking. Cancel or wait out those bookings first.',
            });
          }
        }
      } else if (row.available_until != null) {
        // Clearing the cutoff is always safe (extends availability), so allow it.
      }
    }
    await pool.query(
      `UPDATE properties SET lot_name = ?, address = ?, price = ?, lat = ?, lng = ?,
        available_until = ?, security_deposit = ?, internet = ?,
        electricity_included = ?, water_included = ?, pets_allowed = ?,
        smoking_allowed = ?, modifications_allowed = ? WHERE id = ?`,
      [...pickPropertyFields(b), req.params.id]
    );
    const updated = await findById(req.params.id);
    const images = await imagesByPropertyIds([updated.id]);
    return res.json(toResponse(updated, await isOccupied(updated.id), images.get(updated.id), true));
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/archive', async (req, res, next) => {
  try {
    const row = await findById(req.params.id);
    if (!row) return res.status(404).json({ message: `Property not found with id ${req.params.id}` });
    if (row.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not own this property' });
    }
    await pool.query('UPDATE properties SET archived = TRUE WHERE id = ?', [req.params.id]);
    const updated = await findById(req.params.id);
    const archivedImages = await imagesByPropertyIds([updated.id]);
    return res.json(toResponse(updated, await isOccupied(updated.id), archivedImages.get(updated.id), true));
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/unarchive', async (req, res, next) => {
  try {
    const row = await findById(req.params.id);
    if (!row) return res.status(404).json({ message: `Property not found with id ${req.params.id}` });
    if (row.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not own this property' });
    }
    await pool.query('UPDATE properties SET archived = FALSE WHERE id = ?', [req.params.id]);
    const updated = await findById(req.params.id);
    const unarchivedImages = await imagesByPropertyIds([updated.id]);
    return res.json(toResponse(updated, await isOccupied(updated.id), unarchivedImages.get(updated.id), true));
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await findById(req.params.id);
    if (!row) return res.status(404).json({ message: `Property not found with id ${req.params.id}` });
    if (row.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'You do not own this property' });
    }
    const [logs] = await pool.query('SELECT id, start_date, end_date, status FROM rentallog WHERE property_id = ?', [
      req.params.id,
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pending = logs.find((l) => {
      if (String(l.status).toUpperCase() === 'ENDED') return false;
      if (!l.start_date) return false;
      return new Date(`${l.start_date}T00:00:00`) > today;
    });
    if (pending) {
      return res.status(409).json({
        message: `Cannot remove "${row.lot_name}": it has an upcoming booking (${pending.start_date} — ${pending.end_date || 'ongoing'}). Cancel that booking first.`,
      });
    }
    if (logs.length > 0) {
      return res.status(409).json({
        message: `Cannot permanently delete "${row.lot_name}" because it has booking history. Archive it instead to hide it from renters.`,
      });
    }
    // Photo rows must go first: the FK has no ON DELETE CASCADE, so the
    // property delete would be rejected while photos still reference it.
    let photoIds = [];
    try {
      const [photos] = await pool.query('SELECT public_id FROM property_images WHERE property_id = ?', [
        req.params.id,
      ]);
      photoIds = photos.map((p) => p.public_id);
      await pool.query('DELETE FROM property_images WHERE property_id = ?', [req.params.id]);
    } catch {
      // Photo cleanup must never block the delete itself.
    }
    await pool.query('DELETE FROM properties WHERE id = ?', [req.params.id]);
    // No orphans in the cloud either (best-effort, after the DB work lands).
    if (photoIds.length > 0) {
      // eslint-disable-next-line no-console
      await Promise.allSettled(photoIds.map((pid) => require('../services/cloudinary').destroy(pid))).then((results) => {
        results.forEach((r) => {
          if (r.status === 'rejected') console.warn('Cloudinary cleanup failed:', r.reason && r.reason.message);
        });
      });
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
