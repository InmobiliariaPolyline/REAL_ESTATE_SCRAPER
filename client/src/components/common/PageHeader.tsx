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
    <header className="page-enter mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-4xl font-semibold leading-tight text-text sm:text-[2.6rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-text-muted">{description}</p>
        )}
        <span aria-hidden="true" className="bar-grow mt-4 block h-[3px] w-14 rounded-full bg-gradient-to-r from-gold to-transparent" />
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
