import {useState} from 'react'
import { settings, type Settings } from '../data/settings'
import AccountSettings from './AccountSettings'
import ThemeSettings from './ThemeSettings'

export default function Settings() {

    const [selected, setSelected] = useState<Settings>(settings[0])

    return (
        <div className="grid grid-cols-3 gap-6 w-full h-[75vh] max-w-6xl">
            {/* Left Column = 1*/}
            <div className="col-span-1 bg-white/95 backdrop-blur rounded-2xl shadow-xl p-4 overflow-y-auto dark:bg-slate-900/95 dark:border dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-800 mb-3 dark:text-slate-100">Settings</h3>
                <div className="flex flex-col gap-2">
                    {settings.map((s) => (
                        <button 
                        key={s.id}
                        onClick={() => setSelected(s)}
                        className={`text-left rounded-xl p-3 transition-colors ${
                            selected.id === s.id ? 'bg-blue-100 border-2 border-blue-400 dark:bg-blue-500/15 dark:border-blue-400' : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                        }`}
                        >
                            
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{s.name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{s.logo}</p>
                        </button>
                    ))}
                </div>
            </div>
            {/* Right Column = 2*/}
            <div className="col-span-2 bg-white/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden dark:bg-slate-900/95 dark:border dark:border-slate-800">
                {selected.id === 1 && <AccountSettings />}
                {selected.id === 2 && <ThemeSettings />}
            </div>
        </div>
    )
}