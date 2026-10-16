import { LOGIN_LOCK_MS, LOGIN_MAX_ATTEMPTS } from "./config"
import { isMissingRpc, warnLegacyMode } from "./rpc"
import {
  clearSession,
  loadSession,
  saveSession,
  setSessionToken,
} from "./sessionStore"
import { fetchActiveSubscription, hasAnySubscription } from "./subscriptions"
import { supabase } from "./supabase"
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
  | { ok: false; reason: LoginFailure; retryInSeconds?: number }

interface ServerAccess {
  ok: boolean
  error?: "invalid" | "baneado" | "bloqueado"
  token?: string
  usuario?: SessionUser & { estado?: string }
  suscripcion?: Suscripcion | null
  tuvo_suscripcion?: boolean
}

// ── Bloqueo temporal en el cliente (defensa adicional; el límite real vive en el servidor) ──

const GUARD_KEY = "inmoda_login_guard"

interface LoginGuard {
  fails: number
  lockedUntil: number
}

function readGuard(): LoginGuard {
  try {
    const raw = localStorage.getItem(GUARD_KEY)
    if (raw) {
      const g = JSON.parse(raw) as Partial<LoginGuard>
      return { fails: g.fails ?? 0, lockedUntil: g.lockedUntil ?? 0 }
    }
  } catch {
    /* ignorar */
  }
  return { fails: 0, lockedUntil: 0 }
}

function writeGuard(guard: LoginGuard): void {
  try {
    localStorage.setItem(GUARD_KEY, JSON.stringify(guard))
  } catch {
    /* ignorar */
  }
}

function registerFailure(): void {
  const guard = readGuard()
  const fails = guard.fails + 1
  writeGuard(
    fails >= LOGIN_MAX_ATTEMPTS
      ? { fails: 0, lockedUntil: Date.now() + LOGIN_LOCK_MS }
      : { fails, lockedUntil: guard.lockedUntil }
  )
}

// ── Resolución de acceso ──

/** Decide la pantalla según rol y suscripción. Rol desconocido => null. */
function buildSnapshot(
  user: SessionUser,
  suscripcion: Suscripcion | null,
  tuvoSuscripcion: boolean
): AuthSnapshot | null {
  if (user.rol === "admin") {
    return { user, vista: "admin", suscripcion: null }
  }
  if (user.rol === "usuario") {
    if (suscripcion) return { user, vista: "portal", suscripcion }
    return {
      user,
      vista: "vencido",
      suscripcion: null,
      vencidoMotivo: tuvoSuscripcion ? "vencida" : "sin_suscripcion",
    }
  }
  return null
}

async function snapshotFromLegacy(user: SessionUser): Promise<AuthSnapshot | null> {
  if (user.rol !== "usuario") return buildSnapshot(user, null, false)
  const suscripcion = await fetchActiveSubscription(user.id)
  const tuvo = suscripcion ? true : await hasAnySubscription(user.id)
  return buildSnapshot(user, suscripcion, tuvo)
}

// ── Login ──

async function loginViaRpc(
  usuario: string,
  password: string
): Promise<LoginOutcome | "missing"> {
  const { data, error } = await supabase.rpc("login_usuario", {
    p_usuario: usuario,
    p_password: password,
  })

  if (error) {
    if (isMissingRpc(error)) return "missing"
    console.error("Error en login_usuario:", error)
    return { ok: false, reason: "network" }
  }

  const res = data as ServerAccess | null
  if (!res || !res.ok || !res.usuario) {
    if (res?.error === "baneado") return { ok: false, reason: "banned" }
    if (res?.error === "bloqueado") return { ok: false, reason: "locked" }
    registerFailure()
    return { ok: false, reason: "invalid" }
  }

  const user: SessionUser = {
    id: res.usuario.id,
    usuario: res.usuario.usuario,
    rol: res.usuario.rol,
  }
  const snapshot = buildSnapshot(
    user,
    res.suscripcion ?? null,
    !!res.tuvo_suscripcion
  )
  if (!snapshot) {
    return { ok: false, reason: "unknown_role" }
  }

  saveSession({ user, token: res.token ?? null })
  return { ok: true, snapshot }
}

async function loginLegacy(
  usuario: string,
  password: string
): Promise<LoginOutcome> {
  warnLegacyMode()

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, usuario, rol, estado")
    .eq("usuario", usuario)
    .eq("password_hash", password)
    .maybeSingle()

  if (error) {
    console.error("Error consultando usuarios:", error)
    return { ok: false, reason: "network" }
  }
  if (!data) {
    registerFailure()
    return { ok: false, reason: "invalid" }
  }
  if (data.estado === "baneado") return { ok: false, reason: "banned" }

  // Registro de acceso: no bloquea el login si falla.
  const [accesoRes, conexionRes] = await Promise.all([
    supabase.from("historial_accesos").insert({ usuario_id: data.id }),
    supabase
      .from("usuarios")
      .update({ ultima_conexion: new Date().toISOString() })
      .eq("id", data.id),
  ])
  if (accesoRes.error) console.warn("No se registró el acceso:", accesoRes.error)
  if (conexionRes.error)
    console.warn("No se actualizó la última conexión:", conexionRes.error)

  const user: SessionUser = { id: data.id, usuario: data.usuario, rol: data.rol }
  try {
    const snapshot = await snapshotFromLegacy(user)
    if (!snapshot) return { ok: false, reason: "unknown_role" }
    saveSession({ user, token: null })
    return { ok: true, snapshot }
  } catch (err) {
    console.error("Error verificando suscripción:", err)
    return { ok: false, reason: "network" }
  }
}

export async function login(
  usuarioRaw: string,
  password: string
): Promise<LoginOutcome> {
  const guard = readGuard()
  if (guard.lockedUntil > Date.now()) {
    return {
      ok: false,
      reason: "locked",
      retryInSeconds: Math.ceil((guard.lockedUntil - Date.now()) / 1000),
    }
  }

  const usuario = usuarioRaw.trim()
  if (!usuario || !password) return { ok: false, reason: "invalid" }

  const viaRpc = await loginViaRpc(usuario, password)
  const outcome = viaRpc === "missing" ? await loginLegacy(usuario, password) : viaRpc

  if (outcome.ok) writeGuard({ fails: 0, lockedUntil: 0 })
  return outcome
}

// ── Restauración de sesión (revalida contra el servidor) ──

/**
 * Restaura la sesión guardada revalidando usuario, estado y suscripción.
 * Devuelve `null` (y limpia el almacenamiento) si ya no es válida.
 * Lanza únicamente ante errores de red para que la UI pueda reintentar.
 */
export async function restoreSession(): Promise<AuthSnapshot | null> {
  const stored = loadSession()
  if (!stored) return null

  if (stored.token) {
    const { data, error } = await supabase.rpc("validar_sesion")
    if (error) {
      if (isMissingRpc(error)) {
        clearSession()
        return null
      }
      throw error
    }
    const res = data as ServerAccess | null
    if (!res || !res.ok || !res.usuario) {
      clearSession()
      return null
    }
    const user: SessionUser = {
      id: res.usuario.id,
      usuario: res.usuario.usuario,
      rol: res.usuario.rol,
    }
    const snapshot = buildSnapshot(
      user,
      res.suscripcion ?? null,
      !!res.tuvo_suscripcion
    )
    if (!snapshot) {
      clearSession()
      return null
    }
    return snapshot
  }

  // Modo legado: no hay token, se revalida por id (rol y estado vigentes en la base).
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, usuario, rol, estado")
    .eq("id", stored.user.id)
    .maybeSingle()
  if (error) throw error
  if (!data || data.estado === "baneado") {
    clearSession()
    return null
  }
  const snapshot = await snapshotFromLegacy({
    id: data.id,
    usuario: data.usuario,
    rol: data.rol,
  })
  if (!snapshot) {
    clearSession()
    return null
  }
  return snapshot
}

export async function logout(): Promise<void> {
  try {
    await supabase.rpc("cerrar_sesion")
  } catch {
    /* sin conexión o RPC inexistente: igualmente se limpia el cliente */
  }
  setSessionToken(null)
  clearSession()
}
