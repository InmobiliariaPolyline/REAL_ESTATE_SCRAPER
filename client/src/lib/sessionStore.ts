import { SESSION_TTL_MS } from "./config"
import type { SessionUser } from "@/types"

const STORAGE_KEY = "inmoda_session"

/**
 * Sesión persistida en el navegador.
 * Solo guarda identidad y el token emitido por el servidor; la vista y la suscripción
 * NUNCA se confían desde aquí: se vuelven a calcular al restaurar la sesión.
 */
export interface StoredSession {
  user: SessionUser
  /** Token emitido por `login_usuario` (se valida en el servidor en cada petición). */
  token: string | null
  savedAt: number
}

let memoryToken: string | null = null

/** Token que `api.ts` adjunta como `Authorization: Bearer` en cada petición. */
export const getSessionToken = () => memoryToken
export const setSessionToken = (token: string | null) => {
  memoryToken = token
}

export function saveSession(session: Omit<StoredSession, "savedAt">): void {
  memoryToken = session.token
  try {
    const payload: StoredSession = { ...session, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.error("No se pudo guardar la sesión:", err)
  }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<StoredSession> | null
    if (
      !data ||
      typeof data.savedAt !== "number" ||
      !data.user ||
      typeof data.user.id !== "number" ||
      typeof data.user.usuario !== "string"
    ) {
      clearSession()
      return null
    }
    if (Date.now() - data.savedAt > SESSION_TTL_MS) {
      clearSession()
      return null
    }
    memoryToken = typeof data.token === "string" ? data.token : null
    return {
      user: data.user,
      token: memoryToken,
      savedAt: data.savedAt,
    }
  } catch {
    clearSession()
    return null
  }
}

export function clearSession(): void {
  memoryToken = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* almacenamiento no disponible */
  }
}
