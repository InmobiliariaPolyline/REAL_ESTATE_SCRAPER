/** Utilidades de filtrado compartidas (patrones para expresiones regulares POSIX de Postgres). */

export type Dormitorios = "todos" | "1" | "2" | "3" | "4+"
export type Banios = "todos" | "1" | "2" | "3+"
/** Antigüedad máxima de la publicación en el sistema. */
export type Publicado = "todos" | "hoy" | "semana" | "mes"

/** Escapa los metacaracteres de una expresión regular. */
export function escapeRegex(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
}

/** Escapa `%` y `_` (comodines de LIKE) para búsquedas literales con ILIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}

/** Patrón que ignora tildes: "san martin" encuentra "San Martín". */
export function accentInsensitivePattern(value: string): string {
  return escapeRegex(value)
    .replace(/[aáÁ]/gi, "[aáÁ]")
    .replace(/[eéÉ]/gi, "[eéÉ]")
    .replace(/[iíÍ]/gi, "[iíÍ]")
    .replace(/[oóÓ]/gi, "[oóÓ]")
    .replace(/[uúÚüÜ]/gi, "[uúÚüÜ]")
}

/** Patrón de dormitorios: "2" no coincide con "12", y "4+" cubre 4 o más. */
export function bedroomsPattern(value: Dormitorios): string | null {
  if (value === "todos") return null
  if (value === "4+") return "(^|\\D)([4-9]|[1-9][0-9]+)(\\D|$)"
  return `(^|\\D)${value}(\\D|$)`
}

/** Patrón de baños: "2" no coincide con "12", y "3+" cubre 3 o más. */
export function bathroomsPattern(value: Banios): string | null {
  if (value === "todos") return null
  if (value === "3+") return "(^|\\D)([3-9]|[1-9][0-9]+)(\\D|$)"
  return `(^|\\D)${value}(\\D|$)`
}

/** Días de antigüedad máxima de cada opción de publicación (`null` no filtra). */
export function diasPublicado(value: Publicado): number | null {
  return value === "hoy" ? 1 : value === "semana" ? 7 : value === "mes" ? 30 : null
}
