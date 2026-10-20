import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AuthModalProvider } from './context/AuthModalContext'
import { ConfigProvider } from './context/ConfigContext'
import { DemoProvider } from './context/DemoContext'
import AuthModal from './components/auth/AuthModal'
import DemoBanner from './components/DemoBanner'
import PublicLayout from './components/public/PublicLayout'
import WorldMap from './components/WorldMap'
import LandingPage from './pages/landing/LandingPage'
import AboutPage from './pages/landing/AboutPage'
import FeaturesPage from './pages/landing/FeaturesPage'
import HowItWorksPage from './pages/landing/HowItWorksPage'
import ContactPage from './pages/landing/ContactPage'
import SearchPage from './pages/landing/SearchPage'
import AuthDeepLink from './pages/landing/AuthDeepLink'
import DemoPage from './pages/landing/DemoPage'
import PaymentReturnPage from './pages/PaymentReturnPage'
import { segments } from './data/segments'

// The admin console is never linked from the public site and loads as its own
// chunk, so ordinary visitors never download it.
const AdminPage = lazy(() => import('./pages/admin/AdminPage'))

// Real app destinations. A guest who follows one of these links (a shared
// /browse URL, say) gets the login dialog opened for them so the intent isn't
// lost. An unrecognised URL (a typo) just lands on the page with no nag.
const APP_PATHS = new Set([...segments.map((s) => s.path), '/payment-return'])

// The public auth dialog and demo banner must never paint over the hidden
// admin console.
function GlobalChrome() {
  const location = useLocation()
  if (location.pathname.startsWith('/admin')) return null
  return (
    <>
      <AuthModal />
      <DemoBanner />
    </>
  )
}

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
    </div>
  )
}

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
      <ConfigProvider>
        <DemoProvider>
          <Router>
            <AuthModalProvider>
              <Routes>
                {/* /login and /register live outside the public shell so the
                    redirect happens before any chrome is painted. */}
                <Route path="/login" element={<AuthDeepLink mode="login" />} />
                <Route path="/register" element={<AuthDeepLink mode="register" />} />
                {/* One-click demo; also a shareable link (/demo?role=renter). */}
                <Route path="/demo" element={<DemoPage />} />

                {/* Hidden back office. Reachable only by typing /admin; it has
                    its own login gate and must stay ahead of the /* catch-all. */}
                <Route
                  path="/admin"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <AdminPage />
                    </Suspense>
                  }
                />

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
              <GlobalChrome />
            </AuthModalProvider>
          </Router>
        </DemoProvider>
      </ConfigProvider>
    </AuthProvider>
  )
}
