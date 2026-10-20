import { useEffect, useState } from 'react'
import {
  archiveAdminProperty,
  deleteAdminProperty,
  fetchAdminProperties,
  unarchiveAdminProperty,
  type AdminProperty,
  type Paged,
} from '../../../api/admin'
import { bookedSwal, cancelSwal } from '../../../utils/swal'
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
import { formatPrice, useDebounced } from '../helpers'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export default function Properties() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<AdminProperty> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminProperties({ q: debouncedQ, status, page })
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

  function patchItem(id: number, patch: Partial<AdminProperty>) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) } : prev
    )
  }

  async function handleArchive(property: AdminProperty) {
    const confirmed = await cancelSwal.fire({
      icon: 'warning',
      title: 'Archive this listing?',
      html: `<strong>${property.lotName}</strong> will disappear from public search, but its data and bookings stay intact.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, archive',
      cancelButtonText: 'Keep visible',
    })
    if (!confirmed.isConfirmed) return

    setBusyId(property.id)
    try {
      await archiveAdminProperty(property.id)
      patchItem(property.id, { archived: true })
    } catch (err) {
      await cancelSwal.fire({ icon: 'error', title: 'Could not archive', text: errText(err) })
    } finally {
      setBusyId(null)
    }
  }

  async function handleRestore(property: AdminProperty) {
    const confirmed = await bookedSwal.fire({
      icon: 'question',
      title: 'Restore this listing?',
      html: `<strong>${property.lotName}</strong> will be visible to renters again.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, restore',
      cancelButtonText: 'Cancel',
    })
    if (!confirmed.isConfirmed) return

    setBusyId(property.id)
    try {
      await unarchiveAdminProperty(property.id)
      patchItem(property.id, { archived: false })
    } catch (err) {
      await cancelSwal.fire({ icon: 'error', title: 'Could not restore', text: errText(err) })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(property: AdminProperty) {
    const confirmed = await cancelSwal.fire({
      icon: 'warning',
      title: 'Delete this listing permanently?',
      html: `<strong>${property.lotName}</strong> and its photos will be erased. This cannot be undone.`,
      input: 'text',
      inputPlaceholder: 'Type DELETE',
      inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
      inputValidator: (value) => (value === 'DELETE' ? undefined : 'Type DELETE exactly to confirm.'),
      showCancelButton: true,
      confirmButtonText: 'Delete permanently',
      cancelButtonText: 'Cancel',
    })
    if (!confirmed.isConfirmed) return

    setBusyId(property.id)
    try {
      await deleteAdminProperty(property.id)
      setData((prev) => {
        if (!prev) return prev
        const items = prev.items.filter((item) => item.id !== property.id)
        return { ...prev, items, total: Math.max(0, prev.total - 1) }
      })
      if (data && data.items.length === 1 && page > 1) setPage((p) => p - 1)
    } catch (err) {
      await cancelSwal.fire({ icon: 'error', title: 'Could not delete', text: errText(err) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle="Moderate every listing, including archived ones. Listings with booking or payment history can only be archived."
      />

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value)
              setPage(1)
            }}
            placeholder="Search by listing, address or owner…"
          />
          <Select
            label="Listing status"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
              setLoading(true)
            }}
            options={[
              { value: 'all', label: 'All listings' },
              { value: 'active', label: 'Visible only' },
              { value: 'archived', label: 'Archived only' },
            ]}
          />
          {loading && <span className="text-xs text-slate-400 dark:text-slate-500">Loading…</span>}
        </div>

        {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

        {loading && !data ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <Empty>No listings match this filter.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">ID</th>
                    <th className="pb-2 pr-3 font-semibold">Listing</th>
                    <th className="pb-2 pr-3 font-semibold">Owner</th>
                    <th className="pb-2 pr-3 font-semibold">Price</th>
                    <th className="pb-2 pr-3 font-semibold">Photos</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((property) => {
                    const canDelete = property.bookingCount === 0 && property.paymentCount === 0
                    return (
                      <tr key={property.id} className="align-top">
                        <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">#{property.id}</td>
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{property.lotName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{property.address}</p>
                          {(property.bookingCount > 0 || property.paymentCount > 0) && (
                            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                              {property.bookingCount} booking{property.bookingCount === 1 ? '' : 's'} ·{' '}
                              {property.paymentCount} payment{property.paymentCount === 1 ? '' : 's'} on record
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <p className="text-sm text-slate-700 dark:text-slate-200">{property.ownerName || '—'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{property.ownerEmail || ''}</p>
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap text-slate-700 dark:text-slate-200">
                          {formatPrice(property.price)}
                        </td>
                        <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">{property.imageCount}</td>
                        <td className="py-3 pr-3">
                          <Badge tone={property.archived ? 'amber' : 'green'}>
                            {property.archived ? 'Archived' : 'Visible'}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            {property.archived ? (
                              <ActionButton
                                variant="primary"
                                disabled={busyId === property.id}
                                onClick={() => void handleRestore(property)}
                              >
                                Restore
                              </ActionButton>
                            ) : (
                              <ActionButton
                                variant="subtle"
                                disabled={busyId === property.id}
                                onClick={() => void handleArchive(property)}
                              >
                                Archive
                              </ActionButton>
                            )}
                            <ActionButton
                              variant="danger"
                              disabled={busyId === property.id || !canDelete}
                              title={
                                canDelete
                                  ? 'Delete permanently'
                                  : 'Has booking or payment history — archive instead'
                              }
                              onClick={() => void handleDelete(property)}
                            >
                              Delete
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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
