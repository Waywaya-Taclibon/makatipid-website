import { API_BASE } from './http'

const TOKEN_KEY = 'admin_token'
const EXPIRES_KEY = 'admin_expires_at'

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pages: number
}

export interface AdminUser {
  id: number
  name: string
  email: string
  role: string
  isActive: boolean
  isDemo: boolean
  phone: string | null
  facebook: string | null
  instagram: string | null
}

export interface AdminProperty {
  id: number
  lotName: string
  address: string
  price: number
  archived: boolean
  availableUntil: string | null
  ownerId: number
  ownerName: string | null
  ownerEmail: string | null
  imageCount: number
  bookingCount: number
  paymentCount: number
}

export interface AdminBooking {
  id: number
  status: string
  startDate: string
  endDate: string | null
  propertyId: number
  lotName: string
  address: string
  price: number
  ownerId: number
  ownerName: string | null
  renterId: number
  renterName: string | null
  renterEmail: string | null
}

export interface AdminPayment {
  id: number
  intentId: string
  amountCentavos: number
  status: string
  startDate: string
  endDate: string
  bookingId: number | null
  createdAt: string
  updatedAt: string
  propertyId: number
  lotName: string | null
  renterId: number
  renterName: string | null
  renterEmail: string | null
}

export interface AdminConversation {
  id: number
  propertyId: number
  lotName: string | null
  ownerId: number
  ownerName: string | null
  renterId: number
  renterName: string | null
  createdAt: string
  lastMessageAt: string | null
  expiresAt: string
  expired: boolean
  messageCount: number
  lastMessage: string | null
}

export interface AdminMessage {
  id: number
  senderId: number
  senderName: string
  body: string
  createdAt: string
  readAt: string | null
}

export interface AdminAuditEntry {
  id: number
  adminId: number
  adminName: string
  action: string
  targetType: string | null
  targetId: string | null
  details: string | null
  ip: string | null
  createdAt: string
}

export interface AdminStats {
  users: { total: number; active: number; banned: number; admins: number; demo: number }
  properties: { total: number; archived: number }
  bookings: { total: number; active: number; ended: number }
  payments: { total: number; succeeded: number; pending: number; revenueCentavos: number }
  conversations: { active: number }
  recent: {
    users: AdminUser[]
    bookings: AdminBooking[]
    payments: AdminPayment[]
    audit: AdminAuditEntry[]
  }
}

export interface AdminSystem {
  db: 'ok' | 'error'
  dbError: string | null
  dbLatencyMs: number
  uptimeSeconds: number
  node: string
  env: string
  commit: string | null
  service: string | null
  demoEnabled: boolean
  memory: { rssMb: number; heapUsedMb: number }
  checkedAt: string
}

export interface AdminSession {
  id: number
  name: string
  email: string
  mustChangePassword: boolean
  expiresAt: string | null
}

export interface AdminLoginResponse {
  token: string
  name: string
  email: string
  mustChangePassword: boolean
  expiresInSeconds: number
}

export interface DemoState {
  enabled: boolean
  lastResetAt: string | null
}

export class AdminApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
  }
}

export function getAdminToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return null
    const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || 0)
    if (expiresAt > 0 && Date.now() >= expiresAt) {
      clearAdminSession()
      return null
    }
    return token
  } catch {
    return null
  }
}

export function saveAdminSession(token: string, expiresInSeconds: number) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresInSeconds * 1000))
  } catch {
    // storage unavailable — the in-memory state still works until reload
  }
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  } catch {
    // ignore
  }
}

function notifyAdminExpired() {
  clearAdminSession()
  window.dispatchEvent(new Event('admin:expired'))
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken()
  const res = await fetch(`${API_BASE}/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data: { message?: string; code?: string } | null
  try {
    data = text ? (JSON.parse(text) as { message?: string; code?: string }) : null
  } catch {
    data = { message: text }
  }

  if (!res.ok) {
    // The admin API hides itself behind a bare 404 ("Not found"). A resource
    // 404 carries a descriptive message instead, so we only end the session on
    // the bare one.
    if (res.status === 404 && (!data?.message || data.message === 'Not found')) {
      notifyAdminExpired()
    }
    if (res.status === 403 && data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new Event('admin:password-required'))
    }
    throw new AdminApiError(data?.message || `Request failed (${res.status})`, res.status, data?.code)
  }

  return data as T
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === 'all') continue
    search.set(key, String(value))
  }
  const suffix = search.toString()
  return suffix ? `?${suffix}` : ''
}

// --- session -----------------------------------------------------------------

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  const data = await adminFetch<AdminLoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  saveAdminSession(data.token, data.expiresInSeconds)
  return data
}

export async function adminSession(): Promise<{ admin: AdminSession }> {
  return adminFetch<{ admin: AdminSession }>('/session')
}

export async function changeAdminPassword(
  currentPassword: string | null,
  newPassword: string
): Promise<{ token: string; expiresInSeconds: number }> {
  const body = currentPassword ? { currentPassword, newPassword } : { newPassword }
  const data = await adminFetch<{ token: string; expiresInSeconds: number }>('/password', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  saveAdminSession(data.token, data.expiresInSeconds)
  return data
}

// --- data --------------------------------------------------------------------

export function fetchAdminStats(): Promise<AdminStats> {
  return adminFetch<AdminStats>('/stats')
}

export function fetchAdminUsers(params: {
  q?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<Paged<AdminUser>> {
  return adminFetch<Paged<AdminUser>>(`/users${query(params)}`)
}

export function banAdminUser(id: number): Promise<AdminUser> {
  return adminFetch<AdminUser>(`/users/${id}/ban`, { method: 'PUT' })
}

export function unbanAdminUser(id: number): Promise<AdminUser> {
  return adminFetch<AdminUser>(`/users/${id}/unban`, { method: 'PUT' })
}

export function fetchAdminProperties(params: {
  q?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<Paged<AdminProperty>> {
  return adminFetch<Paged<AdminProperty>>(`/properties${query(params)}`)
}

export function archiveAdminProperty(id: number): Promise<{ id: number; archived: boolean }> {
  return adminFetch<{ id: number; archived: boolean }>(`/properties/${id}/archive`, { method: 'PUT' })
}

export function unarchiveAdminProperty(id: number): Promise<{ id: number; archived: boolean }> {
  return adminFetch<{ id: number; archived: boolean }>(`/properties/${id}/unarchive`, { method: 'PUT' })
}

export function deleteAdminProperty(id: number): Promise<void> {
  return adminFetch<void>(`/properties/${id}`, { method: 'DELETE' })
}

export function fetchAdminBookings(params: {
  q?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<Paged<AdminBooking>> {
  return adminFetch<Paged<AdminBooking>>(`/bookings${query(params)}`)
}

export function endAdminBooking(id: number): Promise<{ id: number; status: string; endDate: string }> {
  return adminFetch<{ id: number; status: string; endDate: string }>(`/bookings/${id}/end`, { method: 'PUT' })
}

export function fetchAdminPayments(params: {
  q?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<Paged<AdminPayment>> {
  return adminFetch<Paged<AdminPayment>>(`/payments${query(params)}`)
}

export function fetchAdminConversations(params: {
  q?: string
  page?: number
  pageSize?: number
}): Promise<Paged<AdminConversation>> {
  return adminFetch<Paged<AdminConversation>>(`/conversations${query(params)}`)
}

export function fetchAdminConversation(
  id: number
): Promise<{ conversation: AdminConversation; messages: AdminMessage[] }> {
  return adminFetch<{ conversation: AdminConversation; messages: AdminMessage[] }>(`/conversations/${id}`)
}

export function fetchAdminDemo(): Promise<DemoState> {
  return adminFetch<DemoState>('/demo')
}

export function resetAdminDemo(): Promise<{ ok: boolean; lastResetAt: string | null }> {
  return adminFetch<{ ok: boolean; lastResetAt: string | null }>('/demo/reset', { method: 'POST' })
}

export function fetchAdminSystem(): Promise<AdminSystem> {
  return adminFetch<AdminSystem>('/system')
}

export function fetchAdminAudit(params: { page?: number; pageSize?: number }): Promise<Paged<AdminAuditEntry>> {
  return adminFetch<Paged<AdminAuditEntry>>(`/audit${query(params)}`)
}
