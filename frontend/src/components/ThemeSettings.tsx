import { useState } from 'react'

type ThemeOption = 'light' | 'dark' | 'system'

export default function ThemeSettings() {
  const [theme, setTheme] = useState<ThemeOption>('system')

  const options: { id: ThemeOption; label: string; icon: string }[] = [
    { id: 'light', label: 'Light', icon: '☀️' },
    { id: 'dark', label: 'Dark', icon: '🌙' },
    { id: 'system', label: 'System', icon: '💻' },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Theme Preferences</h2>
        <p className="text-sm text-slate-500">Choose how the application appearance looks to you.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-6 transition-all ${
              theme === opt.id
                ? 'bg-blue-100 border-2 border-blue-500 text-blue-700'
                : 'bg-slate-50 border-2 border-transparent text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="text-3xl">{opt.icon}</span>
            <span className="font-semibold text-sm">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}