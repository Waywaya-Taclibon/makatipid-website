import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuthModal } from '../../context/AuthModalContext'
import DemoButtons from '../DemoButtons'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'

/**
 * One dialog for both auth flows.
 *
 * Deliberately does NOT close on an outside click (the same rule the rest of
 * the app's modals follow) — the × button and Esc are the only ways out, so a
 * stray click can't wipe half-typed credentials.
 */
export default function AuthModal() {
  const { mode, openAuth, closeAuth } = useAuthModal()
  const dialogRef = useRef<HTMLDivElement>(null)
  const open = mode !== null

  // Esc closes; the page behind is frozen so it can't scroll away underneath.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAuth()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, closeAuth])

  // Land the caret in the first field whenever the dialog opens or the form is
  // swapped, so the user can start typing immediately.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, mode])

  if (mode === null) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-black/70">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800"
      >
        <button
          type="button"
          onClick={closeAuth}
          aria-label="Close"
          className="absolute right-4 top-4 px-1 text-2xl leading-none text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
        >
          ×
        </button>

        <div className="mb-4 flex items-center gap-3 pr-8">
          <img src="/makatipid_logo.png" alt="" className="h-10 w-10 shrink-0" />
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'login'
                ? 'Log in to manage your properties and bookings.'
                : 'It only takes a minute to get started.'}
            </p>
          </div>
        </div>

        {mode === 'login' ? (
          <LoginForm onSwitchMode={() => openAuth('register')} />
        ) : (
          <RegisterForm onSwitchMode={() => openAuth('login')} />
        )}

        <DemoButtons variant="modal" />
      </div>
    </div>,
    document.body
  )
}
