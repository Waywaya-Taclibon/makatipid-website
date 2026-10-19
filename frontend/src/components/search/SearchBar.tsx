import { useEffect, useState, type FormEvent } from 'react'
import { fetchAddressSuggestions } from '../../api/properties'
import { getTodayString } from '../../utils/dates'
import FilterPanel from './FilterPanel'
import {
  DURATION_OPTIONS,
  activeFilterCount,
  emptySearchValues,
  type SearchValues,
} from './searchForm'

interface SearchBarProps {
  initial?: SearchValues
  variant?: 'hero' | 'results'
  onSearch: (values: SearchValues) => void
}

const fieldLabel = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
const fieldInput =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function SearchBar({ initial, variant = 'results', onSearch }: SearchBarProps) {
  const [values, setValues] = useState<SearchValues>(() => initial ?? emptySearchValues())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  // Debounced destination autocomplete. Aborting on every keystroke keeps a
  // slow response from overwriting a newer one.
  useEffect(() => {
    if (!suggestionsOpen) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetchAddressSuggestions(values.q, controller.signal).then((items) => {
        if (!controller.signal.aborted) setSuggestions(items)
      })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [values.q, suggestionsOpen])

  function update(patch: Partial<SearchValues>) {
    setValues((previous) => ({ ...previous, ...patch }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSuggestionsOpen(false)
    setFiltersOpen(false)
    onSearch(values)
  }

  function handleClearFilters() {
    update({
      minPrice: '',
      maxPrice: '',
      maxDeposit: '',
      internet: '',
      pets: false,
      smoking: false,
      modifications: false,
      electricity: false,
      water: false,
    })
  }

  const activeFilters = activeFilterCount(values)
  const hero = variant === 'hero'

  return (
    <div className={`relative w-full ${hero ? 'max-w-4xl' : ''}`}>
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl border border-slate-200 bg-white/95 p-4 dark:border-slate-800 dark:bg-slate-900/95 ${
          hero ? 'shadow-xl' : ''
        }`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          {/* Destination */}
          <div className="relative md:flex-[2]">
            <label className={fieldLabel} htmlFor="search-destination">
              Where
            </label>
            <input
              id="search-destination"
              value={values.q}
              onChange={(e) => update({ q: e.target.value })}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => setSuggestionsOpen(false)}
              placeholder="City, barangay, or street"
              autoComplete="off"
              className={fieldInput}
            />

            {suggestionsOpen && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      // Keep focus on the input so its onBlur doesn't close the
                      // list before this click lands.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        update({ q: suggestion })
                        setSuggestionsOpen(false)
                      }}
                      className="block w-full truncate px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Move-in date */}
          <div className="md:flex-1">
            <label className={fieldLabel} htmlFor="search-movein">
              Move-in
            </label>
            <input
              id="search-movein"
              type="date"
              min={getTodayString()}
              value={values.moveIn}
              onChange={(e) => update({ moveIn: e.target.value })}
              className={fieldInput}
            />
          </div>

          {/* Duration */}
          <div className="md:flex-1">
            <label className={fieldLabel} htmlFor="search-duration">
              Stay
            </label>
            <select
              id="search-duration"
              value={values.months}
              disabled={!values.moveIn}
              onChange={(e) => update({ months: Number(e.target.value) })}
              className={`${fieldInput} disabled:opacity-50`}
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option.months} value={option.months}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="search-filters"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilters > 0
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            More filters
            {activeFilters > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">
                {activeFilters}
              </span>
            )}
          </button>

          <span className="text-xs text-slate-500 dark:text-slate-400">
            Dates are optional — leave them blank to see every listing.
          </span>
        </div>
      </form>

      {filtersOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
          />
          <div
            id="search-filters"
            className="absolute left-0 right-0 z-20 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <FilterPanel values={values} onChange={update} onClear={handleClearFilters} />
          </div>
        </>
      )}
    </div>
  )
}
