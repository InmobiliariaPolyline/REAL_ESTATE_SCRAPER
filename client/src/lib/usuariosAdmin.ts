import { isMissingRpc, warnLegacyMode } from "./rpc"
import { todayISO } from "./dates"
import { activatePremium } from "./subscriptions"
import { supabase } from "./supabase"
import type { EstadoUsuario, Rol, Suscripcion } from "@/types"

export interface UsuarioRow {
  id: number
  usuario: string
  rol: string
  estado: string
  creado_en: string
  ultima_conexion: string | null
  /** Suscripción vigente (la de mayor vencimiento que no ha vencido). */
  suscripcionActiva: Suscripcion | null
}

export interface NewUsuarioInput {
  usuario: string
  password: string
  rol: Rol
  estado: EstadoUsuario
  premium: boolean
}

export const MIN_PASSWORD_LENGTH = 8

const PAGE = 1000

/** Descarga todas las filas paginando de a PAGE (el servidor limita cada respuesta). */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

export async function listUsuarios(): Promise<UsuarioRow[]> {
  const users = await fetchAll<Omit<UsuarioRow, "suscripcionActiva">>(
    (from, to) =>
      supabase
        .from("usuarios")
        .select("id, usuario, rol, estado, creado_en, ultima_conexion")
        .order("creado_en", { ascending: false })
        .range(from, to)
  )
  if (users.length === 0) return []

  // Dos consultas separadas (en vez de un join) para no depender de relaciones/RLS cruzadas.
  const subs = await fetchAll<Suscripcion & { usuario_id: number }>(
    (from, to) =>
      supabase
        .from("suscripciones")
        .select(
          "id, usuario_id, fecha_inicio, fecha_vencimiento, fecha_limite_eliminacion"
        )
        .gte("fecha_vencimiento", todayISO())
        .order("fecha_vencimiento", { ascending: false })
        .range(from, to)
  )

  // Ordenadas de mayor a menor vencimiento: la primera por usuario es la vigente.
  const byUser = new Map<number, Suscripcion>()
  for (const sub of subs) {
    if (!byUser.has(sub.usuario_id)) byUser.set(sub.usuario_id, sub)
  }

  return users.map(u => ({ ...u, suscripcionActiva: byUser.get(u.id) ?? null }))
}

export type CreateUsuarioError = "duplicado" | "desconocido"

export class UsuarioAdminError extends Error {
  constructor(
    public code: CreateUsuarioError,
    message: string
  ) {
    super(message)
  }
}

export async function createUsuario(input: NewUsuarioInput): Promise<void> {
  const { error: rpcError } = await supabase.rpc("crear_usuario", {
    p_usuario: input.usuario,
    p_password: input.password,
    p_rol: input.rol,
    p_estado: input.estado,
    p_premium: input.premium,
  })

  if (!rpcError) return
  if (!isMissingRpc(rpcError)) {
    if (/usuario_duplicado|duplicate key|23505/i.test(`${rpcError.message} ${rpcError.code}`)) {
      throw new UsuarioAdminError("duplicado", "Ese nombre de usuario ya existe")
    }
    throw rpcError
  }

  // Modo legado: inserción directa (la contraseña queda en texto plano hasta aplicar la migración).
  warnLegacyMode()
  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      usuario: input.usuario,
      password_hash: input.password,
      rol: input.rol,
      estado: input.estado,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new UsuarioAdminError("duplicado", "Ese nombre de usuario ya existe")
    }
    throw error
  }

  if (input.premium && data?.id !== undefined) {
    await activatePremium(data.id)
  }
}

export async function setUsuarioEstado(
  id: number,
  estado: EstadoUsuario
): Promise<void> {
  const { error } = await supabase.from("usuarios").update({ estado }).eq("id", id)
  if (error) throw error
}
