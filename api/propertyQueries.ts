import {
  accentInsensitivePattern,
  bedroomsPattern,
  escapeLike,
  type Dormitorios,
} from "../shared/filters"
import { badRequest, optNumber } from "./http"

/** Columnas devueltas al cliente. Los numéricos se castean para llegar como números JSON. */
export const propertyColumns = (alias = "") => {
  const a = alias ? `${alias}.` : ""
  return `${a}id, ${a}portal, ${a}operacion, ${a}inmueble, ${a}titulo,
  ${a}precio::float8 as precio, ${a}precio_usd::float8 as precio_usd, ${a}moneda,
  ${a}distrito, ${a}dormitorios, ${a}banios, ${a}area, ${a}imagen, ${a}url, ${a}creado_en`
}

export const PROPERTY_COLUMNS = propertyColumns()

/** Columnas de `enlaces` devueltas al cliente (id como número). */
export const ENLACE_COLUMNS =
  "id::int as id, propiedad_id, titulo, descripcion, url, tipo, creado_en"

export interface BuiltQuery {
  text: string
  params: unknown[]
}

/** Acumulador de condiciones con parámetros posicionales ($1, $2, ...). */
class Where {
  readonly params: unknown[] = []
  private readonly clauses: string[] = []

  /** Registra un valor y devuelve su marcador posicional. */
  p(value: unknown): string {
    this.params.push(value)
    return `$${this.params.length}`
  }

  add(clause: string) {
    this.clauses.push(clause)
  }

  sql(): string {
    return this.clauses.length ? `where ${this.clauses.join(" and ")}` : ""
  }
}

// ── Portal (clientes) ────────────────────────────────────────────────────────

export interface PortalFilters {
  operacion: string | null
  inmueble: string | null
  distrito: string
  portales: string[]
  moneda: "PEN" | "USD"
  precioMin: number | null
  precioMax: number | null
  dormitorios: Dormitorios
}

const DORMITORIOS = new Set(["todos", "1", "2", "3", "4+"])

const optionOf = (value: string | null): string | null => {
  const v = (value ?? "").trim()
  if (!v || v.toLowerCase() === "todos") return null
  if (v.length > 40) throw badRequest("Filtro demasiado largo")
  return v
}

export function parsePortalFilters(q: URLSearchParams): PortalFilters {
  const dormitorios = q.get("dormitorios") ?? "todos"
  if (!DORMITORIOS.has(dormitorios)) throw badRequest("Filtro de dormitorios inválido")
  const distrito = (q.get("distrito") ?? "").trim()
  if (distrito.length > 80) throw badRequest("Distrito demasiado largo")

  return {
    operacion: optionOf(q.get("operacion")),
    inmueble: optionOf(q.get("inmueble")),
    distrito,
    portales: (q.get("portales") ?? "")
      .split(",")
      .map(p => p.trim().toLowerCase())
      .filter(p => p && p !== "todos" && p.length <= 40),
    moneda: q.get("moneda") === "USD" ? "USD" : "PEN",
    precioMin: optNumber(q.get("precioMin")),
    precioMax: optNumber(q.get("precioMax")),
    dormitorios: dormitorios as Dormitorios,
  }
}

/** Agrega a `w` las condiciones de los filtros del portal. */
function applyPortalWhere(w: Where, f: PortalFilters, usdToPen: number) {
  if (f.operacion) w.add(`lower(operacion) = lower(${w.p(f.operacion)})`)
  if (f.inmueble) w.add(`lower(inmueble) = lower(${w.p(f.inmueble)})`)
  if (f.distrito) w.add(`distrito ~* ${w.p(accentInsensitivePattern(f.distrito))}`)
  if (f.portales.length) w.add(`portal = any(${w.p(f.portales)}::text[])`)

  const dorm = bedroomsPattern(f.dormitorios)
  if (dorm) w.add(`dormitorios ~* ${w.p(dorm)}`)

  // Rango de precio: el aviso entra si su precio nativo cae en el rango o, cuando solo tiene
  // el precio en la otra moneda, si esa cifra convertida cae en el rango.
  const min = f.precioMin ?? 0
  const max = f.precioMax
  if (min > 0 || max !== null) {
    const native = f.moneda === "USD" ? "precio_usd" : "precio"
    const other = f.moneda === "USD" ? "precio" : "precio_usd"
    const factor = f.moneda === "USD" ? usdToPen : 1 / usdToPen
    const bounds = (col: string, scale: number) => {
      const parts: string[] = []
      if (min > 0) parts.push(`${col} >= ${w.p(min * scale)}`)
      if (max !== null) parts.push(`${col} <= ${w.p(max * scale)}`)
      return parts.join(" and ")
    }
    w.add(
      `((${native} > 0 and ${bounds(native, 1)}) or ` +
        `(coalesce(${native}, 0) = 0 and ${other} > 0 and ${bounds(other, factor)}))`
    )
  }
}

/**
 * Página del portal. Orden global y estable: avisos con precio primero (más recientes antes),
 * luego los que no tienen precio en ninguna moneda. Un solo SELECT con el total en `total`.
 */
export function buildPortalQuery(
  f: PortalFilters,
  page: number,
  pageSize: number,
  usdToPen: number
): BuiltQuery {
  const w = new Where()
  applyPortalWhere(w, f, usdToPen)
  const limit = w.p(pageSize)
  const offset = w.p(page * pageSize)
  return {
    text: `select ${PROPERTY_COLUMNS}, count(*) over()::int as total
           from public.propiedades ${w.sql()}
           order by (case when precio > 0 or precio_usd > 0 then 0 else 1 end),
                    creado_en desc, id desc
           limit ${limit} offset ${offset}`,
    params: w.params,
  }
}

/** Total de avisos para los filtros (se usa cuando la página pedida queda fuera de rango). */
export function buildPortalCount(f: PortalFilters, usdToPen: number): BuiltQuery {
  const w = new Where()
  applyPortalWhere(w, f, usdToPen)
  return {
    text: `select count(*)::int as total from public.propiedades ${w.sql()}`,
    params: w.params,
  }
}

// ── Panel de administración ──────────────────────────────────────────────────

export interface AdminFilters {
  distrito: string
  operacion: string | null
  portal: string | null
  /** Moneda original del aviso; `null` no filtra (búsquedas guardadas). */
  moneda: "USD" | "PEN" | null
  minUsd: number | null
  maxUsd: number | null
}

export function parseAdminFilters(q: URLSearchParams): AdminFilters {
  const moneda = q.get("moneda")
  return {
    distrito: (q.get("distrito") ?? "").trim().slice(0, 80),
    operacion: optionOf(q.get("operacion")),
    portal: optionOf(q.get("portal")),
    moneda: moneda === "USD" || moneda === "PEN" ? moneda : null,
    minUsd: optNumber(q.get("minUsd")),
    maxUsd: optNumber(q.get("maxUsd")),
  }
}

function applyAdminWhere(w: Where, f: AdminFilters) {
  if (f.distrito) w.add(`distrito ilike ${w.p(`%${escapeLike(f.distrito)}%`)}`)
  if (f.operacion) w.add(`operacion ilike ${w.p(escapeLike(f.operacion))}`)
  if (f.portal) w.add(`portal ilike ${w.p(`%${escapeLike(f.portal)}%`)}`)
  if (f.moneda) w.add(`moneda = ${w.p(f.moneda)}`)
  if (f.minUsd !== null) w.add(`precio_usd >= ${w.p(f.minUsd)}`)
  if (f.maxUsd !== null) w.add(`precio_usd <= ${w.p(f.maxUsd)}`)
}

export function buildAdminQuery(f: AdminFilters, page: number, pageSize: number): BuiltQuery {
  const w = new Where()
  applyAdminWhere(w, f)
  const limit = w.p(pageSize)
  const offset = w.p(page * pageSize)
  return {
    text: `select ${PROPERTY_COLUMNS}, count(*) over()::int as total
           from public.propiedades ${w.sql()}
           order by creado_en desc, id desc
           limit ${limit} offset ${offset}`,
    params: w.params,
  }
}

export function buildAdminCount(f: AdminFilters): BuiltQuery {
  const w = new Where()
  applyAdminWhere(w, f)
  return {
    text: `select count(*)::int as total from public.propiedades ${w.sql()}`,
    params: w.params,
  }
}
