import type { Banios, Dormitorios, Publicado } from "./filters"

/** Filtros del portal de clientes (forma exacta que se guarda en las búsquedas guardadas). */
export interface PortalFilterState {
  distrito: string
  operacion: "todos" | "ALQUILER" | "VENTA"
  inmueble: "todos" | "Departamento" | "Casa"
  portales: string[]
  moneda: "PEN" | "USD"
  precioMin: number | ""
  precioMax: number | ""
  dormitorios: Dormitorios
  banios: Banios
  areaMin: number | ""
  areaMax: number | ""
  publicado: Publicado
  /** Texto libre: se busca en el título y el distrito. */
  texto: string
}

export const DEFAULT_PORTAL_FILTERS: PortalFilterState = {
  distrito: "",
  operacion: "todos",
  inmueble: "todos",
  portales: [],
  moneda: "PEN",
  precioMin: "",
  precioMax: "",
  dormitorios: "todos",
  banios: "todos",
  areaMin: "",
  areaMax: "",
  publicado: "todos",
  texto: "",
}

const OPERACIONES = ["todos", "ALQUILER", "VENTA"] as const
const INMUEBLES = ["todos", "Departamento", "Casa"] as const
const DORMITORIOS = ["todos", "1", "2", "3", "4+"] as const
const BANIOS = ["todos", "1", "2", "3+"] as const
const PUBLICADOS = ["todos", "hoy", "semana", "mes"] as const

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

const price = (value: unknown): number | "" => {
  if (value === "" || value === null || value === undefined) return ""
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : ""
}

/**
 * Normaliza un objeto desconocido (p. ej. el cuerpo de una petición o un JSON guardado) a
 * `PortalFilterState`, descartando claves y valores no permitidos.
 */
export function sanitizeFilterState(raw: unknown): PortalFilterState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const portales = Array.isArray(r.portales)
    ? r.portales
        .filter((p): p is string => typeof p === "string")
        .map(p => p.trim().toLowerCase())
        .filter(p => p && p.length <= 40)
        .slice(0, 10)
    : []

  return {
    distrito: typeof r.distrito === "string" ? r.distrito.trim().slice(0, 80) : "",
    operacion: pick(r.operacion, OPERACIONES, "todos"),
    inmueble: pick(r.inmueble, INMUEBLES, "todos"),
    portales,
    moneda: r.moneda === "USD" ? "USD" : "PEN",
    precioMin: price(r.precioMin),
    precioMax: price(r.precioMax),
    dormitorios: pick(r.dormitorios, DORMITORIOS, "todos"),
    banios: pick(r.banios, BANIOS, "todos"),
    areaMin: price(r.areaMin),
    areaMax: price(r.areaMax),
    publicado: pick(r.publicado, PUBLICADOS, "todos"),
    texto: typeof r.texto === "string" ? r.texto.trim().slice(0, 80) : "",
  }
}
