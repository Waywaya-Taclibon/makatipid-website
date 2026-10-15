import type { InternetOption } from '../data/properties'
import type { PropertyFormState } from './propertyForm'

const inputClass = 'border border-slate-300 rounded-lg px-3 py-2 text-sm'
const checkboxClass = 'flex items-center gap-2 text-sm text-slate-700'

export default function PropertyFormFields({
  value,
  onChange,
}: {
  value: PropertyFormState
  onChange: (next: PropertyFormState) => void
}) {
  const set = (patch: Partial<PropertyFormState>) => onChange({ ...value, ...patch })

  return (
    <>
      <input value={value.lotName} onChange={(e) => set({ lotName: e.target.value })} placeholder="Lot name" required className={inputClass} />
      <input value={value.address} onChange={(e) => set({ address: e.target.value })} placeholder="Complete address" required className={inputClass} />
      <input value={value.price} onChange={(e) => set({ price: e.target.value })} placeholder="Base rent per month (₱)" type="number" min="0" step="any" required className={inputClass} />
      <input value={value.lat} onChange={(e) => set({ lat: e.target.value })} placeholder="Latitude" type="number" step="any" required className={inputClass} />
      <input value={value.lng} onChange={(e) => set({ lng: e.target.value })} placeholder="Longitude" type="number" step="any" required className={inputClass} />

      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">Available until <span className="font-normal normal-case">(optional)</span></label>
      <input value={value.availableUntil} onChange={(e) => set({ availableUntil: e.target.value })} type="date" className={`${inputClass} -mt-2`} />
      <input value={value.securityDeposit} onChange={(e) => set({ securityDeposit: e.target.value })} placeholder="Security deposit upon meetup (₱, optional)" type="number" min="0" step="any" className={inputClass} />

      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">Internet</label>
      <select value={value.internet} onChange={(e) => set({ internet: e.target.value as InternetOption })} className={`${inputClass} -mt-2 bg-white`}>
        <option value="INCLUDED">Included in rent</option>
        <option value="AVAILABLE">Available on lot (paid separately)</option>
        <option value="NONE">Not available</option>
      </select>

      <div className="flex flex-col gap-2 mt-1">
        <label className={checkboxClass}><input type="checkbox" checked={value.electricityIncluded} onChange={(e) => set({ electricityIncluded: e.target.checked })} className="accent-green-600" /> Electricity included in rent</label>
        <label className={checkboxClass}><input type="checkbox" checked={value.waterIncluded} onChange={(e) => set({ waterIncluded: e.target.checked })} className="accent-green-600" /> Water included in rent</label>
        <label className={checkboxClass}><input type="checkbox" checked={value.petsAllowed} onChange={(e) => set({ petsAllowed: e.target.checked })} className="accent-green-600" /> Pets allowed</label>
        <label className={checkboxClass}><input type="checkbox" checked={value.smokingAllowed} onChange={(e) => set({ smokingAllowed: e.target.checked })} className="accent-green-600" /> Smoking allowed</label>
        <label className={checkboxClass}><input type="checkbox" checked={value.modificationsAllowed} onChange={(e) => set({ modificationsAllowed: e.target.checked })} className="accent-green-600" /> Property modifications allowed</label>
      </div>
    </>
  )
}
