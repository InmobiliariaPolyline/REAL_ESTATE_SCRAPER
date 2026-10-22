import { DEFAULT_PORTAL_FILTERS, type PortalFilterState } from "@shared/savedSearch"

export type Vista = "login" | "admin" | "portal" | "vencido"

export type Rol = "admin" | "usuario"
export type EstadoUsuario = "activo" | "baneado"

/** Datos mínimos del usuario autenticado que viven en el cliente (nunca la contraseña). */
export interface SessionUser {
  id: number
  usuario: string
  rol: string
}

export interface Suscripcion {
  id?: number
  usuario_id?: number
  fecha_inicio?: string
  fecha_vencimiento: string
  fecha_limite_eliminacion: string
}

/** Fila de la tabla `propiedades` (columnas usadas por la interfaz). */
export interface Propiedad {
  id: string
  portal: string
  operacion: string
  inmueble?: string
  titulo: string
  precio: number
  precio_usd: number
  moneda: string
  distrito: string
  dormitorios: string
  banios: string
  area: string
  imagen: string | null
  /** Todas las fotos del aviso (solo en el detalle). */
  imagenes?: string[]
  url: string
  creado_en?: string
}

export type FilterState = PortalFilterState
export const DEFAULT_FILTERS: FilterState = DEFAULT_PORTAL_FILTERS

export type PlanType = "PREMIUM" | "GRATIS"
