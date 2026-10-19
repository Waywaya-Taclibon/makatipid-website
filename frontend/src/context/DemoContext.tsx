/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { readDemoRole, writeDemoRole, type DemoRole } from '../data/demo'

interface DemoContextValue {
  /** True while this browser is signed in as a shared demo account. */
  isDemo: boolean
  /** Which demo persona, or null. */
  role: DemoRole | null
  enable: (role: DemoRole) => void
  disable: () => void
}

const DemoContext = createContext<DemoContextValue | undefined>(undefined)

/**
 * Tracks whether the current session is a demo. Persisted per device so the
 * banner survives a refresh; cleared whenever the user signs out.
 */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<DemoRole | null>(readDemoRole)

  // Any sign-out — manual or a 401 elsewhere in the app — ends demo mode too,
  // so the banner can never linger on a real session.
  useEffect(() => {
    const clear = () => {
      writeDemoRole(null)
      setRole(null)
    }
    window.addEventListener('auth:logout', clear)
    window.addEventListener('auth:expired', clear)
    return () => {
      window.removeEventListener('auth:logout', clear)
      window.removeEventListener('auth:expired', clear)
    }
  }, [])

  const enable = useCallback((next: DemoRole) => {
    writeDemoRole(next)
    setRole(next)
  }, [])

  const disable = useCallback(() => {
    writeDemoRole(null)
    setRole(null)
  }, [])

  const value = useMemo(
    () => ({ isDemo: role !== null, role, enable, disable }),
    [role, enable, disable]
  )

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used within a DemoProvider')
  return ctx
}
