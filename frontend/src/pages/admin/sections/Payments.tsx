import { useEffect, useState } from 'react'
import { fetchAdminPayments, type AdminPayment, type Paged } from '../../../api/admin'
import {
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
import { formatDate, formatDateTime, formatMoney, useDebounced } from '../helpers'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

function tone(status: string): 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'blue' {
  switch (status) {
    case 'SUCCEEDED':
      return 'green'
    case 'PENDING':
      return 'amber'
    case 'FAILED':
    case 'EXPIRED':
      return 'red'
    case 'CANCELLED':
      return 'slate'
    case 'NEEDS_ATTENTION':
      return 'violet'
    default:
      return 'blue'
  }
}

export default function Payments() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<AdminPayment> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminPayments({ q: debouncedQ, status, page })
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

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Read-only copy of the payment ledger. Refunds are handled in the PayMongo dashboard."
      />

      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        This view never changes a payment. SUCCEEDED means the booking was created; NEEDS_ATTENTION means money was
        captured but the booking could not be written.
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value)
              setPage(1)
            }}
            placeholder="Search by intent, listing or renter…"
          />
          <Select
            label="Payment status"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
              setLoading(true)
            }}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'SUCCEEDED', label: 'Succeeded' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'EXPIRED', label: 'Expired' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'NEEDS_ATTENTION', label: 'Needs attention' },
            ]}
          />
          {loading && <span className="text-xs text-slate-400 dark:text-slate-500">Loading…</span>}
        </div>

        {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

        {loading && !data ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <Empty>No payments match this filter.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">ID</th>
                    <th className="pb-2 pr-3 font-semibold">Intent</th>
                    <th className="pb-2 pr-3 font-semibold">Listing</th>
                    <th className="pb-2 pr-3 font-semibold">Renter</th>
                    <th className="pb-2 pr-3 font-semibold">Amount</th>
                    <th className="pb-2 pr-3 font-semibold">Stay</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((payment) => (
                    <tr key={payment.id} className="align-top">
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">
                        #{payment.id}
                        {payment.bookingId ? (
                          <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                            booking #{payment.bookingId}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">
                        <code className="text-[11px] text-slate-600 dark:text-slate-300">{payment.intentId}</code>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-slate-800 dark:text-slate-100">
                          {payment.lotName || `Property #${payment.propertyId}`}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-slate-700 dark:text-slate-200">{payment.renterName || '—'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{payment.renterEmail || ''}</p>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-100">
                        {formatMoney(payment.amountCentavos)}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(payment.startDate)} — {formatDate(payment.endDate)}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={tone(payment.status)}>{payment.status}</Badge>
                      </td>
                      <td className="py-3 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(payment.createdAt)}
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
