import { useState, type FormEvent } from 'react'
import { adminLogin, changeAdminPassword, AdminApiError, type AdminLoginResponse } from '../../api/admin'
import { ErrorNote } from './ui'

function passwordProblem(password: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters.'
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (classes < 3) return 'Include at least three of: lowercase, uppercase, numbers, symbols.'
  return null
}

function errorMessage(err: unknown): string {
  if (err instanceof AdminApiError) {
    if (err.status === 429) return 'Too many attempts. Wait a few minutes and try again.'
    return err.message
  }
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export default function AdminLogin({
  mode,
  email: signedInEmail,
  onLogin,
  onPasswordSet,
  onCancel,
}: {
  mode: 'login' | 'setup'
  email?: string
  onLogin: (result: AdminLoginResponse) => void
  onPasswordSet: () => void
  onCancel: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await adminLogin(email.trim(), password)
      onLogin(result)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSetup(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const problem = passwordProblem(newPassword)
    if (problem) {
      setError(problem)
      return
    }
    if (newPassword !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await changeAdminPassword(null, newPassword)
      setNewPassword('')
      setConfirm('')
      onPasswordSet()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/makatipid_logo.png" alt="" className="h-10 w-10 rounded-xl object-contain" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Makatipid</p>
            <h1 className="text-xl font-bold text-white">Admin console</h1>
          </div>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-sm text-slate-400">Authorised personnel only. All actions are logged.</p>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  className={`${inputClass} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-auto h-7 rounded-lg px-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {error && <ErrorNote>{error}</ErrorNote>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Signed in as <span className="font-semibold">{signedInEmail}</span>. The temporary password has been
              retired — choose the password you will use from now on.
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                New password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={12}
                  className={`${inputClass} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-auto h-7 rounded-lg px-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <span className="mt-1 block text-xs text-slate-500">
                At least 12 characters, using three of: lowercase, uppercase, numbers, symbols.
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Confirm new password
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={12}
                className={inputClass}
              />
            </label>

            {error && <ErrorNote>{error}</ErrorNote>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Set password and continue'}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Sign out instead
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Admin sessions expire after 6 hours. Unrecognised requests are answered with 404.
        </p>
      </div>
    </div>
  )
}
