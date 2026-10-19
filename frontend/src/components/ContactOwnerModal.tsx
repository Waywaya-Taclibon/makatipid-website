import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { OwnerContact, Property } from '../data/properties'
import { useAuth } from '../context/AuthContext'
import { useAuthModal } from '../context/AuthModalContext'
import MessageOwnerModal from './MessageOwnerModal'

interface ContactOwnerModalProps {
  property: Property
  onClose: () => void
}

/**
 * Renter-facing "how do I reach this owner" card.
 *
 * View-only on purpose: the owner's details are not editable here and are not
 * stored by this component. Values come from `Property.ownerContact`, which the
 * API does not populate yet — every row falls back to a placeholder until it
 * does.
 */

/** Keeps only digits and a leading + so tel: links dial cleanly. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function mailHref(email: string): string {
  return `mailto:${email.trim()}`
}

/** Accepts a full URL or a bare handle ("@juandelacruz" / "juandelacruz"). */
function socialHref(value: string, base: string): string {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `${base}/${trimmed.replace(/^@/, '')}`
}

function displayHandle(value: string): string {
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    // Show just the last path segment for readability.
    const last = trimmed.replace(/\/+$/, '').split('/').pop()
    return last ? `@${last.replace(/^@/, '')}` : trimmed
  }
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.24-1.46 1.49-1.46H16.6V4.45A20 20 0 0 0 14.3 4.3c-2.34 0-3.94 1.43-3.94 4.05v2.15H7.75v3h2.61V21h3.14z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

/** One labelled contact line: clickable when a value exists, muted when not. */
function ContactRow({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
  href?: string
  external?: boolean
}) {
  const hasValue = Boolean(value && value.trim())

  const inner = (
    <>
      <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <span className={`block text-sm truncate ${hasValue ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
          {hasValue ? value : 'Not provided yet'}
        </span>
      </span>
    </>
  )

  const baseClass =
    'flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700'

  if (!hasValue || !href) {
    return <div className={baseClass}>{inner}</div>
  }

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={`${baseClass} transition-colors hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10`}
    >
      {inner}
    </a>
  )
}

export default function ContactOwnerModal({ property, onClose }: ContactOwnerModalProps) {
  const { token } = useAuth()
  const { openAuth } = useAuthModal()
  const [showMessenger, setShowMessenger] = useState(false)

  const contact: OwnerContact = property.ownerContact ?? {}
  const ownerName = contact.name?.trim() || `Owner #${property.ownerId}`
  const hasAnyContact = Boolean(
    contact.phone?.trim() ||
      contact.email?.trim() ||
      contact.facebook?.trim() ||
      contact.instagram?.trim()
  )

  function handleMessage() {
    if (!token) {
      // Public search allows anonymous browsing: sign them in, then they can
      // start the chat from the same listing.
      openAuth('login', window.location.pathname + window.location.search)
      return
    }
    setShowMessenger(true)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-owner-title"
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border dark:border-slate-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="contact-owner-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Contact Owner
            </h3>
            <p className="text-sm text-slate-500 mt-0.5 dark:text-slate-400">
              {property.lotName} · {property.address}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1 dark:hover:text-slate-200"
            aria-label="Close contact owner"
          >
            ×
          </button>
        </div>

        {/* Owner identity */}
        <div className="mt-4 flex items-center gap-3">
          <span className="w-12 h-12 shrink-0 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center">
            {initialOf(ownerName)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate dark:text-slate-100">{ownerName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Property owner</p>
          </div>
        </div>

        {!hasAnyContact && (
          <div className="mt-4 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-xl p-3 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300">
            This owner hasn't added contact details yet. You can still send a rental
            request — they'll get back to you once it's submitted.
          </div>
        )}

        {/* Contact details */}
        <div className="mt-4 flex flex-col gap-2">
          <ContactRow
            icon={<PhoneIcon className="w-4 h-4" />}
            label="Phone"
            value={contact.phone}
            href={contact.phone ? telHref(contact.phone) : undefined}
          />
          <ContactRow
            icon={<MailIcon className="w-4 h-4" />}
            label="Email"
            value={contact.email}
            href={contact.email ? mailHref(contact.email) : undefined}
          />
          <ContactRow
            icon={<FacebookIcon className="w-4 h-4" />}
            label="Facebook"
            value={contact.facebook ? displayHandle(contact.facebook) : undefined}
            href={contact.facebook ? socialHref(contact.facebook, 'https://facebook.com') : undefined}
            external
          />
          <ContactRow
            icon={<InstagramIcon className="w-4 h-4" />}
            label="Instagram"
            value={contact.instagram ? displayHandle(contact.instagram) : undefined}
            href={contact.instagram ? socialHref(contact.instagram, 'https://instagram.com') : undefined}
            external
          />
        </div>

        {/* In-app messaging. Chats are temporary (24h after the last message). */}
        <div className="mt-5">
          <button
            type="button"
            onClick={handleMessage}
            className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold bg-blue-600 text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <ChatIcon className="w-4 h-4" />
            Message on Makatipid
          </button>
          <p className="mt-1.5 text-xs text-center text-slate-400 dark:text-slate-500">
            Chats are temporary — they disappear 24 hours after the last message.
          </p>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2 text-sm font-semibold transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>

      {showMessenger && <MessageOwnerModal property={property} onClose={() => setShowMessenger(false)} />}
    </div>,
    document.body
  )
}
