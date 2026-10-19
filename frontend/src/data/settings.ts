export interface Settings {
  id: number
  name: string
  logo: string
}

export const settings: Settings[] = [
  { id: 1, name: 'Account', logo: '👤'},
  { id: 2, name: 'Theme', logo: '🎨'},
  { id: 3, name: 'Animations', logo: '🎞️'}
]