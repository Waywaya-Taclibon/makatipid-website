const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'change-me-locally',
  database: process.env.DB_NAME || 'makatipid_db',
  waitForConnections: true,
  connectionLimit: 10,
  // TiDB Cloud kills public-endpoint connections that sit idle for ~340s, and
  // recommends a max connection lifetime of a few minutes. Recycling idle
  // sockets ourselves means the pool never hands out one the server already
  // dropped, which matters now that the process stays up around the clock.
  maxIdle: 5,
  idleTimeout: 30000,
  dateStrings: true, // return DATE columns as 'YYYY-MM-DD' strings (matches old LocalDate JSON)
  timezone: '+08:00', // Asia/Manila: TIMESTAMP reads/writes (payments.created_at holds) match app rules
  // Managed hosts (TiDB Cloud, PlanetScale) refuse unencrypted connections.
  // DB_SSL=true verifies the server certificate (preferred).
  // DB_SSL=lax still encrypts but skips verification — use only when the
  // machine's CA store can't validate the chain (some Windows/AV setups).
  ...(process.env.DB_SSL === 'true' || process.env.DB_SSL === 'lax'
    ? {
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: process.env.DB_SSL !== 'lax',
        },
      }
    : {}),
});

async function checkConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

// Adds token_version to pre-existing databases (fresh installs get it from schema.sql).
// Safe to run on every boot: duplicate-column errors are ignored.
async function ensureUserTokenVersionColumn() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0');
  } catch (err) {
    // ER_DUP_FIELDNAME (1060): column already exists — nothing to do.
    if (err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME')) return;
    throw err;
  }
}

// Adds the owner-contact columns to pre-existing databases (fresh installs get
// them from schema.sql). Safe to run on every boot: the duplicate-column error
// just means an earlier boot already added it.
async function ensureUserProfileColumns() {
  const columns = [
    'phone VARCHAR(32) NULL',
    'facebook VARCHAR(255) NULL',
    'instagram VARCHAR(255) NULL',
  ];
  for (const column of columns) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN ${column}`);
    } catch (err) {
      // ER_DUP_FIELDNAME (1060): column already exists — nothing to do.
      if (err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME')) continue;
      throw err;
    }
  }
}

// Adds the is_demo marker to pre-existing databases (fresh installs get it from
// schema.sql). Demo accounts are shared throwaway users the one-click demo logs
// into; the flag lets us identify and reset them without touching real users.
async function ensureUserDemoColumn() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0');
  } catch (err) {
    // ER_DUP_FIELDNAME (1060): column already exists — nothing to do.
    if (err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME')) return;
    throw err;
  }
}

// Tiny key/value store for server-side state that must survive restarts (the
// timestamp of the last demo reset, so a reboot doesn't wipe demo data early).
async function ensureAppMetaTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      k VARCHAR(64) NOT NULL PRIMARY KEY,
      v VARCHAR(255) NOT NULL
    )
  `);
}

async function getAppMeta(key) {
  const [rows] = await pool.query('SELECT v FROM app_meta WHERE k = ? LIMIT 1', [key]);
  return rows.length > 0 ? rows[0].v : null;
}

async function setAppMeta(key, value) {
  await pool.query('INSERT INTO app_meta (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [key, value]);
}

// Creates the payments ledger on pre-existing databases (fresh installs get it from schema.sql).
async function ensurePaymentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      intent_id VARCHAR(255) NOT NULL UNIQUE,
      property_id INT NOT NULL,
      renter_id INT NOT NULL,
      amount_centavos INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      booking_id INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_payments_property FOREIGN KEY (property_id) REFERENCES properties (id),
      CONSTRAINT fk_payments_renter FOREIGN KEY (renter_id) REFERENCES users (id),
      CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES rentallog (id),
      INDEX idx_payments_property_status (property_id, status, created_at)
    )
  `);
}

// Widens legacy lat/lng columns (old installs used 2 decimals, which snapped
// every pin to a ~1km grid). Safe to run on every boot; re-running is a no-op.
async function ensurePropertyCoordinatePrecision() {
  await pool.query('ALTER TABLE properties MODIFY COLUMN lat DECIMAL(11,7) NOT NULL, MODIFY COLUMN lng DECIMAL(11,7) NOT NULL');
}

// Creates the property_images ledger on pre-existing databases (fresh installs get it from schema.sql).
async function ensurePropertyImagesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS property_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      property_id INT NOT NULL,
      image_url VARCHAR(1024) NOT NULL,
      public_id VARCHAR(255) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_property_images_property FOREIGN KEY (property_id) REFERENCES properties (id),
      INDEX idx_property_images_property (property_id, sort_order)
    )
  `);
}

// Creates the temporary messaging tables on pre-existing databases (fresh
// installs get them from schema.sql). Safe to run on every boot.
async function ensureMessagingTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      property_id INT NOT NULL,
      owner_id INT NOT NULL,
      renter_id INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_message_at TIMESTAMP NULL,
      expires_at TIMESTAMP NOT NULL,
      CONSTRAINT fk_conversations_property FOREIGN KEY (property_id) REFERENCES properties (id),
      CONSTRAINT fk_conversations_owner FOREIGN KEY (owner_id) REFERENCES users (id),
      CONSTRAINT fk_conversations_renter FOREIGN KEY (renter_id) REFERENCES users (id),
      UNIQUE KEY uq_conversations_property_renter (property_id, renter_id),
      INDEX idx_conversations_owner (owner_id, last_message_at),
      INDEX idx_conversations_renter (renter_id, last_message_at),
      INDEX idx_conversations_expires (expires_at)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP NULL,
      CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id),
      INDEX idx_messages_conversation (conversation_id, id)
    )
  `);
}

// Hard-deletes chats whose 24-hour window has elapsed. Messages go with them
// via ON DELETE CASCADE. Returns the number of conversations removed.
async function sweepExpiredConversations() {
  const [result] = await pool.query('DELETE FROM conversations WHERE expires_at <= NOW()');
  return result.affectedRows || 0;
}

// Adds the per-add idempotency key to pre-existing databases. A retried POST
// (e.g. the response was lost) returns the original property instead of
// inserting a duplicate. Safe to run on every boot.
async function ensurePropertyClientRequestId() {
  try {
    await pool.query('ALTER TABLE properties ADD COLUMN client_request_id VARCHAR(64) NULL');
  } catch (err) {
    // ER_DUP_FIELDNAME (1060): column already exists — nothing to do.
    if (!(err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME'))) throw err;
  }
  try {
    await pool.query('ALTER TABLE properties ADD UNIQUE INDEX uq_properties_owner_client_request (owner_id, client_request_id)');
  } catch (err) {
    // ER_DUP_KEYNAME (1061): index already exists — nothing to do.
    if (!(err && (err.errno === 1061 || err.code === 'ER_DUP_KEYNAME'))) throw err;
  }
}

// Same idempotency guard for messages: a retried send (lost response, double
// Enter that slipped through the client lock) returns the original row instead
// of inserting a second copy. Safe to run on every boot.
async function ensureMessagesClientRequestId() {
  try {
    await pool.query('ALTER TABLE messages ADD COLUMN client_request_id VARCHAR(64) NULL');
  } catch (err) {
    if (!(err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME'))) throw err;
  }
  try {
    await pool.query('ALTER TABLE messages ADD UNIQUE INDEX uq_messages_sender_client_request (conversation_id, sender_id, client_request_id)');
  } catch (err) {
    if (!(err && (err.errno === 1061 || err.code === 'ER_DUP_KEYNAME'))) throw err;
  }
}

// Account suspension. Banning sets is_active = 0 and bumps token_version so
// every existing session dies immediately; the auth middleware re-checks it on
// each request as well.
async function ensureUserActiveColumn() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
  } catch (err) {
    if (err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME')) return;
    throw err;
  }
}

// Set by scripts/promote-admin.js: the admin must choose a new password before
// the dashboard unlocks. Login then issues a short-lived "admin_setup" token.
async function ensureUserMustChangePasswordColumn() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0');
  } catch (err) {
    if (err && (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME')) return;
    throw err;
  }
}

// Append-only trail of admin actions. No FK on admin_id on purpose: the log
// must survive even if the account row is ever removed by hand.
async function ensureAdminAuditLogTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(32) NULL,
      target_id VARCHAR(64) NULL,
      details TEXT NULL,
      ip VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_audit_created (created_at),
      INDEX idx_admin_audit_admin (admin_id)
    )
  `);
}

module.exports = { pool, checkConnection, ensureUserTokenVersionColumn, ensureUserProfileColumns, ensureUserDemoColumn, ensureUserActiveColumn, ensureUserMustChangePasswordColumn, ensureAdminAuditLogTable, ensureAppMetaTable, getAppMeta, setAppMeta, ensurePaymentsTable, ensurePropertyCoordinatePrecision, ensurePropertyImagesTable, ensureMessagingTables, sweepExpiredConversations, ensurePropertyClientRequestId, ensureMessagesClientRequestId };
