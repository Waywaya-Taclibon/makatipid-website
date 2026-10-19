/** Internet availability on the lot. */
export type InternetOption = 'INCLUDED' | 'AVAILABLE' | 'NONE'

export interface PropertyImage {
  id: number
  url: string
  sortOrder: number
}

/**
 * Owner contact details shown in the Contact Owner modal.
 *
 * Every field is optional: the backend does not return these yet, so the modal
 * renders "Not provided yet" placeholders. Once the API exposes them (either
 * mapped from the users table or new columns), populate `Property.ownerContact`
 * in `api/properties.ts` and the modal fills in automatically — no UI changes.
 */
export interface OwnerContact {
  /** Display name; falls back to "Owner #<id>" when missing. */
  name?: string | null
  /** Phone number in any format the owner entered (linked as tel:). */
  phone?: string | null
  email?: string | null
  /** Full URL or plain handle — both are accepted. */
  facebook?: string | null
  /** Full URL or plain handle — both are accepted. */
  instagram?: string | null
}

export interface Property {
  id: number
  lotName: string
  address: string
  price: number
  lat: number
  lng: number
  ownerId: number
  /** Not sent by the API yet — see OwnerContact. */
  ownerContact?: OwnerContact | null
  occupied: boolean
  archived: boolean
  availableUntil: string | null
  securityDeposit: number | null
  internet: InternetOption | null
  electricityIncluded: boolean | null
  waterIncluded: boolean | null
  petsAllowed: boolean | null
  smokingAllowed: boolean | null
  modificationsAllowed: boolean | null
  images: PropertyImage[]
}

/** Fields the user fills in when creating a property; owner/flags come from the server. */
export interface CreatePropertyInput {
  lotName: string
  address: string
  price: number
  lat: number
  lng: number
  availableUntil?: string | null
  securityDeposit?: number | null
  internet?: InternetOption | null
  electricityIncluded?: boolean
  waterIncluded?: boolean
  petsAllowed?: boolean
  smokingAllowed?: boolean
  modificationsAllowed?: boolean
}