#!/usr/bin/env node
/*
 * Grants admin access to one email address.
 *
 *   npm run promote-admin -- waywaytaclibon.wt@gmail.com
 *
 * What it does:
 *   1. Ensures the admin-related columns/table exist (safe to re-run).
 *   2. Sets role = 'ADMIN' on that account (creating it if the email is new).
 *   3. Replaces the password with a freshly generated temporary one and sets
 *      must_change_password = 1, so the old (possibly leaked) password stops
 *      working everywhere immediately.
 *   4. Bumps token_version, which signs out every existing session.
 *
 * The temporary password is printed once. Log in at /admin with it and the
 * dashboard forces you to choose a real password before anything is unlocked.
 * Re-running the script generates a new temporary password (account recovery).
 *
 * Connection details come from backend/.env (the same DB_* vars the API uses).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const crypto = require('crypto');
const argon2 = require('argon2');
const {
  pool,
  ensureUserActiveColumn,
  ensureUserMustChangePasswordColumn,
  ensureAdminAuditLogTable,
} = require('../src/db');

function usage() {
  console.error('Usage: npm run promote-admin -- <email>');
  console.error('   or: ADMIN_EMAIL=<email> npm run promote-admin');
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function main() {
  const email = normalizeEmail(process.argv[2] || process.env.ADMIN_EMAIL);
  if (!email) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Not a valid email address: ${email}`);
    process.exitCode = 1;
    return;
  }

  await ensureUserActiveColumn();
  await ensureUserMustChangePasswordColumn();
  await ensureAdminAuditLogTable();

  const [rows] = await pool.query(
    'SELECT id, name, email, role, is_demo FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [email]
  );

  if (rows.length > 0 && Number(rows[0].is_demo)) {
    console.error('That email belongs to a demo account. Pick a real account instead.');
    process.exitCode = 1;
    return;
  }

  const temporaryPassword = crypto.randomBytes(18).toString('base64url');
  const hash = await argon2.hash(temporaryPassword);

  let userId;
  let created = false;
  if (rows.length > 0) {
    userId = rows[0].id;
    await pool.query(
      `UPDATE users
       SET role = 'ADMIN', password = ?, must_change_password = 1, is_active = 1,
           token_version = token_version + 1
       WHERE id = ?`,
      [hash, userId]
    );
  } else {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role, is_active, must_change_password)
       VALUES ('Admin', ?, ?, 'ADMIN', 1, 1)`,
      [email, hash]
    );
    userId = result.insertId;
    created = true;
  }

  const frontend = (process.env.FRONTEND_ORIGIN || 'https://makatipid-website.vercel.app').replace(/\/+$/, '');

  console.log('');
  console.log('  Admin access granted');
  console.log('  --------------------');
  console.log(`  Email:              ${email}`);
  console.log(`  Account:            #${userId}${created ? ' (newly created)' : ''}`);
  console.log(`  Temporary password: ${temporaryPassword}`);
  console.log('');
  console.log('  1. Open ' + `${frontend}/admin`);
  console.log('  2. Sign in with the email above and the temporary password.');
  console.log('  3. You will be forced to choose a new password before the dashboard unlocks.');
  console.log('');
  console.log('  The temporary password is shown once. It replaces the account\'s previous');
  console.log('  password, and every existing session for it has been signed out.');
  if (!created) {
    console.log('  NOTE: this email already had an account, so its old password no longer works.');
  }
  console.log('');
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
