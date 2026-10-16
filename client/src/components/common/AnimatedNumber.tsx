import { useEffect, useRef, useState } from "react"

interface AnimatedNumberProps {
  value: number
  /** Formato de salida (por defecto, separador de miles es-PE). */
  format?: (n: number) => string
  duration?: number
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString("es-PE")

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** Cifra que cuenta hasta su valor y destella cuando cambia (p. ej. tras refrescar métricas). */
export default function AnimatedNumber({
  value,
  format = defaultFormat,
  duration = 900,
}: AnimatedNumberProps) {
  const [shown, setShown] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const from = useRef(0)
  const first = useRef(true)

  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = value
      setShown(value)
      return
    }
    if (!first.current) setFlashKey(k => k + 1)
    first.current = false

    const start = performance.now()
    const origin = from.current
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const current = origin + (value - origin) * eased
      from.current = current
      setShown(current)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <span key={flashKey} className={flashKey > 0 ? "value-flash" : undefined}>
      {format(shown)}
    </span>
  )
}
