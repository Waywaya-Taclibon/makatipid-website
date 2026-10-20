#!/usr/bin/env node
/*
 * Populates the marketplace with showcase content: six normal owner accounts,
 * two listings each. No bookings, no payments, no conversations, no messages.
 *
 *   npm run seed-showcase
 *   npm run seed-showcase -- --reset
 *   npm run seed-showcase -- --password "KnownPassword123"
 *
 * Run it against the deployed database without a Render shell by pointing
 * ENV_FILE at a local file that holds the production DB_* values:
 *
 *   ENV_FILE=.env.production.local npm run seed-showcase
 *
 * Safety:
 *   - Prints the target host/database before writing anything.
 *   - Refuses to run if any of the seed emails already exist (use --reset).
 *   - --reset refuses to delete any listing that has booking or payment
 *     history, and refuses to delete an ADMIN account.
 *   - Everything (delete + insert) happens in one transaction.
 *   - Seeded accounts are is_demo = 0, so the 6-hour demo reset never wipes
 *     them. They are normal USER accounts.
 */
const path = require('path');
const fs = require('fs');

const explicitEnvFile = process.env.ENV_FILE || process.env.ADMIN_ENV_FILE;
const envPath = explicitEnvFile
  ? path.resolve(process.cwd(), explicitEnvFile)
  : path.join(__dirname, '..', '.env');
if (explicitEnvFile && !fs.existsSync(envPath)) {
  console.error(`Env file not found: ${envPath}`);
  process.exit(1);
}
require('dotenv').config({ path: envPath });

const crypto = require('crypto');
const argon2 = require('argon2');
const {
  pool,
  ensureUserProfileColumns,
  ensureUserActiveColumn,
  ensureUserMustChangePasswordColumn,
  ensurePropertyImagesTable,
  ensurePropertyClientRequestId,
} = require('../src/db');

const argv = process.argv.slice(2);
const RESET = argv.includes('--reset');
const HELP = argv.includes('--help') || argv.includes('-h');
const passwordFlagIndex = argv.indexOf('--password');
const PASSWORD_OVERRIDE =
  passwordFlagIndex >= 0 && argv[passwordFlagIndex + 1] ? String(argv[passwordFlagIndex + 1]) : null;

// Photos already shipped in frontend/public/demo-photos. Relative URLs need no
// Cloudinary account, and the "demo:" public_id prefix tells the property
// delete route these never reached Cloudinary.
const PHOTOS = [
  '/demo-photos/demo-1.jpg',
  '/demo-photos/demo-2.jpg',
  '/demo-photos/demo-3.jpg',
  '/demo-photos/demo-4.jpg',
  '/demo-photos/demo-5.jpg',
  '/demo-photos/demo-6.jpg',
];

/** Today's date in Asia/Manila as YYYY-MM-DD, offset by whole days. */
function manilaDate(offsetDays = 0) {
  return new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

const OWNERS = [
  {
    name: 'Maria Santos',
    email: 'maria.santos@makatipid.app',
    phone: '+63 917 000 0101',
    facebook: 'https://facebook.com/makatipid.showcase',
    instagram: 'https://instagram.com/makatipid.showcase',
    properties: [
      {
        lotName: 'Bright Studio in Cubao',
        address: 'Cubao, Quezon City, Metro Manila',
        price: 12500,
        lat: 14.676,
        lng: 121.0437,
        availableInDays: 180,
        securityDeposit: 12500,
        internet: 'INCLUDED',
        electricityIncluded: true,
        waterIncluded: true,
        petsAllowed: false,
        smokingAllowed: false,
        modificationsAllowed: true,
      },
      {
        lotName: '2BR Walk-up near Katipunan',
        address: 'Loyola Heights, Quezon City, Metro Manila',
        price: 22000,
        lat: 14.6397,
        lng: 121.0777,
        availableInDays: 150,
        securityDeposit: 22000,
        internet: 'AVAILABLE',
        electricityIncluded: false,
        waterIncluded: true,
        petsAllowed: true,
        smokingAllowed: false,
        modificationsAllowed: false,
      },
    ],
  },
  {
    name: 'Jose Dela Cruz',
    email: 'jose.delacruz@makatipid.app',
    phone: '+63 917 000 0102',
    facebook: 'https://facebook.com/makatipid.showcase',
    instagram: 'https://instagram.com/makatipid.showcase',
    properties: [
      {
        lotName: 'Poblacion Loft with Balcony',
        address: 'Poblacion, Makati, Metro Manila',
        price: 28000,
        lat: 14.5547,
        lng: 121.0244,
        availableInDays: 120,
        securityDeposit: 28000,
        internet: 'INCLUDED',
        electricityIncluded: false,
        waterIncluded: false,
        petsAllowed: false,
        smokingAllowed: false,
        modificationsAllowed: true,
      },
      {
        lotName: 'Budget Bedspace in Guadalupe',
        address: 'Guadalupe Nuevo, Makati, Metro Manila',
        price: 5500,
        lat: 14.5646,
        lng: 121.0451,
        availableInDays: 90,
        securityDeposit: 5500,
        internet: 'AVAILABLE',
        electricityIncluded: true,
        waterIncluded: true,
        petsAllowed: false,
        smokingAllowed: false,
        modificationsAllowed: false,
      },
    ],
  },
  {
    name: 'Ana Villanueva',
    email: 'ana.villanueva@makatipid.app',
    phone: '+63 917 000 0103',
    facebook: 'https://facebook.com/makatipid.showcase',
    instagram: 'https://instagram.com/makatipid.showcase',
    properties: [
      {
        lotName: 'Ortigas Condo Studio',
        address: 'Ortigas Center, Pasig, Metro Manila',
        price: 19000,
        lat: 14.586,
        lng: 121.061,
        availableInDays: 180,
        securityDeposit: 19000,
        internet: 'INCLUDED',
        electricityIncluded: false,
        waterIncluded: true,
        petsAllowed: true,
        smokingAllowed: false,
        modificationsAllowed: false,
      },
      {
        lotName: 'Family Townhouse in Kapitolyo',
        address: 'Kapitolyo, Pasig, Metro Manila',
        price: 35000,
        lat: 14.571,
        lng: 121.058,
        availableInDays: 240,
        securityDeposit: 35000,
        internet: 'NONE',
        electricityIncluded: false,
        waterIncluded: false,
        petsAllowed: true,
        smokingAllowed: false,
        modificationsAllowed: true,
      },
    ],
  },
  {
    name: 'Carlo Mendoza',
    email: 'carlo.mendoza@makatipid.app',
    phone: '+63 917 000 0104',
    facebook: 'https://facebook.com/makatipid.showcase',
    instagram: 'https://instagram.com/makatipid.showcase',
    properties: [
      {
        lotName: 'BGC Shared Suite',
        address: 'Fort Bonifacio, Taguig, Metro Manila',
        price: 16000,
        lat: 14.55,
        lng: 121.05,
        availableInDays: 90,
        securityDeposit: 16000,
        internet: 'INCLUDED',
        electricityIncluded: true,
        waterIncluded: true,
        petsAllowed: false,
        smokingAllowed: false,
        modificationsAllowed: false,
      },
      {
        lotName: 'Near-Office 1BR in McKinley',
        address: 'McKinley Hill, Taguig, Metro Manila',
        price: 24000,
        lat: 14.535,
        lng: 121.048,
        availableInDays: 180,
        securityDeposit: 24000,
        internet: 'AVAILABLE',
        electricityIncluded: false,
        waterIncluded: true,
        petsAllowed: true,
        smokingAllowed: false,
        modificationsAllowed: true,
      },
    ],
  },
  {
    name: 'Liza Fernandez',
    email: 'liza.fernandez@makatipid.app',
    phone: '+63 917 000 0105',
    facebook: 'https://facebook.com/makatipid.showcase',
    instagram: 'https://instagram.com/makatipid.showcase',
    properties: [
      {
        lotName: 'IT Park Studio with Fast Fiber',
        address: 'Lahug, Cebu City, Cebu',
        price: 18000,
        lat: 10.33,
        lng: 123.905,
        availableInDays: 150,
        securityDeposit: 18000,
        internet: 'INCLUDED',
        electricityIncluded: true,
        waterIncluded: false,
        petsAllowed: false,
        smokingAllowed: false,
        modificationsAllowed: true,
      },
      {
        lotName: 'Mactan 2BR near Airport',
        address: 'Lapu-Lapu City, Cebu',
        price: 26000,
        lat: 10.305,
        lng: 123.979,
        availableInDays: 210,
        securityDeposit: 26000,
        internet: 'AVAILABLE',
        electricityIncluded: false,
        waterIncluded: true,
        petsAllowed: true,
        smokingAllowed: false,
        modificationsAllowed: false,
      },
    ],
  },
  {
    name: 'Miguel Torres',
    email: 'miguel.torres@makatipid.app',
    phone: '+63 917 000 0106',
    facebook: 'https://facebook.com/makatipid.showcase',
    instagram: 'https://instagram.com/makatipid.showcase',
    properties: [
      {
        lotName: 'Davao Downtown Studio',
        address: 'Poblacion, Davao City, Davao del Sur',
        price: 14000,
        lat: 7.07,
        lng: 125.608,
        availableInDays: 150,
        securityDeposit: 14000,
        internet: 'INCLUDED',
        electricityIncluded: true,
        waterIncluded: true,
        petsAllowed: false,
        smokingAllowed: false,
        modificationsAllowed: true,
      },
      {
        lotName: 'Baguio Hillside Retreat',
        address: 'Mines View, Baguio City, Benguet',
        price: 21000,
        lat: 16.42,
        lng: 120.626,
        availableInDays: 300,
        securityDeposit: 21000,
        internet: 'AVAILABLE',
        electricityIncluded: false,
        waterIncluded: false,
        petsAllowed: true,
        smokingAllowed: false,
        modificationsAllowed: true,
      },
    ],
  },
];

function usage() {
  console.log('');
  console.log('Usage: npm run seed-showcase [-- --reset] [-- --password <value>]');
  console.log('');
  console.log('  --reset             Remove the six seeded accounts/listings first.');
  console.log('                      Refuses if any seeded listing has bookings or payments.');
  console.log('  --password <value>  Use this password for all six accounts (min 10 chars).');
  console.log('                      Default: a unique random password per account.');
  console.log('');
  console.log('Targets backend/.env by default. Set ENV_FILE=... for another database.');
  console.log('');
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function generatedPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

async function targetInfo() {
  const [rows] = await pool.query('SELECT @@hostname AS hostname, DATABASE() AS db');
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || rows[0].db || 'makatipid_db',
    serverHostname: rows[0].hostname,
  };
}

async function removeExisting(conn, owners) {
  const emails = owners.map((owner) => owner.email);
  const [users] = await conn.query(
    'SELECT id, email, role FROM users WHERE LOWER(email) IN (?) FOR UPDATE',
    [emails]
  );
  if (users.length === 0) {
    console.log('  Nothing to remove: none of the seed emails exist yet.');
    return;
  }

  const admin = users.find((user) => String(user.role).toUpperCase() === 'ADMIN');
  if (admin) {
    throw new Error(
      `Refusing to delete ${admin.email}: it is an ADMIN account. Remove it from the seed list or handle it manually.`
    );
  }

  const userIds = users.map((user) => user.id);
  const [properties] = await conn.query(
    'SELECT id, lot_name FROM properties WHERE owner_id IN (?) FOR UPDATE',
    [userIds]
  );
  const propertyIds = properties.map((property) => property.id);

  if (propertyIds.length > 0) {
    const [[bookings]] = await conn.query(
      'SELECT COUNT(*) AS total FROM rentallog WHERE property_id IN (?)',
      [propertyIds]
    );
    const [[payments]] = await conn.query(
      'SELECT COUNT(*) AS total FROM payments WHERE property_id IN (?)',
      [propertyIds]
    );
    if (Number(bookings.total) > 0 || Number(payments.total) > 0) {
      throw new Error(
        `Refusing to delete the seeded listings: ${bookings.total} booking row(s) and ${payments.total} payment row(s) reference them. ` +
          'Cancel them in the admin dashboard first.'
      );
    }
    await conn.query('DELETE FROM conversations WHERE property_id IN (?)', [propertyIds]);
    await conn.query('DELETE FROM property_images WHERE property_id IN (?)', [propertyIds]);
    await conn.query('DELETE FROM properties WHERE id IN (?)', [propertyIds]);
  }

  await conn.query('DELETE FROM users WHERE id IN (?)', [userIds]);

  console.log(
    `  Removed ${users.length} account(s), ${properties.length} listing(s), and any conversations on them.`
  );
}

async function createContent(conn, prepared) {
  const created = [];
  let propertyCount = 0;

  for (const { owner, password, hash } of prepared) {
    const [userResult] = await conn.query(
      `INSERT INTO users
         (name, email, password, role, token_version, is_demo, is_active, must_change_password, phone, facebook, instagram)
       VALUES (?, ?, ?, 'USER', 0, 0, 1, 0, ?, ?, ?)`,
      [owner.name, owner.email, hash, owner.phone, owner.facebook, owner.instagram]
    );
    const userId = userResult.insertId;
    const listings = [];

    for (let i = 0; i < owner.properties.length; i += 1) {
      const seed = owner.properties[i];
      const [propertyResult] = await conn.query(
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
          userId,
          manilaDate(seed.availableInDays),
          seed.securityDeposit,
          seed.internet,
          seed.electricityIncluded,
          seed.waterIncluded,
          seed.petsAllowed,
          seed.smokingAllowed,
          seed.modificationsAllowed,
        ]
      );
      const propertyId = propertyResult.insertId;
      propertyCount += 1;

      // Two photos per listing, dealt from the six bundled demo photos.
      for (let photoIndex = 0; photoIndex < 2; photoIndex += 1) {
        const url = PHOTOS[(propertyCount * 2 + photoIndex) % PHOTOS.length];
        await conn.query(
          'INSERT INTO property_images (property_id, image_url, public_id, sort_order) VALUES (?, ?, ?, ?)',
          [propertyId, url, `demo:${url}`, photoIndex]
        );
      }

      listings.push({ id: propertyId, ...seed });
    }

    created.push({ id: userId, email: owner.email, name: owner.name, password, listings });
  }

  return { created, propertyCount };
}

async function verifyNoActivity(conn, userIds) {
  const [[conversations]] = await conn.query(
    'SELECT COUNT(*) AS total FROM conversations WHERE owner_id IN (?)',
    [userIds]
  );
  const [properties] = await conn.query('SELECT id FROM properties WHERE owner_id IN (?)', [userIds]);
  const propertyIds = properties.map((property) => property.id);

  let bookings = 0;
  let payments = 0;
  if (propertyIds.length > 0) {
    const [bookingRows] = await conn.query(
      'SELECT COUNT(*) AS total FROM rentallog WHERE property_id IN (?)',
      [propertyIds]
    );
    const [paymentRows] = await conn.query(
      'SELECT COUNT(*) AS total FROM payments WHERE property_id IN (?)',
      [propertyIds]
    );
    bookings = Number(bookingRows[0].total);
    payments = Number(paymentRows[0].total);
  }

  const unexpected = [];
  if (Number(conversations.total) > 0) unexpected.push(`${conversations.total} conversation(s)`);
  if (bookings > 0) unexpected.push(`${bookings} booking(s)`);
  if (payments > 0) unexpected.push(`${payments} payment(s)`);
  if (unexpected.length > 0) {
    throw new Error(`Seed produced unexpected activity: ${unexpected.join(', ')}. Rolling back.`);
  }
}

async function main() {
  if (HELP) {
    usage();
    return;
  }

  if (PASSWORD_OVERRIDE && PASSWORD_OVERRIDE.length < 10) {
    throw new Error('--password must be at least 10 characters.');
  }

  const target = await targetInfo();
  console.log('');
  console.log(`  Target database:  ${target.host}:${target.port}/${target.database}`);
  if (target.serverHostname) console.log(`  Server hostname:  ${target.serverHostname}`);
  console.log(`  Mode:             ${RESET ? 'reset then seed' : 'seed (abort if accounts exist)'}`);
  console.log('');

  await ensureUserProfileColumns();
  await ensureUserActiveColumn();
  await ensureUserMustChangePasswordColumn();
  await ensurePropertyImagesTable();
  await ensurePropertyClientRequestId();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT id, email FROM users WHERE LOWER(email) IN (?)',
      [OWNERS.map((owner) => normalizeEmail(owner.email))]
    );

    if (existing.length > 0) {
      if (!RESET) {
        throw new Error(
          `Seed accounts already exist (${existing.map((row) => row.email).join(', ')}). ` +
            'Re-run with --reset to recreate them, or change the emails in this script.'
        );
      }
      await removeExisting(conn, OWNERS);
    }

    // Hash before inserting so the transaction stays short.
    const prepared = [];
    for (const owner of OWNERS) {
      const password = PASSWORD_OVERRIDE || generatedPassword();
      const hash = await argon2.hash(password);
      prepared.push({ owner, password, hash });
    }

    const { created, propertyCount } = await createContent(conn, prepared);
    await verifyNoActivity(
      conn,
      created.map((row) => row.id)
    );

    await conn.commit();

    const width = Math.max(...created.map((row) => row.name.length), 7);
    console.log('  Seed complete');
    console.log('  -------------');
    console.log(`  ${'Name'.padEnd(width)}  ${'Email'.padEnd(34)}  ${'Password'.padEnd(18)}  Listings`);
    for (const row of created) {
      console.log(
        `  ${row.name.padEnd(width)}  ${row.email.padEnd(34)}  ${row.password.padEnd(18)}  ${row.listings.length}`
      );
    }
    console.log('');
    console.log(`  ${created.length} accounts, ${propertyCount} listings, 0 bookings, 0 payments, 0 messages.`);
    console.log('  These are normal USER accounts (is_demo = 0), so the demo reset will not touch them.');
    console.log('  Passwords are printed once. Save them if you want to log in as these owners.');
    if (!PASSWORD_OVERRIDE) {
      console.log('  Re-run with --password to reuse a known password instead of random ones.');
    }
    console.log('');
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
