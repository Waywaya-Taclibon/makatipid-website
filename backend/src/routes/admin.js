const express = require('express');
const argon2 = require('argon2');

const { pool, checkConnection, getAppMeta } = require('../db');
const { signToken, requireAdmin } = require('../middleware/auth');
const { isDemoEnabled, resetDemoData } = require('../demo');
const cloudinary = require('../services/cloudinary');
const { toDateOnlyString, manilaTodayDateOnly } = require('../utils/pricing');

const router = express.Router();

const ADMIN_SESSION_SECONDS = 6 * 60 * 60; // 6 hours, per product requirement
const ADMIN_SETUP_SECONDS = 15 * 60; // first-login password setup window
const LAST_DEMO_RESET_KEY = 'demo_last_reset';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Admin passwords are the keys to every user, booking and payment row, so the
// bar is deliberately higher than the 6-character rule for normal accounts.
function passwordProblem(password, email) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'New password is required.';
  }
  if (password.length < 12) {
    return 'Use at least 12 characters.';
  }
  if (password.length > 200) {
    return 'That password is too long.';
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    return 'Include at least three of: lowercase letters, uppercase letters, numbers, symbols.';
  }
  const localPart = String(email || '').split('@')[0].toLowerCase();
  if (localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
    return 'Do not include your email name in the password.';
  }
  return null;
}

function parsePage(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(req.query.pageSize, 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function searchTerm(req) {
  return String(req.query.q || '').trim();
}

function asLike(value) {
  return `%${value}%`;
}

function numericId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid id' });
    return null;
  }
  return id;
}

function paged(items, total, page, pageSize) {
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function bool(value) {
  return Boolean(Number(value));
}

function userRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: bool(row.is_active),
    isDemo: bool(row.is_demo),
    phone: row.phone ?? null,
    facebook: row.facebook ?? null,
    instagram: row.instagram ?? null,
  };
}

function propertyRow(row) {
  return {
    id: row.id,
    lotName: row.lot_name,
    address: row.address,
    price: Number(row.price),
    archived: bool(row.archived),
    availableUntil: row.available_until ? toDateOnlyString(row.available_until) : null,
    ownerId: row.owner_id,
    ownerName: row.owner_name || null,
    ownerEmail: row.owner_email || null,
    imageCount: Number(row.image_count || 0),
    bookingCount: Number(row.booking_count || 0),
    paymentCount: Number(row.payment_count || 0),
  };
}

function bookingRow(row) {
  return {
    id: row.id,
    status: row.status,
    startDate: toDateOnlyString(row.start_date),
    endDate: row.end_date ? toDateOnlyString(row.end_date) : null,
    propertyId: row.property_id,
    lotName: row.lot_name,
    address: row.address,
    price: Number(row.price),
    ownerId: row.owner_id,
    ownerName: row.owner_name || null,
    renterId: row.renter_id,
    renterName: row.renter_name || null,
    renterEmail: row.renter_email || null,
  };
}

function paymentRow(row) {
  return {
    id: row.id,
    intentId: row.intent_id,
    amountCentavos: Number(row.amount_centavos),
    status: row.status,
    startDate: toDateOnlyString(row.start_date),
    endDate: toDateOnlyString(row.end_date),
    bookingId: row.booking_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    propertyId: row.property_id,
    lotName: row.lot_name || null,
    renterId: row.renter_id,
    renterName: row.renter_name || null,
    renterEmail: row.renter_email || null,
  };
}

function conversationRow(row) {
  return {
    id: row.id,
    propertyId: row.property_id,
    lotName: row.lot_name || null,
    ownerId: row.owner_id,
    ownerName: row.owner_name || null,
    renterId: row.renter_id,
    renterName: row.renter_name || null,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    expiresAt: row.expires_at,
    expired: bool(row.expired),
    messageCount: Number(row.message_count || 0),
    lastMessage: row.last_message || null,
  };
}

// Audit writes must never take down the action they describe.
async function audit(req, action, targetType, targetId, details) {
  try {
    await pool.query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.admin.id,
        action,
        targetType || null,
        targetId != null ? String(targetId) : null,
        details ? JSON.stringify(details) : null,
        (req.ip || '').slice(0, 63) || null,
      ]
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Audit log write failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

// POST /api/admin/login — public, tightly rate-limited at the server mount.
router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body && req.body.email);
    const password = req.body && req.body.password;
    if (!email || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, email, password, role, is_active, must_change_password, token_version FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email]
    );
    const user = rows[0];

    // Verify the hash even for non-admins so response timing does not reveal
    // whether an email belongs to an admin.
    let ok = false;
    if (user) {
      try {
        ok = await argon2.verify(user.password, password);
      } catch {
        ok = false;
      }
    }
    if (!user || !ok || user.role !== 'ADMIN') {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (!Number(user.is_active)) {
      return res.status(403).json({ message: 'This account is suspended.' });
    }

    const setup = bool(user.must_change_password);
    const token = signToken(user.id, user.token_version, {
      expiresInSeconds: setup ? ADMIN_SETUP_SECONDS : ADMIN_SESSION_SECONDS,
      scope: setup ? 'admin_setup' : 'admin',
    });

    if (!setup) {
      await audit({ admin: { id: user.id }, ip: req.ip }, 'admin.login', 'session', null, null);
    }

    return res.json({
      token,
      name: user.name,
      email: user.email,
      mustChangePassword: setup,
      expiresInSeconds: setup ? ADMIN_SETUP_SECONDS : ADMIN_SESSION_SECONDS,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/session — used on page load to restore a session.
router.get('/session', requireAdmin, (req, res) => {
  return res.json({
    admin: {
      id: req.admin.id,
      name: req.admin.name,
      email: req.admin.email,
      mustChangePassword: req.admin.mustChangePassword,
      expiresAt: req.admin.expiresAt,
    },
  });
});

// POST /api/admin/password — first-time setup or a normal password change.
// Either path rotates token_version, which signs every other admin session out.
router.post('/password', requireAdmin, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const problem = passwordProblem(newPassword, req.admin.email);
    if (problem) return res.status(400).json({ message: problem });

    const [rows] = await pool.query('SELECT password FROM users WHERE id = ? LIMIT 1', [req.admin.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' });
    const currentHash = rows[0].password;

    let sameAsCurrent = false;
    try {
      sameAsCurrent = await argon2.verify(currentHash, String(newPassword));
    } catch {
      sameAsCurrent = false;
    }
    if (sameAsCurrent) {
      return res.status(400).json({ message: 'Choose a password you have not used before.' });
    }

    // The setup token already proves the person knows the temporary password,
    // so asking for it again would be pointless. A normal change must confirm
    // the current password.
    if (!req.admin.mustChangePassword) {
      if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
        return res.status(400).json({ message: 'Current password is required.' });
      }
      let ok = false;
      try {
        ok = await argon2.verify(currentHash, currentPassword);
      } catch {
        ok = false;
      }
      if (!ok) return res.status(403).json({ message: 'Current password is incorrect.' });
    }

    const hash = await argon2.hash(String(newPassword));
    await pool.query(
      'UPDATE users SET password = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?',
      [hash, req.admin.id]
    );

    const [updated] = await pool.query('SELECT token_version FROM users WHERE id = ? LIMIT 1', [req.admin.id]);
    const token = signToken(req.admin.id, updated[0].token_version, {
      expiresInSeconds: ADMIN_SESSION_SECONDS,
      scope: 'admin',
    });

    await audit(req, 'admin.password_change', 'admin', req.admin.id, null);

    return res.json({ token, expiresInSeconds: ADMIN_SESSION_SECONDS });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

router.get('/stats', requireAdmin, async (req, res, next) => {
  try {
    const [
      [userRows],
      [propertyRows],
      [bookingRows],
      [paymentRows],
      [conversationRows],
      [recentUsers],
      [recentBookings],
      [recentPayments],
      [recentAudit],
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(is_active = 1), 0) AS active,
                COALESCE(SUM(is_active = 0), 0) AS banned,
                COALESCE(SUM(role = 'ADMIN'), 0) AS admins,
                COALESCE(SUM(is_demo = 1), 0) AS demo
         FROM users`
      ),
      pool.query(
        `SELECT COUNT(*) AS total, COALESCE(SUM(archived = 1), 0) AS archived FROM properties`
      ),
      pool.query(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(status = 'ACTIVE'), 0) AS active,
                COALESCE(SUM(status = 'ENDED'), 0) AS ended
         FROM rentallog`
      ),
      pool.query(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(status = 'SUCCEEDED'), 0) AS succeeded,
                COALESCE(SUM(status = 'PENDING'), 0) AS pending,
                COALESCE(SUM(CASE WHEN status = 'SUCCEEDED' THEN amount_centavos ELSE 0 END), 0) AS revenue
         FROM payments`
      ),
      pool.query('SELECT COUNT(*) AS active FROM conversations WHERE expires_at > NOW()'),
      pool.query(
        `SELECT id, name, email, role, is_active, is_demo
         FROM users ORDER BY id DESC LIMIT 5`
      ),
      pool.query(
        `SELECT r.id, r.status, r.start_date, r.end_date, r.property_id, r.renter_id,
                p.lot_name, p.address, p.price, p.owner_id,
                o.name AS owner_name, u.name AS renter_name, u.email AS renter_email
         FROM rentallog r
         JOIN properties p ON p.id = r.property_id
         LEFT JOIN users o ON o.id = p.owner_id
         LEFT JOIN users u ON u.id = r.renter_id
         ORDER BY r.id DESC LIMIT 5`
      ),
      pool.query(
        `SELECT pay.id, pay.intent_id, pay.amount_centavos, pay.status, pay.start_date, pay.end_date,
                pay.booking_id, pay.created_at, pay.updated_at, pay.property_id, pay.renter_id,
                p.lot_name, u.name AS renter_name, u.email AS renter_email
         FROM payments pay
         LEFT JOIN properties p ON p.id = pay.property_id
         LEFT JOIN users u ON u.id = pay.renter_id
         ORDER BY pay.id DESC LIMIT 5`
      ),
      pool.query(
        `SELECT a.id, a.admin_id, u.name AS admin_name, a.action, a.target_type, a.target_id,
                a.details, a.ip, a.created_at
         FROM admin_audit_log a
         LEFT JOIN users u ON u.id = a.admin_id
         ORDER BY a.id DESC LIMIT 8`
      ),
    ]);

    const u = userRows[0] || {};
    const pr = propertyRows[0] || {};
    const b = bookingRows[0] || {};
    const pay = paymentRows[0] || {};

    return res.json({
      users: {
        total: Number(u.total || 0),
        active: Number(u.active || 0),
        banned: Number(u.banned || 0),
        admins: Number(u.admins || 0),
        demo: Number(u.demo || 0),
      },
      properties: { total: Number(pr.total || 0), archived: Number(pr.archived || 0) },
      bookings: {
        total: Number(b.total || 0),
        active: Number(b.active || 0),
        ended: Number(b.ended || 0),
      },
      payments: {
        total: Number(pay.total || 0),
        succeeded: Number(pay.succeeded || 0),
        pending: Number(pay.pending || 0),
        revenueCentavos: Number(pay.revenue || 0),
      },
      conversations: { active: Number((conversationRows[0] || {}).active || 0) },
      recent: {
        users: recentUsers.map(userRow),
        bookings: recentBookings.map(bookingRow),
        payments: recentPayments.map(paymentRow),
        audit: recentAudit.map((row) => ({
          id: row.id,
          adminId: row.admin_id,
          adminName: row.admin_name || 'Admin',
          action: row.action,
          targetType: row.target_type,
          targetId: row.target_id,
          details: row.details,
          ip: row.ip,
          createdAt: row.created_at,
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req);
    const term = searchTerm(req);
    const status = String(req.query.status || 'all').toLowerCase();
    const role = String(req.query.role || '').trim();

    const where = [];
    const params = [];
    if (term) {
      where.push('(name LIKE ? OR email LIKE ?)');
      params.push(asLike(term), asLike(term));
    }
    if (status === 'active') where.push('is_active = 1');
    if (status === 'banned') where.push('is_active = 0');
    if (role) {
      where.push('role = ?');
      params.push(role);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT id, name, email, role, is_active, is_demo, phone, facebook, instagram
       FROM users ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json(paged(rows.map(userRow), Number(countRow.total || 0), page, pageSize));
  } catch (err) {
    return next(err);
  }
});

router.put('/users/:id/ban', requireAdmin, async (req, res, next) => {
  try {
    const id = numericId(req, res);
    if (id == null) return undefined;
    if (id === req.admin.id) {
      return res.status(400).json({ message: 'You cannot suspend your own account.' });
    }
    const [rows] = await pool.query('SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    if (rows[0].role === 'ADMIN') {
      return res.status(400).json({ message: 'Admin accounts cannot be suspended.' });
    }

    await pool.query('UPDATE users SET is_active = 0, token_version = token_version + 1 WHERE id = ?', [id]);
    await audit(req, 'user.ban', 'user', id, { email: rows[0].email });

    const [updated] = await pool.query(
      'SELECT id, name, email, role, is_active, is_demo, phone, facebook, instagram FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return res.json(userRow(updated[0]));
  } catch (err) {
    return next(err);
  }
});

router.put('/users/:id/unban', requireAdmin, async (req, res, next) => {
  try {
    const id = numericId(req, res);
    if (id == null) return undefined;
    const [rows] = await pool.query('SELECT id, email FROM users WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [id]);
    await audit(req, 'user.unban', 'user', id, { email: rows[0].email });

    const [updated] = await pool.query(
      'SELECT id, name, email, role, is_active, is_demo, phone, facebook, instagram FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return res.json(userRow(updated[0]));
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

router.get('/properties', requireAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req);
    const term = searchTerm(req);
    const status = String(req.query.status || 'all').toLowerCase();

    const where = [];
    const params = [];
    if (term) {
      where.push('(p.lot_name LIKE ? OR p.address LIKE ? OR o.name LIKE ? OR o.email LIKE ?)');
      params.push(asLike(term), asLike(term), asLike(term), asLike(term));
    }
    if (status === 'active') where.push('p.archived = 0');
    if (status === 'archived') where.push('p.archived = 1');
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM properties p LEFT JOIN users o ON o.id = p.owner_id ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT p.id, p.lot_name, p.address, p.price, p.archived, p.available_until, p.owner_id,
              o.name AS owner_name, o.email AS owner_email,
              (SELECT COUNT(*) FROM property_images i WHERE i.property_id = p.id) AS image_count,
              (SELECT COUNT(*) FROM rentallog r WHERE r.property_id = p.id) AS booking_count,
              (SELECT COUNT(*) FROM payments pay WHERE pay.property_id = p.id) AS payment_count
       FROM properties p
       LEFT JOIN users o ON o.id = p.owner_id
       ${whereSql}
       ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json(paged(rows.map(propertyRow), Number(countRow.total || 0), page, pageSize));
  } catch (err) {
    return next(err);
  }
});

router.put('/properties/:id/archive', requireAdmin, async (req, res, next) => {
  try {
    const id = numericId(req, res);
    if (id == null) return undefined;
    const [rows] = await pool.query('SELECT id, lot_name FROM properties WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Property not found' });

    await pool.query('UPDATE properties SET archived = 1 WHERE id = ?', [id]);
    await audit(req, 'property.archive', 'property', id, { lotName: rows[0].lot_name });
    return res.json({ id, archived: true });
  } catch (err) {
    return next(err);
  }
});

router.put('/properties/:id/unarchive', requireAdmin, async (req, res, next) => {
  try {
    const id = numericId(req, res);
    if (id == null) return undefined;
    const [rows] = await pool.query('SELECT id, lot_name FROM properties WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Property not found' });

    await pool.query('UPDATE properties SET archived = 0 WHERE id = ?', [id]);
    await audit(req, 'property.unarchive', 'property', id, { lotName: rows[0].lot_name });
    return res.json({ id, archived: false });
  } catch (err) {
    return next(err);
  }
});

// Mirrors the owner-facing rule: a listing with booking or payment history is
// archived, never erased. Photos are removed from Cloudinary before the rows.
router.delete('/properties/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = numericId(req, res);
    if (id == null) return undefined;

    const [rows] = await pool.query('SELECT id, lot_name FROM properties WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Property not found' });

    const [[bookingCount]] = await pool.query('SELECT COUNT(*) AS total FROM rentallog WHERE property_id = ?', [id]);
    const [[paymentCount]] = await pool.query('SELECT COUNT(*) AS total FROM payments WHERE property_id = ?', [id]);
    if (Number(bookingCount.total) > 0 || Number(paymentCount.total) > 0) {
      return res.status(409).json({
        message: `"${rows[0].lot_name}" has booking or payment history and cannot be erased. Archive it instead.`,
      });
    }

    const [images] = await pool.query('SELECT public_id FROM property_images WHERE property_id = ?', [id]);
    for (const image of images) {
      // Demo photos are relative frontend assets, not Cloudinary objects.
      if (image.public_id && !String(image.public_id).startsWith('demo:') && cloudinary.isConfigured()) {
        try {
          await cloudinary.destroy(image.public_id);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`Cloudinary cleanup failed for ${image.public_id}:`, err.message);
        }
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM property_images WHERE property_id = ?', [id]);
      // Chats reference the listing too, and `messages` cascades from the
      // conversation. The listing is unreachable, so drop the thread with it.
      await conn.query('DELETE FROM conversations WHERE property_id = ?', [id]);
      await conn.query('DELETE FROM properties WHERE id = ?', [id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }

    await audit(req, 'property.delete', 'property', id, { lotName: rows[0].lot_name });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

router.get('/bookings', requireAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req);
    const term = searchTerm(req);
    const status = String(req.query.status || 'all').toUpperCase();

    const where = [];
    const params = [];
    if (term) {
      where.push('(p.lot_name LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR o.name LIKE ?)');
      params.push(asLike(term), asLike(term), asLike(term), asLike(term));
    }
    if (status === 'ACTIVE' || status === 'ENDED') {
      where.push('r.status = ?');
      params.push(status);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM rentallog r
       JOIN properties p ON p.id = r.property_id
       LEFT JOIN users o ON o.id = p.owner_id
       LEFT JOIN users u ON u.id = r.renter_id
       ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT r.id, r.status, r.start_date, r.end_date, r.property_id, r.renter_id,
              p.lot_name, p.address, p.price, p.owner_id,
              o.name AS owner_name, u.name AS renter_name, u.email AS renter_email
       FROM rentallog r
       JOIN properties p ON p.id = r.property_id
       LEFT JOIN users o ON o.id = p.owner_id
       LEFT JOIN users u ON u.id = r.renter_id
       ${whereSql}
       ORDER BY r.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json(paged(rows.map(bookingRow), Number(countRow.total || 0), page, pageSize));
  } catch (err) {
    return next(err);
  }
});

router.put('/bookings/:id/end', requireAdmin, async (req, res, next) => {
  try {
    const id = numericId(req, res);
    if (id == null) return undefined;
    const [rows] = await pool.query('SELECT id, status, property_id FROM rentallog WHERE id = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Booking not found' });

    const today = toDateOnlyString(manilaTodayDateOnly());
    await pool.query("UPDATE rentallog SET status = 'ENDED', end_date = ? WHERE id = ?", [today, id]);
    await audit(req, 'booking.force_end', 'booking', id, {
      previousStatus: rows[0].status,
      propertyId: rows[0].property_id,
      endDate: today,
    });

    return res.json({ id, status: 'ENDED', endDate: today });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Payments (read-only ledger)
// ---------------------------------------------------------------------------

router.get('/payments', requireAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req);
    const term = searchTerm(req);
    const status = String(req.query.status || 'all').toUpperCase();

    const where = [];
    const params = [];
    if (term) {
      where.push('(pay.intent_id LIKE ? OR p.lot_name LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
      params.push(asLike(term), asLike(term), asLike(term), asLike(term));
    }
    if (status && status !== 'ALL') {
      where.push('pay.status = ?');
      params.push(status);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM payments pay
       LEFT JOIN properties p ON p.id = pay.property_id
       LEFT JOIN users u ON u.id = pay.renter_id
       ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT pay.id, pay.intent_id, pay.amount_centavos, pay.status, pay.start_date, pay.end_date,
              pay.booking_id, pay.created_at, pay.updated_at, pay.property_id, pay.renter_id,
              p.lot_name, u.name AS renter_name, u.email AS renter_email
       FROM payments pay
       LEFT JOIN properties p ON p.id = pay.property_id
       LEFT JOIN users u ON u.id = pay.renter_id
       ${whereSql}
       ORDER BY pay.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json(paged(rows.map(paymentRow), Number(countRow.total || 0), page, pageSize));
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Messages (read-only oversight)
// ---------------------------------------------------------------------------

router.get('/conversations', requireAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req);
    const term = searchTerm(req);

    const where = [];
    const params = [];
    if (term) {
      where.push('(p.lot_name LIKE ? OR o.name LIKE ? OR u.name LIKE ?)');
      params.push(asLike(term), asLike(term), asLike(term));
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM conversations c
       JOIN properties p ON p.id = c.property_id
       LEFT JOIN users o ON o.id = c.owner_id
       LEFT JOIN users u ON u.id = c.renter_id
       ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT c.id, c.property_id, c.owner_id, c.renter_id, c.created_at, c.last_message_at, c.expires_at,
              (c.expires_at <= NOW()) AS expired,
              p.lot_name, o.name AS owner_name, u.name AS renter_name,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
              (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message
       FROM conversations c
       JOIN properties p ON p.id = c.property_id
       LEFT JOIN users o ON o.id = c.owner_id
       LEFT JOIN users u ON u.id = c.renter_id
       ${whereSql}
       ORDER BY c.last_message_at DESC, c.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json(paged(rows.map(conversationRow), Number(countRow.total || 0), page, pageSize));
  } catch (err) {
    return next(err);
  }
});

router.get('/conversations/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = numericId(req, res);
    if (id == null) return undefined;

    const [rows] = await pool.query(
      `SELECT c.id, c.property_id, c.owner_id, c.renter_id, c.created_at, c.last_message_at, c.expires_at,
              (c.expires_at <= NOW()) AS expired,
              p.lot_name, o.name AS owner_name, u.name AS renter_name,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
       JOIN properties p ON p.id = c.property_id
       LEFT JOIN users o ON o.id = c.owner_id
       LEFT JOIN users u ON u.id = c.renter_id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Conversation not found' });

    const [messages] = await pool.query(
      `SELECT m.id, m.sender_id, u.name AS sender_name, m.body, m.created_at, m.read_at
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.id ASC
       LIMIT 500`,
      [id]
    );

    return res.json({
      conversation: conversationRow(rows[0]),
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender_name || 'Deleted user',
        body: m.body,
        createdAt: m.created_at,
        readAt: m.read_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

router.get('/demo', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      enabled: isDemoEnabled(),
      lastResetAt: await getAppMeta(LAST_DEMO_RESET_KEY),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/demo/reset', requireAdmin, async (req, res, next) => {
  try {
    await resetDemoData();
    const lastResetAt = await getAppMeta(LAST_DEMO_RESET_KEY);
    await audit(req, 'demo.reset', 'demo', null, { lastResetAt });
    return res.json({ ok: true, lastResetAt });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// System health + audit log
// ---------------------------------------------------------------------------

router.get('/system', requireAdmin, async (req, res, next) => {
  try {
    const started = Date.now();
    let db = 'ok';
    let dbError = null;
    try {
      await checkConnection();
    } catch (err) {
      db = 'error';
      dbError = err.message;
    }
    const dbLatencyMs = Date.now() - started;
    const memory = process.memoryUsage();

    return res.json({
      db,
      dbError,
      dbLatencyMs,
      uptimeSeconds: Math.floor(process.uptime()),
      node: process.version,
      env: process.env.NODE_ENV || 'development',
      commit: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null,
      service: process.env.RENDER_SERVICE_NAME || null,
      demoEnabled: isDemoEnabled(),
      memory: {
        rssMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/audit', requireAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePage(req);
    const [[countRow]] = await pool.query('SELECT COUNT(*) AS total FROM admin_audit_log');
    const [rows] = await pool.query(
      `SELECT a.id, a.admin_id, u.name AS admin_name, a.action, a.target_type, a.target_id,
              a.details, a.ip, a.created_at
       FROM admin_audit_log a
       LEFT JOIN users u ON u.id = a.admin_id
       ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );

    const items = rows.map((row) => ({
      id: row.id,
      adminId: row.admin_id,
      adminName: row.admin_name || 'Admin',
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      details: row.details,
      ip: row.ip,
      createdAt: row.created_at,
    }));

    return res.json(paged(items, Number(countRow.total || 0), page, pageSize));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
