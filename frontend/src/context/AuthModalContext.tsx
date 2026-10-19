/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type AuthMode = 'login' | 'register'

interface AuthModalContextValue {
  /** Which form is showing, or null when the dialog is closed. */
  mode: AuthMode | null
  /** Where to send the user after a successful sign-in (same-origin path only). */
  returnTo: string | null
  openAuth: (mode: AuthMode, returnTo?: string) => void
  closeAuth: () => void
}

interface AuthModalState {
  mode: AuthMode
  returnTo: string | null
}

const AuthModalContext = createContext<AuthModalContextValue | undefined>(undefined)

/**
 * Only same-origin paths are allowed. `//evil.com` is protocol-relative and
 * would leave the site, so it's rejected along with full URLs.
 */
function safeReturnTo(value: string | undefined): string | null {
  if (!value) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

/**
 * Keeps the login/signup dialog in one place so every public surface (navbar,
 * hero CTA, footer, search results, and the /login + /register deep links)
 * opens the same modal instead of navigating to a separate page.
 */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthModalState | null>(null)

  const openAuth = useCallback((mode: AuthMode, returnTo?: string) => {
    setState((previous) => ({
      mode,
      // Switching from Login to Sign up keeps the destination the user came for.
      returnTo: returnTo === undefined ? (previous?.returnTo ?? null) : safeReturnTo(returnTo),
    }))
  }, [])

  const closeAuth = useCallback(() => setState(null), [])

  const value = useMemo(
    () => ({
      mode: state?.mode ?? null,
      returnTo: state?.returnTo ?? null,
      openAuth,
      closeAuth,
    }),
    [state, openAuth, closeAuth]
  )

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider')
  return ctx
}
