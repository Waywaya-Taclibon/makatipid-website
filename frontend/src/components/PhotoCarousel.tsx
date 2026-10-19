import { useState } from 'react'
import type { PropertyImage } from '../data/properties'

/** Shown when a photo URL 404s (e.g. a demo photo that hasn't been added yet). */
const FALLBACK_PHOTO = '/photo-placeholder.svg'

function onPhotoError(event: React.SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget
  if (img.dataset.fallback === '1') return
  img.dataset.fallback = '1'
  img.src = FALLBACK_PHOTO
}

/** Small cover carousel: first image shows, arrows/dots flip through the rest. */
export default function PhotoCarousel({
  images,
  alt,
  className = '',
  imgClassName = '',
}: {
  images: PropertyImage[]
  alt: string
  className?: string
  imgClassName?: string
}) {
  const [index, setIndex] = useState(0)
  if (!images || images.length === 0) return null
  const current = images[Math.min(index, images.length - 1)]

  function go(dir: -1 | 1, e: React.MouseEvent) {
    e.stopPropagation()
    setIndex((i) => (i + dir + images.length) % images.length)
  }

  function jump(i: number, e: React.MouseEvent) {
    e.stopPropagation()
    setIndex(i)
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={current.url}
        alt={alt}
        className={`w-full object-cover ${imgClassName}`}
        loading="lazy"
        onError={onPhotoError}
      />
      {images.length > 1 && (
        <>
          <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white">
            {Math.min(index, images.length - 1) + 1}/{images.length}
          </span>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => go(-1, e)}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white text-sm leading-none"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => go(1, e)}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white text-sm leading-none"
          >
            ›
          </button>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={(e) => jump(i, e)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === Math.min(index, images.length - 1) ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
