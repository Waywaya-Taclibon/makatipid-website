import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { CreatePropertyInput, Property } from '../data/properties'
import PropertyFormFields from './PropertyFormFields'
import PhotoPicker, { type PhotoItem } from './PhotoPicker'
import Spinner from './Spinner'
import ModalLoadingOverlay from './ModalLoadingOverlay'
import { formToInput, propertyToForm, type PropertyFormState } from './propertyForm'
import { useAsyncLock } from '../hooks/useAsyncLock'

interface EditPropertyModalProps {
  property: Property
  onClose: () => void
  onSubmit: (data: CreatePropertyInput, photos: PhotoItem[]) => Promise<void>
}

export default function EditPropertyModal({ property, onClose, onSubmit }: EditPropertyModalProps) {
  const [form, setForm] = useState<PropertyFormState>(() => propertyToForm(property))
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    (property.images ?? []).map((img) => ({ key: `saved-${img.id}`, kind: 'saved' as const, image: img }))
  )
  const [error, setError] = useState<string | null>(null)
  const { busy, run } = useAsyncLock()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!Number.isFinite(parseFloat(form.lat)) || !Number.isFinite(parseFloat(form.lng))) {
      setError('Please pin your property location on the map first.')
      return
    }
    setError(null)
    await run(async () => {
      try {
        await onSubmit(formToInput(form), photos)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update property')
      }
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-lg">
        <form
          onSubmit={handleSubmit}
          aria-busy={busy}
          className="bg-white rounded-2xl shadow-xl p-6 w-full max-h-[90vh] overflow-y-auto flex flex-col gap-3 dark:bg-slate-900 dark:border dark:border-slate-800"
        >
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Edit “{property.lotName}”</h3>

          <fieldset disabled={busy} className="flex flex-col gap-3 border-0 p-0 m-0 min-w-0">
            <PropertyFormFields value={form} onChange={setForm} />

            <PhotoPicker items={photos} onChange={setPhotos} />
          </fieldset>

          {error && <p role="alert" className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <Spinner className="h-4 w-4 text-white" />
                  Saving changes…
                </>
              ) : (
                'Save changes'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>

        {busy && <ModalLoadingOverlay label="Saving your changes…" />}
      </div>
    </div>,
    document.body
  )
}
