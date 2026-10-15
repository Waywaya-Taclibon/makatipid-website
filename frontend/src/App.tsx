import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import WorldMap from './components/WorldMap'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PaymentReturnPage from './pages/PaymentReturnPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/payment-return" element={<ProtectedRoute><PaymentReturnPage /></ProtectedRoute>} />
          <Route path="/*" element={<ProtectedRoute><WorldMap /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}