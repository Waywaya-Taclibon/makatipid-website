const express = require('express');
const { pool } = require('../db');
const { parseDateOnly, toDateOnlyString, manilaTodayDateOnly } = require('../utils/pricing');

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

// Legacy direct booking is disabled: all bookings must go through the paid
// PayMongo flow (POST /api/payments/intents -> confirm). This route previously
// allowed any authenticated user to create an ACTIVE booking without paying.
router.post('/', async (req, res) => {
  return res.status(410).json({
    message: 'Direct booking is disabled. Please book through the payment flow.',
  });
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
    // Owners see full rows; other renters only get date ranges for conflict
    // checking (no renter names/ids).
    const [props] = await pool.query('SELECT owner_id FROM properties WHERE id = ? LIMIT 1', [
      req.params.propertyId,
    ]);
    if (props.length === 0) return res.status(404).json({ message: 'Property not found' });
    const isOwner = props[0].owner_id === req.user.id;
    const [rows] = await pool.query(`${SELECT_JOIN} WHERE r.property_id = ?`, [req.params.propertyId]);
    if (isOwner) {
      return res.json(rows.map(toResponse));
    }
    return res.json(
      rows.map((r) => ({
        startDate: toDateOnlyString(r.start_date),
        endDate: r.end_date ? toDateOnlyString(r.end_date) : null,
        status: r.status,
        propertyId: r.property_id,
      }))
    );
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/end', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, p.owner_id
       FROM rentallog r
       JOIN properties p ON p.id = r.property_id
       WHERE r.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Rental log not found' });
    if (rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the property owner can end this booking.' });
    }
    // App-computed Manila date instead of CURDATE() so the rule matches the
    // rest of the app regardless of the DB server time zone.
    await pool.query('UPDATE rentallog SET status = \'ENDED\', end_date = ? WHERE id = ?', [toDateOnlyString(manilaTodayDateOnly()), req.params.id]);
    const row = await fetchLog(req.params.id);
    return res.json(toResponse(row));
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, renter_id, start_date, end_date FROM rentallog WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });
    const log = rows[0];
    if (log.renter_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only cancel your own bookings.' });
    }
    // Cancellation is only allowed before the stay starts: cancelling a booking
    // that already started would free the dates while the money stays captured.
    const start = parseDateOnly(log.start_date);
    if (start && start <= manilaTodayDateOnly()) {
      return res.status(409).json({ message: 'This booking has already started and cannot be cancelled. Please contact the property owner.' });
    }
    if (log.end_date) {
      const end = parseDateOnly(log.end_date);
      if (end && end < manilaTodayDateOnly()) {
        return res.status(409).json({ message: 'This booking has already ended and cannot be cancelled.' });
      }
    }
    await pool.query('DELETE FROM rentallog WHERE id = ?', [req.params.id]);
    // Keep the payment ledger consistent: a cancelled booking's payment leaves
    // SUCCEEDED so it can be picked up for a refund review.
    try {
      await pool.query("UPDATE payments SET status = 'CANCELLED' WHERE booking_id = ?", [req.params.id]);
    } catch {
      // Ledger table may not exist on very old installs — booking delete still wins.
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
