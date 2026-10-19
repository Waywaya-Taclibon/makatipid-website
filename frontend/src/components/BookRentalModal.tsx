import { useState, useEffect, useRef, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'
import type { Property } from '../data/properties'
import type { Booking } from '../data/rentallog'
import { fetchLogsByProperty } from '../api/rentallog'
import { useAsyncLock } from '../hooks/useAsyncLock'
import {
  attachQrPaymentMethod,
  confirmBookingPayment,
  confirmDemoBooking,
  createBookingIntent,
  createDemoBookingIntent,
  createQrPaymentMethod,
  formatCentavos,
  getPaymentStatus,
  QR_EXPIRY_SECONDS,
} from '../api/payments'
import { findConflictingBooking, formatBookingDate } from '../utils/bookingStatus'
import { computeEndDate, getTodayString } from '../utils/dates'
import { isStoredTokenExpired } from '../api/authHeaders'
import { mockQrDataUrl } from '../utils/demoQr'
import { useAuth } from '../context/AuthContext'
import { useDemo } from '../context/DemoContext'

interface BookRentalModalProps {
  property: Property
  onClose: () => void
  onSuccess: (property: Property) => void
}

const PRESET_DURATIONS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
]

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '-'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function BookRentalModal({ property, onClose, onSuccess }: BookRentalModalProps) {
  const { token } = useAuth()
  const { isDemo } = useDemo()
  const todayStr = getTodayString()

  const [startDate, setStartDate] = useState(todayStr)
  const [durationMonths, setDurationMonths] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'details' | 'payment'>('details')
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null)
  const [intentId, setIntentId] = useState<string | null>(null)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [qrRevealed, setQrRevealed] = useState(false)
  const [testUrl, setTestUrl] = useState<string | null>(null)
  const [existingBookings, setExistingBookings] = useState<Booking[]>([])
  const [existingLoading, setExistingLoading] = useState(true)
  const [existingError, setExistingError] = useState<string | null>(null)
  // Synchronous locks: state alone can miss a same-tick double click.
  const { busy: paying, run: runPayment } = useAsyncLock()
  const { busy: verifying, run: runVerify } = useAsyncLock()
  const revealLockRef = useRef(false)

  const endDate = computeEndDate(startDate, durationMonths)
  const totalEstimatedCost = property.price * durationMonths
  const conflict = findConflictingBooking(existingBookings, startDate, endDate || null)

  // Load existing bookings for this property so we can block overlapping dates.
  // Initial loading/error state comes from useState above; the modal is
  // remounted per property (key={property.id}) so no reset is needed here.
  useEffect(() => {
    let cancelled = false
    fetchLogsByProperty(property.id)
      .then((data) => {
        if (!cancelled) setExistingBookings(data)
      })
      .catch((err) => {
        if (!cancelled) setExistingError(err instanceof Error ? err.message : 'Failed to load existing bookings')
      })
      .finally(() => {
        if (!cancelled) setExistingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [property.id])

  // NOTE: no Escape-to-close and no backdrop-click-to-close on purpose —
  // closing mid-payment must be a deliberate tap on the × button.

  // Poll the intent while the QR is displayed; auto-confirm on success.
  useEffect(() => {
    if (step !== 'payment' || !qrImageUrl || !intentId) return
    // Demo payments are simulated: the "QR" is decorative, so confirm the
    // booking automatically after a beat instead of polling PayMongo.
    if (isDemo) {
      let demoStopped = false
      const demoTimer = setTimeout(async () => {
        try {
          await confirmDemoBooking(intentId)
          if (!demoStopped) onSuccess(property)
        } catch (err) {
          if (!demoStopped) setError(err instanceof Error ? err.message : 'Demo payment failed')
        }
      }, 1600)
      return () => {
        demoStopped = true
        clearTimeout(demoTimer)
      }
    }
    let stopped = false
    const timer = setInterval(async () => {
      if (isStoredTokenExpired()) {
        clearInterval(timer)
        stopped = true
        setQrImageUrl(null)
        setQrRevealed(false)
        setIntentId(null)
        setError('Your session expired while waiting for payment. Log back in and generate a new QR.')
        return
      }
      try {
        const status = await getPaymentStatus(intentId)
        if (stopped) return
        if (status === 'succeeded') {
          clearInterval(timer)
          try {
            await confirmBookingPayment(intentId)
            onSuccess(property)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment confirmation failed')
          }
        } else if (status === 'awaiting_payment_method') {
          // QR expired or the attempt failed — offer a fresh code.
          clearInterval(timer)
          setQrImageUrl(null)
          setQrRevealed(false)
          setIntentId(null)
          setError('The QR code expired before payment completed. Generate a new one to try again.')
        }
        // 'awaiting_next_action' / 'processing' → keep waiting.
      } catch {
        // Transient poll failure — keep waiting; manual verify surfaces real errors.
      }
    }, 3000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [step, qrImageUrl, intentId, property, onSuccess, isDemo])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (property.archived) {
      setError('This property is archived and no longer available for booking.')
      return
    }
    if (durationMonths < 1) {
      setError('Duration must be at least 1 month')
      return
    }
    if (existingLoading) {
      setError('Still checking existing bookings, please try again in a moment.')
      return
    }
    const blocking = findConflictingBooking(existingBookings, startDate, endDate || null)
    if (blocking) {
      setError(
        `These dates conflict with an existing booking (${formatBookingDate(blocking.startDate)} — ${blocking.endDate ? formatBookingDate(blocking.endDate) : 'Ongoing'}). Please pick another range.`
      )
      return
    }

    // Prefer localStorage: context state can be stale if login happened in another tab.
    const authToken = localStorage.getItem('token') || token || ''
    if (!authToken) {
      setError('You need to log in before booking a rental.')
      return
    }

    // Details check out — move to the payment step. The booking itself is
    // only created server-side after the payment succeeds.
    setError(null)
    setConfirmedAmount(null)
    setIntentId(null)
    setQrImageUrl(null)
    setQrRevealed(false)
    setTestUrl(null)
    setStep('payment')
  }

  async function handleGenerateQr() {
    if (isStoredTokenExpired()) {
      setError('Your session has expired. Please log out and log back in, then try again.')
      return
    }
    setError(null)
    await runPayment(async () => {
      try {
        if (isDemo) {
          // Demo: our backend opens a mock intent; the QR below is decorative.
          const intent = await createDemoBookingIntent(property.id, startDate, endDate)
          setIntentId(intent.intentId)
          setConfirmedAmount(intent.amountCentavos)
          setQrImageUrl(mockQrDataUrl(intent.intentId))
          setQrRevealed(false)
          setTestUrl(null)
          return
        }
        // 1. Our backend validates the booking and opens a Payment Intent.
        const intent = await createBookingIntent(property.id, startDate, endDate)
        setIntentId(intent.intentId)
        setConfirmedAmount(intent.amountCentavos)

        // 2. Build the QR Payment Method directly with PayMongo (public key).
        const paymentMethodId = await createQrPaymentMethod()

        // 3. Attach — comes back with the QR image, no redirect involved.
        const attached = await attachQrPaymentMethod(intent.intentId, intent.clientKey, paymentMethodId)
        if (!attached.qrImageUrl) {
          setError(
            `PayMongo did not return a QR code (status: ${attached.status}). ` +
            `No booking was created and you were not charged.`
          )
          return
        }
        setQrImageUrl(attached.qrImageUrl)
        setQrRevealed(false)
        setTestUrl(attached.testUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment failed')
      }
    })
  }

  async function handleRevealQr() {
    if (revealLockRef.current) return
    revealLockRef.current = true
    try {
      const result = await Swal.fire({
        returnFocus: false,
        icon: 'warning',
        iconColor: '#e05d44',
        title: 'Reveal this QR code?',
        text: 'Unblurring it lets any e-wallet or bank app scan it, and scanning WILL charge you real money. Only reveal it for proof of concept. Please use the simulate payment if you want to proceed with the payment',
        showCancelButton: true,
        confirmButtonText: 'I understand, reveal it',
        cancelButtonText: 'Keep it blurred',
        confirmButtonColor: '#e05d44',
        customClass: { popup: 'rounded-2xl!' },
      })
      if (result.isConfirmed) {
        setQrRevealed(true)
      }
    } finally {
      revealLockRef.current = false
    }
  }

  async function handleVerifyNow() {
    if (!intentId) return
    if (isStoredTokenExpired()) {
      setError('Your session has expired. Please log out and log back in, then generate a new QR.')
      return
    }
    setError(null)
    await runVerify(async () => {
      try {
        if (isDemo) {
          await confirmDemoBooking(intentId)
          onSuccess(property)
          return
        }
        await confirmBookingPayment(intentId)
        onSuccess(property)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment not confirmed yet — try again in a moment')
      }
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-md flex flex-col gap-4 relative dark:bg-slate-900 dark:border-slate-800">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Book Rental</h3>
            <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">Select your booking duration and dates</p>
          </div>
          <button
            type="button"
            disabled={paying || verifying}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 transition-colors disabled:opacity-50 dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Property Brief Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center dark:bg-slate-800/60 dark:border-slate-700">
          <div className="pr-2">
            <p className="font-semibold text-slate-800 text-sm dark:text-slate-100">{property.lotName}</p>
            <p className="text-xs text-slate-500 truncate max-w-50 dark:text-slate-400">{property.address}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-sm font-bold text-[#3a7e3a]">
              ₱{property.price.toLocaleString('en-PH')}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">/mo</span>
          </div>
        </div>

        {property.archived && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl p-3 dark:bg-amber-500/10 dark:border-amber-500/40 dark:text-amber-300">
            This property is archived and no longer available for booking.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 dark:bg-red-500/10 dark:border-red-500/40 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        {step === 'details' ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Start Date</label>
            <input
              type="date"
              value={startDate}
              min={todayStr}
              required
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4a9e4a] focus:border-transparent transition-all disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-800"
            />
          </div>

          {/* Duration Presets */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Booking Duration</label>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {durationMonths} {durationMonths === 1 ? 'Month' : 'Months'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {PRESET_DURATIONS.map((preset) => {
                const isSelected = durationMonths === preset.months
                return (
                  <button
                    key={preset.months}
                    type="button"
                    onClick={() => setDurationMonths(preset.months)}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#4a9e4a] text-white border-[#4a9e4a] shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            {/* Custom Months Input */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 whitespace-nowrap dark:text-slate-400">Or custom duration:</span>
              <input
                type="number"
                min={1}
                max={36}
                value={durationMonths}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  setDurationMonths(isNaN(val) ? 1 : Math.max(1, Math.min(36, val)))
                }}
                className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#4a9e4a] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">months</span>
            </div>
          </div>

          {/* Booking Summary Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col gap-2 text-xs dark:bg-slate-800/60 dark:border-slate-700">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Duration:</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {durationMonths} {durationMonths === 1 ? 'month' : 'months'}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Rental Period:</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-0.5 flex justify-between items-baseline dark:border-slate-700">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Estimated Total:</span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-50">
                ₱{totalEstimatedCost.toLocaleString('en-PH')}
              </span>
            </div>
          </div>

          {existingLoading && (
            <p className="text-xs text-slate-400 dark:text-slate-500">Checking existing bookings for conflicts...</p>
          )}
          {existingError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl p-3 dark:bg-amber-500/10 dark:border-amber-500/40 dark:text-amber-300">
              Couldn't verify existing bookings: {existingError}. You can still try, but overlapping dates may be rejected.
            </div>
          )}
          {conflict && !existingLoading && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 dark:bg-red-500/10 dark:border-red-500/40 dark:text-red-300">
              Conflicts with an existing booking ({formatBookingDate(conflict.startDate)} — {conflict.endDate ? formatBookingDate(conflict.endDate) : 'Ongoing'}). Please pick another range.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2.5 text-sm font-semibold transition-all disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={existingLoading || conflict !== null || property.archived}
              className="flex-1 bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full py-2.5 text-sm font-semibold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              Continue to Payment
            </button>
          </div>
        </form>
        ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl p-3 dark:bg-amber-500/10 dark:border-amber-500/40 dark:text-amber-300">
            {isDemo
              ? 'Demo mode — this is a mock payment. No money moves and nothing is scanned; your booking confirms automatically.'
              : 'Test mode — no real money moves. Scan the QR with any bank or e-wallet app to pay.'}
          </div>

          {/* Key-mode indicator removed: test-only diagnostics, hidden from renters. */}

          {/* Payment summary */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col gap-2 text-xs dark:bg-slate-800/60 dark:border-slate-700">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Rental Period:</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-0.5 flex justify-between items-baseline dark:border-slate-700">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Amount to charge:</span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-50">
                {confirmedAmount != null
                  ? formatCentavos(confirmedAmount)
                  : `₱${totalEstimatedCost.toLocaleString('en-PH')}`}
              </span>
            </div>
          </div>

          {qrImageUrl ? (
            <>
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 dark:bg-red-500/10 dark:border-red-500/40 dark:text-red-300">
                {isDemo ? (
                  <>
                    This is a <span className="font-bold">demo QR</span> — it isn't linked to any payment
                    account and can't be charged. Your booking confirms on its own in a moment.
                  </>
                ) : (
                  <>
                    <span className="font-bold">This QR is blurred for your safety.</span>{' '}
                    Scanning it with a real wallet app WILL charge you real money. Use the Simulate button below instead — your phone stays in your pocket.
                  </>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-4 dark:bg-slate-800/60 dark:border-slate-700">
                <div className="relative">
                  <img
                    src={qrImageUrl}
                    alt="QR Ph payment code (blurred for safety — simulate below instead of scanning)"
                    className={`w-48 h-48 rounded-lg bg-white transition-all ${qrRevealed ? '' : 'blur-xl select-none'}`}
                    draggable={false}
                  />
                  {!qrRevealed && (
                    <button
                      type="button"
                      onClick={() => void handleRevealQr()}
                      className="absolute inset-0 m-auto h-fit w-fit bg-slate-900/80 hover:bg-slate-900 text-white rounded-full px-5 py-2 text-xs font-semibold transition-all"
                    >
                      Reveal QR code
                    </button>
                  )}
                </div>
                {qrRevealed && (
                  <button
                    type="button"
                    onClick={() => setQrRevealed(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Blur it again
                  </button>
                )}
                <p className="text-xs text-slate-500 text-center dark:text-slate-400">
                  Amount due: {confirmedAmount != null ? formatCentavos(confirmedAmount) : '—'}
                </p>
                {!isDemo &&
                  (testUrl ? (
                    <a
                      href={testUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-2 text-xs font-semibold transition-all"
                    >
                      Simulate Test Payment
                    </a>
                  ) : (
                    <p className="text-xs text-slate-400 text-center dark:text-slate-500">
                      No simulator link came back — use the test_url from the PayMongo response (logged in the browser console) to simulate payment.
                    </p>
                  ))}
              </div>
              <p className="text-xs text-slate-400 text-center dark:text-slate-500">
                {isDemo
                  ? 'Confirming your demo booking automatically…'
                  : `Waiting for payment… this checks automatically. QR expires in ~${Math.round(QR_EXPIRY_SECONDS / 60)} minutes.`}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isDemo
                ? 'Generate the demo payment below — a mock QR appears and your booking confirms on its own a moment later.'
                : 'Generate a QR Ph code below, then complete it with the Simulate button (never scan it with a real wallet app). Your booking is created automatically once payment succeeds — failed or abandoned payments create nothing.'}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={paying || verifying}
              onClick={() => {
                setStep('details')
                setError(null)
                setQrImageUrl(null)
                setQrRevealed(false)
                setIntentId(null)
                setTestUrl(null)
              }}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2.5 text-sm font-semibold transition-all disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
            >
              Back
            </button>
            {qrImageUrl ? (
              <button
                type="button"
                disabled={verifying}
                onClick={handleVerifyNow}
                className="flex-1 bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full py-2.5 text-sm font-semibold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {verifying ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  isDemo ? 'Confirm demo payment now' : 'Verify (Fallback Only)'
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={paying}
                onClick={handleGenerateQr}
                className="flex-1 bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full py-2.5 text-sm font-semibold transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {paying ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Generating QR...</span>
                  </>
                ) : isDemo ? (
                  `Generate demo QR for ₱${totalEstimatedCost.toLocaleString('en-PH')}`
                ) : (
                  `Generate QR for ₱${totalEstimatedCost.toLocaleString('en-PH')}`
                )}
              </button>
            )}
          </div>
        </div>
        )}
      </div>
    </div>,
    document.body
  )
}
