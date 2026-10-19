import { API_BASE } from './http'
import type { DemoRole } from '../data/demo'

export interface AuthResponse {
  token: string
  name: string
  id: number
}

export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Invalid email or password')
  return res.json()
}

export async function registerRequest(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  if (!res.ok) throw new Error('Could not create account')
  return res.json()
}

export interface DemoAuthResponse extends AuthResponse {
  demo: true
  role: DemoRole
}

/**
 * One-click demo login. Mints a session for a shared, seeded demo account —
 * no password, no form. Returns a message worth showing if the demo is off.
 */
export async function demoLogin(role: DemoRole): Promise<DemoAuthResponse> {
  const res = await fetch(`${API_BASE}/auth/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    let message = 'Could not start the demo. Please try again.'
    try {
      const body = await res.json()
      if (body && typeof body.message === 'string') message = body.message
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message)
  }
  return res.json()
}