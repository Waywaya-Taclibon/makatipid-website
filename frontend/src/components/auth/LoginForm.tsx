import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginRequest } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal } from '../../context/AuthModalContext'

const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function LoginForm({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false) // 1. Visibility state
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { closeAuth, returnTo } = useAuthModal()
  const navigate = useNavigate()
  // Captured before closeAuth() clears the context.
  const destination = returnTo ?? '/dashboard'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await loginRequest(email, password)
      login(res.token, res.name, res.id)
      closeAuth()
      navigate(destination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
        className={inputClass}
      />

      {/* 2. Relative wrapper for absolute positioning */}
      <div className="relative flex items-center">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type={showPassword ? 'text' : 'password'} // 3. Dynamic type based on state
          placeholder="Password"
          autoComplete="current-password"
          required
          className={`${inputClass} pr-10`} // pr-10 prevents text overlapping the eye
        />
        <button
          type="button" // 4. Must be type="button" so it doesn't submit the form!
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 text-slate-400 hover:text-slate-600 text-sm select-none dark:hover:text-slate-200"
        >
          {showPassword ? '🙈' : '👁️'}
        </button>
      </div>

      <button
        disabled={loading}
        type="submit"
        className="bg-amber-500 hover:bg-amber-600 text-white rounded-full py-2 text-sm font-semibold transition-all disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Log in'}
      </button>

      <p className="text-sm text-slate-500 text-center dark:text-slate-400">
        No account?{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          className="text-amber-600 font-semibold dark:text-amber-400"
        >
          Sign up
        </button>
      </p>
    </form>
  )
}
