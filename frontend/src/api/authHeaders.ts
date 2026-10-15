export function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Decodes the stored JWT payload (no secret needed) for diagnostics. */
export function storedTokenInfo(): {
  subject: string | null
  issuedAt: number | null
  expiresAt: number | null
} | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return {
      subject: typeof payload.sub === 'string' ? payload.sub : null,
      issuedAt: typeof payload.iat === 'number' ? payload.iat : null,
      expiresAt: typeof payload.exp === 'number' ? payload.exp : null,
    }
  } catch {
    return null
  }
}

/** True when the JWT is missing, malformed, or past its `exp` claim. */
export function isStoredTokenExpired(): boolean {
  const token = localStorage.getItem('token')
  if (!token) return true
  const parts = token.split('.')
  if (parts.length !== 3) return true
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp !== 'number') return false
    return Date.now() / 1000 >= payload.exp
  } catch {
    return true
  }
}