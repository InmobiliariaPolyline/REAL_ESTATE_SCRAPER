import { api } from "./api"

export interface SuscripcionPerfil {
  fecha_inicio: string
  fecha_vencimiento: string
  /** Días hasta el vencimiento (negativo = ya venció). */
  dias_restantes: number
  dias_totales: number
}

export interface Perfil {
  usuario: string
  rol: "admin" | "usuario"
  estado: string
  creado_en: string
  accesos_30d: number
  accesos_total: number
  acceso_anterior: string | null
  sesiones_activas: number
  favoritos: number
  busquedas: number
  suscripcion: SuscripcionPerfil | null
}

export interface EstadoApi {
  ok: boolean
  /** Milisegundos que tardó la respuesta. */
  ms: number
  mensaje: string
}

export const fetchProfile = () => api.get<Perfil>("/account/profile")

/** Comprueba la API y la base de datos con /api/health y mide el tiempo de respuesta. */
export async function comprobarApi(): Promise<EstadoApi> {
  const inicio = performance.now()
  try {
    await api.get("/health")
    return { ok: true, ms: Math.round(performance.now() - inicio), mensaje: "API y base de datos responden con normalidad" }
  } catch (err) {
    const mensaje = err instanceof Error && err.message ? err.message : "No se pudo contactar con el servidor"
    return { ok: false, ms: Math.round(performance.now() - inicio), mensaje }
  }
}

/** Fracción de la suscripción que ya transcurrió (para el anillo: 1 = recién activada). */
export function fraccionRestante(s: SuscripcionPerfil): number {
  if (s.dias_totales <= 0) return 0
  return Math.min(1, Math.max(0, s.dias_restantes / s.dias_totales))
}
