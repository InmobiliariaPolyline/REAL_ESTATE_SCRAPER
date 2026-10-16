import { api } from "./api"
import { USD_TO_PEN_RATE } from "./config"
import type { FilterState, Propiedad } from "@/types"

export interface PropertyPage {
  data: Propiedad[]
  /** Total de avisos que cumplen los filtros (todas las páginas). */
  count: number
}

/**
 * Página del portal. El orden lo resuelve el servidor y es global y estable entre páginas:
 * primero los avisos con precio (más recientes antes) y al final los que no tienen precio.
 */
export function fetchPortalPage(
  filters: FilterState,
  page: number,
  pageSize: number
): Promise<PropertyPage> {
  return api.get<PropertyPage>("/propiedades", {
    page,
    pageSize,
    operacion: filters.operacion,
    inmueble: filters.inmueble,
    distrito: filters.distrito.trim(),
    portales: filters.portales.join(","),
    moneda: filters.moneda,
    precioMin: filters.precioMin,
    precioMax: filters.precioMax,
    dormitorios: filters.dormitorios,
  })
}

// ── Búsqueda del panel de administración ─────────────────────────────────────

export interface AdminSearchFilters {
  distrito: string
  operacion: string
  portal: string
  precioMin: string
  precioMax: string
  /** Moneda original del aviso; `null` no filtra por moneda (búsquedas guardadas). */
  moneda: "USD" | "PEN" | null
}

export const EMPTY_ADMIN_SEARCH: AdminSearchFilters = {
  distrito: "",
  operacion: "todos",
  portal: "todos",
  precioMin: "",
  precioMax: "",
  moneda: "USD",
}

/** Convierte el monto escrito (en la moneda del filtro) a USD normalizado. */
export function toUsd(value: string, moneda: "USD" | "PEN" | null): number | null {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return moneda === "PEN" ? Math.round(n / USD_TO_PEN_RATE) : n
}

export function fetchAdminPage(
  filters: AdminSearchFilters,
  page: number,
  pageSize: number
): Promise<PropertyPage> {
  return api.get<PropertyPage>("/admin/propiedades", {
    page,
    pageSize,
    distrito: filters.distrito.trim(),
    operacion: filters.operacion,
    portal: filters.portal,
    moneda: filters.moneda,
    minUsd: toUsd(filters.precioMin, filters.moneda),
    maxUsd: toUsd(filters.precioMax, filters.moneda),
  })
}
