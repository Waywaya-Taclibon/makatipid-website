import { useEffect, useState } from 'react'
import {
  endAdminBooking,
  fetchAdminBookings,
  type AdminBooking,
  type Paged,
} from '../../../api/admin'
import { cancelSwal } from '../../../utils/swal'
import {
  ActionButton,
  Badge,
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
} from '../ui'
import { formatDate, useDebounced } from '../helpers'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

function statusTone(status: string): 'green' | 'slate' | 'amber' {
  if (status === 'ACTIVE') return 'green'
  if (status === 'ENDED') return 'slate'
  return 'amber'
}

export default function Bookings() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<AdminBooking> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminBookings({ q: debouncedQ, status, page })
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ, status, page])

  async function handleEnd(booking: AdminBooking) {
    const confirmed = await cancelSwal.fire({
      icon: 'warning',
      title: 'Force-end this booking?',
      html: `<strong>${booking.lotName}</strong> for ${booking.renterName || 'this renter'} will be marked ENDED with today's date. The payment ledger is not changed.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, end it',
      cancelButtonText: 'Keep booking',
    })
    if (!confirmed.isConfirmed) return

    setBusyId(booking.id)
    try {
      const result = await endAdminBooking(booking.id)
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === booking.id ? { ...item, status: result.status, endDate: result.endDate } : item
              ),
            }
          : prev
      )
    } catch (err) {
      await cancelSwal.fire({ icon: 'error', title: 'Could not end booking', text: errText(err) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle="Every rental on record. Force-ending frees the dates immediately; the payment row is untouched."
      />

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value)
              setPage(1)
            }}
            placeholder="Search by listing, renter or owner…"
          />
          <Select
            label="Booking status"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
              setLoading(true)
            }}
            options={[
              { value: 'all', label: 'All bookings' },
              { value: 'ACTIVE', label: 'Active only' },
              { value: 'ENDED', label: 'Ended only' },
            ]}
          />
          {loading && <span className="text-xs text-slate-400 dark:text-slate-500">Loading…</span>}
        </div>

        {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

        {loading && !data ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <Empty>No bookings match this filter.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">ID</th>
                    <th className="pb-2 pr-3 font-semibold">Listing</th>
                    <th className="pb-2 pr-3 font-semibold">Renter</th>
                    <th className="pb-2 pr-3 font-semibold">Owner</th>
                    <th className="pb-2 pr-3 font-semibold">Dates</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((booking) => (
                    <tr key={booking.id} className="align-top">
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">#{booking.id}</td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{booking.lotName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{booking.address}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-slate-700 dark:text-slate-200">{booking.renterName || '—'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{booking.renterEmail || ''}</p>
                      </td>
                      <td className="py-3 pr-3 text-slate-700 dark:text-slate-200">{booking.ownerName || '—'}</td>
                      <td className="py-3 pr-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(booking.startDate)} — {booking.endDate ? formatDate(booking.endDate) : 'ongoing'}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        {booking.status === 'ENDED' ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">Ended</span>
                        ) : (
                          <ActionButton
                            variant="danger"
                            disabled={busyId === booking.id}
                            onClick={() => void handleEnd(booking)}
                          >
                            {busyId === booking.id ? 'Ending…' : 'Force end'}
                          </ActionButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              onPage={(next) => {
                setLoading(true)
                setPage(next)
              }}
            />
          </>
        )}
      </Card>
    </div>
  )
}
