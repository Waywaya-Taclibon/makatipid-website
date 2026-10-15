import { createPortal } from 'react-dom'
import type { Property } from '../data/properties'

interface PropertyDetailsModalProps {
  property: Property
  onClose: () => void
  onBook: () => void
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString('en-PH')}/mo`
}

function formatMoney(amount: number) {
  return `₱${amount.toLocaleString('en-PH')}`
}

/** Parses YYYY-MM-DD without timezone shift. */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No end date set'
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function internetLabel(value: Property['internet']): { text: string; positive: boolean | null } {
  if (value === 'INCLUDED') return { text: 'Included in rent', positive: true }
  if (value === 'AVAILABLE') return { text: 'Available on lot (paid separately)', positive: true }
  if (value === 'NONE') return { text: 'Not available', positive: false }
  return { text: 'Not specified', positive: null }
}

function RuleRow({ label, positive }: { label: string; positive: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      {positive === null ? (
        <span className="text-xs text-slate-400">Not specified</span>
      ) : positive ? (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Yes</span>
      ) : (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">✗ No</span>
      )}
    </div>
  )
}

export default function PropertyDetailsModal({ property, onClose, onBook }: PropertyDetailsModalProps) {
  const internet = internetLabel(property.internet)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{property.lotName}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{property.address}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none px-1"
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <p className="text-lg font-semibold text-blue-600 mt-2">{formatPrice(property.price)}</p>

        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Availability</p>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-700">Available until</span>
              <span className="text-sm font-medium text-slate-800">{formatDate(property.availableUntil)}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-t border-slate-200">
              <span className="text-sm text-slate-700">Security deposit (on meetup)</span>
              <span className="text-sm font-medium text-slate-800">
                {property.securityDeposit != null ? formatMoney(property.securityDeposit) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Rules & inclusions</p>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-1">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-sm text-slate-700">Internet</span>
              {internet.positive === null ? (
                <span className="text-xs text-slate-400">Not specified</span>
              ) : (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${internet.positive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {internet.text}
                </span>
              )}
            </div>
            <RuleRow label="Electricity included in rent" positive={property.electricityIncluded} />
            <RuleRow label="Water included in rent" positive={property.waterIncluded} />
            <RuleRow label="Pets allowed" positive={property.petsAllowed} />
            <RuleRow label="Smoking allowed" positive={property.smokingAllowed} />
            <RuleRow label="Property modifications allowed" positive={property.modificationsAllowed} />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onBook}
            className="flex-1 bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full py-2 text-sm font-semibold transition-all"
          >
            Book this rental
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2 text-sm font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
