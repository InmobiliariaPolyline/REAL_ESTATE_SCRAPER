import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import Tilt from "./Tilt"

export type Tono = "gold" | "blue" | "green" | "amber" | "violet" | "rose" | "teal"

/** Icono con volumen (cara, canto y sombra). */
export function Icono3D({ icon: Icon, tono = "gold", size = "md", className }: { icon: LucideIcon; tono?: Tono; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span className={cn("icon-3d", `tone-${tono}`, size === "sm" && "icon-3d-sm", size === "lg" && "icon-3d-lg", className)} aria-hidden="true">
      <Icon className={size === "sm" ? "size-[1.05rem]" : size === "lg" ? "size-7" : "size-[1.35rem]"} strokeWidth={1.75} />
    </span>
  )
}

/** Ficha de un dato: icono 3D, etiqueta, valor y una nota opcional. */
export function Dato({
  icon,
  label,
  value,
  hint,
  tono = "gold",
  className,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  hint?: ReactNode
  tono?: Tono
  className?: string
}) {
  return (
    <Tilt className={cn(`tone-${tono}`, "flex items-center gap-3 rounded-2xl border border-line bg-surface-3/50 p-3.5", className)}>
      <Icono3D icon={icon} tono={tono} size="sm" className="tilt-icon" />
      <div className="tilt-text min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</p>
        <p className="mono break-words text-[0.95rem] font-semibold leading-snug text-text">{value}</p>
        {hint && <p className="mt-0.5 text-xs leading-snug text-text-muted">{hint}</p>}
      </div>
    </Tilt>
  )
}

/** Bloque con título e icono 3D que agrupa varios datos. */
export function Seccion({
  icon,
  title,
  subtitle,
  tono = "gold",
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  subtitle?: ReactNode
  tono?: Tono
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-3xl border border-line bg-surface-2/70 p-5 sm:p-6", className)}>
      <header className="mb-5 flex items-center gap-3.5">
        <Icono3D icon={icon} tono={tono} />
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

/** Rango mínimo–máximo de la zona con el precio del aviso marcado. */
export function BarraRango({ posicion, min, mediana, max }: { posicion: number | null; min: string; mediana?: string; max: string }) {
  return (
    <div>
      <div className="range-track" role="img" aria-label={posicion === null ? "Rango de precios de la zona" : `El precio está al ${Math.round(posicion)} % del rango de la zona`}>
        {posicion !== null && <span className="range-marker" style={{ left: `${posicion}%` }} />}
      </div>
      <div className="mono mt-2.5 flex items-center justify-between gap-3 text-xs text-text-muted">
        <span>{min}</span>
        {mediana && <span className="text-text-faint">mediana {mediana}</span>}
        <span>{max}</span>
      </div>
    </div>
  )
}
