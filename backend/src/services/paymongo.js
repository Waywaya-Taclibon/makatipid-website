// Thin wrapper over the PayMongo Payments API (test mode).
// Only the SECRET key is ever used here — it never leaves the server.
const crypto = require('crypto');

const BASE_URL = 'https://api.paymongo.com/v1';

function secretKey() {
  return (process.env.PAYMONGO_SECRET_KEY || '').trim();
}

function isConfigured() {
  return secretKey().length > 0;
}

// Returns only the mode ("test" | "live" | "missing" | "unknown") — never any part of the key.
function keyMode() {
  const k = secretKey();
  if (!k) return 'missing';
  if (k.startsWith('sk_test_')) return 'test';
  if (k.startsWith('sk_live')) return 'live';
  return 'unknown';
}

function authHeader() {
  return `Basic ${Buffer.from(`${secretKey()}:`).toString('base64')}`;
}

function extractDetail(bodyText, parsed) {
  const first = parsed && Array.isArray(parsed.errors) && parsed.errors[0];
  if (first && typeof first.detail === 'string' && first.detail) return first.detail;
  return bodyText && bodyText.length > 0 ? bodyText : 'PayMongo request failed.';
}

async function handlePayMongoError(res) {
  const text = await res.text().catch(() => '');
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const err = new Error(extractDetail(text, parsed));
  err.status = res.status;
  err.isPayMongo = true;
  throw err;
}

// Creates a Payment Intent. Returns the raw `data` node ({id, attributes.client_key, ...}).
async function createPaymentIntent(amountCentavos, description, metadata) {
  const res = await fetch(`${BASE_URL}/payment_intents`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountCentavos,
          payment_method_allowed: ['qrph'],
          currency: 'PHP',
          description,
          metadata,
        },
      },
    }),
  });
  if (!res.ok) await handlePayMongoError(res);
  const body = await res.json();
  return body.data;
}

// Retrieves a Payment Intent. Returns the raw `data` node.
async function retrievePaymentIntent(intentId) {
  const res = await fetch(`${BASE_URL}/payment_intents/${encodeURIComponent(intentId)}`, {
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
  });
  if (!res.ok) await handlePayMongoError(res);
  const body = await res.json();
  if (!body || !body.data) {
    const err = new Error('Empty response from PayMongo.');
    err.status = 502;
    throw err;
  }
  return body.data;
}

function webhookSecret() {
  return (process.env.PAYMONGO_WEBHOOK_SECRET || '').trim();
}

// Verifies the `paymongo-signature` header against the raw request bytes.
// PayMongo format: "t=<timestamp>,te=<test_sig>,li=<live_sig>" where each sig is
// HMAC_SHA256("<timestamp>.<raw_body>", webhook_secret). Accepts either te or li.
function verifyWebhookSignature(rawBody, headerValue) {
  const secret = webhookSecret();
  if (!secret) return { ok: false, reason: 'webhook-secret-not-configured' };
  if (!headerValue) return { ok: false, reason: 'missing-signature' };
  const parts = Object.fromEntries(
    String(headerValue)
      .split(',')
      .map((kv) => {
        const i = kv.indexOf('=');
        return i < 0 ? [] : [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
      })
      .filter((kv) => kv.length === 2)
  );
  const timestamp = parts.t;
  if (!timestamp || (!parts.te && !parts.li)) return { ok: false, reason: 'malformed-signature' };
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  const a = Buffer.from(expected);
  for (const candidate of [parts.te, parts.li].filter(Boolean)) {
    try {
      if (candidate.length === a.length && crypto.timingSafeEqual(a, Buffer.from(candidate))) {
        return { ok: true };
      }
    } catch {
      // fall through
    }
  }
  return { ok: false, reason: 'signature-mismatch' };
}

module.exports = { isConfigured, keyMode, createPaymentIntent, retrievePaymentIntent, webhookSecret, verifyWebhookSignature };
