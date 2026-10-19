const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const MAX_BODY_LEN = 2000;
// Chats are temporary: the whole conversation is deleted this many hours after
// its last message. Sending a message pushes the window out again.
const WINDOW_HOURS = 24;
const WINDOW_SECONDS = WINDOW_HOURS * 60 * 60;

// One shared SELECT so every endpoint returns the same conversation shape.
// `?` = the requester's id, used to count messages they haven't read yet.
const CONVERSATION_SELECT = `
  SELECT c.id, c.property_id, c.owner_id, c.renter_id, c.created_at, c.last_message_at,
         p.lot_name, p.address,
         o.name AS owner_name, u.name AS renter_name,
         TIMESTAMPDIFF(SECOND, NOW(), c.expires_at) AS expires_in,
         (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
         (SELECT UNIX_TIMESTAMP(m.created_at) * 1000 FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_at_ms,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id <> ? AND m.read_at IS NULL) AS unread_count
  FROM conversations c
  JOIN properties p ON p.id = c.property_id
  LEFT JOIN users o ON o.id = c.owner_id
  LEFT JOIN users u ON u.id = c.renter_id
`;

function conversationDto(row, userId) {
  const isOwner = Number(row.owner_id) === Number(userId);
  return {
    id: row.id,
    propertyId: row.property_id,
    lotName: row.lot_name || null,
    address: row.address || null,
    ownerId: row.owner_id,
    renterId: row.renter_id,
    role: isOwner ? 'owner' : 'renter',
    counterpartId: isOwner ? row.renter_id : row.owner_id,
    counterpartName: (isOwner ? row.renter_name : row.owner_name) || null,
    lastMessageBody: row.last_body ?? null,
    lastMessageAtMs: row.last_at_ms != null ? Number(row.last_at_ms) : null,
    unreadCount: row.unread_count != null ? Number(row.unread_count) : 0,
    // Seconds until the chat (and all its messages) is deleted. The client
    // counts down from this; it is refreshed on every poll so it can't drift.
    expiresInSeconds: Math.max(0, Number(row.expires_in) || 0),
  };
}

function messageDto(row, userId) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    mine: Number(row.sender_id) === Number(userId),
    body: row.body,
    createdAtMs: Number(row.created_at_ms),
  };
}

async function loadConversation(id, userId) {
  const [rows] = await pool.query(
    `${CONVERSATION_SELECT}
     WHERE c.id = ? AND (c.owner_id = ? OR c.renter_id = ?) AND c.expires_at > NOW()
     LIMIT 1`,
    [userId, id, userId, userId]
  );
  return rows[0] || null;
}

// All of my chats, most recently active first.
router.get('/conversations', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${CONVERSATION_SELECT}
       WHERE (c.owner_id = ? OR c.renter_id = ?) AND c.expires_at > NOW()
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [req.user.id, req.user.id, req.user.id]
    );
    return res.json(rows.map((row) => conversationDto(row, req.user.id)));
  } catch (err) {
    return next(err);
  }
});

// Find-or-create the thread for a listing. Race-safe: the unique key means a
// double-click can only ever produce one conversation.
router.post('/conversations', async (req, res, next) => {
  try {
    const propertyId = Number(req.body && req.body.propertyId);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: 'A valid propertyId is required' });
    }

    const [props] = await pool.query('SELECT id, owner_id FROM properties WHERE id = ? LIMIT 1', [propertyId]);
    if (props.length === 0) return res.status(404).json({ message: 'Property not found' });
    const ownerId = props[0].owner_id;
    if (Number(ownerId) === Number(req.user.id)) {
      return res.status(400).json({ message: "You can't message yourself about your own listing." });
    }

    // Clear an expired row for this pair so a fresh chat can start cleanly.
    await pool.query(
      'DELETE FROM conversations WHERE property_id = ? AND renter_id = ? AND expires_at <= NOW()',
      [propertyId, req.user.id]
    );

    const [existing] = await pool.query(
      'SELECT id FROM conversations WHERE property_id = ? AND renter_id = ? LIMIT 1',
      [propertyId, req.user.id]
    );

    let conversationId;
    if (existing.length > 0) {
      conversationId = existing[0].id;
    } else {
      try {
        const [result] = await pool.query(
          'INSERT INTO conversations (property_id, owner_id, renter_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
          [propertyId, ownerId, req.user.id, WINDOW_HOURS]
        );
        conversationId = result.insertId;
      } catch (err) {
        // Concurrent create lost the race — reuse the winner.
        if (err && err.code === 'ER_DUP_ENTRY') {
          const [again] = await pool.query(
            'SELECT id FROM conversations WHERE property_id = ? AND renter_id = ? LIMIT 1',
            [propertyId, req.user.id]
          );
          if (again.length === 0) throw err;
          conversationId = again[0].id;
        } else {
          throw err;
        }
      }
    }

    const row = await loadConversation(conversationId, req.user.id);
    if (!row) return res.status(404).json({ message: 'Conversation not found' });
    return res.status(201).json(conversationDto(row, req.user.id));
  } catch (err) {
    return next(err);
  }
});

// One thread. `?after=<id>` returns only newer messages (used for polling, so
// we don't re-download the whole history every few seconds).
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid conversation' });

    const conv = await loadConversation(id, req.user.id);
    if (!conv) return res.status(404).json({ message: 'This chat has expired or no longer exists.' });

    const after = Number(req.query.after);
    let rows;
    if (Number.isInteger(after) && after > 0) {
      [rows] = await pool.query(
        'SELECT id, conversation_id, sender_id, body, UNIX_TIMESTAMP(created_at) * 1000 AS created_at_ms FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC',
        [id, after]
      );
    } else {
      [rows] = await pool.query(
        'SELECT * FROM (SELECT id, conversation_id, sender_id, body, UNIX_TIMESTAMP(created_at) * 1000 AS created_at_ms FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 50) t ORDER BY t.id ASC',
        [id]
      );
    }

    // Opening the thread marks everything the other person sent as read.
    await pool.query(
      'UPDATE messages SET read_at = NOW() WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL',
      [id, req.user.id]
    );

    const conversation = conversationDto(conv, req.user.id);
    conversation.unreadCount = 0;
    return res.json({ conversation, messages: rows.map((row) => messageDto(row, req.user.id)) });
  } catch (err) {
    return next(err);
  }
});

router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid conversation' });

    const body = typeof (req.body && req.body.body) === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ message: 'Message cannot be empty' });
    if (body.length > MAX_BODY_LEN) {
      return res.status(400).json({ message: `Message must be ${MAX_BODY_LEN} characters or fewer` });
    }

    const [convs] = await pool.query(
      'SELECT id FROM conversations WHERE id = ? AND (owner_id = ? OR renter_id = ?) AND expires_at > NOW() LIMIT 1',
      [id, req.user.id, req.user.id]
    );
    if (convs.length === 0) {
      return res.status(404).json({ message: 'This chat has expired or no longer exists.' });
    }

    const [result] = await pool.query(
      'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
      [id, req.user.id, body]
    );
    // A new message keeps the chat alive for another 24 hours.
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR) WHERE id = ?',
      [WINDOW_HOURS, id]
    );

    const [rows] = await pool.query(
      'SELECT id, conversation_id, sender_id, body, UNIX_TIMESTAMP(created_at) * 1000 AS created_at_ms FROM messages WHERE id = ?',
      [result.insertId]
    );
    return res.status(201).json({
      message: messageDto(rows[0], req.user.id),
      expiresInSeconds: WINDOW_SECONDS,
    });
  } catch (err) {
    return next(err);
  }
});

// Total unread across every (live) chat, for the dashboard badge.
router.get('/unread-count', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE (c.owner_id = ? OR c.renter_id = ?) AND c.expires_at > NOW()
         AND m.sender_id <> ? AND m.read_at IS NULL`,
      [req.user.id, req.user.id, req.user.id]
    );
    return res.json({ count: Number(rows[0].count) || 0 });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
