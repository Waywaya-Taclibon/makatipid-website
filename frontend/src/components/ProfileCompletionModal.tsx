import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { updateMyProfile, validatePhone, validateSocial, type UserProfile } from '../api/users'
import { useAuth } from '../context/AuthContext'
import { useAsyncLock } from '../hooks/useAsyncLock'

interface ProfileCompletionModalProps {
  profile: UserProfile
  onClose: () => void
  onSaved: (profile: UserProfile) => void
}

const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'
const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400'

/** Matches the server rule: at least 7 digits, only dial-friendly characters. */
function phoneError(value: string): string | null {
  if (!value.trim()) return 'Phone number is required — renters use it to reach you.'
  if (value.length > 32) return 'Phone must be 32 characters or fewer.'
  return validatePhone(value)
}

function socialError(value: string, label: string): string | null {
  return validateSocial(value, label)
}

export default function ProfileCompletionModal({ profile, onClose, onSaved }: ProfileCompletionModalProps) {
  const { token, userId, login } = useAuth()

  const [name, setName] = useState(profile.name ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [facebook, setFacebook] = useState(profile.facebook ?? '')
  const [instagram, setInstagram] = useState(profile.instagram ?? '')
  const [error, setError] = useState<string | null>(null)
  const { busy: saving, run: runSave } = useAsyncLock()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter your name.')
      return
    }
    const pErr = phoneError(phone)
    if (pErr) {
      setError(pErr)
      return
    }
    const fbErr = socialError(facebook, 'Facebook')
    if (fbErr) {
      setError(fbErr)
      return
    }
    const igErr = socialError(instagram, 'Instagram')
    if (igErr) {
      setError(igErr)
      return
    }

    await runSave(async () => {
      setError(null)
      try {
        // Email is intentionally not editable here (changing it needs the current
        // password — that flow lives in Account Settings), so we echo it back.
        const updated = await updateMyProfile({
          name: name.trim(),
          email: profile.email,
          phone: phone.trim(),
          facebook: facebook.trim(),
          instagram: instagram.trim(),
        })
        // Keep the header/greeting in sync if the name changed.
        if (token && userId != null) {
          login(updated.token ?? token, updated.name, updated.id)
        }
        onSaved(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save your details')
      }
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-completion-title"
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col gap-3 dark:bg-slate-900 dark:border dark:border-slate-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="profile-completion-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Complete your information
            </h3>
            <p className="text-sm text-slate-500 mt-0.5 dark:text-slate-400">
              These details are shared with renters when they contact you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1 disabled:opacity-50 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl p-3 dark:bg-blue-500/10 dark:border-blue-500/40 dark:text-blue-300">
          A phone number is required before you can list a property. Facebook and Instagram are optional.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 dark:bg-red-500/10 dark:border-red-500/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="profile-name">Full name</label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            disabled={saving}
            className={`${inputClass} mt-1`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            value={profile.email}
            readOnly
            className={`${inputClass} mt-1 bg-slate-100 text-slate-500 cursor-not-allowed dark:bg-slate-800/50 dark:text-slate-400`}
          />
          <p className="text-[11px] text-slate-400 mt-1 dark:text-slate-500">
            To change your email, use Account Settings.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-phone">
            Phone number <span className="font-normal normal-case">(required)</span>
          </label>
          <input
            id="profile-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09XX XXX XXXX"
            inputMode="tel"
            required
            disabled={saving}
            className={`${inputClass} mt-1`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-facebook">
            Facebook <span className="font-normal normal-case">(optional)</span>
          </label>
          <input
            id="profile-facebook"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="Profile link or @handle"
            disabled={saving}
            className={`${inputClass} mt-1`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-instagram">
            Instagram <span className="font-normal normal-case">(optional)</span>
          </label>
          <input
            id="profile-instagram"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="Profile link or @handle"
            disabled={saving}
            className={`${inputClass} mt-1`}
          />
        </div>

        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full py-2 text-sm font-semibold transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save details'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2 text-sm font-semibold transition-all disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
