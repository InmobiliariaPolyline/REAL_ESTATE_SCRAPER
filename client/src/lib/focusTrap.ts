const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    el => !el.closest("[hidden],[aria-hidden='true']")
  )
}

/**
 * Ref callback para el elemento `role="dialog"` de un modal:
 *  - al abrirse mueve el foco al primer control del diálogo,
 *  - mantiene Tab / Shift+Tab dentro del diálogo,
 *  - al cerrarse devuelve el foco al elemento que lo abrió.
 *
 * Al ser una función de módulo (estable) no necesita hooks: `<div ref={trapFocus} tabIndex={-1} ...>`.
 */
export function trapFocus(node: HTMLElement | null): (() => void) | void {
  if (!node) return

  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return
    const items = focusables(node)
    if (items.length === 0) {
      e.preventDefault()
      node.focus()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === node)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  node.addEventListener("keydown", onKeyDown)
  // Un campo con autoFocus ya tiene el foco dentro: no se lo quitamos.
  if (!node.contains(document.activeElement)) {
    ;(focusables(node)[0] ?? node).focus({ preventScroll: true })
  }

  return () => {
    node.removeEventListener("keydown", onKeyDown)
    if (previous && previous.isConnected) previous.focus({ preventScroll: true })
  }
}
