import { useEffect, useState } from 'react'
import { fetchAdminAudit, type AdminAuditEntry, type Paged } from '../../../api/admin'
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, Pagination } from '../ui'
import { formatDateTime } from '../helpers'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

function actionTone(action: string): 'green' | 'red' | 'amber' | 'slate' | 'blue' {
  if (action.includes('delete') || action.includes('ban') || action.includes('force_end')) return 'red'
  if (action.includes('unban') || action.includes('unarchive') || action.includes('password')) return 'green'
  if (action.includes('archive')) return 'amber'
  if (action.includes('login')) return 'blue'
  return 'slate'
}

export default function AuditLog() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paged<AdminAuditEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminAudit({ page, pageSize: 30 })
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
  }, [page])

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Append-only record of every action taken from this console."
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <Card className="p-4">
        {loading && !data ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <Empty>No admin actions recorded yet.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-semibold">ID</th>
                    <th className="pb-2 pr-3 font-semibold">When</th>
                    <th className="pb-2 pr-3 font-semibold">Admin</th>
                    <th className="pb-2 pr-3 font-semibold">Action</th>
                    <th className="pb-2 pr-3 font-semibold">Target</th>
                    <th className="pb-2 pr-3 font-semibold">Details</th>
                    <th className="pb-2 font-semibold">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">#{entry.id}</td>
                      <td className="py-3 pr-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="py-3 pr-3 text-slate-700 dark:text-slate-200">{entry.adminName}</td>
                      <td className="py-3 pr-3">
                        <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-600 dark:text-slate-300">
                        {entry.targetType ? `${entry.targetType} #${entry.targetId ?? '—'}` : '—'}
                      </td>
                      <td className="max-w-[260px] py-3 pr-3">
                        {entry.details ? (
                          <code
                            title={entry.details}
                            className="block truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {entry.details}
                          </code>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-slate-500 dark:text-slate-400">{entry.ip || '—'}</td>
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
