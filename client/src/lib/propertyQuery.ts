import { USD_TO_PEN_RATE } from "./config"
import { supabase } from "./supabase"
import type { FilterState, Propiedad } from "@/types"

/** Escapa los metacaracteres de una expresión regular POSIX. */
export function escapeRegex(value: string): string {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
}

/** Escapa `%` y `_` (comodines de LIKE) para búsquedas literales con ilike. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}

/** Patrón que ignora tildes: "san martin" encuentra "San Martín". */
export function accentInsensitivePattern(value: string): string {
  return escapeRegex(value)
    .replace(/[aáÁ]/gi, "[aáÁ]")
    .replace(/[eéÉ]/gi, "[eéÉ]")
    .replace(/[iíÍ]/gi, "[iíÍ]")
    .replace(/[oóÓ]/gi, "[oóÓ]")
    .replace(/[uúÚüÜ]/gi, "[uúÚüÜ]")
}

/** Patrón de dormitorios: "2" no coincide con "12", y "4+" cubre 4 o más. */
export function bedroomsPattern(value: FilterState["dormitorios"]): string | null {
  if (value === "todos") return null
  if (value === "4+") return "(^|\\D)([4-9]|[1-9][0-9]+)(\\D|$)"
  return `(^|\\D)${value}(\\D|$)`
}

const toNumber = (value: number | ""): number | null => {
  if (value === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** true si el filtro de precio tiene algún límite activo. */
export function hasPriceRange(f: FilterState): boolean {
  const min = toNumber(f.precioMin)
  const max = toNumber(f.precioMax)
  return (min !== null && min > 0) || max !== null
}

/**
 * Condición `or()` de PostgREST para el rango de precios.
 * Un aviso entra si su precio nativo cae en el rango o, cuando solo tiene el precio en la
 * otra moneda, si esa cifra convertida cae en el rango.
 */
export function priceRangeOr(f: FilterState): string | null {
  const min = toNumber(f.precioMin) ?? 0
  const max = toNumber(f.precioMax)
  if (!(min > 0) && max === null) return null

  const native = f.moneda === "USD" ? "precio_usd" : "precio"
  const other = f.moneda === "USD" ? "precio" : "precio_usd"
  // Factor para convertir el rango pedido a la moneda de la columna "other".
  const factor = f.moneda === "USD" ? USD_TO_PEN_RATE : 1 / USD_TO_PEN_RATE

  const range = (column: string, scale: number) => {
    const parts: string[] = []
    if (min > 0) parts.push(`${column}.gte.${min * scale}`)
    if (max !== null) parts.push(`${column}.lte.${max * scale}`)
    return parts.join(",")
  }

  const otherCond = `${other}.gt.0,${range(other, factor)}`
  return [
    `and(${native}.gt.0,${range(native, 1)})`,
    `and(${native}.eq.0,${otherCond})`,
    `and(${native}.is.null,${otherCond})`,
  ].join(",")
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type PriceGroup = "priced" | "unpriced"

// Condiciones `or()` de PostgREST (cada una en un único parámetro).
const PRICED = "precio.gt.0,precio_usd.gt.0"
// precio nulo/0 Y precio_usd nulo/0, expresado sin `and()` externo.
const UNPRICED = [
  "and(precio.is.null,precio_usd.is.null)",
  "and(precio.is.null,precio_usd.eq.0)",
  "and(precio.eq.0,precio_usd.is.null)",
  "and(precio.eq.0,precio_usd.eq.0)",
].join(",")

/**
 * Aplica los filtros del portal a cualquier builder de `propiedades`.
 * - "priced": avisos con precio. Si hay rango de precio, las ramas de `priceRangeOr` ya
 *   exigen precio > 0 en alguna moneda, así que reemplaza a PRICED.
 * - "unpriced": avisos sin precio en ninguna moneda.
 */
function applyPortalFilters<Q>(query: Q, f: FilterState, group: PriceGroup): Q {
  let q: any = query

  if (f.operacion.toLowerCase() !== "todos") q = q.ilike("operacion", f.operacion)
  if (f.inmueble.toLowerCase() !== "todos") q = q.ilike("inmueble", f.inmueble)

  const distrito = f.distrito.trim()
  if (distrito) q = q.filter("distrito", "imatch", accentInsensitivePattern(distrito))

  const portales = f.portales
    .filter(p => p && p.toLowerCase() !== "todos")
    .map(p => p.toLowerCase())
  if (portales.length > 0) q = q.in("portal", portales)

  const range = priceRangeOr(f)
  q = q.or(group === "unpriced" ? UNPRICED : (range ?? PRICED))

  const dorm = bedroomsPattern(f.dormitorios)
  if (dorm) q = q.filter("dormitorios", "imatch", dorm)

  return q as Q
}


const orderStable = <Q,>(query: Q): Q =>
  (query as any)
    .order("creado_en", { ascending: false })
    .order("id", { ascending: false })

export interface PropertyPage {
  data: Propiedad[]
  /** Total de avisos que cumplen los filtros (todas las páginas). */
  count: number
}

/**
 * Página del portal. El orden es global y estable entre páginas:
 * primero los avisos con precio (más recientes primero) y al final los que no tienen precio.
 * Se resuelve en el servidor con dos grupos para que la paginación sea consistente.
 */
export async function fetchPortalPage(
  filters: FilterState,
  page: number,
  pageSize: number
): Promise<PropertyPage> {
  const base = () => supabase.from("propiedades")

  const pricedCountQ = applyPortalFilters(
    base().select("id", { count: "exact", head: true }),
    filters,
    "priced"
  )
  // Con un rango de precio activo, los avisos sin precio nunca coinciden.
  const includeUnpriced = !hasPriceRange(filters)
  const unpricedCountQ = includeUnpriced
    ? applyPortalFilters(
        base().select("id", { count: "exact", head: true }),
        filters,
        "unpriced"
      )
    : null

  const [pricedRes, unpricedRes] = await Promise.all([
    pricedCountQ,
    unpricedCountQ ?? Promise.resolve({ count: 0, error: null }),
  ])
  if (pricedRes.error) throw pricedRes.error
  if (unpricedRes.error) throw unpricedRes.error

  const pricedCount = pricedRes.count ?? 0
  const unpricedCount = unpricedRes.count ?? 0

  const start = page * pageSize
  const end = start + pageSize // exclusivo
  const rows: Propiedad[] = []

  if (start < pricedCount) {
    const last = Math.min(end, pricedCount) - 1
    const { data, error } = await orderStable(
      applyPortalFilters(base().select("*"), filters, "priced")
    ).range(start, last)
    if (error) throw error
    rows.push(...((data as Propiedad[] | null) ?? []))
  }

  const missing = pageSize - rows.length
  if (missing > 0 && includeUnpriced && unpricedCount > 0) {
    const offset = Math.max(0, start - pricedCount)
    if (offset < unpricedCount) {
      const { data, error } = await orderStable(
        applyPortalFilters(base().select("*"), filters, "unpriced")
      ).range(offset, offset + missing - 1)
      if (error) throw error
      rows.push(...((data as Propiedad[] | null) ?? []))
    }
  }

  return { data: rows, count: pricedCount + unpricedCount }
}

// ── Búsqueda del panel de administración ──

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

export const PROPERTY_COLUMNS =
  "id, portal, operacion, titulo, precio, precio_usd, moneda, distrito, dormitorios, banios, area, imagen, url"

/** Convierte el monto escrito (en la moneda del filtro) a USD normalizado. */
export function toUsd(value: string, moneda: "USD" | "PEN" | null): number | null {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return moneda === "PEN" ? Math.round(n / USD_TO_PEN_RATE) : n
}

export async function fetchAdminPage(
  filters: AdminSearchFilters,
  page: number,
  pageSize: number
): Promise<PropertyPage> {
  let q: any = supabase
    .from("propiedades")
    .select(PROPERTY_COLUMNS, { count: "exact" })

  const distrito = filters.distrito.trim()
  if (distrito) q = q.ilike("distrito", `%${escapeLike(distrito)}%`)
  if (filters.operacion && filters.operacion !== "todos")
    q = q.ilike("operacion", escapeLike(filters.operacion.trim()))
  if (filters.portal && filters.portal !== "todos")
    q = q.ilike("portal", `%${escapeLike(filters.portal.trim())}%`)
  if (filters.moneda) q = q.eq("moneda", filters.moneda)

  const minUsd = toUsd(filters.precioMin, filters.moneda)
  const maxUsd = toUsd(filters.precioMax, filters.moneda)
  if (minUsd !== null) q = q.gte("precio_usd", minUsd)
  if (maxUsd !== null) q = q.lte("precio_usd", maxUsd)

  const { data, count, error } = await orderStable(q).range(
    page * pageSize,
    (page + 1) * pageSize - 1
  )
  if (error) throw error
  return { data: (data as Propiedad[] | null) ?? [], count: count ?? 0 }
}
