const express = require('express');
const { pool } = require('../db');
const paymongo = require('../services/paymongo');
const { wholeMonths, rangesOverlap, parseDateOnly, toDateOnlyString, manilaTodayDateOnly, toDateTimeString, HOLD_MINUTES } = require('../utils/pricing');

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

async function fetchBookingRow(conn, id) {
  const query = conn.query || pool.query.bind(pool);
  const [rows] = await query(
    `SELECT r.id AS log_id, r.status, r.start_date, r.end_date, r.property_id, r.renter_id,
            p.lot_name, p.address, p.price, p.lat, p.lng,
            o.name AS owner_name, u.name AS renter_name
     FROM rentallog r
     JOIN properties p ON p.id = r.property_id
     LEFT JOIN users o ON o.id = p.owner_id
     LEFT JOIN users u ON u.id = r.renter_id
     WHERE r.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

function expectedAmountCentavos(price, start, end) {
  return Math.round(Number(price) * wholeMonths(start, end) * 100);
}

// Active (non-expired) PENDING holds for a property, used to block double-booking
// while another renter is still at the QR step. The cutoff is computed in the
// app (not NOW()) so DB/server time-zone differences can't skew the 5 minutes.
async function findBlockingHold(propertyId, start, end, ignoreIntentId) {
  const cutoff = toDateTimeString(new Date(Date.now() - HOLD_MINUTES * 60 * 1000));
  const [holds] = await pool.query(
    `SELECT intent_id, start_date, end_date, created_at FROM payments
     WHERE property_id = ? AND status = 'PENDING' AND created_at > ?`,
    [propertyId, cutoff]
  );
  return holds.find((h) => {
    if (ignoreIntentId && h.intent_id === ignoreIntentId) return false;
    return rangesOverlap(start, end, parseDateOnly(h.start_date), parseDateOnly(h.end_date));
  });
}

async function findBookingConflict(propertyId, start, end) {
  const [existing] = await pool.query('SELECT start_date, end_date, status FROM rentallog WHERE property_id = ?', [
    propertyId,
  ]);
  return existing.find((log) => {
    if (String(log.status).toUpperCase() === 'ENDED') return false;
    return rangesOverlap(start, end, parseDateOnly(log.start_date), parseDateOnly(log.end_date));
  });
}

function conflictMessage(conflict) {
  return `Property is already booked for those dates (${conflict.start_date} — ${conflict.end_date || 'ongoing'}). Please pick another range.`;
}

// Shared fulfill path used by both confirm + webhook: idempotent, transactional,
// verifies PayMongo status + amount, then creates the booking exactly once.
async function fulfillSucceededIntent(intentData, renterId) {
  const attrs = intentData.attributes || {};
  const meta = attrs.metadata || {};
  if (String(meta.renterId) !== String(renterId)) {
    const err = new Error('This payment does not belong to your account.');
    err.status = 403;
    throw err;
  }
  if (String(attrs.status).toLowerCase() !== 'succeeded') {
    const reason =
      (attrs.last_payment_error && (attrs.last_payment_error.failed_message || attrs.last_payment_error.message)) ||
      '';
    const err = new Error(`Payment did not succeed (status: ${attrs.status || ''}).${reason ? ` ${reason}` : ''}`);
    err.status = 409;
    throw err;
  }

  const propertyId = Number(meta.propertyId);
  const start = parseDateOnly(meta.startDate);
  const end = parseDateOnly(meta.endDate);
  if (!propertyId || !start || !end) {
    const err = new Error('Payment metadata is incomplete.');
    err.status = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Lock the property row so two concurrent confirms serialize here.
    const [props] = await conn.query('SELECT id, lot_name, price, archived, owner_id, available_until FROM properties WHERE id = ? FOR UPDATE', [
      propertyId,
    ]);
    if (props.length === 0) {
      const err = new Error('Property not found');
      err.status = 404;
      throw err;
    }
    if (props[0].archived) {
      const err = new Error('This property is archived and no longer available for booking.');
      err.status = 409;
      throw err;
    }
    if (Number(props[0].owner_id) === Number(renterId)) {
      const err = new Error('You cannot book your own property.');
      err.status = 403;
      throw err;
    }
    if (props[0].available_until) {
      const until = parseDateOnly(props[0].available_until);
      if (until && end > until) {
        const err = new Error('This booking extends past the property availability window.');
        err.status = 409;
        throw err;
      }
    }
    // Lock our ledger row for this intent.
    const [payRows] = await conn.query('SELECT * FROM payments WHERE intent_id = ? FOR UPDATE', [intentData.id]);
    const payment = payRows[0] || null;
    // Idempotency: already fulfilled -> return the existing booking.
    if (payment && payment.status === 'SUCCEEDED' && payment.booking_id) {
      const row = await fetchBookingRow(conn, payment.booking_id);
      await conn.commit();
      return { booking: toBookingResponse(row), duplicate: true };
    }
    // Amount check: PayMongo amount must equal server-side pricing.
    const expected = expectedAmountCentavos(props[0].price, start, end);
    const paidAmount = Number(attrs.amount);
    const recordedAmount = payment ? Number(payment.amount_centavos) : expected;
    if (paidAmount !== expected || recordedAmount !== expected) {
      if (payment) {
        await conn.query("UPDATE payments SET status = 'FAILED' WHERE intent_id = ?", [intentData.id]);
      }
      await conn.commit();
      const err = new Error(`Paid amount does not match the booking price (expected ${expected} centavos).`);
      err.status = 409;
      throw err;
    }
    // Conflict check inside the transaction (race-safe).
    const [existing] = await conn.query(
      'SELECT start_date, end_date, status FROM rentallog WHERE property_id = ? FOR UPDATE',
      [propertyId]
    );
    const conflict = existing.find((log) => {
      if (String(log.status).toUpperCase() === 'ENDED') return false;
      return rangesOverlap(start, end, parseDateOnly(log.start_date), parseDateOnly(log.end_date));
    });
    if (conflict) {
      // Paid but no room: flag for manual refund instead of silently dropping money.
      if (payment) {
        await conn.query("UPDATE payments SET status = 'NEEDS_ATTENTION' WHERE intent_id = ?", [intentData.id]);
      }
      await conn.commit();
      const err = new Error(
        `Payment succeeded but ${conflictMessage(conflict)} Our team will review this payment for a refund.`
      );
      err.status = 409;
      throw err;
    }
    const [result] = await conn.query(
      "INSERT INTO rentallog (property_id, renter_id, start_date, end_date, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
      [propertyId, renterId, toDateOnlyString(start), toDateOnlyString(end)]
    );
    if (payment) {
      await conn.query("UPDATE payments SET status = 'SUCCEEDED', booking_id = ? WHERE intent_id = ?", [
        result.insertId,
        intentData.id,
      ]);
    } else {
      // Webhook/intent created before the ledger existed: record it now.
      await conn.query(
        `INSERT INTO payments (intent_id, property_id, renter_id, amount_centavos, status, start_date, end_date, booking_id)
         VALUES (?, ?, ?, ?, 'SUCCEEDED', ?, ?, ?)`,
        [intentData.id, propertyId, renterId, expected, toDateOnlyString(start), toDateOnlyString(end), result.insertId]
      );
    }
    const row = await fetchBookingRow(conn, result.insertId);
    await conn.commit();
    return { booking: toBookingResponse(row), duplicate: false };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    conn.release();
  }
}

// POST /api/payments/intents — validate + price server-side, return intent for frontend.
router.post('/intents', async (req, res, next) => {
  try {
    if (!paymongo.isConfigured()) {
      return res.status(503).json({ message: 'Online payment is not configured on the server (missing PayMongo secret key).' });
    }
    const { propertyId, startDate, endDate } = req.body || {};
    const [props] = await pool.query('SELECT id, lot_name, price, archived, owner_id, available_until FROM properties WHERE id = ? LIMIT 1', [
      propertyId,
    ]);
    if (props.length === 0) return res.status(404).json({ message: 'Property not found' });
    const property = props[0];
    if (property.archived) {
      return res.status(409).json({ message: 'This property is archived and no longer available for booking.' });
    }
    if (Number(property.owner_id) === Number(req.user.id)) {
      return res.status(403).json({ message: 'You cannot book your own property.' });
    }

    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end || end < start) {
      return res.status(400).json({ message: 'Invalid rental period.' });
    }
    if (start < manilaTodayDateOnly()) {
      return res.status(400).json({ message: 'Start date cannot be in the past.' });
    }
    if (property.available_until) {
      const until = parseDateOnly(property.available_until);
      if (until && end > until) {
        return res.status(400).json({ message: 'Booking extends past the property availability window.' });
      }
    }

    const conflict = await findBookingConflict(property.id, start, end);
    if (conflict) {
      return res.status(409).json({ message: conflictMessage(conflict) });
    }
    const hold = await findBlockingHold(property.id, start, end, null);
    if (hold) {
      return res.status(409).json({
        message: 'Someone is currently paying for overlapping dates. Please try again in a few minutes.',
      });
    }

    const amountCentavos = expectedAmountCentavos(property.price, start, end);

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

    // Record the hold so a second renter can't start paying for the same dates.
    await pool.query(
      `INSERT INTO payments (intent_id, property_id, renter_id, amount_centavos, status, start_date, end_date)
       VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
      [intent.id, property.id, req.user.id, amountCentavos, toDateOnlyString(start), toDateOnlyString(end)]
    );

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
    const { booking } = await fulfillSucceededIntent(data, req.user.id);
    return res.json(booking);
  } catch (err) {
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    return res.status(status).json({ message: err.message || 'Payment confirmation failed' });
  }
});

// POST /api/payments/webhook — PayMongo event source of truth (no JWT; signature-verified).
// Handles pay+close-tab: creates the booking even when the browser is gone.
router.post('/webhook', async (req, res) => {
  const rawBody = req.body; // Buffer thanks to express.raw in server.js
  const signature = req.headers['paymongo-signature'];
  if (!paymongo.webhookSecret()) {
    return res.status(503).json({ message: 'Payment webhook is not configured.' });
  }
  const check = paymongo.verifyWebhookSignature(rawBody, signature);
  if (!check.ok) {
    return res.status(401).json({ message: `Invalid webhook signature (${check.reason}).` });
  }
  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch {
    return res.status(400).json({ message: 'Invalid webhook payload.' });
  }
  // Extract the payment intent id from the event; shapes vary by event type.
  const eventData = (event && event.data) || {};
  const eventAttrs = eventData.attributes || {};
  const inner = eventAttrs.data || {};
  const intentId =
    (inner && inner.id) || (eventAttrs.data && eventAttrs.data.id) || eventAttrs.payment_intent_id || null;
  const eventType = eventAttrs.type || event.type || '';
  if (!intentId) {
    // Acknowledge non-payment events without error so PayMongo stops retrying.
    return res.json({ received: true });
  }
  const isSuccessHint = /succeeded|paid|success/i.test(String(eventType));
  try {
    // Ground truth always comes from the API, never from the webhook body alone.
    const intent = await paymongo.retrievePaymentIntent(intentId);
    const meta = (intent.attributes || {}).metadata || {};
    const renterId = Number(meta.renterId);
    if (!renterId) return res.json({ received: true });
    if (String(intent.attributes.status).toLowerCase() !== 'succeeded') {
      if (isSuccessHint) {
        await pool.query("UPDATE payments SET status = 'FAILED' WHERE intent_id = ?", [intentId]);
      }
      return res.json({ received: true });
    }
    await fulfillSucceededIntent(intent, renterId);
    return res.json({ received: true });
  } catch (e) {
    // 409 NEEDS_ATTENTION etc. is recorded in the ledger; acknowledge so PayMongo
    // doesn't retry, since retrying won't change a date conflict.
    if (e.status === 409 || e.status === 403 || e.status === 404) {
      return res.json({ received: true });
    }
    return res.status(502).json({ message: e.message || 'Webhook processing failed' });
  }
});

module.exports = router;
