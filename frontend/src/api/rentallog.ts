import { authHeaders } from './authHeaders'
import { API_BASE } from './http'
import type { Booking } from '../data/rentallog'

export async function fetchMyBookings(): Promise<Booking[]> {
  const response = await fetch(`${API_BASE}/rentallog/my`, {
    headers: authHeaders(),
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('Your session has expired. Please log out and log back in, then try again.')
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch bookings: ${response.status}`)
  }
  return response.json()
}

export async function cancelBooking(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/rentallog/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('Your session has expired. Please log out and log back in, then try again.')
  }
  if (response.status === 404) {
    throw new Error('That booking no longer exists.')
  }
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Failed to cancel booking: ${response.status}`)
  }
}

export async function fetchLogsByProperty(propertyId: number): Promise<Booking[]> {
  const response = await fetch(`${API_BASE}/rentallog/property/${propertyId}`, {
    headers: authHeaders(),
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('Your session has expired. Please log out and log back in, then try again.')
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch bookings for property: ${response.status}`)
  }
  return response.json()
}