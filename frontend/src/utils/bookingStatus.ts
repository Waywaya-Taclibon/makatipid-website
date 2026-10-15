import type { Booking } from '../data/rentallog'

export type DynamicBookingStatus = 'ACTIVE' | 'PENDING' | 'ENDED'

export function getDynamicStatus(b: Booking): DynamicBookingStatus {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const startDate = new Date(b.startDate)
  startDate.setHours(0, 0, 0, 0)

  if (startDate > now) {
    return 'PENDING'
  }

  if (b.endDate) {
    const endDate = new Date(b.endDate)
    endDate.setHours(0, 0, 0, 0)
    if (now > endDate) {
      return 'ENDED'
    }
  }

  return 'ACTIVE'
}

export function getCurrentBooking(bookings: Booking[]): Booking | null {
  return bookings.find((b) => getDynamicStatus(b) === 'ACTIVE') ?? null
}

export function getUpcomingBooking(bookings: Booking[]): Booking | null {
  const upcoming = bookings
    .filter((b) => getDynamicStatus(b) === 'PENDING')
    .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
  return upcoming[0] ?? null
}

export function formatBookingDate(dateStr: string | null): string {
  if (!dateStr) return 'Ongoing'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function toDayStart(value: string | Date): number {
  const d = value instanceof Date ? new Date(value) : new Date(value)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Day-granularity range overlap. A null end means ongoing (infinite). */
export function rangesOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null
): boolean {
  const aS = toDayStart(aStart)
  const bS = toDayStart(bStart)
  const aE = aEnd ? toDayStart(aEnd) : Number.POSITIVE_INFINITY
  const bE = bEnd ? toDayStart(bEnd) : Number.POSITIVE_INFINITY
  return aS <= bE && bS <= aE
}

/**
 * Returns the first existing booking that overlaps the requested range.
 * Ended-by-date bookings never block; only ACTIVE / PENDING ones do.
 */
export function findConflictingBooking(
  existing: Booking[],
  reqStart: string,
  reqEnd: string | null
): Booking | null {
  if (!reqStart) return null
  const end = reqEnd || null
  return (
    existing.find((b) => {
      const status = getDynamicStatus(b)
      if (status === 'ENDED') return false
      return rangesOverlap(reqStart, end, b.startDate, b.endDate)
    }) ?? null
  )
}
