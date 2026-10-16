import { ApiError, api } from "./api"
import { clearSession, loadSession, saveSession, setSessionToken } from "./sessionStore"
import type { SessionUser, Suscripcion, Vista } from "@/types"

export type VencidoMotivo = "vencida" | "sin_suscripcion"

/** Estado ya resuelto que el router necesita para decidir qué pantalla mostrar. */
export interface AuthSnapshot {
  user: SessionUser
  vista: Exclude<Vista, "login">
  suscripcion: Suscripcion | null
  vencidoMotivo?: VencidoMotivo
}

export type LoginFailure =
  | "invalid"
  | "banned"
  | "locked"
  | "unknown_role"
  | "network"

export type LoginOutcome =
  | { ok: true; snapshot: AuthSnapshot }
  | { ok: false; reason: LoginFailure }

/** Respuesta de /api/login y /api/session. */
interface AccessResponse {
  ok: boolean
  token?: string
  usuario: SessionUser & { estado?: string }
  suscripcion: Suscripcion | null
  tuvo_suscripcion: boolean
}

/** Decide la pantalla según rol y suscripción. Rol desconocido => null. */
function buildSnapshot(res: AccessResponse): AuthSnapshot | null {
  const user: SessionUser = {
    id: res.usuario.id,
    usuario: res.usuario.usuario,
    rol: res.usuario.rol,
  }
  const suscripcion = res.suscripcion ?? null

  if (user.rol === "admin") {
    return { user, vista: "admin", suscripcion: null }
  }
  if (user.rol === "usuario") {
    if (suscripcion) return { user, vista: "portal", suscripcion }
    return {
      user,
      vista: "vencido",
      suscripcion: null,
      vencidoMotivo: res.tuvo_suscripcion ? "vencida" : "sin_suscripcion",
    }
  }
  return null
}

export async function login(usuarioRaw: string, password: string): Promise<LoginOutcome> {
  const usuario = usuarioRaw.trim()
  if (!usuario || !password) return { ok: false, reason: "invalid" }

  let res: AccessResponse
  try {
    res = await api.post<AccessResponse>("/login", { usuario, password })
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return { ok: false, reason: "invalid" }
      if (err.status === 403) return { ok: false, reason: "banned" }
      if (err.status === 429) return { ok: false, reason: "locked" }
    }
    console.error("Error en el login:", err)
    return { ok: false, reason: "network" }
  }

  const snapshot = buildSnapshot(res)
  if (!snapshot || !res.token) return { ok: false, reason: "unknown_role" }

  saveSession({ user: snapshot.user, token: res.token })
  return { ok: true, snapshot }
}

/**
 * Restaura la sesión guardada revalidándola contra el servidor (usuario, estado, suscripción).
 * Devuelve `null` (y limpia el almacenamiento) si ya no es válida.
 * Lanza únicamente ante errores de red para que la UI pueda avisar.
 */
export async function restoreSession(): Promise<AuthSnapshot | null> {
  const stored = loadSession()
  if (!stored) return null

  let res: AccessResponse
  try {
    res = await api.get<AccessResponse>("/session")
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      clearSession()
      return null
    }
    throw err
  }

  const snapshot = buildSnapshot(res)
  if (!snapshot) {
    clearSession()
    return null
  }
  return snapshot
}

export async function logout(): Promise<void> {
  try {
    await api.post("/logout")
  } catch {
    /* sin conexión o sesión ya caducada: igualmente se limpia el cliente */
  }
  setSessionToken(null)
  clearSession()
}
