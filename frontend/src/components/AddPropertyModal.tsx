import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { CreatePropertyInput } from '../data/properties'
import PropertyFormFields from './PropertyFormFields'
import PhotoPicker, { type PhotoItem } from './PhotoPicker'
import { emptyPropertyForm, formToInput, type PropertyFormState } from './propertyForm'

interface AddPropertyModalProps {
  onClose: () => void
  onSubmit: (data: CreatePropertyInput, photos: File[]) => void
}

export default function AddPropertyModal({ onClose, onSubmit }: AddPropertyModalProps) {
  const [form, setForm] = useState<PropertyFormState>(emptyPropertyForm)
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!Number.isFinite(parseFloat(form.lat)) || !Number.isFinite(parseFloat(form.lng))) {
      setError('Please pin your property location on the map first.')
      return
    }
    setError(null)
    onSubmit(
      formToInput(form),
      photos.filter((p) => p.kind === 'new' && p.file).map((p) => p.file as File)
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col gap-3 dark:bg-slate-900 dark:border dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add Property</h3>

        <PropertyFormFields value={form} onChange={setForm} />

        <PhotoPicker items={photos} onChange={setPhotos} />

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <div className="flex gap-2 mt-2">
          <button type="submit" className="flex-1 bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full py-2 text-sm font-semibold transition-all">
            Save
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2 text-sm font-semibold transition-all dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200">
            Cancel
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
