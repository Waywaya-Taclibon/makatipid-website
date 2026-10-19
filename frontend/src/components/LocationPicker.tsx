import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAsyncLock } from '../hooks/useAsyncLock'
import { useMotion } from '../context/MotionContext'
import { BASE_SEARCH_PAN_SECONDS } from '../data/motion'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Default view: Philippines. If the form already has coords (edit flow),
// the map centers there instead.
const DEFAULT_CENTER: [number, number] = [12.8797, 121.774]
const DEFAULT_ZOOM = 6
const FOCUSED_ZOOM = 15
const SEARCH_ZOOM = 17

interface SearchResult {
  display_name: string
  lat: string
  lon: string
}

function ClickToPin({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap()
  useEffect(() => {
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], Math.max(map.getZoom(), FOCUSED_ZOOM))
    }
  }, [map, lat, lng])
  return null
}

function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  const { reduced, speed } = useMotion()
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], SEARCH_ZOOM, {
        duration: reduced ? 0 : BASE_SEARCH_PAN_SECONDS / speed,
      })
    }
  }, [map, target, reduced, speed])
  return null
}

export default function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: string
  lng: string
  onChange: (lat: string, lng: string) => void
}) {
  const parsedLat = parseFloat(lat)
  const parsedLng = parseFloat(lng)
  const hasPin = Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const { busy: searching, run: runSearch } = useAsyncLock()
  const [searchError, setSearchError] = useState<string | null>(null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const locatingLockRef = useRef(false)

  const center: [number, number] = hasPin ? [parsedLat, parsedLng] : DEFAULT_CENTER

  function handlePick(pickLat: number, pickLng: number) {
    // Keep 6 decimals (~10cm) so the payload stays clean.
    onChange(pickLat.toFixed(6), pickLng.toFixed(6))
  }

  function handleUseMyLocation() {
    if (locatingLockRef.current) return
    if (!('geolocation' in navigator)) {
      setGeoError('Your browser does not support location lookup.')
      return
    }
    locatingLockRef.current = true
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePick(pos.coords.latitude, pos.coords.longitude)
        setFlyTarget({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        locatingLockRef.current = false
        setLocating(false)
      },
      () => {
        setGeoError('Could not get your location. Please search or pin the map manually.')
        locatingLockRef.current = false
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setSearchError(null)
    setResults([])
    await runSearch(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ph&q=${encodeURIComponent(q)}`,
          { headers: { Accept: 'application/json' } }
        )
        if (!res.ok) throw new Error(`Search failed: ${res.status}`)
        const data = (await res.json()) as SearchResult[]
        setResults(data)
        if (data.length === 0) {
          setSearchError('No matches in the Philippines — try a nearby city or landmark.')
        }
      } catch {
        setSearchError('Search is unavailable right now. Please zoom in and pin manually.')
      }
    })
  }

  function handleSelectResult(r: SearchResult) {
    const rLat = parseFloat(r.lat)
    const rLng = parseFloat(r.lon)
    if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) return
    handlePick(rLat, rLng)
    setFlyTarget({ lat: rLat, lng: rLng })
    setResults([])
    setQuery(r.display_name.split(',').slice(0, 2).join(','))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
          Pin location <span className="font-normal normal-case">(search, then tap)</span>
        </label>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      {/* Plain div (not a form): this picker lives inside the property form,
          and nested forms would submit the outer form by accident. */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              void handleSearch()
            }
          }}
          placeholder="Search street, barangay, or city…"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={searching || !query.trim()}
          className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {searching ? '…' : 'Find'}
        </button>
      </div>
      {searchError && <p className="text-xs text-amber-600 dark:text-amber-400">{searchError}</p>}
      {results.length > 0 && (
        <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
          {results.map((r) => (
            <button
              key={`${r.lat},${r.lon},${r.display_name}`}
              type="button"
              onClick={() => handleSelectResult(r)}
              className="text-left text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl overflow-hidden border border-slate-300 h-64 dark:border-slate-700">
        <MapContainer
          center={center}
          zoom={hasPin ? FOCUSED_ZOOM : DEFAULT_ZOOM}
          doubleClickZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <ClickToPin onPick={handlePick} />
          <Recenter lat={hasPin ? parsedLat : null} lng={hasPin ? parsedLng : null} />
          <FlyTo target={flyTarget} />
          {hasPin && (
            <Marker
              position={[parsedLat, parsedLng]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker
                  const pos = m.getLatLng()
                  handlePick(pos.lat, pos.lng)
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      {geoError && <p className="text-xs text-amber-600 dark:text-amber-400">{geoError}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {hasPin
          ? `Pinned at ${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)} — zoom right in and drag the pin for meter-level accuracy.`
          : 'Tip: search your street or barangay first — tapping while zoomed out can land kilometers away.'}
      </p>
    </div>
  )
}
