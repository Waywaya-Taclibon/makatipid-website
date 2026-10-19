import { useState } from 'react'
import { useMotion } from '../context/MotionContext'
import {
  BASE_CAMERA_MS,
  EASING_OPTIONS,
  easingCss,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_PRESETS,
} from '../data/motion'

export default function MotionSettings() {
  const { speed, easing, reduced, setSpeed, setEasing, setReduced, reset } = useMotion()
  const [previewKey, setPreviewKey] = useState(0)

  const previewMs = Math.max(60, Math.round(BASE_CAMERA_MS / speed))
  const easingLabel = EASING_OPTIONS.find((option) => option.id === easing)?.label ?? easing

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Animations</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tune how the world map, the moving cars, and the UI transitions feel. Saved on this device.
        </p>
      </div>

      {/* Live preview — remounts on any change so the new timing plays instantly. */}
      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Preview</p>
          <button
            type="button"
            onClick={() => setPreviewKey((value) => value + 1)}
            disabled={reduced}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            Play preview
          </button>
        </div>
        <div className="relative h-12 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            key={`${speed}-${easing}-${reduced}-${previewKey}`}
            className="absolute top-2 h-8 w-8 rounded-full bg-blue-600 shadow"
            style={
              reduced
                ? { left: '0.5rem' }
                : { animation: `motion-preview-run ${previewMs}ms ${easingCss(easing)} forwards` }
            }
          />
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          {reduced
            ? 'Reduce motion is on — the preview stays still.'
            : `This demo runs in ${previewMs}ms with the “${easingLabel}” curve.`}
        </p>
      </div>

      {/* Speed */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Animation speed</p>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{speed.toFixed(2)}×</span>
        </div>
        <input
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={0.05}
          value={speed}
          disabled={reduced}
          onChange={(event) => setSpeed(Number(event.target.value))}
          className="mt-3 w-full accent-blue-600 disabled:opacity-40"
          aria-label="Animation speed"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>Slower</span>
          <span>Faster</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SPEED_PRESETS.map((preset) => {
            const active = !reduced && Math.abs(speed - preset.speed) < 0.01
            return (
              <button
                key={preset.id}
                type="button"
                disabled={reduced}
                onClick={() => setSpeed(preset.speed)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
                  active
                    ? 'border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Easing */}
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Easing style</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EASING_OPTIONS.map((option) => {
            const active = easing === option.id
            return (
              <button
                key={option.id}
                type="button"
                disabled={reduced}
                onClick={() => setEasing(option.id)}
                className={`flex flex-col items-start rounded-xl border-2 px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                  active
                    ? 'border-blue-500 bg-blue-100 dark:border-blue-400 dark:bg-blue-500/15'
                    : 'border-transparent bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{option.label}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{option.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Reduced motion */}
      <button
        type="button"
        role="switch"
        aria-checked={reduced}
        onClick={() => setReduced(!reduced)}
        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
      >
        <span>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Reduce motion</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Instant transitions and parked cars. Follows your device setting by default.
          </span>
        </span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            reduced ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              reduced ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      <div>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
