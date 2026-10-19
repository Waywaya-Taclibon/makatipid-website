interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
}

/** Shared intro block for the public inner pages (About/Features/How it works/Contact). */
export default function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="mx-auto max-w-3xl text-center">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-2 text-3xl font-extrabold text-slate-800 sm:text-4xl dark:text-slate-100">
        {title}
      </h1>
      {description && (
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
          {description}
        </p>
      )}
    </header>
  )
}
