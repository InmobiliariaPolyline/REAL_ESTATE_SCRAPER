/**
 * Devuelve la URL solo si usa http(s); en otro caso `null`.
 * Evita esquemas peligrosos (javascript:, data:, etc.) en enlaces provenientes de
 * datos scrapeados o escritos por usuarios.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null
  } catch {
    return null
  }
}
