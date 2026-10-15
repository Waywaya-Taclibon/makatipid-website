import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { loginRequest } from '../api/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false) // 1. Visibility state
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await loginRequest(email, password)
      login(res.token, res.name, res.id)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 w-80 flex flex-col gap-3">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Log in</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        
        <input 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          type="email" 
          placeholder="Email" 
          required 
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm" 
        />
        
        {/* 2. Relative wrapper for absolute positioning */}
        <div className="relative flex items-center">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'} // 3. Dynamic type based on state
            placeholder="Password"
            required
            className="w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm" // pr-10 prevents text overlapping the eye
          />
          <button
            type="button" // 4. Must be type="button" so it doesn't submit the form!
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-slate-400 hover:text-slate-600 text-sm select-none"
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
        <p className="text-sm text-slate-500 text-center">
          No account? <Link to="/register" className="text-amber-600 font-semibold">Sign up</Link>
        </p>
      </form>
    </div>
  )
}