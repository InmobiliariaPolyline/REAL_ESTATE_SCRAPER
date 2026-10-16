import { safeHttpUrl } from "@shared/url"

export { TIPOS_ENLACE } from "@shared/constants"
export { validateEnlace, type EnlaceInput } from "@shared/validation"

export interface Enlace {
  id: number
  propiedad_id: string
  titulo: string
  descripcion: string | null
  url: string
  tipo: string
  creado_en: string | null
}

/** Abre un enlace en una pestaña nueva solo si es una URL http(s) válida. */
export function openEnlace(url: string): boolean {
  const safe = safeHttpUrl(url)
  if (!safe) return false
  window.open(safe, "_blank", "noopener,noreferrer")
  return true
}
