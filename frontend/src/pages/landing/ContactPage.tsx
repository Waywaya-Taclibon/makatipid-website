import PageHeader from '../../components/public/PageHeader'
import { CONTACT } from '../../data/contact'

/** Keeps only digits and a leading + so tel: links dial cleanly. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** Accepts a full URL or a bare handle ("@makatipid" / "makatipid"). */
function socialHref(value: string, base: string): string {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `${base}/${trimmed.replace(/^@/, '')}`
}

function displayHandle(value: string): string {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    const last = trimmed.replace(/\/+$/, '').split('/').pop()
    return last ? `@${last.replace(/^@/, '')}` : trimmed
  }
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

const cardClass =
  'flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/95'

export default function ContactPage() {
  const hasAny = Boolean(CONTACT.email || CONTACT.phone || CONTACT.facebook || CONTACT.instagram)

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <PageHeader
        eyebrow="Contact"
        title="Talk to us"
        description="Questions about listing a property, a booking, or a payment? Reach out through any of the channels below."
      />

      {hasAny ? (
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {CONTACT.email && (
            <div className={cardClass}>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Email
              </span>
              <a
                href={`mailto:${CONTACT.email}`}
                className="text-sm font-semibold text-blue-600 break-all hover:underline dark:text-blue-400"
              >
                {CONTACT.email}
              </a>
            </div>
          )}

          {CONTACT.phone && (
            <div className={cardClass}>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Phone
              </span>
              <a
                href={telHref(CONTACT.phone)}
                className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                {CONTACT.phone}
              </a>
            </div>
          )}

          {CONTACT.facebook && (
            <div className={cardClass}>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Facebook
              </span>
              <a
                href={socialHref(CONTACT.facebook, 'https://facebook.com')}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                {displayHandle(CONTACT.facebook)}
              </a>
            </div>
          )}

          {CONTACT.instagram && (
            <div className={cardClass}>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Instagram
              </span>
              <a
                href={socialHref(CONTACT.instagram, 'https://instagram.com')}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                {displayHandle(CONTACT.instagram)}
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-14 rounded-2xl border border-slate-200 bg-white/95 p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300">
          Contact details are being finalised.
        </p>
      )}

      <p className="mt-8 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        For anything about a specific property, the fastest route is the
        "Contact Owner" button on that listing — it goes straight to the owner.
      </p>
    </div>
  )
}
