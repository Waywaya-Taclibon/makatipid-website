import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDemo } from '../context/DemoContext'

/**
 * Fixed strip shown whenever this browser is signed in as a demo account. It
 * sets expectations (sample data, mock payments, periodic reset) and offers the
 * only deliberate way out of demo mode.
 */
export default function DemoBanner() {
  const { isDemo, role, disable } = useDemo()
  const { logout } = useAuth()
  const navigate = useNavigate()

  if (!isDemo) return null

  const exitDemo = () => {
    disable()
    logout()
    navigate('/')
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-300 bg-amber-50/95 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur dark:border-amber-500/40 dark:bg-amber-950/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2 text-center text-xs text-amber-900 dark:text-amber-100">
        <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-bold uppercase tracking-wide">
          Demo mode{role ? ` · ${role}` : ''}
        </span>
        <span>
          You're exploring Makatipid with sample data as the demo {role}. Bookings use a mock
          payment, and everything resets every 6 hours.
        </span>
        <button
          type="button"
          onClick={exitDemo}
          className="rounded-full border border-amber-400 px-3 py-1 font-semibold transition-colors hover:bg-amber-100 dark:border-amber-500/50 dark:hover:bg-amber-500/20"
        >
          Exit demo
        </button>
      </div>
    </div>
  )
}
