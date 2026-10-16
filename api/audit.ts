import type { Access } from "./auth"
import type { Db } from "./db"

/** IP del cliente según las cabeceras de la plataforma (Netlify o proxy inverso). */
export function clientIp(req: Request): string | null {
  const h = req.headers
  const raw =
    h.get("x-nf-client-connection-ip") ||
    h.get("x-forwarded-for")?.split(",")[0] ||
    h.get("x-real-ip")
  return raw ? raw.trim().slice(0, 64) : null
}

export function userAgentOf(req: Request): string | null {
  const ua = req.headers.get("user-agent")
  return ua ? ua.slice(0, 300) : null
}

export type AuditAction =
  | "usuario.crear"
  | "usuario.estado"
  | "usuario.premium"
  | "usuario.password_reset"
  | "usuario.cerrar_sesiones"
  | "propiedad.eliminar"
  | "limpieza.ejecutar"
  | "scraper.lanzar"
  | "cuenta.password_cambio"
  | "cuenta.sesiones_cerradas"

/** Acciones auditadas (el panel las usa para el filtro). */
export const AUDIT_ACTIONS: AuditAction[] = [
  "usuario.crear",
  "usuario.estado",
  "usuario.premium",
  "usuario.password_reset",
  "usuario.cerrar_sesiones",
  "propiedad.eliminar",
  "limpieza.ejecutar",
  "scraper.lanzar",
  "cuenta.password_cambio",
  "cuenta.sesiones_cerradas",
]

interface AuditContext {
  db: Db
  req: Request
  access: Access
}

/**
 * Registra una acción en `auditoria`. Es "best effort": si falla (p. ej. la migración 005 aún
 * no está aplicada) se registra el error en el servidor pero la acción del usuario no se
 * interrumpe. Nunca debe recibir contraseñas ni tokens en `detalle`.
 */
export async function audit(
  ctx: AuditContext,
  accion: AuditAction,
  objetivo?: string | null,
  detalle?: Record<string, unknown>
): Promise<void> {
  try {
    await ctx.db.query(
      `insert into public.auditoria (usuario_id, usuario, accion, objetivo, detalle, ip)
       values ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        ctx.access.usuario.id,
        ctx.access.usuario.usuario,
        accion,
        objetivo ?? null,
        detalle ? JSON.stringify(detalle) : null,
        clientIp(ctx.req),
      ]
    )
  } catch (err) {
    console.error("No se pudo registrar la auditoría:", err)
  }
}
