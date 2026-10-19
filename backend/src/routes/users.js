const express = require('express');
const argon2 = require('argon2');
const { pool } = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

const MAX_PHONE_LEN = 32;
const MAX_SOCIAL_LEN = 255;

// Owner contact fields are optional. `undefined` means "not part of this
// request" (leave the stored value alone); null/'' means "clear it".
// Returns { ok, provided, value } or { ok: false, message }.
function normalizePhone(raw) {
  if (raw === undefined) return { ok: true, provided: false, value: null };
  if (raw === null) return { ok: true, provided: true, value: null };
  const value = String(raw).trim();
  if (value === '') return { ok: true, provided: true, value: null };
  if (value.length > MAX_PHONE_LEN) {
    return { ok: false, message: `Phone must be ${MAX_PHONE_LEN} characters or fewer` };
  }
  if (!/^[0-9+()\-.\s]+$/.test(value)) {
    return { ok: false, message: 'Phone can only contain digits, spaces and + ( ) - .' };
  }
  if (value.replace(/\D/g, '').length < 7) {
    return { ok: false, message: 'Please enter a complete phone number' };
  }
  return { ok: true, provided: true, value };
}

function normalizeSocial(raw, label) {
  if (raw === undefined) return { ok: true, provided: false, value: null };
  if (raw === null) return { ok: true, provided: true, value: null };
  const value = String(raw).trim();
  if (value === '') return { ok: true, provided: true, value: null };
  if (value.length > MAX_SOCIAL_LEN) {
    return { ok: false, message: `${label} must be ${MAX_SOCIAL_LEN} characters or fewer` };
  }
  if (/\s/.test(value)) {
    return { ok: false, message: `${label} cannot contain spaces` };
  }
  return { ok: true, provided: true, value };
}

router.get('/me', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, phone, facebook, instagram FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.put('/me', async (req, res, next) => {
  try {
    const { name, currentPassword } = req.body || {};
    const email = typeof (req.body && req.body.email) === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    const phone = normalizePhone(req.body && req.body.phone);
    if (!phone.ok) return res.status(400).json({ message: phone.message });
    const facebook = normalizeSocial(req.body && req.body.facebook, 'Facebook');
    if (!facebook.ok) return res.status(400).json({ message: facebook.message });
    const instagram = normalizeSocial(req.body && req.body.instagram, 'Instagram');
    if (!instagram.ok) return res.status(400).json({ message: instagram.message });

    const [current] = await pool.query(
      'SELECT id, name, email, password, token_version, phone, facebook, instagram FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    if (current.length === 0) return res.status(404).json({ message: 'User not found' });
    const me = current[0];
    // Absent fields keep their stored value so callers like Account Settings,
    // which only send name/email, can't accidentally wipe the contact info.
    const nextPhone = phone.provided ? phone.value : (me.phone ?? null);
    const nextFacebook = facebook.provided ? facebook.value : (me.facebook ?? null);
    const nextInstagram = instagram.provided ? instagram.value : (me.instagram ?? null);
    const emailChanged = String(me.email).trim().toLowerCase() !== email;
    if (emailChanged) {
      // Email change takes over the account identity: require proof of ownership.
      if (!currentPassword) {
        return res.status(400).json({ message: 'Please enter your current password to change your email.' });
      }
      let ok = false;
      try {
        ok = await argon2.verify(me.password, String(currentPassword));
      } catch {
        ok = false;
      }
      if (!ok) {
        return res.status(403).json({ message: 'Current password is incorrect.' });
      }
    }
    const [conflict] = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ? LIMIT 1', [email, req.user.id]);
    if (conflict.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    // Bump token_version only on email change so name-only edits keep existing sessions.
    // A fresh token is returned so this device stays logged in instead of 401ing.
    if (emailChanged) {
      await pool.query(
        'UPDATE users SET name = ?, email = ?, phone = ?, facebook = ?, instagram = ?, token_version = token_version + 1 WHERE id = ?',
        [name, email, nextPhone, nextFacebook, nextInstagram, req.user.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = ?, phone = ?, facebook = ?, instagram = ? WHERE id = ?',
        [name, nextPhone, nextFacebook, nextInstagram, req.user.id]
      );
    }
    const [rows] = await pool.query(
      'SELECT id, name, email, role, phone, facebook, instagram, token_version FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const updated = rows[0];
    const token = signToken(updated.id, Number(updated.token_version) || 0);
    return res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      phone: updated.phone ?? null,
      facebook: updated.facebook ?? null,
      instagram: updated.instagram ?? null,
      token,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
