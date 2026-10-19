const jwt = require('jsonwebtoken');
const { pool } = require('../db');

function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production.');
  }
  return 'local-dev-only-do-not-use-in-prod';
}

function getExpirationMs() {
  const v = Number(process.env.JWT_EXPIRATION_MS || 86400000);
  return Number.isFinite(v) && v > 0 ? v : 86400000;
}

function signToken(userId, tokenVersion = 0) {
  return jwt.sign({ sub: String(userId), tv: Number(tokenVersion) || 0 }, getSecret(), {
    expiresIn: Math.floor(getExpirationMs() / 1000),
  });
}

function extractBearer(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

// Public routes: /api/auth/**, exact GET property reads, GET /health,
// and the PayMongo webhook (PayMongo has no JWT; verified by signature instead).
function isPublic(req) {
  if (req.path.startsWith('/api/auth/')) return true;
  if (req.method === 'POST' && req.path === '/api/payments/webhook') return true;
  if (req.method === 'GET' && req.path === '/health') return true;
  if (req.method !== 'GET') return false;
  if (req.path === '/api/properties' || req.path === '/api/properties/') return true;
  if (req.path === '/api/properties/available') return true;
  if (req.path === '/api/properties/search') return true;
  if (req.path === '/api/properties/suggestions') return true;
  if (req.path === '/api/properties/mine') return false; // owner-only, needs auth
  const m = req.path.match(/^\/api\/properties\/(\d+)\/?$/);
  if (m) return true;
  return false;
}

async function authMiddleware(req, res, next) {
  // Public routes still get optional auth: if a valid token rides along we
  // attach req.user so responses can include data that only members may see
  // (owner contact details). A missing/invalid/stale token simply means
  // "anonymous" here, never a 401.
  const publicRoute = isPublic(req);
  const token = extractBearer(req);
  if (!token) {
    if (publicRoute) return next();
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }
  let userId;
  let tokenVersion = 0;
  try {
    const payload = jwt.verify(token, getSecret());
    userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      if (publicRoute) return next();
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    tokenVersion = Number(payload.tv) || 0;
  } catch {
    if (publicRoute) return next();
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, token_version FROM users WHERE id = ? LIMIT 1', [userId]);
    if (rows.length === 0) {
      if (publicRoute) return next();
      return res.status(401).json({ message: 'User not found' });
    }
    const user = rows[0];
    if (Number(user.token_version) !== tokenVersion) {
      if (publicRoute) return next();
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { signToken, authMiddleware, extractBearer };
