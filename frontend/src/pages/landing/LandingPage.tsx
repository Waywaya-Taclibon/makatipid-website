import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal, type AuthMode } from '../../context/AuthModalContext'
import LandingBackdrop from '../../components/public/LandingBackdrop'
import SearchBar from '../../components/search/SearchBar'
import { toSearchParams } from '../../components/search/searchForm'

const highlights = [
  {
    title: 'List in minutes',
    body: 'Add photos, drop a pin on the map, set your price. No paperwork, no waiting.',
  },
  {
    title: 'Found on the map',
    body: 'Renters explore places by location and see exactly where a property sits.',
  },
  {
    title: 'Paid securely',
    body: 'Booking payments run through PayMongo, so both sides are covered.',
  },
]

const steps = [
  { n: '1', title: 'Create a free account', body: 'Sign up with your name, email, and password.' },
  { n: '2', title: 'List your place or browse', body: 'Owners add a property; renters search the map.' },
  { n: '3', title: 'Book and get paid', body: 'Confirm a request and the payment is handled for you.' },
]

export default function LandingPage() {
  const { token } = useAuth()
  const { openAuth } = useAuthModal()
  const location = useLocation()
  const navigate = useNavigate()

  // A redirect (from a protected URL or the /login deep link) can ask for the
  // dialog by putting it in router state. Open it, then clear the state so a
  // Back press or refresh doesn't reopen it.
  useEffect(() => {
    const requested = (location.state as { authModal?: AuthMode } | null)?.authModal
    if (!requested) return
    openAuth(requested)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate, openAuth])

  return (
    <>
      {/* Hero. No overflow-hidden here: the search bar's filter panel hangs
          below the section and would otherwise be clipped. The backdrop
          already clips its own artwork. */}
      <section className="relative isolate">
        <LandingBackdrop />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
          <span className="rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            Rental marketplace
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-800 sm:text-6xl dark:text-slate-100">
            Find a place that fits <span className="text-blue-600 dark:text-blue-400">your budget</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
            Makatipid connects owners and renters in one map. List a place in
            minutes, browse what's nearby, and settle the payment securely —
            no middlemen, no guesswork.
          </p>

          <div className="mt-8 w-full text-left">
            <SearchBar
              variant="hero"
              onSearch={(values) => navigate(`/search?${toSearchParams(values).toString()}`)}
            />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {token ? (
              <Link
                to="/dashboard"
                className="rounded-full bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="rounded-full bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Get started free
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className="rounded-full border border-slate-300 bg-white/80 px-7 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  I already have an account
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/95"
            >
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
          <Link to="/features" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            See everything Makatipid can do →
          </Link>
        </p>
      </section>

      {/* How it works strip */}
      <section className="border-y border-slate-200 bg-white/60 py-16 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold text-slate-800 sm:text-3xl dark:text-slate-100">
            How it works
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-300">
            <Link to="/how-it-works" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Read the full walkthrough →
            </Link>
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white/95 px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
          <h2 className="text-2xl font-extrabold text-slate-800 sm:text-3xl dark:text-slate-100">
            Ready to makatipid?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300">
            Join the owners and renters already using Makatipid. It's free to
            create an account.
          </p>
          <div className="mt-7 flex justify-center">
            {token ? (
              <Link
                to="/dashboard"
                className="rounded-full bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Go to Dashboard
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openAuth('register')}
                className="rounded-full bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Create your free account
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
