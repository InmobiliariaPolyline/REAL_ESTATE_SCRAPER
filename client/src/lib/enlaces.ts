import { safeHttpUrl } from "./url"

export interface Enlace {
  id: number
  propiedad_id: string
  titulo: string
  descripcion: string | null
  url: string
  tipo: string
  creado_en: string | null
}

export const TIPOS_ENLACE = [
  "OTRO",
  "INFORMACION_ESTADISTICA",
  "INFORMACION_LEGAL",
  "DOCUMENTACION",
] as const

export interface EnlaceInput {
  titulo: string
  descripcion: string
  url: string
}

export type EnlaceValidation =
  | { ok: true; titulo: string; descripcion: string | null; url: string }
  | { ok: false; message: string }

/** Valida y normaliza el formulario de un enlace (solo se aceptan URLs http/https). */
export function validateEnlace(input: EnlaceInput): EnlaceValidation {
  const titulo = input.titulo.trim()
  if (!titulo) return { ok: false, message: "El título es obligatorio." }
  if (!input.url.trim()) return { ok: false, message: "La URL es obligatoria." }
  const url = safeHttpUrl(input.url)
  if (!url) {
    return {
      ok: false,
      message: "La URL no es válida. Debe comenzar con http:// o https://",
    }
  }
  return {
    ok: true,
    titulo,
    descripcion: input.descripcion.trim() || null,
    url,
  }
}

/** Abre un enlace en una pestaña nueva solo si es una URL http(s) válida. */
export function openEnlace(url: string): boolean {
  const safe = safeHttpUrl(url)
  if (!safe) return false
  window.open(safe, "_blank", "noopener,noreferrer")
  return true
}
