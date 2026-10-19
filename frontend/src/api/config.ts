import { API_BASE } from './http'

export interface AppConfig {
  /** Whether the one-click demo is enabled (backend kill switch). */
  demoLoginEnabled: boolean
  /** Relative URLs of the bundled demo photos, in display order. */
  demoPhotos: string[]
}

/**
 * Public runtime config. The demo kill switch lives on the backend so it can be
 * flipped without a frontend redeploy, so the UI asks for it on load.
 */
export async function fetchAppConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`)
  if (!res.ok) throw new Error(`Config request failed (${res.status})`)
  const body = await res.json()
  return {
    demoLoginEnabled: Boolean(body?.demoLoginEnabled),
    demoPhotos: Array.isArray(body?.demoPhotos) ? body.demoPhotos.filter((p: unknown) => typeof p === 'string') : [],
  }
}
