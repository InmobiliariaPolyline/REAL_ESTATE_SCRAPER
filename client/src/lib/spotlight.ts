/**
 * Brillo que sigue al cursor sobre las tarjetas interactivas (`.card-interactive`).
 * Un solo oyente delegado en el documento: calcula la posición relativa del cursor y la
 * deja en las variables CSS `--mx` y `--my` de la tarjeta; el resto es CSS.
 * No hace nada con la preferencia de movimiento reducido.
 */
export function initSpotlight(doc: Document = document): () => void {
  const reduce =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (reduce) return () => {}

  let frame = 0
  let pending: { card: HTMLElement; x: number; y: number } | null = null

  const flush = () => {
    frame = 0
    if (!pending) return
    const { card, x, y } = pending
    const r = card.getBoundingClientRect()
    card.style.setProperty("--mx", `${x - r.left}px`)
    card.style.setProperty("--my", `${y - r.top}px`)
    pending = null
  }

  const onMove = (e: PointerEvent) => {
    if (doc.documentElement.dataset.motion === "reduced") return
    const card = (e.target as Element | null)?.closest?.<HTMLElement>(".card-interactive")
    if (!card) return
    pending = { card, x: e.clientX, y: e.clientY }
    if (!frame) frame = requestAnimationFrame(flush)
  }

  doc.addEventListener("pointermove", onMove, { passive: true })
  return () => {
    doc.removeEventListener("pointermove", onMove)
    if (frame) cancelAnimationFrame(frame)
  }
}
