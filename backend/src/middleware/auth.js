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

// `options.expiresInSeconds` overrides the default session length (admin
// sessions are shorter). `options.scope` marks a token as admin-only, so a
// normal site session can never be replayed against /api/admin/*.
function signToken(userId, tokenVersion = 0, options = {}) {
  const payload = { sub: String(userId), tv: Number(tokenVersion) || 0 };
  if (options.scope) payload.scope = String(options.scope);
  const requested = Number(options.expiresInSeconds);
  const expiresIn =
    Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : Math.floor(getExpirationMs() / 1000);
  return jwt.sign(payload, getSecret(), { expiresIn });
}

function extractBearer(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

// Public routes: /api/auth/**, exact GET property reads, the GET /health
// probes, and the PayMongo webhook (PayMongo has no JWT; verified by signature
// instead).
function isPublic(req) {
  if (req.path.startsWith('/api/auth/')) return true;
  if (req.method === 'POST' && req.path === '/api/payments/webhook') return true;
  if (req.method === 'GET' && (req.path === '/health' || req.path === '/health/db')) return true;
  if (req.method === 'GET' && req.path === '/api/config') return true;
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
    const [rows] = await pool.query(
      'SELECT id, name, email, role, token_version, is_demo, is_active FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (rows.length === 0) {
      if (publicRoute) return next();
      return res.status(401).json({ message: 'User not found' });
    }
    const user = rows[0];
    // A suspension is enforced on every request, so existing tokens die with it
    // (banning also bumps token_version, this is the belt-and-braces check).
    if (!Number(user.is_active)) {
      if (publicRoute) return next();
      return res.status(401).json({ message: 'This account has been suspended.' });
    }
    if (Number(user.token_version) !== tokenVersion) {
      if (publicRoute) return next();
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role, isDemo: Boolean(user.is_demo) };
    return next();
  } catch (err) {
    return next(err);
  }
}

// Admin gate. Missing, invalid, expired, non-admin and wrong-scope tokens all
// get a plain 404 so probing clients cannot tell /api/admin apart from a path
// that does not exist. Only tokens minted by POST /api/admin/login carry
// scope="admin" (or the short-lived "admin_setup" used to set the first
// password), so an ordinary site session can never reach these routes.
async function requireAdmin(req, res, next) {
  const token = extractBearer(req);
  if (!token) return res.status(404).json({ message: 'Not found' });

  let payload;
  try {
    payload = jwt.verify(token, getSecret());
  } catch {
    return res.status(404).json({ message: 'Not found' });
  }
  if (payload.scope !== 'admin' && payload.scope !== 'admin_setup') {
    return res.status(404).json({ message: 'Not found' });
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(404).json({ message: 'Not found' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, token_version, is_active, must_change_password FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const user = rows[0];
    if (!user || user.role !== 'ADMIN' || !Number(user.is_active)) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (Number(user.token_version) !== (Number(payload.tv) || 0)) {
      return res.status(404).json({ message: 'Not found' });
    }

    const mustChangePassword = Boolean(Number(user.must_change_password));

    // A setup token exists only to choose the first password. It may read the
    // session and post the new password, nothing else.
    if (payload.scope === 'admin_setup') {
      const allowed =
        (req.method === 'GET' && req.path === '/session') ||
        (req.method === 'POST' && req.path === '/password');
      if (!allowed) {
        return res.status(403).json({
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Set a new admin password first.',
        });
      }
    }

    // Defensive: a full-scope token must not work while a password change is
    // still outstanding.
    if (mustChangePassword && payload.scope !== 'admin_setup') {
      return res.status(403).json({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Set a new admin password first.',
      });
    }

    req.admin = {
      id: user.id,
      name: user.name,
      email: user.email,
      mustChangePassword,
      scope: payload.scope,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { signToken, authMiddleware, requireAdmin, extractBearer };
