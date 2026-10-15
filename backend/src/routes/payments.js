const express = require('express');
const { pool } = require('../db');
const paymongo = require('../services/paymongo');
const { wholeMonths, rangesOverlap, parseDateOnly, toDateOnlyString, todayDateOnly } = require('../utils/pricing');

const router = express.Router();

function toBookingResponse(row) {
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

// POST /api/payments/intents — validate + price server-side, return intent for frontend.
router.post('/intents', async (req, res, next) => {
  try {
    if (!paymongo.isConfigured()) {
      return res.status(503).json({ message: 'Online payment is not configured on the server (missing PayMongo secret key).' });
    }
    const { propertyId, startDate, endDate } = req.body || {};
    const [props] = await pool.query('SELECT id, lot_name, price, archived FROM properties WHERE id = ? LIMIT 1', [
      propertyId,
    ]);
    if (props.length === 0) return res.status(404).json({ message: 'Property not found' });
    const property = props[0];
    if (property.archived) {
      return res.status(409).json({ message: 'This property is archived and no longer available for booking.' });
    }

    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end || end < start) {
      return res.status(400).json({ message: 'Invalid rental period.' });
    }
    if (start < todayDateOnly()) {
      return res.status(400).json({ message: 'Start date cannot be in the past.' });
    }

    const [existing] = await pool.query('SELECT start_date, end_date, status FROM rentallog WHERE property_id = ?', [
      property.id,
    ]);
    const conflict = existing.find((log) => {
      if (String(log.status).toUpperCase() === 'ENDED') return false;
      return rangesOverlap(start, end, parseDateOnly(log.start_date), parseDateOnly(log.end_date));
    });
    if (conflict) {
      return res.status(409).json({
        message: `Property is already booked for those dates (${conflict.start_date} — ${conflict.end_date || 'ongoing'}). Please pick another range.`,
      });
    }

    const months = wholeMonths(start, end);
    // DECIMAL price may come back as string; use integer-centavos math like the old BigDecimal logic.
    const priceNum = Number(property.price);
    const amountCentavos = Math.round(priceNum * months * 100);

    let intent;
    try {
      intent = await paymongo.createPaymentIntent(amountCentavos, `Rental booking: ${property.lot_name}`, {
        propertyId: String(property.id),
        renterId: String(req.user.id),
        startDate: toDateOnlyString(start),
        endDate: toDateOnlyString(end),
      });
    } catch (e) {
      return res.status(e.status || 502).json({ message: e.message });
    }

    return res.json({
      intentId: intent.id,
      clientKey: intent.attributes && intent.attributes.client_key,
      amountCentavos,
      keyMode: paymongo.keyMode(),
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/payments/intents/:intentId — live status for QR polling (ownership-checked).
router.get('/intents/:intentId', async (req, res, next) => {
  try {
    let data;
    try {
      data = await paymongo.retrievePaymentIntent(req.params.intentId);
    } catch (e) {
      return res.status(e.status || 502).json({ message: e.message });
    }
    const attrs = data.attributes || {};
    const meta = attrs.metadata || {};
    if (String(meta.renterId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This payment does not belong to your account.' });
    }
    return res.json({ status: attrs.status || '' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/payments/intents/:intentId/confirm — verify success, then create the booking.
router.post('/intents/:intentId/confirm', async (req, res, next) => {
  try {
    let data;
    try {
      data = await paymongo.retrievePaymentIntent(req.params.intentId);
    } catch (e) {
      return res.status(e.status || 502).json({ message: e.message });
    }
    const attrs = data.attributes || {};
    const meta = attrs.metadata || {};
    if (String(meta.renterId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'This payment does not belong to your account.' });
    }
    const status = attrs.status || '';
    if (status.toLowerCase() !== 'succeeded') {
      const reason =
        (attrs.last_payment_error && (attrs.last_payment_error.failed_message || attrs.last_payment_error.message)) ||
        '';
      return res
        .status(409)
        .json({ message: `Payment did not succeed (status: ${status}).${reason ? ` ${reason}` : ''}` });
    }

    const propertyId = Number(meta.propertyId);
    const start = parseDateOnly(meta.startDate);
    const end = parseDateOnly(meta.endDate);
    if (!propertyId || !start || !end) {
      return res.status(400).json({ message: 'Payment metadata is incomplete.' });
    }

    // Re-check conflict inside the booking insert path (race-safe).
    const [props] = await pool.query('SELECT id, archived FROM properties WHERE id = ? LIMIT 1', [propertyId]);
    if (props.length === 0) return res.status(404).json({ message: 'Property not found' });
    if (props[0].archived) {
      return res.status(409).json({ message: 'This property is archived and no longer available for booking.' });
    }
    const [existing] = await pool.query('SELECT start_date, end_date, status FROM rentallog WHERE property_id = ?', [
      propertyId,
    ]);
    const conflict = existing.find((log) => {
      if (String(log.status).toUpperCase() === 'ENDED') return false;
      return rangesOverlap(start, end, parseDateOnly(log.start_date), parseDateOnly(log.end_date));
    });
    if (conflict) {
      return res.status(409).json({
        message: `Property is already booked for those dates (${conflict.start_date} — ${conflict.end_date || 'ongoing'}). Please pick another range.`,
      });
    }

    const [result] = await pool.query(
      "INSERT INTO rentallog (property_id, renter_id, start_date, end_date, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
      [propertyId, req.user.id, toDateOnlyString(start), toDateOnlyString(end)]
    );
    const [rows] = await pool.query(
      `SELECT r.id AS log_id, r.status, r.start_date, r.end_date, r.property_id, r.renter_id,
              p.lot_name, p.address, p.price, p.lat, p.lng,
              o.name AS owner_name, u.name AS renter_name
       FROM rentallog r
       JOIN properties p ON p.id = r.property_id
       LEFT JOIN users o ON o.id = p.owner_id
       LEFT JOIN users u ON u.id = r.renter_id
       WHERE r.id = ? LIMIT 1`,
      [result.insertId]
    );
    return res.json(toBookingResponse(rows[0]));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
