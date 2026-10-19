import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { confirmBookingPayment, formatCentavos } from '../api/payments'
import type { Booking } from '../data/rentallog'

type VerifyState = 'verifying' | 'success' | 'failed'

export default function PaymentReturnPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const intentId = params.get('intent')

  const [state, setState] = useState<VerifyState>(() => (intentId ? 'verifying' : 'failed'))
  const [message, setMessage] = useState<string | null>(() => (intentId ? null : 'Missing payment reference.'))
  const [booking, setBooking] = useState<Booking | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // Guard against double-invocation (e.g. React StrictMode): confirming
    // twice would create the booking, then fail on the date conflict.
    if (started.current) return
    started.current = true

    if (!intentId) return
    confirmBookingPayment(intentId)
      .then((b) => {
        setBooking(b)
        setState('success')
      })
      .catch((err) => {
        setState('failed')
        setMessage(err instanceof Error ? err.message : 'Payment confirmation failed')
      })
  }, [intentId])

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md flex flex-col gap-4 text-center dark:bg-slate-900 dark:border dark:border-slate-800">
        {state === 'verifying' && (
          <>
            <svg className="animate-spin h-8 w-8 text-[#4a9e4a] mx-auto dark:text-[#6fc46f]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Confirming your payment…</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Please wait while we verify with PayMongo and finalize your booking.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 text-2xl font-bold flex items-center justify-center mx-auto dark:bg-green-500/20 dark:text-green-300">✓</div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Booking confirmed!</h1>
            {booking && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {booking.lotName} · Booking #{booking.id}
              </p>
            )}
            <button
              onClick={() => navigate('/browse')}
              className="bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full py-2.5 text-sm font-semibold transition-all"
            >
              Back to browsing
            </button>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 text-2xl font-bold flex items-center justify-center mx-auto dark:bg-red-500/20 dark:text-red-300">✕</div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Payment didn't go through</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {message ?? 'Something went wrong.'} No booking was created and you were not charged.
            </p>
            <button
              onClick={() => navigate('/browse')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2.5 text-sm font-semibold transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
            >
              Back to browsing
            </button>
          </>
        )}

        {booking && state === 'success' && booking.price > 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Paid {formatCentavos(Math.round(booking.price * 100))}/mo rate · Test mode, no real charge
          </p>
        )}
      </div>
    </div>
  )
}
