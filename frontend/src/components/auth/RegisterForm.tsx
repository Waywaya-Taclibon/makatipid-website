import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerRequest } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal } from '../../context/AuthModalContext'
import { useAsyncLock } from '../../hooks/useAsyncLock'

const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function RegisterForm({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { busy: loading, run: runSubmit } = useAsyncLock()
  const { login } = useAuth()
  const { closeAuth, returnTo } = useAuthModal()
  const navigate = useNavigate()
  // Captured before closeAuth() clears the context.
  const destination = returnTo ?? '/dashboard'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await runSubmit(async () => {
      setError(null)
      try {
        const res = await registerRequest(name, email, password)
        login(res.token, res.name, res.id)
        closeAuth()
        navigate(destination)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <fieldset disabled={loading} className="flex flex-col gap-3 border-0 p-0 m-0 min-w-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoComplete="name"
          required
          className={inputClass}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          className={inputClass}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </fieldset>

      <button
        disabled={loading}
        type="submit"
        className="bg-amber-500 hover:bg-amber-600 text-white rounded-full py-2 text-sm font-semibold transition-all disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Sign up'}
      </button>

      <p className="text-sm text-slate-500 text-center dark:text-slate-400">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          disabled={loading}
          className="text-amber-600 font-semibold disabled:opacity-50 dark:text-amber-400"
        >
          Log in
        </button>
      </p>
    </form>
  )
}
