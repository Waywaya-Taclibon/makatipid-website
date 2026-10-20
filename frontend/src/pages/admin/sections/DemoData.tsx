import { useEffect, useState } from 'react'
import { fetchAdminDemo, resetAdminDemo, type DemoState } from '../../../api/admin'
import { bookedSwal, cancelSwal } from '../../../utils/swal'
import { Badge, Card, ErrorNote, Loading, PageHeader } from '../ui'
import { buttonClass, formatDateTime } from '../helpers'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export default function DemoData() {
  const [state, setState] = useState<DemoState | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminDemo()
      .then((result) => {
        if (cancelled) return
        setState(result)
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
  }, [])

  async function handleReset() {
    const confirmed = await cancelSwal.fire({
      icon: 'warning',
      title: 'Rebuild the demo marketplace?',
      html: 'All demo users, listings, bookings, payments and chats are wiped and re-seeded. Real accounts are never touched.',
      input: 'text',
      inputPlaceholder: 'Type RESET',
      inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
      inputValidator: (value) => (value === 'RESET' ? undefined : 'Type RESET exactly to confirm.'),
      showCancelButton: true,
      confirmButtonText: 'Rebuild demo data',
      cancelButtonText: 'Cancel',
    })
    if (!confirmed.isConfirmed) return

    setResetting(true)
    try {
      const result = await resetAdminDemo()
      setState((prev) => ({ enabled: prev?.enabled ?? true, lastResetAt: result.lastResetAt }))
      await bookedSwal.fire({
        icon: 'success',
        title: 'Demo data rebuilt',
        text: 'The demo owner and renter accounts have a fresh marketplace again.',
        confirmButtonText: 'OK',
      })
    } catch (err) {
      await cancelSwal.fire({ icon: 'error', title: 'Reset failed', text: errText(err) })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Demo data"
        subtitle="The one-click demo accounts are shared by every visitor and rebuilt on a fixed six-hour cycle."
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      {loading && !state ? (
        <Loading />
      ) : state ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Demo login
            </p>
            <div className="mt-2">
              <Badge tone={state.enabled ? 'green' : 'slate'}>{state.enabled ? 'Enabled' : 'Disabled'}</Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {state.enabled
                ? 'Visitors can open the demo with one click from the landing page.'
                : 'DEMO_LOGIN_ENABLED=false is set on the server, so the demo buttons and endpoint are off.'}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Last reset
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {formatDateTime(state.lastResetAt)}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Automatic resets run at 00:00, 06:00, 12:00 and 18:00 Asia/Manila.
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Manual rebuild
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Use this to give testers a clean marketplace immediately.
            </p>
            <button
              type="button"
              disabled={resetting}
              onClick={() => void handleReset()}
              className={`mt-3 ${buttonClass('danger')}`}
            >
              {resetting ? 'Rebuilding…' : 'Reset demo data now'}
            </button>
          </Card>
        </div>
      ) : null}

      <Card className="mt-4 p-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">What a reset touches</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Demo owner and renter profiles are restored to their defaults.</li>
          <li>Their listings, photos, bookings, payments and chats are deleted and re-seeded.</li>
          <li>Real users, listings, bookings and payments are never touched.</li>
          <li>Visitors who are already signed into the demo stay signed in (their user ids are stable).</li>
        </ul>
      </Card>
    </div>
  )
}
