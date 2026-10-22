import { api } from "./api"

export interface CargaConfig {
  pausada: boolean
  tope_mensual: number
  maximo_por_corrida: number
}

export interface Corrida {
  id: number
  estado: "iniciada" | "completada" | "fallida"
  origen: "manual" | "programada"
  iniciada_por: string | null
  avisos_pedidos: number
  avisos_recibidos: number | null
  avisos_guardados: number | null
  detalle: string | null
  iniciada_en: string
  finalizada_en: string | null
}

export interface EstadoCarga {
  /** Hay token, secreto y dirección pública en el servidor. */
  configurada: boolean
  config: CargaConfig
  usado: number
  restante: number
  limites: { tope_mensual: number; maximo_por_corrida: number }
  corridas: Corrida[]
}

/** Costo aproximado por 1 000 avisos del actor (solo para mostrar estimaciones). */
export const COSTO_POR_MIL_USD = 3

/** Cupo gratuito mensual de Apify (US$), según su plan gratuito. */
export const CUPO_GRATIS_USD = 5

export const costoEstimadoUsd = (avisos: number) => (avisos * COSTO_POR_MIL_USD) / 1000

/** Avisos que caben en el cupo gratuito mensual al costo estimado. */
export const avisosEnCupoGratis = () => Math.floor((CUPO_GRATIS_USD / COSTO_POR_MIL_USD) * 1000)

export const fetchCarga = () => api.get<EstadoCarga>("/admin/carga")
export const saveCarga = (cambios: Partial<CargaConfig>) => api.put<CargaConfig>("/admin/carga", cambios)
export const runCarga = () => api.post<{ ok: true; items: number }>("/admin/carga/ejecutar")
