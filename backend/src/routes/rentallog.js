const express = require('express');
const { pool } = require('../db');
const { rangesOverlap, parseDateOnly, toDateOnlyString, todayDateOnly } = require('../utils/pricing');

const router = express.Router();

function toResponse(row) {
  return {
    id: row.log_id,
    status: row.status,
    startDate: toDateOnlyString(row.start_date),
    endDate: row.end_date ? toDateOnlyString(row.end_date) : null,
    propertyId: row.property_id,
    lotName: row.lot_name,
    address: row.address,
    price: Number(row.price),
    lat: Number(row.lat),
    lng: Number(row.lng),
    ownerName: row.owner_name || null,
    renterId: row.renter_id,
    renterName: row.renter_name || null,
  };
}

const SELECT_JOIN = `
  SELECT r.id AS log_id, r.status, r.start_date, r.end_date,
         r.property_id, r.renter_id,
         p.lot_name, p.address, p.price, p.lat, p.lng,
         o.name AS owner_name, u.name AS renter_name
  FROM rentallog r
  JOIN properties p ON p.id = r.property_id
  LEFT JOIN users o ON o.id = p.owner_id
  LEFT JOIN users u ON u.id = r.renter_id
`;

async function fetchLog(id) {
  const [rows] = await pool.query(`${SELECT_JOIN} WHERE r.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

router.post('/', async (req, res, next) => {
  try {
    const { propertyId, startDate, endDate } = req.body || {};
    if (propertyId == null) {
      return res.status(400).json({ message: 'propertyId is required' });
    }
    const [props] = await pool.query('SELECT id, lot_name, archived FROM properties WHERE id = ? LIMIT 1', [propertyId]);
    if (props.length === 0) return res.status(404).json({ message: 'Property not found' });
    if (props[0].archived) {
      return res.status(409).json({ message: 'This property is archived and no longer available for booking.' });
    }

    const newStart = parseDateOnly(startDate) || todayDateOnly();
    const newEnd = parseDateOnly(endDate);

    const [existing] = await pool.query('SELECT start_date, end_date, status FROM rentallog WHERE property_id = ?', [
      propertyId,
    ]);
    const conflict = existing.find((log) => {
      if (String(log.status).toUpperCase() === 'ENDED') return false;
      return rangesOverlap(newStart, newEnd, parseDateOnly(log.start_date), parseDateOnly(log.end_date));
    });
    if (conflict) {
      return res.status(409).json({
        message: `Property is already booked for those dates (${conflict.start_date} — ${conflict.end_date || 'ongoing'}). Please pick another range.`,
      });
    }

    const [result] = await pool.query(
      "INSERT INTO rentallog (property_id, renter_id, start_date, end_date, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
      [propertyId, req.user.id, toDateOnlyString(newStart), newEnd ? toDateOnlyString(newEnd) : null]
    );
    const row = await fetchLog(result.insertId);
    return res.json(toResponse(row));
  } catch (err) {
    return next(err);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${SELECT_JOIN} WHERE r.renter_id = ?`, [req.user.id]);
    return res.json(rows.map(toResponse));
  } catch (err) {
    return next(err);
  }
});

router.get('/property/:propertyId', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${SELECT_JOIN} WHERE r.property_id = ?`, [req.params.propertyId]);
    return res.json(rows.map(toResponse));
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/end', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id FROM rentallog WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Rental log not found' });
    await pool.query("UPDATE rentallog SET status = 'ENDED', end_date = CURDATE() WHERE id = ?", [req.params.id]);
    const row = await fetchLog(req.params.id);
    return res.json(toResponse(row));
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, renter_id, end_date FROM rentallog WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });
    const log = rows[0];
    if (log.renter_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only cancel your own bookings.' });
    }
    if (log.end_date) {
      const end = parseDateOnly(log.end_date);
      if (end && end < todayDateOnly()) {
        return res.status(409).json({ message: 'This booking has already ended and cannot be cancelled.' });
      }
    }
    await pool.query('DELETE FROM rentallog WHERE id = ?', [req.params.id]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
