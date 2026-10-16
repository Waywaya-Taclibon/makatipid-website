import type { CreatePropertyInput, Property, PropertyImage } from '../data/properties'
import { apiFetch } from './http'

const API_BASE = 'http://localhost:8080/api'

export async function fetchProperties(): Promise<Property[]> {
  const res = await fetch(`${API_BASE}/properties`)
  if (!res.ok) {
    throw new Error(`Failed to fetch properties: ${res.status}`)
  }
  return res.json()
}

/** Owner-only feed: only the logged-in user's properties (avoids downloading everyone's data). */
export async function fetchMyProperties(): Promise<Property[]> {
  const res = await apiFetch(`/properties/mine`)
  if (res.status === 401) {
    throw new Error('Your session has expired. Please log in again.')
  }
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

export async function fetchProperty(id: number): Promise<Property> {
  const res = await fetch(`${API_BASE}/properties/${id}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch property: ${res.status}`)
  }
  return res.json()
}

/** Owner-only: uploads one batch of photos (server caps at 3 total per property). */
export async function uploadPropertyImages(propertyId: number, files: File[]): Promise<PropertyImage[]> {
  const form = new FormData()
  files.forEach((f) => form.append('photos', f))
  // NOTE: no Content-Type header — the browser sets the multipart boundary.
  const res = await apiFetch(`/properties/${propertyId}/images`, { method: 'POST', body: form })
  if (!res.ok) await throwDetailed('Failed to upload photos', res)
  return res.json()
}

/** Owner-only: removes one photo. Returns the remaining photos. */
export async function deletePropertyImage(propertyId: number, imageId: number): Promise<PropertyImage[]> {
  const res = await apiFetch(`/properties/${propertyId}/images/${imageId}`, { method: 'DELETE' })
  if (!res.ok) await throwDetailed('Failed to remove photo', res)
  return res.json()
}

/** Owner-only: rewrites the photo order (first id = cover). Returns the reordered photos. */
export async function reorderPropertyImages(propertyId: number, order: number[]): Promise<PropertyImage[]> {
  const res = await apiFetch(`/properties/${propertyId}/images/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  })
  if (!res.ok) await throwDetailed('Failed to reorder photos', res)
  return res.json()
}