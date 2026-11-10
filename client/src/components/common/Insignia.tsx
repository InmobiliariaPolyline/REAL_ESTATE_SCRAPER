import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type TonoInsignia = "violet" | "green" | "rose" | "amber" | "cyan" | "blue" | "neutral"

interface InsigniaProps {
  /** Texto de la parte oscura y cuadrada (categoría o moneda). Sin él, la insignia es de un solo segmento. */
  etiqueta?: ReactNode
  icono?: LucideIcon
  children: ReactNode
  tono?: TonoInsignia
  tamano?: "sm" | "md" | "lg"
  /** Cifras en monoespaciada (fichas y montos pequeños). */
  mono?: boolean
  /** Valor atenuado (p. ej. «Sin precio»). */
  atenuada?: boolean
  titulo?: string
  className?: string
}

/**
 * Insignia partida: etiqueta oscura y cuadrada a la izquierda y valor en color a la derecha con curva suave.
 * Una sola pieza visual para precios, tipo, operación, estado y fichas.
 */
export default function Insignia({ etiqueta, icono: Icono, children, tono = "neutral", tamano = "sm", mono, atenuada, titulo, className }: InsigniaProps) {
  return (
    <span
      title={titulo}
      className={cn("sb", `sb-${tono}`, tamano === "md" && "sb-md", tamano === "lg" && "sb-lg", mono && "sb-mono", atenuada && "sb-faint", !etiqueta && !Icono && "sb-solo", className)}
    >
      {(etiqueta || Icono) && (
        <span className="sb-l">
          {Icono && <Icono className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
          {etiqueta}
        </span>
      )}
      {/* El espacio no se ve (los hijos son flex) pero hace que «Tipo Casa» se lea y se copie con su separación */}
      {(etiqueta || Icono) && " "}
      <span className="sb-v">
        <span>{children}</span>
      </span>
    </span>
  )
}
