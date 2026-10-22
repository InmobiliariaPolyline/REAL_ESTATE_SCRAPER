import { useRef, type ElementType, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface TiltProps {
  children: ReactNode
  className?: string
  /** Giro máximo en grados hacia el cursor. */
  max?: number
  as?: ElementType
}

const sinMovimiento = () =>
  document.documentElement.dataset.motion === "reduced" ||
  (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)

/** Ficha que se inclina suavemente hacia el cursor (efecto 3D). No se mueve con movimiento reducido. */
export default function Tilt({ children, className, max = 7, as: Tag = "div" }: TiltProps) {
  const ref = useRef<HTMLElement>(null)

  const mover = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType === "touch" || sinMovimiento()) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty("--ry", `${(x * 2 * max).toFixed(2)}deg`)
    el.style.setProperty("--rx", `${(-y * 2 * max).toFixed(2)}deg`)
  }

  const soltar = () => {
    ref.current?.style.setProperty("--rx", "0deg")
    ref.current?.style.setProperty("--ry", "0deg")
  }

  return (
    <Tag ref={ref as never} className={cn("tilt", className)} onPointerMove={mover} onPointerLeave={soltar}>
      {children}
    </Tag>
  )
}
