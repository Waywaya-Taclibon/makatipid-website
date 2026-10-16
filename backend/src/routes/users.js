const express = require('express');
const argon2 = require('argon2');
const { pool } = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

router.get('/me', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1', [req.user.id]);
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
    const [current] = await pool.query('SELECT id, name, email, password, token_version FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (current.length === 0) return res.status(404).json({ message: 'User not found' });
    const me = current[0];
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
      await pool.query('UPDATE users SET name = ?, email = ?, token_version = token_version + 1 WHERE id = ?', [name, email, req.user.id]);
    } else {
      await pool.query('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    }
    const [rows] = await pool.query('SELECT id, name, email, role, token_version FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const updated = rows[0];
    const token = signToken(updated.id, Number(updated.token_version) || 0);
    return res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, token });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
