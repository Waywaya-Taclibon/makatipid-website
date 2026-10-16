import { authHeaders, storedTokenInfo } from './authHeaders'
import { API_BASE } from './http'
import type { Booking } from '../data/rentallog'

const PAYMONGO_API = 'https://api.paymongo.com/v1'

/** QR code lifetime in seconds (PayMongo allows 60–9000). */
export const QR_EXPIRY_SECONDS = 300

export interface BookingIntent {
  intentId: string
  clientKey: string
  amountCentavos: number
  /** PayMongo environment the BACKEND key points at ("test" | "live" | ...). */
  keyMode?: string
}

/** PayMongo environment the FRONTEND public key points at (prefix only, never the key). */
export function frontendKeyMode(): string {
  const key = import.meta.env.VITE_PAYMONGO_PUBLIC_KEY as string | undefined
  if (!key) return 'missing'
  if (key.startsWith('pk_test_')) return 'test'
  if (key.startsWith('pk_live')) return 'live'
  return 'unknown'
}

export interface QrAttachResult {
  status: string
  /** Base64 image URL for <img src> (next_action.code.image_url). */
  qrImageUrl: string | null
  /** Test-mode simulator link, when PayMongo includes one in the response. */
  testUrl: string | null
}

function publicKey(): string {
  const key = import.meta.env.VITE_PAYMONGO_PUBLIC_KEY as string | undefined
  if (!key) {
    throw new Error('Online payment is not configured yet (missing PayMongo public key).')
  }
  return key
}

function basicAuth(key: string): string {
  return `Basic ${btoa(`${key}:`)}`
}

/** Pulls the code + message out of PayMongo's {errors:[{code, detail}]} payload. */
async function paymongoErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    const first = body?.errors?.[0]
    const detail = typeof first?.detail === 'string' && first.detail ? first.detail : null
    const code = typeof first?.code === 'string' && first.code ? first.code : null
    if (detail && code) {
      const hint = code === 'resource_not_found'
        ? ' (Test/live key mismatch: make sure the frontend public key AND backend secret key are BOTH test keys, and BOTH servers were restarted after changing them.)'
        : ''
      return `PayMongo (${code}): ${detail}${hint}`
    }
    if (detail) return detail
  } catch {
    // fall through to generic message
  }
  return `PayMongo request failed: ${res.status}`
}

/**
 * Backend 401/403s come in two flavors: Spring Security rejections (empty
 * body = genuinely not logged in) and forwarded PayMongo errors (with a
 * message body). Only the former means "session expired".
 */
async function throwForStatus(prefix: string, res: Response): Promise<never> {
  const errorText = await res.text().catch(() => '')
  if ((res.status === 401 || res.status === 403) && !errorText) {
    // Empty-body 401 = Spring rejected the token. Include the saved login's
    // age so stale-token cases (old tab, different origin) are obvious.
    const info = storedTokenInfo()
    const age = info?.issuedAt
      ? ` (saved login from ${new Date(info.issuedAt * 1000).toLocaleString('en-PH')})`
      : ' (no usable saved login)'
    throw new Error(
      `Server rejected your login token${age}. Log out and log back in on this exact page and tab, then try again.`
    )
  }
  throw new Error(errorText || `${prefix}: ${res.status}`)
}

/** Step 1: ask OUR backend to validate the booking and open a Payment Intent. */
export async function createBookingIntent(
  propertyId: number,
  startDate: string,
  endDate: string
): Promise<BookingIntent> {
  const response = await fetch(`${API_BASE}/payments/intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ propertyId, startDate, endDate }),
  })
  if (!response.ok) await throwForStatus('Failed to start payment', response)
  return response.json()
}

/** Step 2: create a QR Ph Payment Method with the PUBLIC key. */
export async function createQrPaymentMethod(): Promise<string> {
  const response = await fetch(`${PAYMONGO_API}/payment_methods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(publicKey()),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          type: 'qrph',
          expiry_seconds: QR_EXPIRY_SECONDS,
        },
      },
    }),
  })
  if (!response.ok) throw new Error(await paymongoErrorMessage(response))
  const body = await response.json()
  return body.data.id as string
}

/**
 * Step 3: attach the QR Payment Method (PUBLIC key + client_key).
 * Comes back as `awaiting_next_action` with the QR image at
 * next_action.code.image_url. No redirect involved.
 */
export async function attachQrPaymentMethod(
  intentId: string,
  clientKey: string,
  paymentMethodId: string
): Promise<QrAttachResult> {
  const response = await fetch(`${PAYMONGO_API}/payment_intents/${intentId}/attach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(publicKey()),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          payment_method: paymentMethodId,
          client_key: clientKey,
        },
      },
    }),
  })
  if (!response.ok) throw new Error(await paymongoErrorMessage(response))
  const body = await response.json()
  const attributes = body.data.attributes
  const nextAction = attributes.next_action ?? {}
  // Test-mode simulator link location varies; check the known spots first,
  // then deep-scan the whole next_action object for any http(s) URL
  // (the Base64 QR image uses a data: scheme, so it never matches).
  const testUrl =
    (typeof nextAction.test_url === 'string' && nextAction.test_url) ||
    (typeof attributes.test_url === 'string' && attributes.test_url) ||
    findHttpUrl(nextAction)
  if (typeof window !== 'undefined' && nextAction && Object.keys(nextAction).length > 0) {
    console.debug('[PayMongo] next_action:', nextAction)
  }
  return {
    status: attributes.status as string,
    qrImageUrl: (nextAction.code?.image_url as string | undefined) ?? null,
    testUrl,
  }
}

/** Recursively finds the first http(s) URL in an unknown JSON shape. */
function findHttpUrl(node: unknown): string | null {
  if (typeof node === 'string') {
    return /^https?:\/\//i.test(node) ? node : null
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findHttpUrl(item)
      if (found) return found
    }
    return null
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) {
      const found = findHttpUrl(value)
      if (found) return found
    }
  }
  return null
}

/** Live intent status for QR polling (goes through OUR backend, ownership-checked). */
export async function getPaymentStatus(intentId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/payments/intents/${intentId}`, {
    headers: authHeaders(),
  })
  if (!response.ok) await throwForStatus('Failed to check payment status', response)
  const body = await response.json()
  return body.status as string
}

/** Step 4: after success, ask OUR backend to verify and create the booking. */
export async function confirmBookingPayment(intentId: string): Promise<Booking> {
  const response = await fetch(`${API_BASE}/payments/intents/${intentId}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!response.ok) await throwForStatus('Payment confirmation failed', response)
  return response.json()
}

export function formatCentavos(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`
}
