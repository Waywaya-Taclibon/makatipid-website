import { useState, type FormEvent } from 'react'
import { changeAdminPassword, type AdminSession } from '../../../api/admin'
import { bookedSwal, cancelSwal } from '../../../utils/swal'
import { ErrorNote, PageHeader } from '../ui'
import { buttonClass, formatDateTime } from '../helpers'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

function passwordProblem(password: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.'
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (classes < 3) return 'Include at least three of: lowercase, uppercase, numbers, symbols.'
  return null
}

export default function Security({
  admin,
  onPasswordChanged,
}: {
  admin: AdminSession
  onPasswordChanged: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const problem = passwordProblem(newPassword)
    if (problem) {
      setError(problem)
      return
    }
    if (newPassword !== confirm) {
      setError('The two new passwords do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('Choose a password different from the current one.')
      return
    }

    setBusy(true)
    try {
      await changeAdminPassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      onPasswordChanged()
      await bookedSwal.fire({
        icon: 'success',
        title: 'Password updated',
        text: 'Other admin sessions have been signed out. This session continues with a fresh 6-hour token.',
        confirmButtonText: 'OK',
      })
    } catch (err) {
      setError(errText(err))
      await cancelSwal.fire({ icon: 'error', title: 'Could not update password', text: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

  return (
    <div>
      <PageHeader
        title="Security"
        subtitle="The admin password protects every user, booking and payment record on the platform."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Account</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Email
              </dt>
              <dd className="text-slate-800 dark:text-slate-100">{admin.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Session expires
              </dt>
              <dd className="text-slate-800 dark:text-slate-100">{formatDateTime(admin.expiresAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Role
              </dt>
              <dd className="text-slate-800 dark:text-slate-100">ADMIN</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Locked out? Re-run <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">npm run promote-admin</code>{' '}
            on the backend to issue a new temporary password.
          </p>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Change password</h2>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Current password
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              New password
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              At least 12 characters, using three of: lowercase, uppercase, numbers, symbols.
            </span>
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Confirm new password
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
              className={inputClass}
            />
          </label>

          {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}

          <button type="submit" disabled={busy} className={`mt-4 ${buttonClass('primary')}`}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Changing the password rotates the session version, so every other admin session is signed out
            immediately.
          </p>
        </form>
      </div>
    </div>
  )
}
