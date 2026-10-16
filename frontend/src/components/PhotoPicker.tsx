import { useEffect, useRef, useState } from 'react'
import type { PropertyImage } from '../data/properties'

export interface PhotoItem {
  key: string
  kind: 'saved' | 'new'
  image?: PropertyImage
  file?: File
}

export const MAX_PHOTOS = 3
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function NewPhotoThumb({ file }: { file: File }) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  if (!preview) return <div className="w-full h-20 bg-slate-100 rounded-lg animate-pulse" />
  return <img src={preview} alt="New photo preview" className="w-full h-20 object-cover rounded-lg" />
}

export default function PhotoPicker({
  items,
  onChange,
}: {
  items: PhotoItem[]
  onChange: (next: PhotoItem[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)
  const remaining = MAX_PHOTOS - items.length

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const picked = Array.from(fileList)
    const valid = picked.filter((f) => ACCEPTED_TYPES.includes(f.type))
    if (valid.length < picked.length) {
      setNote('Only JPEG, PNG, or WebP photos are allowed — the rest were skipped.')
    }
    const room = MAX_PHOTOS - items.length
    const accepted = valid.slice(0, Math.max(room, 0))
    if (valid.length > accepted.length) {
      setNote(`You can keep at most ${MAX_PHOTOS} photos — extra ones were skipped.`)
    } else if (valid.length === picked.length) {
      setNote(null)
    }
    if (accepted.length === 0) return
    const next = accepted.map((file, i) => ({
      key: `new-${Date.now()}-${i}`,
      kind: 'new' as const,
      file,
    }))
    onChange([...items, ...next])
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Photos <span className="font-normal normal-case">({items.length}/{MAX_PHOTOS}, first = cover)</span>
        </label>
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            + Add photos
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl py-6 text-sm text-slate-500 transition-colors"
        >
          Tap to add up to {MAX_PHOTOS} photos of your property
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item, i) => (
            <div key={item.key} className="relative group">
              {item.kind === 'saved' && item.image ? (
                <img src={item.image.url} alt="Property photo" className="w-full h-20 object-cover rounded-lg" />
              ) : (
                item.file && <NewPhotoThumb file={item.file} />
              )}
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#4a9e4a] text-white">
                  COVER
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove photo"
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs leading-none"
              >
                ×
              </button>
              <div className="absolute bottom-1 left-1 right-1 flex justify-between">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move photo left"
                  className="w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs leading-none disabled:opacity-30"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label="Move photo right"
                  className="w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs leading-none disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {note && <p className="text-xs text-amber-600">{note}</p>}
    </div>
  )
}
