import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal } from '../../context/AuthModalContext'
import DemoButtons from '../DemoButtons'
import { CONTACT } from '../../data/contact'

export default function Footer() {
  const { token } = useAuth()
  const { openAuth } = useAuthModal()
  const navigate = useNavigate()

  return (
    <footer className="border-t border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <img src="/makatipid_logo.png" alt="" className="h-9 w-9" />
            <span className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              Makatipid
            </span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            A rental marketplace built for Filipinos — list a place in minutes,
            find one on the map, and settle payment securely.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Explore</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            <li><Link to="/about" className="hover:text-blue-600 dark:hover:text-blue-400">About</Link></li>
            <li><Link to="/features" className="hover:text-blue-600 dark:hover:text-blue-400">Features</Link></li>
            <li><Link to="/how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400">How it works</Link></li>
            <li><Link to="/contact" className="hover:text-blue-600 dark:hover:text-blue-400">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Get started</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
            {token ? (
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                >
                  Go to Dashboard
                </button>
              </li>
            ) : (
              <>
                <li>
                  <button
                    type="button"
                    onClick={() => openAuth('register')}
                    className="hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Create an account
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => openAuth('login')}
                    className="hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Log in
                  </button>
                </li>
                <DemoButtons variant="footer" />
              </>
            )}
            {CONTACT.email && (
              <li>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {CONTACT.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-5 text-center text-xs text-slate-500 sm:px-6 dark:border-slate-800 dark:text-slate-400">
        © {new Date().getFullYear()} Makatipid. All rights reserved.
      </div>
    </footer>
  )
}
