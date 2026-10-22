import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="empty-halo mb-5 inline-flex size-16 items-center justify-center rounded-3xl bg-surface-3 ring-1 ring-line-strong">
        <Icon className="animate-float relative size-7 text-gold" strokeWidth={1.5} />
      </span>
      <p className="text-base font-medium text-text">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
