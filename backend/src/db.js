const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'change-me-locally',
  database: process.env.DB_NAME || 'makatipid_db',
  waitForConnections: true,
  connectionLimit: 10,
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

module.exports = { pool, checkConnection, ensureUserTokenVersionColumn, ensureUserProfileColumns, ensurePaymentsTable, ensurePropertyCoordinatePrecision, ensurePropertyImagesTable, ensureMessagingTables, sweepExpiredConversations, ensurePropertyClientRequestId };
