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
  url: string
  creado_en?: string
}

export interface FilterState {
  distrito: string
  operacion: "todos" | "ALQUILER" | "VENTA"
  inmueble: "todos" | "Departamento" | "Casa"
  portales: string[]
  moneda: "PEN" | "USD"
  precioMin: number | ""
  precioMax: number | ""
  dormitorios: "todos" | "1" | "2" | "3" | "4+"
}

export const DEFAULT_FILTERS: FilterState = {
  distrito: "",
  operacion: "todos",
  inmueble: "todos",
  portales: [],
  moneda: "PEN",
  precioMin: "",
  precioMax: "",
  dormitorios: "todos",
}

export type PlanType = "PREMIUM" | "GRATIS"
