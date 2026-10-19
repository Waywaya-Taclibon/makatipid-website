import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { CreatePropertyInput, Property, PropertyImage } from '../data/properties'
import type { Booking } from '../data/rentallog'
import { fetchMyProperties, createProperty, updateProperty, deleteProperty, archiveProperty, unarchiveProperty, fetchProperty, uploadPropertyImages, deletePropertyImage, reorderPropertyImages } from '../api/properties'
import { fetchLogsByProperty } from '../api/rentallog'
import { formatBookingDate, getCurrentBooking, getDynamicStatus, getUpcomingBooking } from '../utils/bookingStatus'
import AddPropertyModal from './AddPropertyModal'
import EditPropertyModal from './EditPropertyModal'
import ProfileCompletionModal from './ProfileCompletionModal'
import type { PhotoItem } from './PhotoPicker'
import Swal from 'sweetalert2'
import { useAuth } from '../context/AuthContext'
import { useMotion } from '../context/MotionContext'
import { BASE_MAP_PAN_SECONDS } from '../data/motion'
import { cancelSwal } from '../utils/swal'
import { fetchMyProfile, isProfileComplete, type UserProfile } from '../api/users'
import { useAsyncLock } from '../hooks/useAsyncLock'


delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Recenters the map whenever the selected property changes.
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const { reduced, speed } = useMotion()
  map.flyTo([lat, lng], map.getZoom(), { duration: reduced ? 0 : BASE_MAP_PAN_SECONDS / speed })
  return null
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString('en-PH')}/mo`
}

const bookingStatusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/40',
  PENDING: 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  ENDED: 'bg-slate-100 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
}

export default function PropertiesView() {
  const { userId } = useAuth()
  const location = useLocation()
  const isActive = location.pathname === '/properties'

  const [properties, setProperties] = useState<Property[]>([])
  const [selected, setSelected] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredAction, setHoveredAction] = useState<'add' | 'edit' | 'archive' | 'remove' | null>(null)
  // Date-based live status for every owned property, so list badges don't
  // rely on the stale backend `occupied` flag (which ignores dates).
  const [bookingsByProperty, setBookingsByProperty] = useState<Record<number, Booking[]>>({})
  const [bookingErrorsByProperty, setBookingErrorsByProperty] = useState<Record<number, string>>({})

  // Listing gate: a phone number must be on the owner's profile before they can
  // add a property. The prompt repeats on every visit while it's still missing.
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const profilePromptedRef = useRef(false)

  // Defence in depth: the modals lock themselves, but parent handlers also
  // refuse overlapping requests in case a second event slips through.
  const { busy: actionBusy, run: runAction } = useAsyncLock()
  const addInFlightRef = useRef(false)
  const editInFlightRef = useRef(false)

  useEffect(() => {
    if (!isActive || properties.length > 0) return

    fetchMyProperties()
      .then((data) => {
        setProperties(data)
        const firstOwnedProperty = data.find((p) => p.ownerId === userId) ?? data[0] ?? null
        setSelected(firstOwnedProperty)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [isActive, properties.length, userId])

  const selectedId = selected?.id
  useEffect(() => {
    if (!isActive || selectedId == null) return

    fetchLogsByProperty(selectedId)
      .then((data) => {
        setBookingsByProperty((prev) => ({ ...prev, [selectedId]: data }))
        setBookingErrorsByProperty((prev) => {
          const next = { ...prev }
          delete next[selectedId]
          return next
        })
      })
      .catch((err) => {
        setBookingErrorsByProperty((prev) => ({
          ...prev,
          [selectedId]: err instanceof Error ? err.message : 'Failed to load bookings',
        }))
      })
  }, [isActive, selectedId])

  // Fetch bookings for all owned properties once, so each list badge can be
  // computed from today's date instead of the backend `occupied` flag.
  const ownedIdsKey = properties
    .filter((p) => p.ownerId === userId)
    .map((p) => p.id)
    .join(',')
  useEffect(() => {
    if (!isActive || ownedIdsKey === '') return
    const ownedIds = ownedIdsKey.split(',').map(Number)
    const missingIds = ownedIds.filter((id) => bookingsByProperty[id] === undefined)
    if (missingIds.length === 0) return
    let cancelled = false
    Promise.allSettled(missingIds.map((id) => fetchLogsByProperty(id))).then((results) => {
      if (cancelled) return
      setBookingsByProperty((prev) => {
        const next = { ...prev }
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') next[missingIds[i]] = r.value
        })
        return next
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, ownedIdsKey])

  const promptForProfile = useCallback(async () => {
    const result = await Swal.fire({
      returnFocus: false,
      icon: 'warning',
      iconColor: '#e05d44',
      title: 'Complete your information first',
      text: "You haven't completed your contact information yet. It's required to be eligible for property listing. Do you want to proceed?",
      showCancelButton: true,
      confirmButtonText: "Yes, let's do it",
      cancelButtonText: 'Not now',
      confirmButtonColor: '#4a9e4a',
      customClass: {
        popup: 'rounded-2xl! font-sans',
        title: 'text-xl! font-bold! text-slate-800! dark:text-slate-100!',
      },
    })
    if (result.isConfirmed) setShowProfileModal(true)
  }, [])

  // Re-read the profile every time the page becomes active so the prompt can
  // re-appear while the details are still missing (agreed behaviour).
  useEffect(() => {
    if (!isActive) return
    profilePromptedRef.current = false
    let cancelled = false
    fetchMyProfile()
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch(() => {
        // If the profile can't be read (session/network), leave listing open
        // rather than blocking on a transient failure.
        if (!cancelled) setProfile(null)
      })
    return () => {
      cancelled = true
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive || !profile) return
    if (isProfileComplete(profile)) return
    if (profilePromptedRef.current) return
    profilePromptedRef.current = true
    void promptForProfile()
  }, [isActive, profile, promptForProfile])

  const propertyBookings = selectedId == null ? [] : bookingsByProperty[selectedId] ?? []
  const bookingsLoading = selectedId != null
    && bookingsByProperty[selectedId] === undefined
    && bookingErrorsByProperty[selectedId] === undefined
  const bookingsError = selectedId == null ? null : bookingErrorsByProperty[selectedId] ?? null
  const currentBooking = getCurrentBooking(propertyBookings)
  const upcomingBooking = !currentBooking ? getUpcomingBooking(propertyBookings) : null
  // Full history: current first, then upcoming by start date, then past by most recent.
  const allBookingsSorted = [...propertyBookings].sort((a, b) => {
    const rank = (bk: Booking) => {
      const s = getDynamicStatus(bk)
      return s === 'ACTIVE' ? 0 : s === 'PENDING' ? 1 : 2
    }
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    if (ra === 2) {
      const aEnd = a.endDate ? +new Date(a.endDate) : +new Date(a.startDate)
      const bEnd = b.endDate ? +new Date(b.endDate) : +new Date(b.startDate)
      return bEnd - aEnd
    }
    return +new Date(a.startDate) - +new Date(b.startDate)
  })

  function isCurrentlyBooked(propertyId: number, fallbackOccupied: boolean): boolean {
    const logs = bookingsByProperty[propertyId]
    if (logs === undefined) return fallbackOccupied
    return getCurrentBooking(logs) !== null
  }

  function updatePropertyInList(updated: Property) {
    setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setSelected(updated)
  }

  async function handleArchiveToggle() {
    if (!selected) return
    await runAction(async () => {
      try {
        const updated = selected.archived
          ? await unarchiveProperty(selected.id)
          : await archiveProperty(selected.id)
        updatePropertyInList(updated)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update property')
      }
    })
  }

  async function handleRemove() {
    if (!selected) return
    const target = selected
    await runAction(async () => {
      try {
        const logs = bookingsByProperty[target.id]

        // Blocked while an upcoming booking exists — removing would strand the renter.
        const pending = logs ? getUpcomingBooking(logs) : null
        if (pending) {
          await cancelSwal.fire({
            icon: 'warning',
            title: `Cannot remove "${target.lotName}"`,
            text:
              `It has an upcoming booking ` +
              `(${formatBookingDate(pending.startDate)} — ${pending.endDate ? formatBookingDate(pending.endDate) : 'Ongoing'}). ` +
              `Cancel that booking first.`,
            confirmButtonText: 'Got it',
            confirmButtonColor: '#4a9e4a',
          })
          return
        }

        // Booking history must be preserved: archive instead of hard-deleting.
        if (logs && logs.length > 0) {
          const confirmed = window.confirm(
            `"${target.lotName}" has booking history, so it will be archived (hidden from renters) instead of permanently deleted. Continue?`
          )
          if (!confirmed) return
          const updated = await archiveProperty(target.id)
          updatePropertyInList(updated)
          setError(null)
          return
        }

        // No bookings on record: permanent delete (the server re-checks and
        // returns a message if anything blocks it).
        const confirmed = window.confirm(`Delete "${target.lotName}"? This can't be undone.`)
        if (!confirmed) return

        await deleteProperty(target.id)
        const removedId = target.id
        const remaining = properties.filter((p) => p.id !== removedId)
        setProperties(remaining)
        setSelected(remaining[0] ?? null)
        setBookingsByProperty((prev) => {
          const next = { ...prev }
          delete next[removedId]
          return next
        })
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove property')
      }
    })
  }
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  // Add Property is gated behind the profile check; viewing/editing stays open.
  function handleAddPropertyClick() {
    if (profile && !isProfileComplete(profile)) {
      void promptForProfile()
      return
    }
    setShowAddModal(true)
  }

  async function handleAdd(data: CreatePropertyInput, photos: File[]) {
    if (addInFlightRef.current) return
    addInFlightRef.current = true
    try {
      const created = await createProperty(data)
      // Two-step save: the property must exist before photos can attach to it.
      let photoWarning: string | null = null
      if (photos.length > 0) {
        try {
          created.images = await uploadPropertyImages(created.id, photos)
        } catch (photoErr) {
          photoWarning = photoErr instanceof Error ? photoErr.message : 'unknown error'
        }
      }
      setProperties((prev) => [...prev, created])
      setSelected(created)
      // Always close on partial success: retrying from this modal would POST
      // the property again. Photos can be added later from Edit.
      setShowAddModal(false)
      if (photoWarning) {
        await Swal.fire({
          returnFocus: false,
          icon: 'warning',
          iconColor: '#e05d44',
          title: 'Property saved — photos failed',
          text: `"${created.lotName}" was listed, but the photo upload failed: ${photoWarning}. Reopen Edit to add photos.`,
          confirmButtonText: 'Got it',
          confirmButtonColor: '#4a9e4a',
          customClass: {
            popup: 'rounded-2xl!',
            title: 'text-lg! font-bold! text-slate-800! dark:text-slate-100!',
          },
        })
      } else {
        await Swal.fire({
          returnFocus: false,
          icon: 'success',
          iconColor: '#4a9e4a',
          title: 'Property added!',
          text: `"${created.lotName}" is now listed and visible to renters.`,
          confirmButtonText: 'Nice!',
          confirmButtonColor: '#4a9e4a',
          customClass: {
            popup: 'rounded-2xl!',
            title: 'text-lg! font-bold! text-slate-800! dark:text-slate-100!',
          },
        })
      }
    } finally {
      addInFlightRef.current = false
    }
  }

  async function handleEdit(data: CreatePropertyInput, photos: PhotoItem[]) {
    if (!selected) return
    if (editInFlightRef.current) return
    editInFlightRef.current = true
    const propertyId = selected.id
    let detailsSaved = false
    try {
      const updated = await updateProperty(propertyId, data)
      detailsSaved = true
      // Photo plan vs. what the server currently has.
      const originalIds = (selected.images ?? []).map((img) => img.id)
      const keptIds = photos.filter((p) => p.kind === 'saved' && p.image).map((p) => (p.image as PropertyImage).id)
      const removedIds = originalIds.filter((id) => !keptIds.includes(id))
      const addedFiles = photos.filter((p) => p.kind === 'new' && p.file).map((p) => p.file as File)
      const currentIds = new Set((updated.images ?? []).map((img) => img.id))
      const orderChanged =
        keptIds.length !== originalIds.length || keptIds.some((id, i) => originalIds[i] !== id)
      // Uploads first (new ids needed before the final order can be written).
      if (addedFiles.length > 0) {
        await uploadPropertyImages(propertyId, addedFiles)
      }
      if (keptIds.length > 0 || addedFiles.length > 0) {
        // Rebuild the full id sequence in the user's final arrangement.
        const latest = await fetchProperty(propertyId)
        // New uploads have no stable key: match them in upload order.
        const newIds = latest.images
          .filter((img) => !currentIds.has(img.id))
          .sort((a, b) => a.id - b.id)
          .map((img) => img.id)
        let cursor = 0
        const fullOrder: number[] = []
        for (const p of photos) {
          if (p.kind === 'saved' && p.image) fullOrder.push(p.image.id)
          else if (p.kind === 'new' && p.file && cursor < newIds.length) fullOrder.push(newIds[cursor++])
        }
        if (fullOrder.length > 0 && (orderChanged || addedFiles.length > 0)) {
          await reorderPropertyImages(propertyId, fullOrder)
        }
      }
      for (const id of removedIds) {
        await deletePropertyImage(propertyId, id)
      }
      const fresh = await fetchProperty(propertyId)
      updatePropertyInList(fresh)
      setShowEditModal(false)
      setError(null)
    } catch (err) {
      // Details never changed: safe to keep the modal open for a clean retry.
      if (!detailsSaved) throw err
      // A later photo step failed: resync the listing and close, because
      // retrying from the stale modal could upload or delete photos twice.
      try {
        const fresh = await fetchProperty(propertyId)
        updatePropertyInList(fresh)
      } catch {
        // Ignore resync failure; the warning below still tells the user.
      }
      setShowEditModal(false)
      await Swal.fire({
        returnFocus: false,
        icon: 'warning',
        iconColor: '#e05d44',
        title: 'Details saved — photos need attention',
        text: `${err instanceof Error ? err.message : 'Some photo changes failed'}. The listing was refreshed; reopen Edit to finish updating the photos.`,
        confirmButtonText: 'Got it',
        confirmButtonColor: '#4a9e4a',
        customClass: {
          popup: 'rounded-2xl!',
          title: 'text-lg! font-bold! text-slate-800! dark:text-slate-100!',
        },
      })
    } finally {
      editInFlightRef.current = false
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6 w-full h-[75vh] max-w-6xl">
      {/* Left panel — 1 column wide */}
      <div className="col-span-1 bg-white/95 backdrop-blur rounded-2xl shadow-xl p-4 overflow-y-auto dark:bg-slate-900/95 dark:border dark:border-slate-800">
        <div className="flex items-center justify-between mb-3">
           <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">My Properties</h3>
            <div className="relative flex items-center gap-2">
              {hoveredAction && (
                <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-10 px-2.5 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-md whitespace-nowrap pointer-events-none">
                  {hoveredAction === 'add' ? 'Add property'
                    : hoveredAction === 'edit' ? 'Edit property'
                    : hoveredAction === 'archive' ? (selected?.archived ? 'Unarchive' : 'Archive')
                    : 'Remove property'}
                </div>
              )}
              <button onClick={handleAddPropertyClick} disabled={actionBusy} className="bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed" onMouseEnter={() => setHoveredAction('add')} onMouseLeave={() => setHoveredAction(null)} onFocus={() => setHoveredAction('add')} onBlur={() => setHoveredAction(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button onClick={() => setShowEditModal(true)} disabled={!selected || actionBusy} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed" onMouseEnter={() => setHoveredAction('edit')} onMouseLeave={() => setHoveredAction(null)} onFocus={() => setHoveredAction('edit')} onBlur={() => setHoveredAction(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={handleArchiveToggle} disabled={!selected || actionBusy} className={`rounded-full w-8 h-8 flex items-center justify-center shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${!selected ? 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500' : selected.archived ? 'bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`} onMouseEnter={() => setHoveredAction('archive')} onMouseLeave={() => setHoveredAction(null)} onFocus={() => setHoveredAction('archive')} onBlur={() => setHoveredAction(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>
              <button onClick={handleRemove} disabled={!selected || actionBusy} className="bg-[#e05d44] hover:bg-[#c04a33] text-white rounded-full w-8 h-8 flex items-center justify-center shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed" onMouseEnter={() => setHoveredAction('remove')} onMouseLeave={() => setHoveredAction(null)} onFocus={() => setHoveredAction('remove')} onBlur={() => setHoveredAction(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
        </div>
        {loading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading properties...</p>}
        {error && <p className="text-sm text-red-500 dark:text-red-400">Couldn't load properties: {error}</p>}
        <div className="flex flex-col gap-2">
          {properties.map((p) => {
            if (userId !== p.ownerId) return null
            // Skip/hide property if the logged-in user is NOT the owner
            // Badge is date-based: booked only if a booking covers today.
            const booked = isCurrentlyBooked(p.id, p.occupied)
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`text-left rounded-xl p-3 transition-colors ${
                  selected?.id === p.id
                    ? 'bg-blue-100 border-2 border-blue-400 dark:bg-blue-500/15 dark:border-blue-400'
                    : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{p.lotName}</p>
                  <div className="flex gap-1 shrink-0">
                    {p.archived && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40">
                        Archived
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                        booked
                          ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/40'
                          : 'bg-slate-100 text-slate-500 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      {booked ? 'Booked' : 'Available'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{p.address}</p>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{formatPrice(p.price)}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right panel — 2 columns wide */}
      <div className="col-span-2 flex flex-col gap-4 min-h-0">
        {/* Booking status card for the selected property */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-4 max-h-[38vh] overflow-y-auto dark:bg-slate-900/95 dark:border dark:border-slate-800">
          {selected?.archived && (
            <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/40">
              Archived — hidden from renters. Use Unarchive to make it bookable again.
            </p>
          )}
          {!selected ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Select a property to see its booking status.</p>
          ) : bookingsLoading ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Checking booking status for “{selected.lotName}”...</p>
          ) : bookingsError ? (
            <p className="text-sm text-red-500 dark:text-red-400">Couldn't load booking status: {bookingsError}</p>
          ) : currentBooking ? (
            <div className="flex justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Currently Booked</p>
                </div>
                <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                  {formatBookingDate(currentBooking.startDate)} — {currentBooking.endDate ? formatBookingDate(currentBooking.endDate) : 'Ongoing'}
                </p>
                <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                  Renter: {currentBooking.renterName ?? (currentBooking.renterId != null ? `#${currentBooking.renterId}` : '—')}
                </p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full h-fit whitespace-nowrap ${bookingStatusStyles[getDynamicStatus(currentBooking)]}`}>
                {getDynamicStatus(currentBooking)}
              </span>
            </div>
          ) : upcomingBooking ? (
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">Available now · Upcoming booking</p>
                <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                  {formatBookingDate(upcomingBooking.startDate)} — {upcomingBooking.endDate ? formatBookingDate(upcomingBooking.endDate) : 'Ongoing'}
                </p>
                <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                  Renter: {upcomingBooking.renterName ?? (upcomingBooking.renterId != null ? `#${upcomingBooking.renterId}` : '—')}
                  {' '}· Booking #{upcomingBooking.id}
                </p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full h-fit whitespace-nowrap ${bookingStatusStyles[getDynamicStatus(upcomingBooking)]}`}>
                {getDynamicStatus(upcomingBooking)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                <p className="font-semibold text-slate-800 dark:text-slate-100">Available — no active booking today</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-300 whitespace-nowrap dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                AVAILABLE
              </span>
            </div>
          )}

          {/* Full booking history: past, current, and upcoming */}
          {!bookingsLoading && !bookingsError && selected && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 dark:text-slate-400">
                All bookings ({allBookingsSorted.length})
              </p>
              {allBookingsSorted.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">No bookings yet for this property.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {allBookingsSorted.map((b) => (
                    <div key={b.id} className="rounded-xl border border-slate-200 p-3 flex justify-between gap-3 dark:border-slate-700">
                      <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {formatBookingDate(b.startDate)} — {b.endDate ? formatBookingDate(b.endDate) : 'Ongoing'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                          Renter: {b.renterName ?? (b.renterId != null ? `#${b.renterId}` : '—')}
                          {' '}· Booking #{b.id}
                        </p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full h-fit whitespace-nowrap ${bookingStatusStyles[getDynamicStatus(b)]}`}>
                        {getDynamicStatus(b)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden flex-1 min-h-[40vh] dark:bg-slate-900/95 dark:border dark:border-slate-800">
          {isActive && selected && userId === selected.ownerId ? (
            <MapContainer center={[selected.lat, selected.lng]} zoom={15} style={{ height: '100%', width: '100%', minHeight: '40vh' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              <RecenterMap lat={selected.lat} lng={selected.lng} />
              <Marker position={[selected.lat, selected.lng]}>
                <Popup>{selected.lotName}</Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div className="w-full h-full min-h-[40vh] flex items-center justify-center text-slate-400 dark:text-slate-500">
              {!isActive
                ? "Map loads when this page is active"
                : !selected
                ? "No property selected"
                : "You do not have permission to view this map location"}
            </div>
          )}
        </div>
      </div>

      {showProfileModal && profile && (
        <ProfileCompletionModal
          profile={profile}
          onClose={() => setShowProfileModal(false)}
          onSaved={(updated) => {
            setProfile(updated)
            setShowProfileModal(false)
            void Swal.fire({
              returnFocus: false,
              icon: 'success',
              iconColor: '#4a9e4a',
              title: 'Information saved!',
              text: 'Your contact details are set — you can now list a property, and renters can reach you.',
              confirmButtonText: 'Great!',
              confirmButtonColor: '#4a9e4a',
              customClass: {
                popup: 'rounded-2xl! font-sans',
                title: 'text-lg! font-bold! text-slate-800! dark:text-slate-100!',
              },
            })
          }}
        />
      )}

      {showAddModal && (
        <AddPropertyModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAdd}
        />
      )}

      {showEditModal && selected && (
        <EditPropertyModal
          property={selected}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEdit}
        />
      )}
    </div>
  )
}