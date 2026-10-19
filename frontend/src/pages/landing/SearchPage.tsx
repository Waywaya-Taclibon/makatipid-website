import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { searchProperties, type SearchResult, type SearchSort } from '../../api/properties'
import BookRentalModal from '../../components/BookRentalModal'
import ContactOwnerModal from '../../components/ContactOwnerModal'
import PropertyDetailsModal from '../../components/PropertyDetailsModal'
import PropertyCard from '../../components/search/PropertyCard'
import SearchBar from '../../components/search/SearchBar'
import {
  parseSearchValues,
  toSearchFilters,
  toSearchParams,
  type SearchValues,
} from '../../components/search/searchForm'
import { useAuth } from '../../context/AuthContext'
import { useAuthModal } from '../../context/AuthModalContext'
import type { Property } from '../../data/properties'
import { bookedSwal } from '../../utils/swal'

const PAGE_SIZE = 12

const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'price_desc', label: 'Highest price' },
]

function readSort(value: string | null): SearchSort {
  return value === 'price_asc' || value === 'price_desc' ? value : 'newest'
}

interface Outcome {
  /** The request this data belongs to, so loading is derived instead of synced. */
  key: string
  result: SearchResult | null
  error: string | null
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const { token, userId } = useAuth()
  const { openAuth } = useAuthModal()

  const search = params.toString()
  const values = useMemo(() => parseSearchValues(new URLSearchParams(search)), [search])
  const sort = readSort(params.get('sort'))
  const page = Math.max(Math.floor(Number(params.get('page')) || 1), 1)

  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const requestKey = `${search}|${page}|${sort}|${refreshKey}`
  // Derived loading: no setState in the effect body, and switching pages can't
  // flash a stale list.
  const loading = outcome?.key !== requestKey
  const result = outcome?.key === requestKey ? outcome.result : null
  const error = outcome?.key === requestKey ? outcome.error : null

  const [detailsProperty, setDetailsProperty] = useState<Property | null>(null)
  const [contactProperty, setContactProperty] = useState<Property | null>(null)
  const [bookingProperty, setBookingProperty] = useState<Property | null>(null)

  useEffect(() => {
    let cancelled = false

    searchProperties({
      ...toSearchFilters(values),
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then((data) => {
        if (!cancelled) setOutcome({ key: requestKey, result: data, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        setOutcome({
          key: requestKey,
          result: null,
          error: err instanceof Error ? err.message : 'Could not load results',
        })
      })

    return () => {
      cancelled = true
    }
  }, [requestKey, values, page, sort])

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  const currentUrl = `${location.pathname}${location.search}`

  function handleSearch(next: SearchValues) {
    const nextParams = toSearchParams(next)
    if (sort !== 'newest') nextParams.set('sort', sort)
    setParams(nextParams)
  }

  function handleSort(nextSort: SearchSort) {
    const nextParams = new URLSearchParams(params)
    if (nextSort === 'newest') nextParams.delete('sort')
    else nextParams.set('sort', nextSort)
    nextParams.delete('page')
    setParams(nextParams)
  }

  function goToPage(nextPage: number) {
    const nextParams = new URLSearchParams(params)
    if (nextPage <= 1) nextParams.delete('page')
    else nextParams.set('page', String(nextPage))
    setParams(nextParams)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBook(property: Property) {
    if (Number(property.ownerId) === Number(userId)) return
    if (!token) {
      // Send them back to exactly this filtered view once they're signed in.
      openAuth('login', currentUrl)
      return
    }
    setBookingProperty(property)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl dark:text-slate-100">
          Find a rental
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Browse every listed place. Filter by budget, dates, and what the lot offers.
        </p>
      </div>

      <SearchBar key={search} initial={values} onSearch={handleSearch} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
          {loading ? 'Searching…' : `${total} ${total === 1 ? 'place' : 'places'} found`}
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Sort
          <select
            value={sort}
            onChange={(e) => handleSort(readSort(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70"
            />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white/95 p-10 text-center dark:border-slate-800 dark:bg-slate-900/95">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            No places match those filters
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
            Try widening the date range, raising the budget, or clearing a filter.
          </p>
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams())}
            className="mt-5 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Clear all filters
          </button>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isOwn={Number(property.ownerId) === Number(userId)}
              canContactOwner={Boolean(token)}
              onViewDetails={() => setDetailsProperty(property)}
              onContactOwner={() => setContactProperty(property)}
              onBook={() => handleBook(property)}
            />
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      )}

      {detailsProperty && (
        <PropertyDetailsModal
          property={detailsProperty}
          onClose={() => setDetailsProperty(null)}
          onBook={() => {
            const selected = detailsProperty
            setDetailsProperty(null)
            handleBook(selected)
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
            // These dates may now be taken — refresh so the card can't be rebooked.
            setRefreshKey((value) => value + 1)
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
