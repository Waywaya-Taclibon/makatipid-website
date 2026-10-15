import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { CreatePropertyInput, Property } from '../data/properties'
import PropertyFormFields from './PropertyFormFields'
import { formToInput, propertyToForm, type PropertyFormState } from './propertyForm'

interface EditPropertyModalProps {
  property: Property
  onClose: () => void
  onSubmit: (data: CreatePropertyInput) => void
}

export default function EditPropertyModal({ property, onClose, onSubmit }: EditPropertyModalProps) {
  const [form, setForm] = useState<PropertyFormState>(() => propertyToForm(property))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(formToInput(form))
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto flex flex-col gap-3">
        <h3 className="text-lg font-bold text-slate-800">Edit “{property.lotName}”</h3>

        <PropertyFormFields value={form} onChange={setForm} />

        <div className="flex gap-2 mt-2">
          <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full py-2 text-sm font-semibold transition-all">
            Save changes
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full py-2 text-sm font-semibold transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
