export interface RentalLog {
  id: number
  propertyId: number
  renterId: number
  startDate: string
  endDate: string | null
  status: 'ACTIVE' | 'ENDED' | 'PENDING'
}

export interface Booking {
  id: number
  status: string
  startDate: string
  endDate: string | null
  propertyId: number
  lotName: string
  address: string
  price: number
  lat: number
  lng: number
  ownerName: string
  renterId?: number | null
  renterName?: string | null
}