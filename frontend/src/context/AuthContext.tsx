
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface AuthContextValue {
  token: string | null
  userName: string | null
  userId: number | null
  login: (token: string, userName: string, userId: number) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem('userName'))

  const [userId, setUserId] = useState<number | null>(() => {
    const saved = localStorage.getItem('userId')
    return saved ? Number(saved) : null
  })

  function login(newToken: string, newUserName: string, newUserId: number) {
    localStorage.setItem('token', newToken)
    localStorage.setItem('userName', newUserName)
    localStorage.setItem('userId', String(newUserId))
    setToken(newToken)
    setUserName(newUserName)
    setUserId(newUserId)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('userName')
    localStorage.removeItem('userId')

    setToken(null)
    setUserName(null)
    setUserId(null)
  }

  // Any 401 from apiFetch() lands here and ends the session everywhere at once,
  // so a stale/rotated token can't leave the app half-logged-in.
  useEffect(() => {
    const onExpired = () => {
      setToken(null)
      setUserName(null)
      setUserId(null)
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  return (
    <AuthContext.Provider value={{ token, userName, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}