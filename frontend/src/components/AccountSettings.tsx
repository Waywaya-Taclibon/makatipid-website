import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api/http'
import { validatePhone, validateSocial } from '../api/users'
import { useAsyncLock } from '../hooks/useAsyncLock'

export default function AccountSettings() {
  const { userName, token, login, logout } = useAuth()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: userName || '',
    email: '',
    phone: '',
    facebook: '',
    instagram: '',
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')

  const { busy: saving, run: runSave } = useAsyncLock()
  // Guards Save until the stored details are known: submitting a blank phone
  // before the profile loads would clear the saved number.
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    // Fetch current user details on mount
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setFormData({
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            facebook: data.facebook || '',
            instagram: data.instagram || ''
          })
          setOriginalEmail(data.email || '')
          setProfileLoaded(true)
        } else if (response.status === 401) {
          logout()
          navigate('/')
        } else {
          setError('Could not load your account details. Please refresh the page.')
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
        setError('Could not load your account details. Please refresh the page.')
      }
    }

    fetchProfile()
  }, [token, logout, navigate])

  // Submit form updates to the backend
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!token) {
    setError('You must be logged in to update account settings.')
    return
  }

    const phoneIssue = validatePhone(formData.phone)
    if (phoneIssue) {
      setError(phoneIssue)
      return
    }
    const facebookIssue = validateSocial(formData.facebook, 'Facebook')
    if (facebookIssue) {
      setError(facebookIssue)
      return
    }
    const instagramIssue = validateSocial(formData.instagram, 'Instagram')
    if (instagramIssue) {
      setError(instagramIssue)
      return
    }

    await runSave(async () => {
      setError(null)
      setSuccess(null)

      try {
        const emailChanged = formData.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase()
        const response = await fetch(`${API_BASE}/users/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...formData, currentPassword: emailChanged ? currentPassword : undefined }),
        })

        if (response.status === 401) {
          logout()
          navigate('/')
          throw new Error('Session expired. Please log in again.')
        }
        if (response.status === 403) {
        const body = await response.json().catch(() => null)
        throw new Error((body && body.message) || 'Current password is incorrect.')
        }

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error((body && body.message) || 'Failed to update account details')
        }

        const updatedUser = await response.json()
        // The server rotates the token on email change: adopt it so this device
        // stays logged in instead of 401ing on the next request.
        if (updatedUser.token) {
          login(updatedUser.token, updatedUser.name, updatedUser.id)
        } else if (updatedUser.name) {
          login(token, updatedUser.name, updatedUser.id)
        }
        setOriginalEmail(updatedUser.email || formData.email)
        setCurrentPassword('')

        setSuccess(emailChanged ? 'Account updated successfully! Your other devices were signed out.' : 'Account updated successfully!')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Account Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Update your account details, contact email address, and how renters can reach you.</p>
      </div>

      {/* Notification Banner */}
      {error && <p className="text-sm font-medium text-red-500 dark:text-red-400">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{success}</p>}

      <fieldset disabled={saving} className="flex flex-col gap-4 border-0 p-0 m-0 min-w-0">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Full Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Email Address</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contact details</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Renters see these when they contact you about a property. Facebook and Instagram are optional.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Phone Number</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="09XX XXX XXXX"
            className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Required before you can list a property. Leave blank to remove it.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Facebook</label>
          <input
            type="text"
            value={formData.facebook}
            onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
            placeholder="Profile link or @handle"
            className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Instagram</label>
          <input
            type="text"
            value={formData.instagram}
            onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
            placeholder="Profile link or @handle"
            className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>

        {formData.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase() && originalEmail !== '' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Current Password (required to change email)</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
        )}
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !profileLoaded}
          className="self-start rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          disabled={saving}
          className="self-start rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          Log Out
        </button>
      </div>
    </form>
  )
}