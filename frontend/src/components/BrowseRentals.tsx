import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Property } from '../data/properties'
import { fetchAddressSuggestions, fetchAvailableProperties } from '../api/properties'
import { useAuth } from '../context/AuthContext'
import { useMotion } from '../context/MotionContext'
import { BASE_MAP_PAN_SECONDS } from '../data/motion'
import BookRentalModal from './BookRentalModal'
import ContactOwnerModal from './ContactOwnerModal'
import PropertyDetailsModal from './PropertyDetailsModal'
import PhotoCarousel from './PhotoCarousel'
import { DURATION_OPTIONS } from './search/searchForm'
import { computeEndDate, getTodayString } from '../utils/dates'
import { bookedSwal } from '../utils/swal'

delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const { reduced, speed } = useMotion()
  map.flyTo([lat, lng], map.getZoom(), { duration: reduced ? 0 : BASE_MAP_PAN_SECONDS / speed })
  return null
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString('en-PH')}/mo`
}

const filterLabel =
  'text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
const filterInput =
  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

interface BrowseOutcome {
  /** The request this data belongs to, so loading is derived instead of synced. */
  key: string
  properties: Property[]
  error: string | null
}

export default function BrowseRentals() {
  const { userId } = useAuth()
  const location = useLocation()
  const isActive = location.pathname === '/browse'

  const [outcome, setOutcome] = useState<BrowseOutcome | null>(null)
  const [selected, setSelected] = useState<Property | null>(null)

  // Browse filters. Everything starts blank, so the feed opens with every
  // available listing and only narrows once the renter chooses something.
  const [locationQuery, setLocationQuery] = useState('')
  const [debouncedLocation, setDebouncedLocation] = useState('')
  const [moveIn, setMoveIn] = useState('')
  const [months, setMonths] = useState<number>(DURATION_OPTIONS[0].months)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Typing a location shouldn't fire a request on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedLocation(locationQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [locationQuery])

  // Address autocomplete drawn from listings that actually exist.
  useEffect(() => {
    if (!isActive) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetchAddressSuggestions(locationQuery, controller.signal).then((items) => {
        if (!controller.signal.aborted) setSuggestions(items)
      })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [isActive, locationQuery])

  const requestKey = `${isActive}|${debouncedLocation}|${moveIn}|${months}`
  // Derived loading: no setState in the effect body, and changing a filter
  // can't flash the previous (now wrong) results.
  const loading = isActive && outcome?.key !== requestKey
  const properties = outcome?.key === requestKey ? outcome.properties : []
  const error = outcome?.key === requestKey ? outcome.error : null

  useEffect(() => {
    if (!isActive) return

    let cancelled = false

    // The server needs a complete window, so dates are only sent when the
    // renter picked a move-in date (the stay length supplies the end date).
    const end = moveIn ? computeEndDate(moveIn, months) : ''

    fetchAvailableProperties({
      q: debouncedLocation,
      start: moveIn || undefined,
      end: end || undefined,
    })
      .then((data) => {
        if (!cancelled) setOutcome({ key: requestKey, properties: data, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        setOutcome({
          key: requestKey,
          properties: [],
          error: err instanceof Error ? err.message : 'Could not load properties',
        })
      })

    return () => {
      cancelled = true
    }
  }, [isActive, requestKey, debouncedLocation, moveIn, months])

  const [bookingProperty, setBookingProperty] = useState<Property | null>(null)
  const [detailsProperty, setDetailsProperty] = useState<Property | null>(null)
  const [contactProperty, setContactProperty] = useState<Property | null>(null)

  const hasFilters = locationQuery.trim() !== '' || moveIn !== ''
  const activeFilterCount = (locationQuery.trim() ? 1 : 0) + (moveIn ? 1 : 0)

  function clearFilters() {
    setLocationQuery('')
    setDebouncedLocation('')
    setMoveIn('')
    setMonths(DURATION_OPTIONS[0].months)
  }

  // Renters only see other people's listings. Deriving the visible list (and a
  // valid selection) keeps the map from sitting on "Loading map..." forever
  // when the feed is empty or every listing belongs to the signed-in owner.
  const visibleProperties = properties.filter((p) => Number(p.ownerId) !== Number(userId))
  const selectedVisible =
    visibleProperties.find((p) => p.id === selected?.id) ?? visibleProperties[0] ?? null

  return (
    <div className="grid grid-cols-3 gap-6 w-full h-[75vh] max-w-6xl">
      <div className="col-span-1 bg-white/95 backdrop-blur rounded-2xl shadow-xl p-4 overflow-y-auto dark:bg-slate-900/95 dark:border dark:border-slate-800">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Rentals</h3>
          {!loading && (
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              {visibleProperties.length} {visibleProperties.length === 1 ? 'listing' : 'listings'}
            </span>
          )}
        </div>

        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Filter rentals
              {hasFilters && (
                <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-2">
            <label className={filterLabel} htmlFor="browse-location">
              Location
            </label>
            <input
              id="browse-location"
              type="search"
              list="browse-location-options"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="City, barangay, or street"
              autoComplete="off"
              className={filterInput}
            />
            <datalist id="browse-location-options">
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className={filterLabel} htmlFor="browse-movein">
                Available from
              </label>
              <input
                id="browse-movein"
                type="date"
                min={getTodayString()}
                value={moveIn}
                onChange={(e) => setMoveIn(e.target.value)}
                className={filterInput}
              />
            </div>
            <div className="min-w-0">
              <label className={filterLabel} htmlFor="browse-duration">
                Stay
              </label>
              <select
                id="browse-duration"
                value={months}
                disabled={!moveIn}
                onChange={(e) => setMonths(Number(e.target.value))}
                className={filterInput}
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.months} value={option.months}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            Leave location and dates blank to see every listing.
          </p>
        </div>

        {loading && properties.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading properties...</p>
        )}
        {error && <p className="text-sm text-red-500 dark:text-red-400">Couldn't load properties: {error}</p>}
        {!loading && !error && visibleProperties.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {hasFilters
              ? 'No rentals match those filters. Try another location or widen the dates.'
              : properties.length > 0
                ? "You've listed all current rentals. New listings from other owners will appear here."
                : 'No rentals available right now. Check back soon.'}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {visibleProperties.map((p) => {
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className={`text-left rounded-xl transition-colors cursor-pointer overflow-hidden ${
                  selectedVisible?.id === p.id
                    ? 'bg-blue-100 border-2 border-blue-400 dark:bg-blue-500/15 dark:border-blue-400'
                    : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                }`}
              >
                {p.images && p.images.length > 0 && (
                  <PhotoCarousel images={p.images} alt={`${p.lotName} photo`} imgClassName="h-28" />
                )}
                <div className="p-3 flex justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{p.lotName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{p.address}</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatPrice(p.price)}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDetailsProperty(p)
                    }}
                    className="bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full px-3 py-1 text-xs font-semibold transition-all"
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setContactProperty(p)
                    }}
                    className="bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full px-3 py-1 text-xs font-semibold transition-all"
                  >
                    Contact Owner
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setBookingProperty(p)
                    }}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition-all bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white"
                  >
                    Book a Rental
                  </button>
                </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="col-span-2 bg-white/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden dark:bg-slate-900/95 dark:border dark:border-slate-800">
        {isActive && selectedVisible ? (
          <MapContainer center={[selectedVisible.lat, selectedVisible.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <RecenterMap lat={selectedVisible.lat} lng={selectedVisible.lng} />
            <Marker position={[selectedVisible.lat, selectedVisible.lng]}>
              <Popup>{selectedVisible.lotName}</Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center px-6 text-center text-slate-400 dark:text-slate-500">
            {!isActive
              ? 'Map loads when this page is active'
              : loading
              ? 'Loading map...'
              : error
              ? 'Map unavailable — rentals could not be loaded.'
              : visibleProperties.length === 0
              ? hasFilters
                ? 'No rentals match those filters.'
                : properties.length > 0
                  ? "You're viewing your own listings, so there is nothing to show on the map yet."
                  : 'No rentals to show on the map yet. New listings will appear here.'
              : 'Select a rental to view it on the map'}
          </div>
        )}
      </div>

      {detailsProperty && (
        <PropertyDetailsModal
          property={detailsProperty}
          onClose={() => setDetailsProperty(null)}
          onBook={() => {
            setBookingProperty(detailsProperty)
            setDetailsProperty(null)
          }}
        />
      )}

      {contactProperty && (
        <ContactOwnerModal
          property={contactProperty}
          onClose={() => setContactProperty(null)}
        />
      )}

      {bookingProperty && (
        <BookRentalModal
          key={bookingProperty.id}
          property={bookingProperty}
          onClose={() => setBookingProperty(null)}
          onSuccess={(booked) => {
            setBookingProperty(null)
            bookedSwal.fire({
              title: 'Rental request sent successfully!',
              text: `Your rental request for "${booked.lotName}" has been sent successfully! The owner will review your request and get back to you.`,
              icon: 'success',
              confirmButtonText: 'Great!',
            })
          }}
        />
      )}
    </div>
  )
}