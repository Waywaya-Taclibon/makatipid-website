import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { demoLogin } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useAuthModal } from '../context/AuthModalContext'
import { useDemo } from '../context/DemoContext'
import { useAsyncLock } from '../hooks/useAsyncLock'
import type { DemoRole } from '../data/demo'

/**
 * Shared one-click demo entry. Signs in as the chosen demo persona, records that
 * this browser is in demo mode, then lands on the dashboard. Uses useAsyncLock so
 * a double click can't fire two logins.
 */
export function useDemoLogin() {
  const { login } = useAuth()
  const { closeAuth } = useAuthModal()
  const { enable } = useDemo()
  const navigate = useNavigate()
  const { busy, run } = useAsyncLock()
  const [error, setError] = useState<string | null>(null)

  const startDemo = useCallback(
    (role: DemoRole, destination = '/dashboard') =>
      run(async () => {
        setError(null)
        try {
          const res = await demoLogin(role)
          enable(role)
          login(res.token, res.name, res.id)
          closeAuth()
          navigate(destination)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not start the demo')
        }
      }),
    [run, enable, login, closeAuth, navigate]
  )

  const clearError = useCallback(() => setError(null), [])

  return { startDemo, busy, error, clearError }
}
