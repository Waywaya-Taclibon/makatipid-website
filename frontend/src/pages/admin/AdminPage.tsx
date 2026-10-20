import { useEffect, useState } from 'react'
import {
  AdminApiError,
  adminSession,
  clearAdminSession,
  getAdminToken,
  type AdminLoginResponse,
  type AdminSession,
} from '../../api/admin'
import AdminLogin from './AdminLogin'
import AuditLog from './sections/AuditLog'
import Bookings from './sections/Bookings'
import DemoData from './sections/DemoData'
import Messages from './sections/Messages'
import Overview from './sections/Overview'
import Payments from './sections/Payments'
import Properties from './sections/Properties'
import Security from './sections/Security'
import SystemHealth from './sections/SystemHealth'
import Users from './sections/Users'

type Tab =
  | 'overview'
  | 'users'
  | 'properties'
  | 'bookings'
  | 'payments'
  | 'messages'
  | 'demo'
  | 'system'
  | 'audit'
  | 'security'

const NAV: { heading: string; items: { id: Tab; label: string }[] }[] = [
  {
    heading: 'Marketplace',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'users', label: 'Users' },
      { id: 'properties', label: 'Properties' },
      { id: 'bookings', label: 'Bookings' },
      { id: 'payments', label: 'Payments' },
      { id: 'messages', label: 'Messages' },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { id: 'demo', label: 'Demo data' },
      { id: 'system', label: 'System health' },
      { id: 'audit', label: 'Audit log' },
    ],
  },
  {
    heading: 'Account',
    items: [{ id: 'security', label: 'Security' }],
  },
]

const TITLES: Record<Tab, string> = {
  overview: 'Overview',
  users: 'Users',
  properties: 'Properties',
  bookings: 'Bookings',
  payments: 'Payments',
  messages: 'Messages',
  demo: 'Demo data',
  system: 'System health',
  audit: 'Audit log',
  security: 'Security',
}

export default function AdminPage() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'setup' | 'ready'>('checking')
  const [admin, setAdmin] = useState<AdminSession | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Keep the console out of search engines and give it its own title.
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Admin · Makatipid'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.title = previousTitle
      meta.remove()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function refreshSession() {
      const session = await adminSession()
      if (cancelled) return
      setAdmin(session.admin)
      setPendingEmail(session.admin.email)
      setPhase(session.admin.mustChangePassword ? 'setup' : 'ready')
    }

    async function boot() {
      if (!getAdminToken()) {
        setPhase('login')
        return
      }
      try {
        await refreshSession()
      } catch (err) {
        if (cancelled) return
        if (err instanceof AdminApiError && err.code === 'PASSWORD_CHANGE_REQUIRED') {
          setPhase('setup')
          return
        }
        clearAdminSession()
        setPhase('login')
      }
    }

    function signOut() {
      clearAdminSession()
      setAdmin(null)
      setPendingEmail(undefined)
      setPhase('login')
      setTab('overview')
      setSidebarOpen(false)
    }

    function passwordRequired() {
      setPhase('setup')
    }

    void boot()
    window.addEventListener('admin:expired', signOut)
    window.addEventListener('admin:password-required', passwordRequired)
    return () => {
      cancelled = true
      window.removeEventListener('admin:expired', signOut)
      window.removeEventListener('admin:password-required', passwordRequired)
    }
  }, [])

  // Hard stop when the 6-hour token expires, even if the tab sits idle.
  useEffect(() => {
    if (phase !== 'ready' || !admin?.expiresAt) return
    const remaining = new Date(admin.expiresAt).getTime() - Date.now()
    const timer = setTimeout(() => {
      clearAdminSession()
      setAdmin(null)
      setPendingEmail(undefined)
      setPhase('login')
    }, Math.max(0, remaining))
    return () => clearTimeout(timer)
  }, [phase, admin])

  async function finishLogin(result: AdminLoginResponse) {
    setPendingEmail(result.email)
    if (result.mustChangePassword) {
      setPhase('setup')
      return
    }
    try {
      const session = await adminSession()
      setAdmin(session.admin)
      setPhase(session.admin.mustChangePassword ? 'setup' : 'ready')
    } catch {
      clearAdminSession()
      setPhase('login')
    }
  }

  async function finishPasswordSetup() {
    try {
      const session = await adminSession()
      setAdmin(session.admin)
      setPendingEmail(session.admin.email)
      setPhase(session.admin.mustChangePassword ? 'setup' : 'ready')
    } catch {
      clearAdminSession()
      setPhase('login')
    }
  }

  function signOut() {
    clearAdminSession()
    setAdmin(null)
    setPendingEmail(undefined)
    setPhase('login')
    setTab('overview')
    setSidebarOpen(false)
  }

  if (phase === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
          Checking your admin session…
        </div>
      </div>
    )
  }

  if (phase === 'login' || phase === 'setup') {
    return (
      <AdminLogin
        mode={phase}
        email={pendingEmail}
        onLogin={(result) => void finishLogin(result)}
        onPasswordSet={() => void finishPasswordSetup()}
        onCancel={signOut}
      />
    )
  }

  if (!admin) return null

  // Narrowed copy for use inside the section renderer below.
  const currentAdmin = admin

  function selectTab(next: Tab) {
    setTab(next)
    setSidebarOpen(false)
  }

  function renderNav() {
    return (
      <div className="space-y-6">
        {NAV.map((group) => (
          <div key={group.heading}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {group.heading}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = item.id === tab
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectTab(item.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  function renderSection() {
    switch (tab) {
      case 'overview':
        return <Overview />
      case 'users':
        return <Users />
      case 'properties':
        return <Properties />
      case 'bookings':
        return <Bookings />
      case 'payments':
        return <Payments />
      case 'messages':
        return <Messages />
      case 'demo':
        return <DemoData />
      case 'system':
        return <SystemHealth />
      case 'audit':
        return <AuditLog />
      case 'security':
        return <Security admin={currentAdmin} onPasswordChanged={() => void finishPasswordSetup()} />
      default:
        return <Overview />
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              Menu
            </button>
            <img src="/makatipid_logo.png" alt="" className="h-9 w-9 rounded-lg object-contain" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                Makatipid
              </p>
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">Admin console</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{admin.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{admin.email}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20" aria-label="Admin sections">
            {renderNav()}
          </nav>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 cursor-default bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative h-full w-64 overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Sections</p>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
              {renderNav()}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 pb-16" aria-label={`${TITLES[tab]} section`}>
          {renderSection()}
        </main>
      </div>
    </div>
  )
}
