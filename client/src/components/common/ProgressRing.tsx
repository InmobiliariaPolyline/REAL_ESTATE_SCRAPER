import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ProgressRingProps {
  /** Fracción completada, de 0 a 1. */
  value: number
  size?: number
  stroke?: number
  /** Contenido centrado (cifra, icono…). */
  children?: ReactNode
  className?: string
  /** Texto para lectores de pantalla. */
  label: string
}

/** Anillo de progreso que se dibuja al aparecer. El color es `currentColor`. */
export default function ProgressRing({ value, size = 132, stroke = 10, children, className, label }: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - clamped)

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" fill="none" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-4)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ ["--ring-len" as string]: circumference, animation: "ringDraw 1.4s cubic-bezier(0.23, 1, 0.32, 1) both" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
