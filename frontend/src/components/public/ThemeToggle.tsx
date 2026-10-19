import { useTheme } from '../../context/ThemeContext'

/**
 * Compact light/dark flip for the public site. Reads and writes the same
 * `makatipid:theme` preference the in-app Settings screen uses, so a choice
 * made here carries into the app (and vice versa).
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const next = isDark ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-base transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
    </button>
  )
}
