/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchAppConfig } from '../api/config'

interface ConfigContextValue {
  /** Whether the one-click demo is enabled server-side. */
  demoLoginEnabled: boolean
  /** Bundled demo photo URLs (relative), in order. */
  demoPhotos: string[]
  /** True once the config has been fetched (successfully or not). */
  loaded: boolean
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined)

/**
 * Runtime config fetched once on load. Defaults to "demo off" so a backend that
 * is down (or the demo switched off) never shows broken buttons.
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfigContextValue>({ demoLoginEnabled: false, demoPhotos: [], loaded: false })

  useEffect(() => {
    let cancelled = false
    fetchAppConfig()
      .then((config) => {
        if (!cancelled) setState({ ...config, loaded: true })
      })
      .catch(() => {
        if (!cancelled) setState((previous) => ({ ...previous, loaded: true }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return <ConfigContext.Provider value={state}>{children}</ConfigContext.Provider>
}

export function useAppConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useAppConfig must be used within a ConfigProvider')
  return ctx
}
