import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { CreatePropertyInput } from '../data/properties'
import PropertyFormFields from './PropertyFormFields'
import { emptyPropertyForm, formToInput, type PropertyFormState } from './propertyForm'

interface AddPropertyModalProps {
  onClose: () => void
  onSubmit: (data: CreatePropertyInput) => void
}

export default function AddPropertyModal({ onClose, onSubmit }: AddPropertyModalProps) {
  const [form, setForm] = useState<PropertyFormState>(emptyPropertyForm)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(formToInput(form))
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto flex flex-col gap-3">
        <h3 className="text-lg font-bold text-slate-800">Add Property</h3>

        <PropertyFormFields value={form} onChange={setForm} />

        <div className="flex gap-2 mt-2">
          <button type="submit" className="flex-1 bg-[#4a9e4a] hover:bg-[#3a7e3a] text-white rounded-full py-2 text-sm font-semibold transition-all">
            Save
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
