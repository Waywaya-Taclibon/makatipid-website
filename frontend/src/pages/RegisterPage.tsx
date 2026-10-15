import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registerRequest } from '../api/auth'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await registerRequest(name, email, password)
      login(res.token, res.name, res.id)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 w-80 flex flex-col gap-3">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Sign up</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        <button disabled={loading} type="submit" className="bg-amber-500 hover:bg-amber-600 text-white rounded-full py-2 text-sm font-semibold transition-all disabled:opacity-50">
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
        <p className="text-sm text-slate-500 text-center">
          Already have an account? <Link to="/login" className="text-amber-600 font-semibold">Log in</Link>
        </p>
      </form>
    </div>
  )
}