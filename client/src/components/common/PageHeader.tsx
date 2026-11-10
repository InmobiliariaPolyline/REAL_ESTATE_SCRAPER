import type { ReactNode } from "react"

interface PageHeaderProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/** Cabecera de página: título grande en serif (marca) con acciones a la derecha. */
export default function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-enter mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-6">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2.5">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] font-semibold leading-[1.1] text-text sm:text-[2.4rem]">{title}</h1>
        {description && <p className="mt-2.5 max-w-2xl text-[0.9375rem] leading-relaxed text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
