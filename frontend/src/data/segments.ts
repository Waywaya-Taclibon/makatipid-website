export interface Segment {
  id: string
  path: string
  title: string
  x: number
  y: number
  width: number
  height: number
}

const CELL_W = 1600
const CELL_H = 800
const GAP = 100

function cellPos(col: number, row: number) {
  return { x: col * (CELL_W + GAP), y: row * (CELL_H + GAP) }
}

export const segments: Segment[] = [
  { id: 'browse',     path: '/browse',     title: 'Browse Rentals', ...cellPos(0, 0), width: CELL_W, height: CELL_H},
  { id: 'properties', path: '/properties', title: 'My Properties',  ...cellPos(1, 0), width: CELL_W, height: CELL_H},
  { id: 'bookings',   path: '/bookings',   title: 'My Bookings',    ...cellPos(2, 0), width: CELL_W, height: CELL_H},
  { id: 'messages',   path: '/messages',   title: 'Messages',       ...cellPos(0, 1), width: CELL_W, height: CELL_H},
  { id: 'home',       path: '/dashboard',  title: 'Where do you wanna start?',      ...cellPos(1, 1), width: CELL_W, height: CELL_H},
  { id: 'settings',   path: '/settings',   title: 'Settings',       ...cellPos(2, 1), width: CELL_W, height: CELL_H},
  { id: 'wallet',     path: '/wallet',     title: 'Wallet',         ...cellPos(0, 2), width: CELL_W, height: CELL_H},
]

export const WORLD_WIDTH = 3 * CELL_W + 2 * GAP
export const WORLD_HEIGHT = 3 * CELL_H + 2 * GAP