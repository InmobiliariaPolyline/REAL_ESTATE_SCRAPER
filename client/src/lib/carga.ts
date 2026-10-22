import { api } from "./api"

export interface CargaConfig {
  pausada: boolean
  tope_mensual: number
  maximo_por_corrida: number
  /** Día del mes (1 a 28) en que se reinicia el crédito de Apify. */
  dia_reinicio: number
  /** Tope propio de Urbania (avisos por ciclo). */
  tope_urbania?: number
}

export type FuenteId = "adondevivir" | "urbania"

/** Uso y tope de una fuente de avisos en el ciclo actual. */
export interface FuenteCarga {
  id: FuenteId
  nombre: string
  usado: number
  tope: number
  tope_maximo: number
  maximo_por_corrida: number
  restante: number
}

export interface Corrida {
  id: number
  fuente?: FuenteId
  estado: "iniciada" | "completada" | "fallida"
  origen: "manual" | "programada"
  iniciada_por: string | null
  /** Actor de Apify que hizo la corrida (`usuario~nombre`); null en corridas anteriores a esta columna. */
  actor?: string | null
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
  /** Una entrada por fuente (Adondevivir, Urbania). */
  fuentes?: FuenteCarga[]
  /** Ciclo de uso actual (fechas AAAA-MM-DD): desde el último reinicio hasta el próximo. */
  ventana: { desde: string; reinicia: string }
  /** De dónde salen ciclo, crédito y gasto: la cuenta de Apify (automático) o una estimación de respaldo. */
  origen_datos: "apify" | "estimado"
  credito: { usd: number; costo_por_mil: number; gasto_usd: number }
  limites: { tope_mensual: number; maximo_por_corrida: number; dia_reinicio: [number, number] }
  corridas: Corrida[]
}

/** Costo estimado en US$ de `avisos` avisos al costo por 1 000 dado. */
export const costoEstimadoUsd = (avisos: number, costoPorMil: number) => (avisos * costoPorMil) / 1000

export const fetchCarga = () => api.get<EstadoCarga>("/admin/carga")
export const saveCarga = (cambios: Partial<CargaConfig>) => api.put<CargaConfig>("/admin/carga", cambios)
export const runCarga = (fuente?: FuenteId) =>
  api.post<{ ok: true; items: number; fuente?: FuenteId }>("/admin/carga/ejecutar", fuente ? { fuente } : undefined)
