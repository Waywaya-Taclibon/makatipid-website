import { Outlet } from 'react-router-dom'
import Footer from './Footer'
import Navbar from './Navbar'

/** Shared shell for every public (logged-out-friendly) page. */
export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <Navbar />
      {/* pt-16 clears the fixed 4rem navbar. */}
      <main className="flex-1 pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
