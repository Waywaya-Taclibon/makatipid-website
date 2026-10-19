/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  BASE_CAMERA_MS,
  BASE_TRANSITION_MS,
  DEFAULT_EASING,
  DEFAULT_SPEED,
  easingCss,
  isEasingId,
  SPEED_MAX,
  SPEED_MIN,
  type EasingId,
} from '../data/motion'

/** Per-device visual preference, saved like the theme. */
export const MOTION_STORAGE_KEY = 'makatipid:motion'

interface StoredMotion {
  speed: number
  easing: EasingId
  reduced: boolean
}

interface MotionContextValue {
  /** Playback factor: 1 = original, higher = faster. */
  speed: number
  easing: EasingId
  /** When true: instant transitions and no decorative motion. */
  reduced: boolean
  setSpeed: (speed: number) => void
  setEasing: (easing: EasingId) => void
  setReduced: (reduced: boolean) => void
  reset: () => void
  /** Scales a base duration in ms by the speed. 0 when reduced. */
  duration: (baseMs: number) => number
  /** Factor for looping car animations. 0 when reduced (cars should not run). */
  carFactor: number
}

const MotionContext = createContext<MotionContextValue | undefined>(undefined)

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPEED
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value))
}

function readStored(): StoredMotion {
  // First run follows the OS "reduce motion" setting; after that the user's
  // explicit choice wins.
  const fallback: StoredMotion = { speed: DEFAULT_SPEED, easing: DEFAULT_EASING, reduced: prefersReducedMotion() }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(MOTION_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredMotion>
    return {
      speed: parsed.speed === undefined ? DEFAULT_SPEED : clampSpeed(Number(parsed.speed)),
      easing: isEasingId(parsed.easing) ? parsed.easing : DEFAULT_EASING,
      reduced: typeof parsed.reduced === 'boolean' ? parsed.reduced : fallback.reduced,
    }
  } catch {
    return fallback
  }
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredMotion>(readStored)

  const persist = useCallback((next: StoredMotion) => {
    setState(next)
    try {
      window.localStorage.setItem(MOTION_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage blocked — the choice still applies for this session.
    }
  }, [])

  const { speed, easing, reduced } = state

  // Publish the preference to <html> as CSS variables so every Tailwind
  // transition follows it without threading props through the whole app.
  useEffect(() => {
    const root = document.documentElement
    const css = easingCss(easing)
    root.dataset.motion = reduced ? 'off' : 'on'
    root.style.setProperty('--default-transition-duration', reduced ? '0s' : `${BASE_TRANSITION_MS / speed}ms`)
    root.style.setProperty('--default-transition-timing-function', css)
    root.style.setProperty('--motion-camera-duration', reduced ? '0s' : `${BASE_CAMERA_MS / speed}ms`)
    root.style.setProperty('--motion-camera-easing', css)
  }, [speed, easing, reduced])

  const value = useMemo<MotionContextValue>(
    () => ({
      speed,
      easing,
      reduced,
      setSpeed: (next) => persist({ ...state, speed: clampSpeed(next) }),
      setEasing: (next) => persist({ ...state, easing: next }),
      setReduced: (next) => persist({ ...state, reduced: next }),
      reset: () => persist({ speed: DEFAULT_SPEED, easing: DEFAULT_EASING, reduced: prefersReducedMotion() }),
      duration: (baseMs) => (reduced ? 0 : baseMs / speed),
      carFactor: reduced ? 0 : speed,
    }),
    [state, speed, easing, reduced, persist]
  )

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}

export function useMotion() {
  const ctx = useContext(MotionContext)
  if (!ctx) throw new Error('useMotion must be used within a MotionProvider')
  return ctx
}
