const express = require('express');
const argon2 = require('argon2');
const { pool } = require('../db');
const { signToken } = require('../middleware/auth');
const { isDemoEnabled, prepareDemoSession } = require('../demo');

const router = express.Router();

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, password } = req.body || {};
    const email = normalizeEmail(req.body && req.body.email);
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const [existing] = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    const hash = await argon2.hash(String(password));
    const [result] = await pool.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [
      name,
      email,
      hash,
      'USER',
    ]);
    const token = signToken(result.insertId, 0);
    return res.json({ token, name, id: result.insertId });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { password } = req.body || {};
    const email = normalizeEmail(req.body && req.body.email);
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const [rows] = await pool.query('SELECT id, name, email, password, token_version, is_active FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const user = rows[0];
    let ok = false;
    try {
      ok = await argon2.verify(user.password, String(password));
    } catch {
      ok = false;
    }
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!Number(user.is_active)) {
      return res.status(403).json({ message: 'This account has been suspended.' });
    }
    const token = signToken(user.id, Number(user.token_version) || 0);
    return res.json({ token, name: user.name, id: user.id });
  } catch (err) {
    return next(err);
  }
});

// One-click demo: mints a token for a shared, seeded demo account. No password
// is involved and no credentials are exposed. Disabled entirely when
// DEMO_LOGIN_ENABLED=false (both this endpoint and the UI buttons).
router.post('/demo', async (req, res, next) => {
  try {
    if (!isDemoEnabled()) {
      return res.status(404).json({ message: 'Demo login is not available.' });
    }
    const role = req.body && req.body.role === 'renter' ? 'renter' : 'owner';
    const ids = await prepareDemoSession();
    const userId = ids[role];
    const [rows] = await pool.query('SELECT id, name, token_version FROM users WHERE id = ? LIMIT 1', [userId]);
    if (rows.length === 0) {
      return res.status(500).json({ message: 'Demo account is unavailable. Please try again.' });
    }
    const user = rows[0];
    const token = signToken(user.id, Number(user.token_version) || 0);
    return res.json({ token, name: user.name, id: user.id, demo: true, role });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
