import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppConfig } from '../../context/ConfigContext'
import { useDemoLogin } from '../../hooks/useDemoLogin'
import type { DemoRole } from '../../data/demo'

/**
 * `/demo` (and `/demo?role=renter`) is the shareable one-click entry: it signs
 * the visitor into a demo account on load and bounces to the dashboard. Lives
 * outside the public shell so the redirect happens before any chrome paints.
 */
export default function DemoPage() {
  const [params] = useSearchParams()
  const role: DemoRole = params.get('role') === 'renter' ? 'renter' : 'owner'
  const { demoLoginEnabled, loaded } = useAppConfig()
  const { startDemo, busy, error } = useDemoLogin()
  const navigate = useNavigate()
  const startedRef = useRef(false)

  useEffect(() => {
    if (!loaded) return
    if (!demoLoginEnabled) {
      navigate('/', { replace: true })
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    void startDemo(role)
  }, [loaded, demoLoginEnabled, role, startDemo, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 text-center dark:bg-slate-950">
      <img src="/makatipid_logo.png" alt="" className="h-14 w-14" />
      <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
        {error ? 'Could not start the demo' : busy ? 'Starting your demo…' : 'Preparing the demo…'}
      </h1>

      {error ? (
        <>
          <p className="max-w-md text-sm text-red-500 dark:text-red-400">{error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void startDemo(role)}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Try again
            </button>
            <Link
              to="/"
              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Back home
            </Link>
          </div>
        </>
      ) : (
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          Signing you in as the demo {role}. Real listings, mock payments — nothing to set up.
        </p>
      )}

      <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
      </div>
    </div>
  )
}
