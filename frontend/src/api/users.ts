import { authHeaders } from './authHeaders'
import { API_BASE } from './http'

export interface UserProfile {
  id: number
  name: string
  email: string
  role?: string
  /** Owner contact fields — null until the user fills them in. */
  phone: string | null
  facebook: string | null
  instagram: string | null
}

export interface UpdateProfileInput {
  name: string
  email: string
  /** Omit to leave the stored value untouched; send null/'' to clear. */
  phone?: string | null
  facebook?: string | null
  instagram?: string | null
  /** Only needed when the email is changing. */
  currentPassword?: string
}

export interface UpdateProfileResponse extends UserProfile {
  token?: string
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return body && typeof body.message === 'string' ? body.message : fallback
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/me`, { headers: authHeaders() })
  if (res.status === 401) throw new Error('Your session has expired. Please log in again.')
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to load your profile (${res.status})`))
  return res.json()
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<UpdateProfileResponse> {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  })
  if (res.status === 401) throw new Error('Your session has expired. Please log in again.')
  if (!res.ok) throw new Error(await errorMessage(res, `Failed to save your details (${res.status})`))
  return res.json()
}

/**
 * A profile is "eligible for listing" once a phone number is on file.
 * Name and email already exist from signup; socials stay optional.
 */
export function isProfileComplete(profile: Pick<UserProfile, 'phone'> | null | undefined): boolean {
  return Boolean(profile && profile.phone && profile.phone.trim())
}

const MAX_PHONE_LEN = 32
const MAX_SOCIAL_LEN = 255

/**
 * Client-side mirror of the server's phone rule. Phone is optional here —
 * callers that need it (the listing gate) check for emptiness themselves.
 * Returns an error message, or null when the value is acceptable.
 */
export function validatePhone(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_PHONE_LEN) return `Phone must be ${MAX_PHONE_LEN} characters or fewer.`
  if (!/^[0-9+()\-.\s]+$/.test(trimmed)) return 'Phone can only contain digits, spaces and + ( ) - .'
  if (trimmed.replace(/\D/g, '').length < 7) return 'Please enter a complete phone number.'
  return null
}

/** Client-side mirror of the server's rule for Facebook/Instagram handles. */
export function validateSocial(value: string, label: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_SOCIAL_LEN) return `${label} must be ${MAX_SOCIAL_LEN} characters or fewer.`
  if (/\s/.test(trimmed)) return `${label} cannot contain spaces.`
  return null
}
