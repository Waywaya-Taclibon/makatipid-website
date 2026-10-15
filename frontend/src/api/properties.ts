import type { CreatePropertyInput, Property } from '../data/properties'

const API_BASE = 'http://localhost:8080/api'

export async function fetchProperties(): Promise<Property[]> {
  const res = await fetch(`${API_BASE}/properties`)
  if (!res.ok) {
    throw new Error(`Failed to fetch properties: ${res.status}`)
  }
  return res.json()
}

/** Bookable feed for renters: archived properties are excluded server-side. */
export async function fetchAvailableProperties(): Promise<Property[]> {
  const res = await fetch(`${API_BASE}/properties/available`)
  if (!res.ok) {
    throw new Error(`Failed to fetch properties: ${res.status}`)
  }
  return res.json()
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function throwDetailed(prefix: string, res: Response): Promise<never> {
  let detail: string
  try {
    const body = await res.json()
    detail = typeof body?.message === 'string' ? body.message : JSON.stringify(body)
  } catch {
    try {
      detail = await res.text()
    } catch {
      detail = ''
    }
  }
  throw new Error(detail ? `${prefix}: ${detail}` : `${prefix}: ${res.status}`)
}

export async function createProperty(data: CreatePropertyInput): Promise<Property> {
  const res = await fetch(`${API_BASE}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Failed to create property: ${res.status}`)
  return res.json()
}

export async function updateProperty(id: number, data: CreatePropertyInput): Promise<Property> {
  const res = await fetch(`${API_BASE}/properties/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwDetailed('Failed to update property', res)
  return res.json()
}

export async function deleteProperty(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/properties/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) await throwDetailed('Failed to delete property', res)
}

export async function archiveProperty(id: number): Promise<Property> {
  const res = await fetch(`${API_BASE}/properties/${id}/archive`, {
    method: 'PUT',
    headers: authHeaders(),
  })
  if (!res.ok) await throwDetailed('Failed to archive property', res)
  return res.json()
}

export async function unarchiveProperty(id: number): Promise<Property> {
  const res = await fetch(`${API_BASE}/properties/${id}/unarchive`, {
    method: 'PUT',
    headers: authHeaders(),
  })
  if (!res.ok) await throwDetailed('Failed to unarchive property', res)
  return res.json()
}