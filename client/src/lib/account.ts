import { api } from "./api"

export interface SessionInfo {
  id: number
  created_at: string
  ultimo_uso: string
  user_agent: string | null
  ip: string | null
  /** true para la sesión desde la que se consulta. */
  actual: boolean
}

export const listSessions = () => api.get<SessionInfo[]>("/account/sessions")
export const revokeSession = (id: number) => api.delete(`/account/sessions/${id}`)
export const revokeOtherSessions = () =>
  api.post<{ ok: boolean; cerradas: number }>("/account/sessions/revoke-others")

/** El administrador cierra todas las sesiones de un usuario. */
export const closeUserSessions = (usuarioId: number) =>
  api.post<{ ok: boolean; cerradas: number }>(`/admin/usuarios/${usuarioId}/cerrar-sesiones`)

export interface AuditEntry {
  id: number
  usuario_id: number | null
  usuario: string
  accion: string
  objetivo: string | null
  detalle: Record<string, unknown> | null
  ip: string | null
  creado_en: string
}

export interface AuditPage {
  data: AuditEntry[]
  count: number
  acciones: string[]
}

export const fetchAudit = (params: { page: number; pageSize: number; accion?: string; usuario?: string }) =>
  api.get<AuditPage>("/admin/auditoria", params)

/** Texto legible de cada acción auditada. */
export const AUDIT_LABELS: Record<string, string> = {
  "usuario.crear": "Usuario creado",
  "usuario.estado": "Estado de usuario cambiado",
  "usuario.premium": "Premium activado o renovado",
  "usuario.password_reset": "Contraseña restablecida",
  "usuario.cerrar_sesiones": "Sesiones de usuario cerradas",
  "propiedad.eliminar": "Propiedad eliminada",
  "limpieza.ejecutar": "Limpieza de inactivos",
  "scraper.lanzar": "Scraper lanzado",
  "cuenta.password_cambio": "Contraseña propia cambiada",
  "cuenta.sesiones_cerradas": "Sesiones propias cerradas",
  "carga.iniciar": "Carga de datos iniciada",
  "carga.config": "Carga de datos configurada",
}

/** "Chrome en Windows" a partir de un User-Agent (aproximado, solo informativo). */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido"
  const ua = userAgent
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador"
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "sistema desconocido"
  return `${browser} en ${os}`
}

/** "hace 5 min", "hace 3 h", "hace 2 días". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return "ahora mismo"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} ${d === 1 ? "día" : "días"}`
}
