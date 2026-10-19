import { Link } from 'react-router-dom'
import PageHeader from '../../components/public/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal } from '../../context/AuthModalContext'

const features = [
  {
    title: 'Map-based listings',
    body: 'Every property is placed on the map with an exact pin. Find a place by position instead of parsing an address.',
  },
  {
    title: 'Add a property in minutes',
    body: 'Photos, price, details, and a drop-the-pin location picker. Up to three photos per listing, editable one at a time.',
  },
  {
    title: 'Secure booking payments',
    body: 'Renters pay through PayMongo. Bookings are held while payment clears, so a double-booking can\'t slip through.',
  },
  {
    title: 'Direct owner contact',
    body: 'Phone, email, and social handles on the listing, so a renter can ask a question before committing.',
  },
  {
    title: 'Booking management',
    body: 'Owners review and confirm requests; renters follow each booking\'s status from their dashboard.',
  },
  {
    title: 'Light and dark mode',
    body: 'The whole app follows your device, or you can pick a side yourself. Your choice sticks on this device.',
  },
]

export default function FeaturesPage() {
  const { token } = useAuth()
  const { openAuth } = useAuthModal()

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <PageHeader
        eyebrow="Features"
        title="Everything you need to rent or be rented"
        description="Makatipid keeps the tools owners and renters actually use — and leaves out the parts that slow both of them down."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/95"
          >
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{feature.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white/95 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/95">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
          See it for yourself
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          The fastest way to understand Makatipid is to make an account and add
          a property — even a draft.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {token ? (
            <Link
              to="/dashboard"
              className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Create a free account
            </button>
          )}
          <Link
            to="/how-it-works"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            How it works
          </Link>
        </div>
      </div>
    </div>
  )
}
