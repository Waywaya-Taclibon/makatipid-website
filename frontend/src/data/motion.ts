export type EasingId = 'smooth' | 'linear' | 'snappy' | 'bounce'

export interface EasingOption {
  id: EasingId
  label: string
  description: string
  css: string
}

/** Easing curves offered for the camera slide and UI transitions. */
export const EASING_OPTIONS: EasingOption[] = [
  { id: 'smooth', label: 'Smooth', description: 'Gentle ease in and out', css: 'cubic-bezier(0.65, 0, 0.35, 1)' },
  { id: 'linear', label: 'Linear', description: 'Constant, mechanical pace', css: 'linear' },
  { id: 'snappy', label: 'Snappy', description: 'Quick start, soft landing', css: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { id: 'bounce', label: 'Bounce', description: 'Overshoots then settles', css: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
]

export function easingCss(id: EasingId): string {
  return EASING_OPTIONS.find((option) => option.id === id)?.css ?? EASING_OPTIONS[0].css
}

export function isEasingId(value: unknown): value is EasingId {
  return EASING_OPTIONS.some((option) => option.id === value)
}

export interface SpeedPreset {
  id: string
  label: string
  speed: number
}

/** Playback factor: 1 = the app's original speed, higher = faster. */
export const SPEED_PRESETS: SpeedPreset[] = [
  { id: 'very-slow', label: 'Very slow', speed: 0.4 },
  { id: 'slow', label: 'Slow', speed: 0.7 },
  { id: 'normal', label: 'Normal', speed: 1 },
  { id: 'fast', label: 'Fast', speed: 1.6 },
  { id: 'turbo', label: 'Turbo', speed: 2.5 },
]

export const SPEED_MIN = 0.25
export const SPEED_MAX = 3
export const DEFAULT_SPEED = 1
export const DEFAULT_EASING: EasingId = 'smooth'

/** Base timings the app shipped with; the speed factor scales these. */
export const BASE_TRANSITION_MS = 150
export const BASE_CAMERA_MS = 900
export const BASE_MAP_PAN_SECONDS = 0.8
export const BASE_SEARCH_PAN_SECONDS = 1
