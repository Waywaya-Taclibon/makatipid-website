import { useEffect, useState } from 'react'
import { fetchAdminStats, type AdminStats } from '../../../api/admin'
import {
  Badge,
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
} from '../ui'
import { buttonClass, formatDate, formatDateTime, formatMoney } from '../helpers'

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </Card>
  )
}

function paymentTone(status: string): 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'violet' {
  switch (status) {
    case 'SUCCEEDED':
      return 'green'
    case 'PENDING':
      return 'amber'
    case 'FAILED':
    case 'EXPIRED':
      return 'red'
    case 'NEEDS_ATTENTION':
      return 'violet'
    default:
      return 'slate'
  }
}

function bookingTone(status: string): 'green' | 'slate' | 'amber' {
  if (status === 'ACTIVE') return 'green'
  if (status === 'ENDED') return 'slate'
  return 'amber'
}

export default function Overview() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchAdminStats()
      .then((data) => {
        if (cancelled) return
        setStats(data)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the overview.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Everything happening across Makatipid right now."
        actions={
          <button
            type="button"
            className={buttonClass('subtle')}
            onClick={() => {
              setLoading(true)
              setRefreshKey((k) => k + 1)
            }}
          >
            Refresh
          </button>
        }
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      {loading && !stats ? (
        <Loading label="Loading the dashboard…" />
      ) : stats ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Users"
              value={stats.users.total.toLocaleString('en-PH')}
              hint={`${stats.users.active} active · ${stats.users.banned} suspended · ${stats.users.demo} demo`}
            />
            <Stat
              label="Listings"
              value={stats.properties.total.toLocaleString('en-PH')}
              hint={`${stats.properties.archived} archived`}
            />
            <Stat
              label="Bookings"
              value={stats.bookings.total.toLocaleString('en-PH')}
              hint={`${stats.bookings.active} active · ${stats.bookings.ended} ended`}
            />
            <Stat
              label="Collected"
              value={formatMoney(stats.payments.revenueCentavos)}
              hint={`${stats.payments.succeeded} succeeded · ${stats.payments.pending} pending`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Recent payments</h2>
                <Badge tone="slate">{stats.payments.total} total</Badge>
              </div>
              {stats.recent.payments.length === 0 ? (
                <Empty>No payments recorded yet.</Empty>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stats.recent.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {payment.renterName || 'Unknown renter'}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {payment.lotName || `Property #${payment.propertyId}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {formatMoney(payment.amountCentavos)}
                        </p>
                        <Badge tone={paymentTone(payment.status)}>{payment.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Recent bookings</h2>
                <Badge tone="slate">{stats.bookings.active} active</Badge>
              </div>
              {stats.recent.bookings.length === 0 ? (
                <Empty>No bookings yet.</Empty>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stats.recent.bookings.map((booking) => (
                    <li key={booking.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {booking.lotName}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {booking.renterName || 'Unknown renter'} · {formatDate(booking.startDate)} —{' '}
                          {booking.endDate ? formatDate(booking.endDate) : 'ongoing'}
                        </p>
                      </div>
                      <Badge tone={bookingTone(booking.status)}>{booking.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Newest accounts</h2>
              {stats.recent.users.length === 0 ? (
                <Empty>No users yet.</Empty>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stats.recent.users.map((user) => (
                    <li key={user.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {user.isDemo && <Badge tone="violet">Demo</Badge>}
                        <Badge tone={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Active' : 'Suspended'}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Latest admin activity</h2>
              {stats.recent.audit.length === 0 ? (
                <Empty>No admin actions logged yet.</Empty>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stats.recent.audit.map((entry) => (
                    <li key={entry.id} className="py-2.5">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.action}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {entry.adminName} · {formatDateTime(entry.createdAt)}
                        {entry.targetType ? ` · ${entry.targetType} #${entry.targetId ?? '—'}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}
