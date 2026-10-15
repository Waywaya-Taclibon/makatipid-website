const jwt = require('jsonwebtoken');
const { pool } = require('../db');

function getSecret() {
  return process.env.JWT_SECRET || 'local-dev-only-do-not-use-in-prod';
}

function getExpirationMs() {
  const v = Number(process.env.JWT_EXPIRATION_MS || 86400000);
  return Number.isFinite(v) && v > 0 ? v : 86400000;
}

function signToken(email) {
  return jwt.sign({ sub: email }, getSecret(), {
    expiresIn: Math.floor(getExpirationMs() / 1000),
  });
}

function extractBearer(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

// Public routes: /api/auth/** and GET /api/properties/**
function isPublic(req) {
  if (req.path.startsWith('/api/auth/')) return true;
  if (req.method === 'GET' && req.path.startsWith('/api/properties')) return true;
  if (req.method === 'GET' && req.path === '/health') return true;
  return false;
}

async function authMiddleware(req, res, next) {
  if (isPublic(req)) return next();
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  let email;
  try {
    const payload = jwt.verify(token, getSecret());
    email = payload.sub;
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  try {
    const [rows] = await pool.query('SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'User not found' });
    req.user = rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { signToken, authMiddleware, extractBearer };
