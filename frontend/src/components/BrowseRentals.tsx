import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Property } from '../data/properties'
import { fetchAvailableProperties } from '../api/properties'
import { useAuth } from '../context/AuthContext'
import BookRentalModal from './BookRentalModal'
import ContactOwnerModal from './ContactOwnerModal'
import PropertyDetailsModal from './PropertyDetailsModal'
import PhotoCarousel from './PhotoCarousel'
import { bookedSwal } from '../utils/swal'

delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  map.flyTo([lat, lng], map.getZoom(), { duration: 0.8 })
  return null
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString('en-PH')}/mo`
}

export default function BrowseRentals() {
  const { userId } = useAuth()
  const location = useLocation()
  const isActive = location.pathname === '/browse'

  const [properties, setProperties] = useState<Property[]>([])
  const [selected, setSelected] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive || properties.length > 0) return

    // Archived properties are excluded server-side, so renters can't see or book them.
    fetchAvailableProperties()
      .then((data) => {
        setProperties(data)
        // Normalize types to prevent string vs number comparison bugs
        const firstOtherProperty =
          data.find((p) => Number(p.ownerId) !== Number(userId)) ?? null
        setSelected(firstOtherProperty)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isActive, properties.length, userId])

  const [bookingProperty, setBookingProperty] = useState<Property | null>(null)
  const [detailsProperty, setDetailsProperty] = useState<Property | null>(null)
  const [contactProperty, setContactProperty] = useState<Property | null>(null)

  // Renters only see other people's listings. Deriving the visible list (and a
  // valid selection) keeps the map from sitting on "Loading map..." forever
  // when the feed is empty or every listing belongs to the signed-in owner.
  const visibleProperties = properties.filter((p) => Number(p.ownerId) !== Number(userId))
  const selectedVisible =
    visibleProperties.find((p) => p.id === selected?.id) ?? visibleProperties[0] ?? null

  return (
    <div className="grid grid-cols-3 gap-6 w-full h-[75vh] max-w-6xl">
      <div className="col-span-1 bg-white/95 backdrop-blur rounded-2xl shadow-xl p-4 overflow-y-auto dark:bg-slate-900/95 dark:border dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-800 mb-3 dark:text-slate-100">Rentals</h3>

        {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading properties...</p>}
        {error && <p className="text-sm text-red-500 dark:text-red-400">Couldn't load properties: {error}</p>}
        {!loading && !error && visibleProperties.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {properties.length > 0
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
              ? properties.length > 0
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