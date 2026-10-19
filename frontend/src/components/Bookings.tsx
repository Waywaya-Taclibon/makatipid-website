import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { cancelSwal } from '../utils/swal'
import type { Booking } from '../data/rentallog'
import { cancelBooking, fetchMyBookings } from '../api/rentallog'
import { formatBookingDate, getDynamicStatus } from '../utils/bookingStatus'

function formatPrice(price: number) {
  return `₱${price.toLocaleString('en-PH')}/mo`
}

function formatDate(dateStr: string) {
  return formatBookingDate(dateStr)
}

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/40',
  PENDING: 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  ENDED: 'bg-slate-100 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
}

export default function Bookings() {
  const location = useLocation()
  const isActive = location.pathname === '/bookings'

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  useEffect(() => {
    if (!isActive || bookings.length > 0) return

    fetchMyBookings()
      .then((data) => {
        setBookings(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isActive, bookings.length])

  async function handleCancel(b: Booking) {
    const status = getDynamicStatus(b)
    const dateRange = `${formatDate(b.startDate)} — ${b.endDate ? formatDate(b.endDate) : 'Ongoing'}`
    const confirmed = await cancelSwal.fire({
      icon: 'warning',
      title: status === 'ACTIVE' ? 'Cancel ongoing stay?' : 'Cancel this booking?',
      buttonsStyling: true,
      text:
        status === 'ACTIVE'
          ? `"${b.lotName}" (${dateRange}). This stay is ongoing, cancelling removes it entirely and frees the property immediately. This cannot be undone.`
          : `"${b.lotName}" (${dateRange}) will be removed entirely. This cannot be undone.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, cancel it',
      cancelButtonText: 'Keep booking',
    })
    if (!confirmed.isConfirmed) return

    setCancellingId(b.id)
    try {
      await cancelBooking(b.id)
      setBookings((prev) => prev.filter((x) => x.id !== b.id))
      setError(null)
    } catch (err) {
      await cancelSwal.fire({
        icon: 'error',
        title: 'Could not cancel booking',
        text: err instanceof Error ? err.message : 'Failed to cancel booking',
        confirmButtonText: 'OK',
        confirmButtonColor: '#4a9e4a',
      })
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-6 w-full max-w-3xl h-[75vh] overflow-y-auto dark:bg-slate-900/95 dark:border dark:border-slate-800">
      <h3 className="text-lg font-bold text-slate-800 mb-4 dark:text-slate-100">My Bookings</h3>

      {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading your bookings...</p>}
      {error && <p className="text-sm text-red-500 dark:text-red-400">Couldn't load bookings: {error}</p>}
      {!loading && !error && bookings.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500">You haven't booked any rentals yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {bookings.map((b) => {
          const status = getDynamicStatus(b)
          const cancellable = status === 'PENDING' || status === 'ACTIVE'
          return (
            <div key={b.id} className="rounded-xl border border-slate-200 p-4 flex justify-between gap-3 dark:border-slate-700">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{b.lotName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{b.address}</p>
                <p className="text-sm font-semibold text-slate-700 mt-1 dark:text-slate-300">{formatPrice(b.price)}</p>
                <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">
                  {formatDate(b.startDate)} — {b.endDate ? formatDate(b.endDate) : 'Ongoing'}
                </p>
                <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">Owner: {b.ownerName}</p>
              </div>
              <div className="flex flex-col items-end justify-between shrink-0">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full h-fit whitespace-nowrap ${statusStyles[status] ?? 'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                  {status}
                </span>
                {cancellable && (
                  <button
                    onClick={() => handleCancel(b)}
                    disabled={cancellingId === b.id}
                    className="mt-auto text-xs font-semibold px-3 py-1 rounded-full border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    {cancellingId === b.id ? 'Cancelling…' : 'Cancel Booking'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}