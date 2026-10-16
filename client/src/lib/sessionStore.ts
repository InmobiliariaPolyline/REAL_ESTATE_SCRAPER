import { IDLE_TIMEOUT_MS, SESSION_TTL_MS } from "./config"
import type { SessionUser } from "@/types"

const STORAGE_KEY = "inmoda_session"
const ACTIVITY_KEY = "inmoda_last_activity"

/**
 * La sesión vive en `sessionStorage`: se pierde al cerrar la pestaña o la ventana (y no se
 * comparte entre pestañas ni sobrevive a reiniciar el navegador). El rastro heredado en
 * `localStorage` de versiones anteriores se elimina.
 */
const storage = () => sessionStorage

function removeLegacy() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sin acceso */
  }
}

/** Última actividad del usuario (ms). Sirve para detectar inactividad también tras recargar. */
export function getLastActivity(): number | null {
  try {
    const raw = storage().getItem(ACTIVITY_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function setLastActivity(at: number): void {
  try {
    storage().setItem(ACTIVITY_KEY, String(at))
  } catch {
    /* sin acceso */
  }
}

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
    removeLegacy()
    storage().setItem(STORAGE_KEY, JSON.stringify(payload))
    setLastActivity(Date.now())
  } catch (err) {
    console.error("No se pudo guardar la sesión:", err)
  }
}

export function loadSession(): StoredSession | null {
  try {
    removeLegacy()
    const raw = storage().getItem(STORAGE_KEY)
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
    // Si la pestaña estuvo inactiva más del plazo (p. ej. portátil suspendido), no se restaura.
    const last = getLastActivity()
    if (last !== null && Date.now() - last > IDLE_TIMEOUT_MS) {
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
    storage().removeItem(STORAGE_KEY)
    storage().removeItem(ACTIVITY_KEY)
  } catch {
    /* almacenamiento no disponible */
  }
  removeLegacy()
}
