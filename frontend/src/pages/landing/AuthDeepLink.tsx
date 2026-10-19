import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { AuthMode } from '../../context/AuthModalContext'

/**
 * `/login` and `/register` still work as shareable links: instead of a second
 * full-screen form, they hop to the landing page and ask it to open the dialog
 * (via router state, which is dropped again right after so Back/refresh doesn't
 * reopen it).
 */
export default function AuthDeepLink({ mode }: { mode: AuthMode }) {
  const { token } = useAuth()

  // Already signed in — don't nag, just go to the app.
  if (token) return <Navigate to="/dashboard" replace />

  return <Navigate to="/" replace state={{ authModal: mode }} />
}
