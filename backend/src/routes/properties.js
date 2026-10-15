const express = require('express');
const { pool } = require('../db');

const router = express.Router();

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function boolOrNull(v) {
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

function toResponse(row, occupied) {
  return {
    id: row.id,
    lotName: row.lot_name,
    address: row.address,
    price: Number(row.price),
    lat: Number(row.lat),
    lng: Number(row.lng),
    ownerId: row.owner_id,
    ownerName: row.owner_name || null,
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
  };
}

const SELECT_ALL = `
  SELECT p.*, u.name AS owner_name
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

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(SELECT_ALL);
    const occupied = await occupiedSet();
    return res.json(rows.map((p) => toResponse(p, occupied.has(p.id))));
  } catch (err) {
    return next(err);
  }
});

router.get('/available', async (req, res, next) => {
  try {
    const [rows] = await pool.query(SELECT_ALL);
    const occupied = await occupiedSet();
    return res.json(rows.filter((p) => !p.archived).map((p) => toResponse(p, occupied.has(p.id))));
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await findById(req.params.id);
    if (!row) return res.status(404).json({ message: `Property not found with id ${req.params.id}` });
    return res.json(toResponse(row, await isOccupied(row.id)));
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
  try {
    const b = req.body || {};
    if (!b.lotName || !b.address || b.price == null || b.lat == null || b.lng == null) {
      return res.status(400).json({ message: 'lotName, address, price, lat and lng are required' });
    }
    const [result] = await pool.query(
      `INSERT INTO properties
        (lot_name, address, price, lat, lng, owner_id, archived, available_until, security_deposit,
         internet, electricity_included, water_included, pets_allowed, smoking_allowed, modifications_allowed)
       VALUES (?, ?, ?, ?, ?, ?, FALSE, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.lotName, b.address, b.price, b.lat, b.lng, req.user.id,
        b.availableUntil ?? null, b.securityDeposit ?? null, b.internet ?? null,
        b.electricityIncluded ?? null, b.waterIncluded ?? null, b.petsAllowed ?? null,
        b.smokingAllowed ?? null, b.modificationsAllowed ?? null]
    );
    const row = await findById(result.insertId);
    return res.json(toResponse(row, false));
  } catch (err) {
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
    await pool.query(
      `UPDATE properties SET lot_name = ?, address = ?, price = ?, lat = ?, lng = ?,
        available_until = ?, security_deposit = ?, internet = ?,
        electricity_included = ?, water_included = ?, pets_allowed = ?,
        smoking_allowed = ?, modifications_allowed = ? WHERE id = ?`,
      [...pickPropertyFields(b), req.params.id]
    );
    const updated = await findById(req.params.id);
    return res.json(toResponse(updated, await isOccupied(updated.id)));
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
    return res.json(toResponse(updated, await isOccupied(updated.id)));
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
    return res.json(toResponse(updated, await isOccupied(updated.id)));
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
    await pool.query('DELETE FROM properties WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
