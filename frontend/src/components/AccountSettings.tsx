import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function AccountSettings() {
  const { userName, token, login, logout } = useAuth()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: userName || '',
    email: '',
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    // Fetch current user details on mount
    const fetchProfile = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          setFormData({
            name: data.name || '',
            email: data.email || ''
          })
          setOriginalEmail(data.email || '')
        } else if (response.status === 401) {
          logout()
          navigate('/login')
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
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

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const emailChanged = formData.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase()
      const response = await fetch('http://localhost:8080/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, currentPassword: emailChanged ? currentPassword : undefined }),
      })

      if (response.status === 401) {
        logout()
        navigate('/login')
        throw new Error('Session expired. Please log in again.')
      }
      if (response.status === 403) {
      throw new Error('Session expired or unauthorized. Please log in again.')
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
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Account Settings</h2>
        <p className="text-sm text-slate-500">Update your account details and contact email address.</p>
      </div>

      {/* Notification Banner */}
      {error && <p className="text-sm font-medium text-red-500">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {formData.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase() && originalEmail !== '' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password (required to change email)</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full rounded-xl border border-slate-200 p-3 text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="self-start rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          Log Out
        </button>
      </div>
    </form>
  )
}