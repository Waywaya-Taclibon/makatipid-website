import type { SearchFilters } from '../../api/properties'
import type { InternetOption } from '../../data/properties'
import { computeEndDate } from '../../utils/dates'

export const DURATION_OPTIONS = [
  { label: '1 mo', months: 1 },
  { label: '3 mo', months: 3 },
  { label: '6 mo', months: 6 },
  { label: '12 mo', months: 12 },
] as const

export type BooleanFilterKey = 'pets' | 'smoking' | 'modifications' | 'electricity' | 'water'

export const BOOLEAN_FILTERS: { key: BooleanFilterKey; label: string }[] = [
  { key: 'pets', label: 'Pets allowed' },
  { key: 'smoking', label: 'Smoking allowed' },
  { key: 'modifications', label: 'Modifications allowed' },
  { key: 'electricity', label: 'Electricity included' },
  { key: 'water', label: 'Water included' },
]

const INTERNET_VALUES: InternetOption[] = ['INCLUDED', 'AVAILABLE', 'NONE']

export interface SearchValues {
  q: string
  moveIn: string
  months: number
  minPrice: string
  maxPrice: string
  maxDeposit: string
  internet: '' | InternetOption
  pets: boolean
  smoking: boolean
  modifications: boolean
  electricity: boolean
  water: boolean
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const NUMBER_PATTERN = /^\d+(\.\d+)?$/

export function emptySearchValues(): SearchValues {
  return {
    q: '',
    moveIn: '',
    months: 1,
    minPrice: '',
    maxPrice: '',
    maxDeposit: '',
    internet: '',
    pets: false,
    smoking: false,
    modifications: false,
    electricity: false,
    water: false,
  }
}

/** Ignores junk left in a hand-edited URL instead of forwarding it to the API. */
function readNumber(params: URLSearchParams, key: string): string {
  const raw = (params.get(key) ?? '').trim()
  return NUMBER_PATTERN.test(raw) ? raw : ''
}

export function parseSearchValues(params: URLSearchParams): SearchValues {
  const months = Number(params.get('months'))
  const start = (params.get('start') ?? '').trim()
  const internet = params.get('internet')

  return {
    q: params.get('q') ?? '',
    moveIn: DATE_PATTERN.test(start) ? start : '',
    months: DURATION_OPTIONS.some((option) => option.months === months) ? months : 1,
    minPrice: readNumber(params, 'minPrice'),
    maxPrice: readNumber(params, 'maxPrice'),
    maxDeposit: readNumber(params, 'maxDeposit'),
    internet: INTERNET_VALUES.includes(internet as InternetOption) ? (internet as InternetOption) : '',
    pets: params.get('pets') === '1',
    smoking: params.get('smoking') === '1',
    modifications: params.get('modifications') === '1',
    electricity: params.get('electricity') === '1',
    water: params.get('water') === '1',
  }
}

/** Serialises the bar for the URL. Never includes paging, so a new search starts at page 1. */
export function toSearchParams(values: SearchValues): URLSearchParams {
  const params = new URLSearchParams()

  const q = values.q.trim()
  if (q) params.set('q', q)

  if (values.moveIn) {
    params.set('start', values.moveIn)
    params.set('months', String(values.months))
    const end = computeEndDate(values.moveIn, values.months)
    if (end) params.set('end', end)
  }

  const numeric: [string, string][] = [
    ['minPrice', values.minPrice],
    ['maxPrice', values.maxPrice],
    ['maxDeposit', values.maxDeposit],
  ]
  for (const [key, raw] of numeric) {
    const value = raw.trim()
    if (NUMBER_PATTERN.test(value)) params.set(key, value)
  }

  if (values.internet) params.set('internet', values.internet)
  if (values.pets) params.set('pets', '1')
  if (values.smoking) params.set('smoking', '1')
  if (values.modifications) params.set('modifications', '1')
  if (values.electricity) params.set('electricity', '1')
  if (values.water) params.set('water', '1')

  return params
}

export function toSearchFilters(values: SearchValues): SearchFilters {
  const filters: SearchFilters = {}
  const q = values.q.trim()
  if (q) filters.q = q

  if (values.moveIn) {
    filters.start = values.moveIn
    const end = computeEndDate(values.moveIn, values.months)
    if (end) filters.end = end
  }

  if (NUMBER_PATTERN.test(values.minPrice.trim())) filters.minPrice = Number(values.minPrice)
  if (NUMBER_PATTERN.test(values.maxPrice.trim())) filters.maxPrice = Number(values.maxPrice)
  if (NUMBER_PATTERN.test(values.maxDeposit.trim())) filters.maxDeposit = Number(values.maxDeposit)

  if (values.internet) filters.internet = values.internet
  if (values.pets) filters.pets = true
  if (values.smoking) filters.smoking = true
  if (values.modifications) filters.modifications = true
  if (values.electricity) filters.electricity = true
  if (values.water) filters.water = true

  return filters
}

/** How many "More filters" choices are active — shown as a badge on the button. */
export function activeFilterCount(values: SearchValues): number {
  let count = 0
  if (values.minPrice.trim()) count += 1
  if (values.maxPrice.trim()) count += 1
  if (values.maxDeposit.trim()) count += 1
  if (values.internet) count += 1
  for (const { key } of BOOLEAN_FILTERS) {
    if (values[key]) count += 1
  }
  return count
}
