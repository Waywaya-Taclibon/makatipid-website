import { BOOLEAN_FILTERS, type SearchValues } from './searchForm'

interface FilterPanelProps {
  values: SearchValues
  onChange: (patch: Partial<SearchValues>) => void
  onClear: () => void
}

const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500'

export default function FilterPanel({ values, onChange, onClear }: FilterPanelProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className={labelClass}>Monthly price (₱)</p>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Min"
            value={values.minPrice}
            onChange={(e) => onChange({ minPrice: e.target.value })}
            className={inputClass}
            aria-label="Minimum monthly price"
          />
          <span className="text-slate-400">–</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Max"
            value={values.maxPrice}
            onChange={(e) => onChange({ maxPrice: e.target.value })}
            className={inputClass}
            aria-label="Maximum monthly price"
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="filter-deposit">
          Max deposit (₱)
        </label>
        <input
          id="filter-deposit"
          type="number"
          min="0"
          inputMode="numeric"
          placeholder="Any"
          value={values.maxDeposit}
          onChange={(e) => onChange({ maxDeposit: e.target.value })}
          className={`mt-1 ${inputClass}`}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="filter-internet">
          Internet
        </label>
        <select
          id="filter-internet"
          value={values.internet}
          onChange={(e) => onChange({ internet: e.target.value as SearchValues['internet'] })}
          className={`mt-1 ${inputClass}`}
        >
          <option value="">Any</option>
          <option value="INCLUDED">Included in rent</option>
          <option value="AVAILABLE">Available on lot</option>
          <option value="NONE">Not available</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <p className={labelClass}>Must have</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {BOOLEAN_FILTERS.map(({ key, label }) => {
            const active = values[key]
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ [key]: !active } as Partial<SearchValues>)}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="sm:col-span-2 flex justify-end">
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          Clear filters
        </button>
      </div>
    </div>
  )
}
