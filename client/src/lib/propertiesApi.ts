import { api } from "./api"
import { USD_TO_PEN_RATE } from "./config"
import type { FilterState, Propiedad } from "@/types"

export interface PropertyPage {
  data: Propiedad[]
  /** Total de avisos que cumplen los filtros (todas las páginas). */
  count: number
}

export type Orden = "relevancia" | "recientes" | "precio_asc" | "precio_desc"

export const ORDEN_OPTIONS: { value: Orden; label: string }[] = [
  { value: "relevancia", label: "Relevancia" },
  { value: "recientes", label: "Más recientes" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
]

function portalParams(filters: FilterState, orden: Orden) {
  return {
    operacion: filters.operacion,
    inmueble: filters.inmueble,
    distrito: filters.distrito.trim(),
    portales: filters.portales.join(","),
    moneda: filters.moneda,
    precioMin: filters.precioMin,
    precioMax: filters.precioMax,
    dormitorios: filters.dormitorios,
    orden,
  }
}

/**
 * Página del portal. El orden lo resuelve el servidor y es global y estable entre páginas
 * (por defecto: avisos con precio primero y, al final, los que no tienen precio).
 */
export function fetchPortalPage(
  filters: FilterState,
  page: number,
  pageSize: number,
  orden: Orden = "relevancia"
): Promise<PropertyPage> {
  return api.get<PropertyPage>("/propiedades", { page, pageSize, ...portalParams(filters, orden) })
}

/** Descarga la búsqueda actual (hasta 5000 filas) como CSV. */
export async function exportPortalCsv(filters: FilterState, orden: Orden): Promise<void> {
  const { blob, filename } = await api.download("/propiedades/export", portalParams(filters, orden))
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Detalle e historial de precios ───────────────────────────────────────────

export interface PricePoint {
  registrado_en: string
  precio: number
  precio_usd: number
  moneda: string
}

export interface PropertyDetail {
  propiedad: Propiedad
  historial: PricePoint[]
}

export const fetchPropertyDetail = (id: string) =>
  api.get<PropertyDetail>(`/propiedades/${encodeURIComponent(id)}`)

// ── Favoritos y búsquedas guardadas del cliente ──────────────────────────────

export const fetchFavoritos = () =>
  api.get<{ ids: string[]; propiedades: Propiedad[] }>("/favoritos")

export const addFavorito = (propiedadId: string) =>
  api.post("/favoritos", { propiedad_id: propiedadId })

export const removeFavorito = (propiedadId: string) =>
  api.delete(`/favoritos/${encodeURIComponent(propiedadId)}`)

export interface SavedSearch {
  id: string
  nombre: string
  filtros: FilterState
  creado_en: string
}

export const listSavedSearches = () => api.get<SavedSearch[]>("/busquedas")

export const saveSearch = (nombre: string, filtros: FilterState) =>
  api.post<{ id: string }>("/busquedas", { nombre, filtros })

export const deleteSavedSearch = (id: string) => api.delete(`/busquedas/${encodeURIComponent(id)}`)

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
