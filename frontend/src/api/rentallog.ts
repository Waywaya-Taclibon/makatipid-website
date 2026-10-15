import { authHeaders, isStoredTokenExpired } from './authHeaders'
import type { Booking, RentalLog } from '../data/rentallog'

export async function createRentalLog(
  data: Omit<RentalLog, 'id' | 'renterId'>,
  token?: string
) {
  // localStorage is the source of truth: context state can be stale when
  // login/logout happened in another tab, so prefer storage over the parameter.
  const authToken = localStorage.getItem('token') || token
  if (!authToken) {
    throw new Error('You need to log in before booking a rental.')
  }
  if (isStoredTokenExpired()) {
    throw new Error('Your session has expired. Please log out and log back in, then try again.')
  }

  const response = await fetch('http://localhost:8080/api/rentallog', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(data),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('Your session has expired or is invalid. Please log out and log back in, then try again.')
  }
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create rental log (${response.status}): ${errorText}`)
  }

  return response.json()
}

export async function fetchMyBookings(): Promise<Booking[]> {
  const response = await fetch('http://localhost:8080/api/rentallog/my', {
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
  const response = await fetch(`http://localhost:8080/api/rentallog/${id}`, {
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
  const response = await fetch(`http://localhost:8080/api/rentallog/property/${propertyId}`, {
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