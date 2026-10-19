// One-click demo accounts.
//
// Recruiters and testers should be able to try Makatipid in a single click. Two
// shared, flagged accounts ("owner" and "renter") are seeded with a small,
// believable slice of the marketplace, and everything demo-related is wiped and
// rebuilt on a fixed 6-hour cycle so no visitor ever inherits another's mess.
//
// Demo activity deliberately lands in the real tables (the demo owner books and
// messages like anyone else), so the reset sweeps by demo user id rather than
// hiding rows. Real users, real listings and real bookings are never touched.
const crypto = require('crypto');
const argon2 = require('argon2');
const { pool, getAppMeta, setAppMeta } = require('./db');

const RESET_PERIOD_MS = 6 * 3600 * 1000; // aligned to 00/06/12/18 Asia/Manila
const LAST_RESET_KEY = 'demo_last_reset';

// Demo photos live in the frontend's public folder and are referenced by
// relative URL, so no Cloudinary account is needed. Drop files into
// frontend/public/demo-photos as demo-1.jpg … demo-6.jpg, or override the list
// with the DEMO_PHOTOS env var (comma-separated).
const DEFAULT_DEMO_PHOTOS = [
  '/demo-photos/demo-1.jpg',
  '/demo-photos/demo-2.jpg',
  '/demo-photos/demo-3.jpg',
  '/demo-photos/demo-4.jpg',
  '/demo-photos/demo-5.jpg',
  '/demo-photos/demo-6.jpg',
];

const DEMO_USERS = {
  owner: {
    name: 'Makatipid Demo · Owner',
    email: 'demo.owner@makatipid.app',
    phone: '+63 917 000 0001',
    facebook: 'https://facebook.com/makatipid.demo',
    instagram: 'https://instagram.com/makatipid.demo',
  },
  renter: {
    name: 'Makatipid Demo · Renter',
    email: 'demo.renter@makatipid.app',
    phone: '+63 917 000 0002',
    facebook: 'https://facebook.com/makatipid.demo',
    instagram: 'https://instagram.com/makatipid.demo',
  },
};

function isDemoEnabled() {
  // On by default (including production); set DEMO_LOGIN_ENABLED=false to kill
  // both the buttons and the endpoint.
  return String(process.env.DEMO_LOGIN_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
}

function demoPhotos() {
  const raw = (process.env.DEMO_PHOTOS || '').trim();
  if (!raw) return DEFAULT_DEMO_PHOTOS;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Today's date in Asia/Manila as YYYY-MM-DD, offset by whole days. */
function manilaDate(offsetDays = 0) {
  return new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

// Demo ids are remembered in app_meta so a tester editing the demo account's
// email (which is allowed) can't orphan it — the reset would otherwise create a
// second account on the next lookup.
async function findDemoUserId(role, spec) {
  const metaKey = `demo_${role}_id`;

  const stored = await getAppMeta(metaKey);
  if (stored) {
    const id = Number(stored);
    if (Number.isInteger(id) && id > 0) {
      const [rows] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [id]);
      if (rows.length > 0) {
        await pool.query('UPDATE users SET is_demo = 1 WHERE id = ?', [id]);
        return id;
      }
    }
  }

  const [byEmail] = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [spec.email]);
  if (byEmail.length > 0) {
    const id = byEmail[0].id;
    await pool.query('UPDATE users SET is_demo = 1 WHERE id = ?', [id]);
    await setAppMeta(metaKey, String(id));
    return id;
  }

  // The password is random and never surfaced — demo sessions are minted by the
  // /auth/demo endpoint, not by logging in with credentials.
  const hash = await argon2.hash(crypto.randomBytes(24).toString('hex'));
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password, role, is_demo, phone, facebook, instagram) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
    [spec.name, spec.email, hash, 'USER', spec.phone, spec.facebook, spec.instagram]
  );
  await setAppMeta(metaKey, String(result.insertId));
  return result.insertId;
}

/** Ensures both demo accounts exist. Safe to call on every boot / demo login. */
async function ensureDemoData() {
  const owner = await findDemoUserId('owner', DEMO_USERS.owner);
  const renter = await findDemoUserId('renter', DEMO_USERS.renter);
  return { owner, renter };
}

// Reset puts the demo profiles back to their defaults (testers may have renamed
// them). Skips the email if a real account has since claimed it.
async function restoreDemoProfile(q, id, spec) {
  const [taken] = await q.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1', [
    spec.email,
    id,
  ]);
  if (taken.length === 0) {
    await q.query('UPDATE users SET name = ?, email = ?, phone = ?, facebook = ?, instagram = ? WHERE id = ?', [
      spec.name,
      spec.email,
      spec.phone,
      spec.facebook,
      spec.instagram,
      id,
    ]);
  } else {
    await q.query('UPDATE users SET name = ?, phone = ?, facebook = ?, instagram = ? WHERE id = ?', [
      spec.name,
      spec.phone,
      spec.facebook,
      spec.instagram,
      id,
    ]);
  }
}

async function restoreDemoProfiles(q, ids) {
  await restoreDemoProfile(q, ids.owner, DEMO_USERS.owner);
  await restoreDemoProfile(q, ids.renter, DEMO_USERS.renter);
}

// A handful of realistic Philippine rentals so the demo dashboard looks lived-in.
function propertySeeds() {
  return [
    {
      lotName: 'Sunny Studio near Katipunan',
      address: 'Loyola Heights, Quezon City, Metro Manila',
      price: 15000,
      lat: 14.6397,
      lng: 121.0777,
      availableUntil: manilaDate(180),
      securityDeposit: 15000,
      internet: 'INCLUDED',
      electricityIncluded: true,
      waterIncluded: true,
      petsAllowed: false,
      smokingAllowed: false,
      modificationsAllowed: true,
    },
    {
      lotName: 'Makati 1BR with City View',
      address: 'Poblacion, Makati, Metro Manila',
      price: 32000,
      lat: 14.5547,
      lng: 121.0244,
      availableUntil: manilaDate(120),
      securityDeposit: 32000,
      internet: 'AVAILABLE',
      electricityIncluded: false,
      waterIncluded: true,
      petsAllowed: true,
      smokingAllowed: false,
      modificationsAllowed: false,
    },
    {
      lotName: 'Cebu IT Park Studio',
      address: 'Lahug, Cebu City, Cebu',
      price: 18000,
      lat: 10.33,
      lng: 123.905,
      availableUntil: manilaDate(150),
      securityDeposit: 18000,
      internet: 'INCLUDED',
      electricityIncluded: true,
      waterIncluded: false,
      petsAllowed: false,
      smokingAllowed: false,
      modificationsAllowed: true,
    },
    {
      lotName: 'BGC Bedspace (bunk)',
      address: 'Fort Bonifacio, Taguig, Metro Manila',
      price: 6500,
      lat: 14.55,
      lng: 121.05,
      availableUntil: manilaDate(90),
      securityDeposit: 6500,
      internet: 'AVAILABLE',
      electricityIncluded: true,
      waterIncluded: true,
      petsAllowed: false,
      smokingAllowed: false,
      modificationsAllowed: false,
    },
  ];
}

async function insertProperty(q, seed, ownerId) {
  const [result] = await q.query(
    `INSERT INTO properties
       (lot_name, address, price, lat, lng, owner_id, archived, available_until, security_deposit,
        internet, electricity_included, water_included, pets_allowed, smoking_allowed, modifications_allowed)
     VALUES (?, ?, ?, ?, ?, ?, FALSE, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seed.lotName,
      seed.address,
      seed.price,
      seed.lat,
      seed.lng,
      ownerId,
      seed.availableUntil,
      seed.securityDeposit,
      seed.internet,
      seed.electricityIncluded,
      seed.waterIncluded,
      seed.petsAllowed,
      seed.smokingAllowed,
      seed.modificationsAllowed,
    ]
  );
  return result.insertId;
}

async function insertDemoPhotos(q, propertyId, startIndex, count) {
  const photos = demoPhotos();
  if (photos.length === 0) return;
  for (let i = 0; i < count; i += 1) {
    const url = photos[(startIndex + i) % photos.length];
    await q.query(
      'INSERT INTO property_images (property_id, image_url, public_id, sort_order) VALUES (?, ?, ?, ?)',
      [propertyId, url, `demo:${url}`, i]
    );
  }
}

/**
 * Builds the demo marketplace from scratch. Accepts an optional connection so
 * it can run inside the reset transaction.
 */
async function seedDemoContent(conn, ownerId, renterId) {
  const q = conn || pool;
  const seeds = propertySeeds();
  const ids = [];
  for (let i = 0; i < seeds.length; i += 1) {
    const propertyId = await insertProperty(q, seeds[i], ownerId);
    // Two photos each, dealt from the configured set so listings look distinct.
    await insertDemoPhotos(q, propertyId, i * 2, 2);
    ids.push(propertyId);
  }

  const [first, second, third, fourth] = ids;

  // One ongoing rental (so "My Properties" shows an occupied unit) and one that
  // has finished (so booking history isn't empty).
  await q.query(
    "INSERT INTO rentallog (property_id, renter_id, start_date, end_date, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
    [fourth, renterId, manilaDate(-20), manilaDate(40)]
  );
  await q.query(
    "INSERT INTO rentallog (property_id, renter_id, start_date, end_date, status) VALUES (?, ?, ?, ?, 'ENDED')",
    [second, renterId, manilaDate(-150), manilaDate(-60)]
  );

  // A live owner ↔ renter chat, so the inbox and the 24-hour countdown aren't
  // empty. The window is 24h from seeding and is rebuilt on every reset.
  const [conversation] = await q.query(
    `INSERT INTO conversations (property_id, owner_id, renter_id, last_message_at, expires_at)
     VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
    [first, ownerId, renterId]
  );
  const conversationId = conversation.insertId;
  const thread = [
    { sender: renterId, body: 'Hi! Is this unit still available for next month?' },
    { sender: ownerId, body: 'Hello! Yes, it is available. When would you like to move in?' },
    { sender: renterId, body: 'Great — I was thinking the 1st. Can we schedule a viewing?' },
    { sender: ownerId, body: 'Sure, I can do Saturday morning. I will send the exact time shortly.' },
  ];
  for (const message of thread) {
    await q.query('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)', [
      conversationId,
      message.sender,
      message.body,
    ]);
  }

  // Touch the seeded chat to the top of the inbox.
  await q.query('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [conversationId]);

  // second/third are otherwise free so testers can book them; `third` is used
  // only to keep the ids readable above.
  void third;
}

/**
 * Wipes everything the demo touched (in FK-safe order) and re-seeds. The demo
 * user ids are stable, so testers' live sessions survive a reset.
 */
async function resetDemoData() {
  const ids = await ensureDemoData();
  const demoIds = [ids.owner, ids.renter];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [owned] = await conn.query('SELECT id FROM properties WHERE owner_id IN (?)', [demoIds]);
    const propertyIds = owned.map((row) => row.id);

    // payments → conversations/messages → rentallog → property_images → properties
    if (propertyIds.length > 0) {
      await conn.query('DELETE FROM payments WHERE property_id IN (?) OR renter_id IN (?)', [propertyIds, demoIds]);
      await conn.query('DELETE FROM rentallog WHERE property_id IN (?) OR renter_id IN (?)', [propertyIds, demoIds]);
      await conn.query('DELETE FROM property_images WHERE property_id IN (?)', [propertyIds]);
    } else {
      await conn.query('DELETE FROM payments WHERE renter_id IN (?)', [demoIds]);
      await conn.query('DELETE FROM rentallog WHERE renter_id IN (?)', [demoIds]);
    }
    await conn.query('DELETE FROM conversations WHERE owner_id IN (?) OR renter_id IN (?)', [demoIds, demoIds]);
    if (propertyIds.length > 0) {
      await conn.query('DELETE FROM properties WHERE id IN (?)', [propertyIds]);
    }
    await restoreDemoProfiles(conn, ids);
    await seedDemoContent(conn, ids.owner, ids.renter);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  await setAppMeta(LAST_RESET_KEY, new Date().toISOString());
  return ids;
}

/**
 * Called by /auth/demo: guarantees the accounts exist and that there is at least
 * one demo listing to look at (first-ever run, or a reset that found nothing).
 */
async function prepareDemoSession() {
  const ids = await ensureDemoData();
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM properties WHERE owner_id = ?', [ids.owner]);
  if (Number(rows[0].count) === 0) {
    await seedDemoContent(null, ids.owner, ids.renter);
  }
  return ids;
}

/** Milliseconds until the next clock-aligned reset (00/06/12/18 Manila). */
function msUntilNextReset(now = Date.now()) {
  const manilaMs = now + 8 * 3600 * 1000;
  const sinceBoundary = ((manilaMs % RESET_PERIOD_MS) + RESET_PERIOD_MS) % RESET_PERIOD_MS;
  const delay = RESET_PERIOD_MS - sinceBoundary;
  return delay < 1000 ? delay + RESET_PERIOD_MS : delay;
}

/** True when a reset slot passed while the server was asleep/offline. */
async function shouldResetOnBoot(now = Date.now()) {
  const last = await getAppMeta(LAST_RESET_KEY);
  if (!last) return true;
  const lastMs = Date.parse(last);
  if (!Number.isFinite(lastMs)) return true;
  return now - lastMs >= RESET_PERIOD_MS;
}

module.exports = {
  isDemoEnabled,
  demoPhotos,
  ensureDemoData,
  prepareDemoSession,
  seedDemoContent,
  resetDemoData,
  msUntilNextReset,
  shouldResetOnBoot,
  DEMO_USERS,
};
