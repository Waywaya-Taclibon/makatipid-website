const API_BASE = 'http://localhost:8080/api'

export function notifyUnauthorized() {
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('userName')
    localStorage.removeItem('userId')
  } catch {
    // storage unavailable — state reset still happens via the event below
  }
  window.dispatchEvent(new Event('auth:expired'))
}

/** Authenticated fetch against the backend. Clears the session globally on 401. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401) {
    notifyUnauthorized()
  }
  return res
}
