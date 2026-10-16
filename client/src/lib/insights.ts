import { api } from "./api"
import type { PortalFilterState } from "@shared/savedSearch"
import type { Propiedad } from "@/types"

export interface Bajada extends Propiedad {
  precio_anterior_usd: number
  /** Porcentaje que bajó el precio (por ejemplo 10 = -10 %). */
  baja_pct: number
  bajo_en: string
}

export interface BusquedaConNuevos {
  id: string
  nombre: string
  filtros: PortalFilterState
  nuevos: number
}

export interface Inicio {
  hoy: number
  ultimas24h: number
  nuevosDias: number
  recientes: Propiedad[]
  bajadas: Bajada[]
  busquedas: BusquedaConNuevos[]
}

export interface EstadisticaDistrito {
  distrito: string
  operacion: "VENTA" | "ALQUILER"
  avisos: number
  precioMediano: number
  precioM2Mediano: number | null
}

export interface Estadisticas {
  distritos: EstadisticaDistrito[]
  resumen: { operacion: "VENTA" | "ALQUILER"; avisos: number; precioM2Mediano: number | null }[]
}

export interface PorVencer {
  id: number
  usuario: string
  fecha_vencimiento: string
  /** Días hasta el vencimiento (negativo = ya venció). */
  dias: number
}

export const fetchInicio = () => api.get<Inicio>("/inicio")
export const fetchEstadisticas = () => api.get<Estadisticas>("/estadisticas")

/** Mensaje de WhatsApp para recordar la renovación a un cliente. */
export function mensajeRenovacion(usuario: string, fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split("-")
  const fecha = `${d}/${m}/${y}`
  const cuando =
    dias < 0 ? `venció el ${fecha}` : dias === 0 ? `vence hoy (${fecha})` : `vence el ${fecha}`
  return `Hola ${usuario}, tu suscripción a Real Estate Scraper ${cuando}. ¿Quieres renovarla para seguir con acceso al catálogo?`
}

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
