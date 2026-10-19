import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AuthModalProvider } from './context/AuthModalContext'
import AuthModal from './components/auth/AuthModal'
import PublicLayout from './components/public/PublicLayout'
import WorldMap from './components/WorldMap'
import LandingPage from './pages/landing/LandingPage'
import AboutPage from './pages/landing/AboutPage'
import FeaturesPage from './pages/landing/FeaturesPage'
import HowItWorksPage from './pages/landing/HowItWorksPage'
import ContactPage from './pages/landing/ContactPage'
import SearchPage from './pages/landing/SearchPage'
import AuthDeepLink from './pages/landing/AuthDeepLink'
import PaymentReturnPage from './pages/PaymentReturnPage'
import { segments } from './data/segments'

// Real app destinations. A guest who follows one of these links (a shared
// /browse URL, say) gets the login dialog opened for them so the intent isn't
// lost. An unrecognised URL (a typo) just lands on the page with no nag.
const APP_PATHS = new Set([...segments.map((s) => s.path), '/payment-return'])

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const location = useLocation()

  if (!token) {
    return (
      <Navigate
        to="/"
        replace
        state={APP_PATHS.has(location.pathname) ? { authModal: 'login' } : undefined}
      />
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AuthModalProvider>
          <Routes>
            {/* /login and /register live outside the public shell so the
                redirect happens before any chrome is painted. */}
            <Route path="/login" element={<AuthDeepLink mode="login" />} />
            <Route path="/register" element={<AuthDeepLink mode="register" />} />

            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/search" element={<SearchPage />} />
            </Route>

            <Route path="/payment-return" element={<ProtectedRoute><PaymentReturnPage /></ProtectedRoute>} />
            <Route path="/*" element={<ProtectedRoute><WorldMap /></ProtectedRoute>} />
          </Routes>
          <AuthModal />
        </AuthModalProvider>
      </Router>
    </AuthProvider>
  )
}
