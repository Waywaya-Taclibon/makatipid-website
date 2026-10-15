// Thin wrapper over the PayMongo Payments API (test mode).
// Only the SECRET key is ever used here — it never leaves the server.
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

module.exports = { isConfigured, keyMode, createPaymentIntent, retrievePaymentIntent };
