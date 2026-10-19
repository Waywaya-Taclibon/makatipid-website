import { Link } from 'react-router-dom'
import PageHeader from '../../components/public/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal } from '../../context/AuthModalContext'

const values = [
  {
    title: 'Makatipid means to save',
    body: 'The name is the whole idea. Renting should cost less — less time, less guesswork, and fewer fees lost in the middle.',
  },
  {
    title: 'Built around a map',
    body: 'Location is the first thing anyone asks about a rental. So it is the first thing you see here, not a line of text in a listing.',
  },
  {
    title: 'Owners and renters, one place',
    body: 'Owners list and confirm. Renters browse, ask, and book. Both sides track the same record, so nobody has to chase anyone.',
  },
]

export default function AboutPage() {
  const { token } = useAuth()
  const { openAuth } = useAuthModal()

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <PageHeader
        eyebrow="About"
        title="Renting, without the runaround"
        description="Makatipid is a rental marketplace for the Philippines. Owners list their places in minutes; renters find them on a map and book with a payment flow that protects both sides."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-3">
        {values.map((value) => (
          <div
            key={value.title}
            className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/95"
          >
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{value.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{value.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-3xl border border-slate-200 bg-white/95 p-8 dark:border-slate-800 dark:bg-slate-900/95">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Who it's for</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Owners</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              You have a room, a unit, or a lot sitting empty. Add it once with
              photos, a pin on the map, and your price. New booking requests land
              in your dashboard, and you decide what to accept.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Renters</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              You want somewhere near work, school, or family, at a price that
              makes sense. Browse by location, compare what's actually there,
              and reach the owner directly.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/how-it-works"
            className="rounded-full bg-blue-600 px-6 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            See how it works
          </Link>
          {!token && (
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Create an account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
