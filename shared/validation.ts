import { TIPOS_ENLACE, type TipoEnlace } from "./constants"
import { safeHttpUrl } from "./url"

export interface EnlaceInput {
  titulo: string
  descripcion: string
  url: string
  tipo?: string
}

export type EnlaceValidation =
  | {
      ok: true
      titulo: string
      descripcion: string | null
      url: string
      tipo: TipoEnlace
    }
  | { ok: false; message: string }

/** Valida y normaliza un enlace (solo URLs http/https, tipo conocido). */
export function validateEnlace(input: EnlaceInput): EnlaceValidation {
  const titulo = (input.titulo ?? "").trim()
  if (!titulo) return { ok: false, message: "El título es obligatorio." }
  if (titulo.length > 200) return { ok: false, message: "El título es demasiado largo." }
  if (!(input.url ?? "").trim()) return { ok: false, message: "La URL es obligatoria." }
  const url = safeHttpUrl(input.url)
  if (!url) {
    return {
      ok: false,
      message: "La URL no es válida. Debe comenzar con http:// o https://",
    }
  }
  const tipo = (input.tipo ?? "OTRO") as TipoEnlace
  if (!TIPOS_ENLACE.includes(tipo)) {
    return { ok: false, message: "El tipo de enlace no es válido." }
  }
  return {
    ok: true,
    titulo,
    descripcion: (input.descripcion ?? "").trim() || null,
    url,
    tipo,
  }
}
