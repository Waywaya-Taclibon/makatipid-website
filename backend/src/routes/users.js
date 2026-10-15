const express = require('express');
const { pool } = require('../db');

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
    const { name, email } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    const [conflict] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, req.user.id]);
    if (conflict.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);
    const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
