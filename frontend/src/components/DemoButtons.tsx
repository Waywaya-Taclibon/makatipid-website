import { useAppConfig } from '../context/ConfigContext'
import { useDemoLogin } from '../hooks/useDemoLogin'

type DemoButtonVariant = 'hero' | 'compact' | 'modal' | 'footer'

/**
 * The one-click demo entry points. Renders nothing when the backend kill switch
 * is off, so the buttons vanish the moment the demo is disabled.
 */
export default function DemoButtons({ variant = 'hero' }: { variant?: DemoButtonVariant }) {
  const { demoLoginEnabled } = useAppConfig()
  const { startDemo, busy, error } = useDemoLogin()

  if (!demoLoginEnabled) return null

  const ownerLabel = busy ? 'Starting…' : 'Demo as owner'
  const renterLabel = busy ? 'Starting…' : 'Demo as renter'

  if (variant === 'compact') {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void startDemo('owner')}
        className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
      >
        {busy ? 'Starting…' : 'Try demo'}
      </button>
    )
  }

  if (variant === 'footer') {
    return (
      <>
        <li>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startDemo('owner')}
            className="hover:text-blue-600 disabled:opacity-50 dark:hover:text-blue-400"
          >
            Try the demo as an owner
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startDemo('renter')}
            className="hover:text-blue-600 disabled:opacity-50 dark:hover:text-blue-400"
          >
            Try the demo as a renter
          </button>
        </li>
      </>
    )
  }

  if (variant === 'modal') {
    return (
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Just looking around? Jump straight in — no signup needed.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void startDemo('owner')}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {ownerLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startDemo('renter')}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {renterLabel}
          </button>
        </div>
        {error && <p className="mt-2 text-center text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    )
  }

  // hero
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        or try it instantly
      </span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={() => void startDemo('owner')}
          className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {ownerLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void startDemo('renter')}
          className="rounded-full border border-emerald-300 bg-white/80 px-6 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-slate-900/80 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          {renterLabel}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  )
}
