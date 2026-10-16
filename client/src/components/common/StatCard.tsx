import type { LucideIcon } from "lucide-react"
import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tone = "gold" | "blue" | "green" | "amber" | "violet" | "rose"

const TONES: Record<Tone, { icon: string; ring: string }> = {
  gold: { icon: "text-gold", ring: "bg-gold-soft ring-gold/25" },
  blue: { icon: "text-blue", ring: "bg-blue/10 ring-blue/25" },
  green: { icon: "text-green", ring: "bg-green/10 ring-green/25" },
  amber: { icon: "text-amber", ring: "bg-amber/10 ring-amber/25" },
  violet: { icon: "text-violet", ring: "bg-violet/10 ring-violet/25" },
  rose: { icon: "text-rose", ring: "bg-rose/10 ring-rose/25" },
}

interface StatCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  tone?: Tone
  /** Texto secundario junto al valor (p. ej. "+11 hoy"). */
  hint?: ReactNode
  /** Enlace inferior estilo "Ver más →". */
  footerLabel?: string
  onFooterClick?: () => void
  loading?: boolean
}

/** Tarjeta de métrica: etiqueta, cifra grande en mono, icono y enlace inferior. */
export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "gold",
  hint,
  footerLabel,
  onFooterClick,
  loading,
}: StatCardProps) {
  const t = TONES[tone]
  return (
    <div className="card card-texture flex flex-col">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0 pl-1">
          <p className="text-sm text-text-muted">{label}</p>
          {loading ? (
            <div className="skeleton mt-3 h-9 w-24" />
          ) : (
            <p className="mono mt-2 text-[2rem] font-semibold leading-none tracking-tight text-text">
              {value}
            </p>
          )}
          {hint && <p className="mt-2 text-xs text-text-muted">{hint}</p>}
        </div>
        <span
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1",
            t.ring
          )}
        >
          <Icon className={cn("size-5", t.icon)} strokeWidth={1.75} />
        </span>
      </div>

      {footerLabel && (
        <button
          type="button"
          onClick={onFooterClick}
          className="mt-auto flex items-center justify-between border-t border-line px-6 py-3 text-xs font-medium text-text-muted transition hover:text-gold"
        >
          {footerLabel}
          <ArrowRight className="size-4" />
        </button>
      )}
    </div>
  )
}
