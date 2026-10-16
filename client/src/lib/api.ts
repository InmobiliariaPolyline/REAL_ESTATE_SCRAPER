import { API_BASE_URL } from "./config"
import { getSessionToken } from "./sessionStore"

/** Error devuelto por la API (`{ error, message }`) o fallo de red (status 0). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

let onUnauthorized: (() => void) | null = null

/** Registra qué hacer cuando la API responde 401 con una sesión activa (p. ej. cerrar sesión). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>

function toQuery(params?: QueryParams): string {
  if (!params) return ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

async function request<T>(
  method: string,
  path: string,
  options: { params?: QueryParams; body?: unknown } = {}
): Promise<T> {
  const token = getSessionToken()
  const headers: Record<string, string> = { Accept: "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers["Content-Type"] = "application/json"

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api${path}${toQuery(options.params)}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (err) {
    throw new ApiError(0, "network", err instanceof Error ? err.message : "Error de red")
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* respuesta sin cuerpo JSON */
  }

  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; message?: string }
    // Una sesión que el servidor ya no reconoce: se avisa a la app (no aplica al login).
    if (res.status === 401 && token && path !== "/login") onUnauthorized?.()
    throw new ApiError(
      res.status,
      body.error ?? "http_error",
      body.message ?? `Error ${res.status}`
    )
  }
  return data as T
}

export const api = {
  get: <T>(path: string, params?: QueryParams) => request<T>("GET", path, { params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>("POST", path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, { body: body ?? {} }),
  delete: <T>(path: string) => request<T>("DELETE", path),
}
