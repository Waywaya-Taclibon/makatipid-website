/** Internet availability on the lot. */
export type InternetOption = 'INCLUDED' | 'AVAILABLE' | 'NONE'

export interface PropertyImage {
  id: number
  url: string
  sortOrder: number
}

export interface Property {
  id: number
  lotName: string
  address: string
  price: number
  lat: number
  lng: number
  ownerId: number
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