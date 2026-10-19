import { useTheme, type ThemePreference } from '../context/ThemeContext'

const options: { id: ThemePreference; label: string; description: string; icon: string }[] = [
  { id: 'light', label: 'Light', description: 'Bright surfaces, dark text', icon: '☀️' },
  { id: 'dark', label: 'Dark', description: 'Dim surfaces, light text', icon: '🌙' },
  { id: 'system', label: 'System', description: 'Match your device setting', icon: '💻' },
]

export default function ThemeSettings() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Theme Preferences</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose how the application appearance looks to you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {options.map((opt) => {
          const selected = theme === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(opt.id)}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-6 text-center transition-all ${
                selected
                  ? 'bg-blue-100 border-2 border-blue-500 text-blue-700 dark:bg-blue-500/15 dark:border-blue-400 dark:text-blue-200'
                  : 'bg-slate-50 border-2 border-transparent text-slate-600 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-3xl" aria-hidden="true">
                {opt.icon}
              </span>
              <span className="font-semibold text-sm">{opt.label}</span>
              <span className="text-[11px] leading-snug opacity-80">{opt.description}</span>
            </button>
          )
        })}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        {theme === 'system'
          ? `Following your system setting — currently ${resolvedTheme}.`
          : `Using ${resolvedTheme} mode on this device.`}
      </p>
    </div>
  )
}
