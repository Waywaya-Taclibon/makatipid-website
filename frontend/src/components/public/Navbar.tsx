import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal } from '../../context/AuthModalContext'
import ThemeToggle from './ThemeToggle'

const links = [
  { to: '/about', label: 'About' },
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/contact', label: 'Contact' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  }`

export default function Navbar() {
  const { token, userName, logout } = useAuth()
  const { openAuth } = useAuthModal()
  const navigate = useNavigate()
  const location = useLocation()
  const [openPath, setOpenPath] = useState<string | null>(null)

  // The panel is tied to the route it was opened on, so any navigation —
  // including a Back/Forward press — closes it without needing an effect.
  const menuOpen = openPath === location.pathname

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 md:grid md:grid-cols-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 shrink-0 md:justify-self-start">
          <img src="/makatipid_logo.png" alt="" className="h-9 w-9" />
          <span className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            Makatipid
          </span>
        </Link>

        {/* Centre links — desktop only. Grid columns keep them truly centred
            regardless of how wide the brand or the controls get. */}
        <div className="hidden items-center gap-1 md:flex md:justify-self-center">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Right side — desktop only */}
        <div className="hidden items-center gap-2 md:flex md:justify-self-end">
          <ThemeToggle />
          {token ? (
            <>
              <span className="max-w-[10rem] truncate text-sm font-medium text-slate-600 dark:text-slate-300">
                {userName}
              </span>
              <Link
                to="/dashboard"
                className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Go to Dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuth('register')}
                className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Sign up
              </button>
            </>
          )}
        </div>

        {/* Right side — mobile */}
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpenPath(menuOpen ? null : location.pathname)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>

      {/* Any click inside the panel dismisses it after the click's own
          handler runs — including a re-tap of the current page's link. */}
      {menuOpen && (
        <div
          onClick={() => setOpenPath(null)}
          className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {token ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-full bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Go to Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
