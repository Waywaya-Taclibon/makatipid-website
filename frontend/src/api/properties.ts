import type { CreatePropertyInput, InternetOption, Property, PropertyImage } from '../data/properties'
import { API_BASE, apiFetch } from './http'

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
  // apiFetch attaches the member token when present: the server only includes
  // owner contact details for signed-in renters, which the Contact Owner modal
  // needs. Anonymous visitors still get the same list, just without contacts.
  const res = await apiFetch('/properties/available')
  if (!res.ok) {
    throw new Error(`Failed to fetch properties: ${res.status}`)
  }
  return res.json()
}

export type SearchSort = 'newest' | 'price_asc' | 'price_desc'

export interface SearchFilters {
  q?: string
  /** YYYY-MM-DD. `start` and `end` must be supplied together. */
  start?: string
  end?: string
  minPrice?: number
  maxPrice?: number
  maxDeposit?: number
  internet?: InternetOption
  pets?: boolean
  smoking?: boolean
  modifications?: boolean
  electricity?: boolean
  water?: boolean
  sort?: SearchSort
  limit?: number
  offset?: number
}

export interface SearchResult {
  items: Property[]
  total: number
  limit: number
  offset: number
}

function buildSearchQuery(filters: SearchFilters): string {
  const params = new URLSearchParams()
  const q = filters.q?.trim()
  if (q) params.set('q', q)
  if (filters.start) params.set('start', filters.start)
  if (filters.end) params.set('end', filters.end)

  const numeric: [string, number | undefined][] = [
    ['minPrice', filters.minPrice],
    ['maxPrice', filters.maxPrice],
    ['maxDeposit', filters.maxDeposit],
    ['limit', filters.limit],
    ['offset', filters.offset],
  ]
  for (const [key, value] of numeric) {
    if (typeof value === 'number' && Number.isFinite(value)) params.set(key, String(value))
  }

  if (filters.internet) params.set('internet', filters.internet)
  if (filters.sort) params.set('sort', filters.sort)

  const booleans: [string, boolean | undefined][] = [
    ['pets', filters.pets],
    ['smoking', filters.smoking],
    ['modifications', filters.modifications],
    ['electricity', filters.electricity],
    ['water', filters.water],
  ]
  for (const [key, value] of booleans) {
    if (value) params.set(key, '1')
  }

  return params.toString()
}

/** Public search: works signed out, and returns owner contact only when signed in. */
export async function searchProperties(filters: SearchFilters): Promise<SearchResult> {
  const query = buildSearchQuery(filters)
  const res = await apiFetch(`/properties/search${query ? `?${query}` : ''}`)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || `Search failed (${res.status})`)
  }
  return res.json()
}

/** Destination autocomplete drawn from addresses that actually have listings. */
export async function fetchAddressSuggestions(query: string, signal?: AbortSignal): Promise<string[]> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  try {
    const res = await fetch(`${API_BASE}/properties/suggestions?${params.toString()}`, { signal })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data.filter((value: unknown): value is string => typeof value === 'string') : []
  } catch {
    // Aborted or offline — suggestions are a nicety, never a blocker.
    return []
  }
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
  if (!res.ok) await throwDetailed('Failed to create property', res)
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