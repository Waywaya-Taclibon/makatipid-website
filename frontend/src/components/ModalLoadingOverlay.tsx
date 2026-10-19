import Spinner from './Spinner'

/** Blocks the whole dialog while an async save is in flight. */
export default function ModalLoadingOverlay({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/85 p-6 text-center backdrop-blur-sm dark:bg-slate-900/85"
    >
      <Spinner className="h-8 w-8 text-[#4a9e4a]" />
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
    </div>
  )
}
