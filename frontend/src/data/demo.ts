export type DemoRole = 'owner' | 'renter'

/** Per-device flag: which demo persona this browser is signed in as. */
export const DEMO_STORAGE_KEY = 'makatipid:demo'

export function readDemoRole(): DemoRole | null {
  try {
    const value = window.localStorage.getItem(DEMO_STORAGE_KEY)
    return value === 'owner' || value === 'renter' ? value : null
  } catch {
    return null
  }
}

export function writeDemoRole(role: DemoRole | null): void {
  try {
    if (role) window.localStorage.setItem(DEMO_STORAGE_KEY, role)
    else window.localStorage.removeItem(DEMO_STORAGE_KEY)
  } catch {
    // Storage blocked — the banner just won't persist across reloads.
  }
}
