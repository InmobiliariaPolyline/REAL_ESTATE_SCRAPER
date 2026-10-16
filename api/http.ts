/** Error con código HTTP; el handler lo convierte en una respuesta JSON. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string
  ) {
    super(message ?? code)
  }
}

export const badRequest = (message: string) => new HttpError(400, "bad_request", message)
export const unauthorized = () => new HttpError(401, "unauthorized", "Sesión inválida o expirada")
export const forbidden = () => new HttpError(403, "forbidden", "No tienes permiso para esta acción")
export const notFound = () => new HttpError(404, "not_found", "No encontrado")

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Los datos dependen de la sesión: nunca se cachean.
      "Cache-Control": "no-store",
    },
  })
}

/** Lee el cuerpo JSON (objeto). Un cuerpo vacío o inválido produce 400. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let data: unknown
  try {
    data = await req.json()
  } catch {
    throw badRequest("El cuerpo de la petición no es JSON válido")
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw badRequest("Se esperaba un objeto JSON")
  }
  return data as Record<string, unknown>
}

export function str(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string") throw badRequest(`${field} debe ser texto`)
  if (value.length > max) throw badRequest(`${field} es demasiado largo`)
  return value
}

export function optStr(value: unknown, field: string, max = 500): string {
  return value === undefined || value === null ? "" : str(value, field, max)
}

export function intParam(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value === "") return fallback
  const n = Number(value)
  if (!Number.isInteger(n)) throw badRequest("Parámetro numérico inválido")
  return Math.min(max, Math.max(min, n))
}

/** Número finito >= 0 o `null` si el parámetro está vacío. */
export function optNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw badRequest("Parámetro numérico inválido")
  return n
}
