import { safeHttpUrl } from "@shared/url"

import { TIPOS_ENLACE, type TipoEnlace } from "@shared/constants"

export { TIPOS_ENLACE }
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

export const TIPO_LABELS: Record<TipoEnlace, string> = {
  OTRO: "Otro",
  INFORMACION_ESTADISTICA: "Información estadística",
  INFORMACION_LEGAL: "Información legal",
  DOCUMENTACION: "Documentación",
}

/** Abre un enlace en una pestaña nueva solo si es una URL http(s) válida. */
export function openEnlace(url: string): boolean {
  const safe = safeHttpUrl(url)
  if (!safe) return false
  window.open(safe, "_blank", "noopener,noreferrer")
  return true
}
