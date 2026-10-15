const express = require('express');
const argon2 = require('argon2');
const { pool } = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
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
    const token = signToken(email);
    return res.json({ token, name, id: result.insertId });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const [rows] = await pool.query('SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1', [email]);
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
    const token = signToken(user.email);
    return res.json({ token, name: user.name, id: user.id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
