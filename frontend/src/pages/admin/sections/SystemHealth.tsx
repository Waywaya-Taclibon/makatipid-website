import { useEffect, useState } from 'react'
import { fetchAdminSystem, type AdminSystem } from '../../../api/admin'
import { Badge, Card, ErrorNote, Loading, PageHeader } from '../ui'
import { buttonClass, formatDateTime, formatUptime } from '../helpers'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  )
}

export default function SystemHealth() {
  const [system, setSystem] = useState<AdminSystem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await fetchAdminSystem()
        if (cancelled) return
        setSystem(result)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not read system health.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    const timer = setInterval(() => void load(), 30000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refreshKey])

  return (
    <div>
      <PageHeader
        title="System health"
        subtitle="Live view of the API process and its database connection. Refreshes every 30 seconds."
        actions={
          <button type="button" className={buttonClass('subtle')} onClick={() => setRefreshKey((k) => k + 1)}>
            Refresh now
          </button>
        }
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      {loading && !system ? (
        <Loading label="Checking the service…" />
      ) : system ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Database</h2>
              <Badge tone={system.db === 'ok' ? 'green' : 'red'}>
                {system.db === 'ok' ? 'Reachable' : 'Unreachable'}
              </Badge>
            </div>
            {system.db === 'ok' ? (
              <Field label="Round trip" value={`${system.dbLatencyMs} ms`} />
            ) : (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {system.dbError || 'The connection check failed.'}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              TiDB Cloud Starter scales compute to zero when idle, so the first query after a quiet period can take a
              few extra seconds. That is expected.
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Process</h2>
            <Field label="Uptime" value={formatUptime(system.uptimeSeconds)} />
            <Field label="Node" value={system.node} />
            <Field label="Environment" value={system.env} />
            <Field label="Heap used" value={`${system.memory.heapUsedMb} MB`} />
            <Field label="RSS" value={`${system.memory.rssMb} MB`} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Deployment</h2>
            <Field label="Service" value={system.service || 'Not on Render'} />
            <Field label="Commit" value={system.commit || 'Unknown'} />
            <Field label="Demo login" value={system.demoEnabled ? 'Enabled' : 'Disabled'} />
            <Field label="Checked at" value={formatDateTime(system.checkedAt)} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">What this does not show</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Render's free instance can still restart without notice, and this page only sees the process that
              answered the request. Use the billing page for monthly instance hours and PayMongo's dashboard for
              payment health.
            </p>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
