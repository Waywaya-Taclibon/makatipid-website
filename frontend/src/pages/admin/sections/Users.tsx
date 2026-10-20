import { useEffect, useState } from 'react'
import {
  banAdminUser,
  fetchAdminUsers,
  unbanAdminUser,
  type AdminUser,
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
import { useDebounced } from '../helpers'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export default function Users() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebounced(q)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<AdminUser> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminUsers({ q: debouncedQ, status, page })
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

  async function handleBan(user: AdminUser) {
    const confirmed = await cancelSwal.fire({
      icon: 'warning',
      title: 'Suspend this account?',
      html: `<strong>${user.name}</strong> (${user.email}) will be signed out immediately and cannot log in until restored.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, suspend',
      cancelButtonText: 'Keep access',
    })
    if (!confirmed.isConfirmed) return

    setBusyId(user.id)
    try {
      const updated = await banAdminUser(user.id)
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((item) => (item.id === updated.id ? updated : item)) } : prev
      )
    } catch (err) {
      await cancelSwal.fire({ icon: 'error', title: 'Could not suspend', text: errText(err) })
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnban(user: AdminUser) {
    const confirmed = await bookedSwal.fire({
      icon: 'question',
      title: 'Restore this account?',
      html: `<strong>${user.name}</strong> (${user.email}) will be able to log in again.`,
      showCancelButton: true,
      confirmButtonText: 'Yes, restore',
      cancelButtonText: 'Cancel',
    })
    if (!confirmed.isConfirmed) return

    setBusyId(user.id)
    try {
      const updated = await unbanAdminUser(user.id)
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((item) => (item.id === updated.id ? updated : item)) } : prev
      )
    } catch (err) {
      await cancelSwal.fire({ icon: 'error', title: 'Could not restore', text: errText(err) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Every registered account, including demo accounts. Suspending signs the user out everywhere."
      />

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value)
              setPage(1)
            }}
            placeholder="Search by name or email…"
          />
          <Select
            label="Account status"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
              setLoading(true)
            }}
            options={[
              { value: 'all', label: 'All accounts' },
              { value: 'active', label: 'Active only' },
              { value: 'banned', label: 'Suspended only' },
            ]}
          />
          {loading && <span className="text-xs text-slate-400 dark:text-slate-500">Loading…</span>}
        </div>

        {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

        {loading && !data ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <Empty>No accounts match this filter.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">ID</th>
                    <th className="pb-2 pr-3 font-semibold">Account</th>
                    <th className="pb-2 pr-3 font-semibold">Role</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 pr-3 font-semibold">Contact</th>
                    <th className="pb-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((user) => (
                    <tr key={user.id} className="align-top">
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">#{user.id}</td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={user.role === 'ADMIN' ? 'violet' : 'slate'}>{user.role}</Badge>
                          {user.isDemo && <Badge tone="blue">Demo</Badge>}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={user.isActive ? 'green' : 'red'}>
                          {user.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-500 dark:text-slate-400">
                        {user.phone || '—'}
                      </td>
                      <td className="py-3 text-right">
                        {user.role === 'ADMIN' ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">Protected</span>
                        ) : user.isActive ? (
                          <ActionButton
                            variant="danger"
                            disabled={busyId === user.id}
                            onClick={() => void handleBan(user)}
                          >
                            {busyId === user.id ? 'Suspending…' : 'Suspend'}
                          </ActionButton>
                        ) : (
                          <ActionButton
                            variant="primary"
                            disabled={busyId === user.id}
                            onClick={() => void handleUnban(user)}
                          >
                            {busyId === user.id ? 'Restoring…' : 'Restore'}
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
