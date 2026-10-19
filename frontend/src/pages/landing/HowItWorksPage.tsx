import { Link } from 'react-router-dom'
import PageHeader from '../../components/public/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal } from '../../context/AuthModalContext'

const ownerSteps = [
  {
    n: '1',
    title: 'Create your account',
    body: 'Your name, email, and a password. That\'s the whole signup.',
  },
  {
    n: '2',
    title: 'Add the contact number renters will see',
    body: 'You\'ll be asked once, the first time you add a property. Renters need a way to reach you.',
  },
  {
    n: '3',
    title: 'List the property',
    body: 'Photos, monthly price, and the details that matter. Drop a pin on the map for the exact spot.',
  },
  {
    n: '4',
    title: 'Review booking requests',
    body: 'Requests arrive in your dashboard. Accept or decline — a decline releases the slot immediately.',
  },
  {
    n: '5',
    title: 'Get paid',
    body: 'Accepted bookings are paid through PayMongo and settled to your account.',
  },
]

const renterSteps = [
  {
    n: '1',
    title: 'Create your account',
    body: 'Free, and it takes about a minute.',
  },
  {
    n: '2',
    title: 'Browse the map',
    body: 'Filter what\'s available and open any listing to see photos, price, and the exact location.',
  },
  {
    n: '3',
    title: 'Contact the owner if you have questions',
    body: 'Their phone, email, and socials are on the listing.',
  },
  {
    n: '4',
    title: 'Book and pay securely',
    body: 'Send a booking request and pay through PayMongo once the owner accepts.',
  },
]

function StepList({ steps }: { steps: { n: string; title: string; body: string }[] }) {
  return (
    <ol className="mt-6 flex flex-col gap-5">
      {steps.map((step) => (
        <li key={step.n} className="flex items-start gap-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {step.n}
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function HowItWorksPage() {
  const { token } = useAuth()
  const { openAuth } = useAuthModal()

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <PageHeader
        eyebrow="How it works"
        title="Two sides, one flow"
        description="Whether you're listing a place or looking for one, it comes down to a few steps."
      />

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">If you're an owner</h2>
          <StepList steps={ownerSteps} />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/95 p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">If you're a renter</h2>
          <StepList steps={renterSteps} />
        </div>
      </div>

      <div className="mt-14 rounded-3xl border border-slate-200 bg-white/95 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/95">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Ready when you are</h2>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
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
              Get started free
            </button>
          )}
          <Link
            to="/contact"
            className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  )
}
