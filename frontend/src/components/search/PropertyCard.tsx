import type { Property } from '../../data/properties'

interface PropertyCardProps {
  property: Property
  isOwn: boolean
  canContactOwner: boolean
  onViewDetails: () => void
  onContactOwner: () => void
  onBook: () => void
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString('en-PH')}/mo`
}

function internetLabel(value: Property['internet']): string | null {
  if (value === 'INCLUDED') return 'Wi-Fi included'
  if (value === 'AVAILABLE') return 'Wi-Fi available'
  if (value === 'NONE') return 'No Wi-Fi'
  return null
}

export default function PropertyCard({
  property,
  isOwn,
  canContactOwner,
  onViewDetails,
  onContactOwner,
  onBook,
}: PropertyCardProps) {
  const cover = property.images?.[0]?.url

  // Only claims the listing actually makes — a null flag means "not specified",
  // which is different from "no".
  const badges: string[] = []
  const internet = internetLabel(property.internet)
  if (internet) badges.push(internet)
  if (property.petsAllowed === true) badges.push('Pets OK')
  if (property.electricityIncluded === true) badges.push('Electricity included')
  if (property.waterIncluded === true) badges.push('Water included')
  if (property.modificationsAllowed === true) badges.push('Modifications OK')

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/95">
      <div className="relative h-40 bg-slate-100 dark:bg-slate-800">
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-40" aria-hidden="true">
            🏠
          </div>
        )}

        {property.occupied && (
          <span className="absolute left-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white">
            Currently occupied
          </span>
        )}
        {isOwn && (
          <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
            Your listing
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-slate-800 dark:text-slate-100">{property.lotName}</h3>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{property.address}</p>
        </div>

        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatPrice(property.price)}</p>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={onViewDetails}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            View details
          </button>

          {canContactOwner && !isOwn && (
            <button
              type="button"
              onClick={onContactOwner}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Contact owner
            </button>
          )}

          <button
            type="button"
            onClick={onBook}
            disabled={isOwn}
            className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isOwn ? 'Your listing' : 'Book'}
          </button>
        </div>
      </div>
    </article>
  )
}
