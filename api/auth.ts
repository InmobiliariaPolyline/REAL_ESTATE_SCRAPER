import type { Db } from "./db"

/** public: sin sesión · user: cualquier sesión · member: admin o suscriptor vigente · admin: solo admin. */
export type AuthLevel = "public" | "user" | "member" | "admin"

export interface Access {
  token: string
  usuario: { id: number; usuario: string; rol: string; estado: string }
  suscripcion: {
    id: number
    usuario_id: number
    fecha_inicio: string
    fecha_vencimiento: string
    fecha_limite_eliminacion: string
  } | null
  tuvo_suscripcion: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match && UUID.test(match[1]) ? match[1] : null
}

/** Valida el token contra la base (vigente, cuenta activa). `null` si no es válido. */
export async function authenticate(db: Db, req: Request): Promise<Access | null> {
  const token = bearerToken(req)
  if (!token) return null

  const rows = await db.query<{ r: Omit<Access, "token"> & { ok: boolean } }>(
    "select public.validar_sesion($1::uuid) as r",
    [token]
  )
  const result = rows[0]?.r
  if (!result?.ok) return null
  return {
    token,
    usuario: result.usuario,
    suscripcion: result.suscripcion ?? null,
    tuvo_suscripcion: !!result.tuvo_suscripcion,
  }
}
