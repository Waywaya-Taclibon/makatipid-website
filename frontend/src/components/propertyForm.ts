import type { CreatePropertyInput, InternetOption, Property } from '../data/properties'

/** String-based form state (inputs are strings until submit). */
export interface PropertyFormState {
  lotName: string
  address: string
  price: string
  lat: string
  lng: string
  availableUntil: string
  securityDeposit: string
  internet: InternetOption
  electricityIncluded: boolean
  waterIncluded: boolean
  petsAllowed: boolean
  smokingAllowed: boolean
  modificationsAllowed: boolean
}

export const emptyPropertyForm: PropertyFormState = {
  lotName: '',
  address: '',
  price: '',
  lat: '',
  lng: '',
  availableUntil: '',
  securityDeposit: '',
  internet: 'NONE',
  electricityIncluded: false,
  waterIncluded: false,
  petsAllowed: false,
  smokingAllowed: false,
  modificationsAllowed: false,
}

/** Prefill the form from an existing property (edit flow). */
export function propertyToForm(p: Property): PropertyFormState {
  return {
    lotName: p.lotName,
    address: p.address,
    price: String(p.price),
    lat: String(p.lat),
    lng: String(p.lng),
    availableUntil: p.availableUntil ?? '',
    securityDeposit: p.securityDeposit != null ? String(p.securityDeposit) : '',
    internet: p.internet ?? 'NONE',
    electricityIncluded: p.electricityIncluded ?? false,
    waterIncluded: p.waterIncluded ?? false,
    petsAllowed: p.petsAllowed ?? false,
    smokingAllowed: p.smokingAllowed ?? false,
    modificationsAllowed: p.modificationsAllowed ?? false,
  }
}

/** Convert form state to the API payload. */
export function formToInput(s: PropertyFormState): CreatePropertyInput {
  return {
    lotName: s.lotName,
    address: s.address,
    price: parseFloat(s.price),
    lat: parseFloat(s.lat),
    lng: parseFloat(s.lng),
    availableUntil: s.availableUntil || null,
    securityDeposit: s.securityDeposit ? parseFloat(s.securityDeposit) : null,
    internet: s.internet,
    electricityIncluded: s.electricityIncluded,
    waterIncluded: s.waterIncluded,
    petsAllowed: s.petsAllowed,
    smokingAllowed: s.smokingAllowed,
    modificationsAllowed: s.modificationsAllowed,
  }
}
