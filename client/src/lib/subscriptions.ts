import { GRACE_DAYS, PREMIUM_DAYS } from "./config"
import { addDaysISO, todayISO } from "./dates"
import { isMissingRpc, warnLegacyMode } from "./rpc"
import { supabase } from "./supabase"
import type { Suscripcion } from "@/types"

const SUB_COLUMNS =
  "id, usuario_id, fecha_inicio, fecha_vencimiento, fecha_limite_eliminacion"

/**
 * Suscripción vigente del usuario: la de mayor `fecha_vencimiento` que aún no venció.
 * Usa `limit(1)` + `maybeSingle()` para no fallar cuando existen varias filas
 * (renovaciones históricas). Lanza si la consulta falla, para no confundir un error de red
 * con una suscripción vencida.
 */
export async function fetchActiveSubscription(
  usuarioId: number
): Promise<Suscripcion | null> {
  const { data, error } = await supabase
    .from("suscripciones")
    .select(SUB_COLUMNS)
    .eq("usuario_id", usuarioId)
    .gte("fecha_vencimiento", todayISO())
    .order("fecha_vencimiento", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as Suscripcion | null) ?? null
}

/** true si el usuario tuvo alguna suscripción alguna vez (para distinguir "vencida" de "sin plan"). */
export async function hasAnySubscription(usuarioId: number): Promise<boolean> {
  const { count, error } = await supabase
    .from("suscripciones")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)

  if (error) throw error
  return (count ?? 0) > 0
}

/**
 * Activa o renueva Premium. Si ya hay suscripción vigente, extiende desde su vencimiento
 * (no pierde días); si no, cuenta desde hoy. Reutiliza la fila existente en vez de apilar
 * nuevas filas.
 */
export async function activatePremium(
  usuarioId: number,
  dias: number = PREMIUM_DAYS
): Promise<void> {
  const { error: rpcError } = await supabase.rpc("activar_premium", {
    p_usuario_id: usuarioId,
    p_dias: dias,
  })
  if (!rpcError) return
  if (!isMissingRpc(rpcError)) throw rpcError

  warnLegacyMode()
  const hoy = todayISO()

  const { data: latest, error: fetchError } = await supabase
    .from("suscripciones")
    .select(SUB_COLUMNS)
    .eq("usuario_id", usuarioId)
    .order("fecha_vencimiento", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (fetchError) throw fetchError

  const current = latest as Suscripcion | null
  const stillValid = !!current && current.fecha_vencimiento >= hoy
  const base = stillValid ? current!.fecha_vencimiento : hoy
  const vence = addDaysISO(base, dias)
  const limite = addDaysISO(vence, GRACE_DAYS)

  if (current?.id !== undefined) {
    const { error } = await supabase
      .from("suscripciones")
      .update({
        ...(stillValid ? {} : { fecha_inicio: hoy }),
        fecha_vencimiento: vence,
        fecha_limite_eliminacion: limite,
      })
      .eq("id", current.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from("suscripciones").insert({
    usuario_id: usuarioId,
    fecha_inicio: hoy,
    fecha_vencimiento: vence,
    fecha_limite_eliminacion: limite,
  })
  if (error) throw error
}
