import { claveNombre, distritoOficial } from "../shared/ubicacion"
import {
  accentInsensitivePattern,
  bathroomsPattern,
  bedroomsPattern,
  diasPublicado,
  escapeLike,
  type Banios,
  type Dormitorios,
  type Publicado,
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

/**
 * Columnas del catálogo del portal: las de siempre y las que dan las etiquetas de las tarjetas (cantidad de fotos,
 * cocheras, antigüedad y departamento). Existen con db/008, 009 y 011; sin ellas el portal usa `PROPERTY_COLUMNS`.
 */
export const PROPERTY_COLUMNS_TARJETA = `${PROPERTY_COLUMNS},
  estacionamientos, antiguedad, departamento, coalesce(cardinality(imagenes), 0)::int as fotos`

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
  banios: Banios
  /** Departamento (región) y provincia (ciudad): coincidencia exacta sin importar tildes ni mayúsculas. */
  departamento: string
  provincia: string
  cocheras: Cocheras
  /** Años de antigüedad máximos (0 = estreno). */
  antiguedadMax: number | null
  /** Texto del anunciante o inmobiliaria. */
  anunciante: string
  /** Oculta los avisos sin precio publicado. */
  soloConPrecio: boolean
  areaMin: number | null
  areaMax: number | null
  publicado: Publicado
  texto: string
  orden: Orden
}

export type Cocheras = "todos" | "1+" | "2+" | "3+"
export type Orden = "relevancia" | "recientes" | "precio_asc" | "precio_desc"
const ORDENES = new Set<string>(["relevancia", "recientes", "precio_asc", "precio_desc"])

const DORMITORIOS = new Set(["todos", "1", "2", "3", "4+"])
const BANIOS = new Set(["todos", "1", "2", "3+"])
const PUBLICADOS = new Set(["todos", "hoy", "semana", "mes"])
const COCHERAS = new Set(["todos", "1+", "2+", "3+"])

/** Texto corto opcional de un filtro (se recorta y se valida el largo). */
const textoCorto = (value: string | null, campo: string, max = 80): string => {
  const t = (value ?? "").trim()
  if (t.length > max) throw badRequest(`${campo} demasiado largo`)
  return t
}

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
  const banios = q.get("banios") ?? "todos"
  if (!BANIOS.has(banios)) throw badRequest("Filtro de baños inválido")
  const publicado = q.get("publicado") ?? "todos"
  if (!PUBLICADOS.has(publicado)) throw badRequest("Filtro de publicación inválido")
  const cocheras = q.get("cocheras") ?? "todos"
  if (!COCHERAS.has(cocheras)) throw badRequest("Filtro de cocheras inválido")
  const texto = (q.get("texto") ?? "").trim()
  if (texto.length > 80) throw badRequest("Texto de búsqueda demasiado largo")

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
    banios: banios as Banios,
    departamento: textoCorto(q.get("departamento"), "Departamento", 60),
    provincia: textoCorto(q.get("provincia"), "Provincia", 60),
    cocheras: cocheras as Cocheras,
    antiguedadMax: optNumber(q.get("antiguedadMax")),
    anunciante: textoCorto(q.get("anunciante"), "Anunciante"),
    soloConPrecio: q.get("soloConPrecio") === "1" || q.get("soloConPrecio") === "true",
    areaMin: optNumber(q.get("areaMin")),
    areaMax: optNumber(q.get("areaMax")),
    publicado: publicado as Publicado,
    texto,
    orden: ORDENES.has(q.get("orden") ?? "") ? (q.get("orden") as Orden) : "relevancia",
  }
}

/** Filtros de ubicación y detalle que comparten el portal y el panel de administración. */
export type FiltrosDetalle = Pick<
  PortalFilters,
  "inmueble" | "dormitorios" | "banios" | "departamento" | "provincia" | "cocheras" | "antiguedadMax" | "anunciante" | "soloConPrecio" | "areaMin" | "areaMax" | "publicado" | "texto"
>

const CLAVES_DETALLE = [
  "inmueble", "dormitorios", "banios", "departamento", "provincia", "cocheras", "antiguedadMax", "anunciante", "soloConPrecio", "areaMin", "areaMax", "publicado", "texto",
] as const

/** Los filtros de detalle de una consulta (los mismos parámetros del portal); lo que falte queda sin filtrar. */
export function parseFiltrosDetalle(q: URLSearchParams): FiltrosDetalle {
  const f = parsePortalFilters(q)
  return Object.fromEntries(CLAVES_DETALLE.map(k => [k, f[k]])) as FiltrosDetalle
}

function applyDetalleWhere(w: Where, f: FiltrosDetalle) {
  if (f.inmueble) w.add(`lower(inmueble) = lower(${w.p(f.inmueble)})`)

  const dorm = bedroomsPattern(f.dormitorios)
  if (dorm) w.add(`dormitorios ~* ${w.p(dorm)}`)

  // Departamento y provincia: igualdad exacta, sin tildes ni mayúsculas.
  const sinTildes = (col: string) => `translate(lower(${col}), 'áéíóúüñ', 'aeiouun')`
  if (f.departamento) w.add(`${sinTildes("departamento")} = ${w.p(claveNombre(f.departamento))}`)
  if (f.provincia) w.add(`${sinTildes("provincia")} = ${w.p(claveNombre(f.provincia))}`)

  // Cocheras: «2+» entiende «2», «3 cocheras», «10»…, pero no «0».
  if (f.cocheras !== "todos") {
    const min = Number(f.cocheras[0])
    const digitos = min >= 9 ? "[9]" : `[${min}-9]`
    w.add(`estacionamientos ~ ${w.p(`(^|\\D)(${digitos}|[1-9][0-9]+)(\\D|$)`)}`)
  }

  if (f.antiguedadMax !== null) {
    const anios = `(case when antiguedad ~* '^estreno' then 0 when antiguedad ~ '^[0-9]+' then (regexp_match(antiguedad, '^[0-9]+'))[1]::int end)`
    w.add(`${anios} <= ${w.p(f.antiguedadMax)}`)
  }

  if (f.anunciante) w.add(`publicador ilike ${w.p(`%${escapeLike(f.anunciante)}%`)}`)
  if (f.soloConPrecio) w.add("(precio > 0 or precio_usd > 0)")

  const banios = bathroomsPattern(f.banios)
  if (banios) w.add(`banios ~* ${w.p(banios)}`)

  // Área: se toma el primer número del texto («85,5 m2»); sin número, el aviso no entra al filtrarla.
  if ((f.areaMin ?? 0) > 0 || f.areaMax !== null) {
    const area = `(case when area ~ '^[0-9]+([.,][0-9]+)?' then replace((regexp_match(area, '^[0-9]+(?:[.,][0-9]+)?'))[1], ',', '.')::numeric end)`
    if ((f.areaMin ?? 0) > 0) w.add(`${area} >= ${w.p(f.areaMin)}`)
    if (f.areaMax !== null) w.add(`${area} <= ${w.p(f.areaMax)}`)
  }

  const dias = diasPublicado(f.publicado)
  if (dias) w.add(`creado_en >= now() - ${w.p(dias)}::int * interval '1 day'`)

  if (f.texto) {
    const like = w.p(`%${escapeLike(f.texto)}%`)
    w.add(`(titulo ilike ${like} or distrito ilike ${like})`)
  }
}

/**
 * Condición del filtro de distrito. Un distrito oficial de Lima o del Callao se compara exacto (sin tildes ni
 * mayúsculas): «Miraflores» no debe traer «San Juan de Miraflores». Un texto parcial («mira») o de provincias
 * sigue buscando por coincidencia.
 */
function condicionDistrito(w: Where, valor: string): string {
  const oficial = distritoOficial(valor)
  if (oficial) return `translate(lower(distrito), 'áéíóúüñ', 'aeiouun') = ${w.p(claveNombre(oficial))}`
  return `distrito ~* ${w.p(accentInsensitivePattern(valor))}`
}

/** Agrega a `w` las condiciones de los filtros del portal. */
function applyPortalWhere(w: Where, f: PortalFilters, usdToPen: number) {
  if (f.operacion) w.add(`lower(operacion) = lower(${w.p(f.operacion)})`)
  if (f.distrito) w.add(condicionDistrito(w, f.distrito))
  if (f.portales.length) w.add(`portal = any(${w.p(f.portales)}::text[])`)

  applyDetalleWhere(w, f)

  // Rango de precio, en la moneda elegida. `precio` está en la moneda del aviso (`moneda`), así que un
  // aviso publicado en dólares no cuenta como soles: se usa su precio normalizado y se convierte.
  const min = f.precioMin ?? 0
  const max = f.precioMax
  if (min > 0 || max !== null) {
    const efectivo = precioEfectivo(w, f.moneda, usdToPen)
    if (min > 0) w.add(`${efectivo} >= ${w.p(min)}`)
    if (max !== null) w.add(`${efectivo} <= ${w.p(max)}`)
  }
}

/**
 * Precio de un aviso en la moneda pedida, listo para comparar u ordenar. En soles: el precio publicado
 * si el aviso está en soles y, si no, el precio en dólares por el tipo de cambio. En dólares: el
 * normalizado (`precio_usd`) y, si falta, el publicado convertido. Sin precio da `null`.
 */
function precioEfectivo(w: Where, moneda: "PEN" | "USD", usdToPen: number): string {
  const rate = `${w.p(usdToPen)}::numeric`
  return moneda === "USD"
    ? `(case when precio_usd > 0 then precio_usd when precio > 0 and moneda = 'USD' then precio when precio > 0 then precio / ${rate} end)`
    : `(case when precio > 0 and moneda = 'PEN' then precio when precio_usd > 0 then precio_usd * ${rate} when precio > 0 then precio end)`
}

/**
 * Cláusula ORDER BY del portal. Todas las variantes son estables entre páginas (desempate por
 * fecha e id). El orden por precio usa el precio efectivo en la moneda elegida: el nativo si
 * existe o el convertido de la otra moneda; los avisos sin precio siempre quedan al final.
 */
function orderClause(w: Where, f: PortalFilters, usdToPen: number): string {
  const priced = "(case when precio > 0 or precio_usd > 0 then 0 else 1 end)"
  const tail = "creado_en desc, id desc"
  if (f.orden === "recientes") return `order by ${tail}`
  if (f.orden === "relevancia") return `order by ${priced}, ${tail}`

  const effective = precioEfectivo(w, f.moneda, usdToPen)
  const dir = f.orden === "precio_asc" ? "asc" : "desc"
  return `order by ${priced}, ${effective} ${dir} nulls last, ${tail}`
}

/**
 * Página del portal. Por defecto el orden es global y estable: avisos con precio primero (más
 * recientes antes) y al final los que no tienen precio. Un solo SELECT con el total en `total`.
 */
export function buildPortalQuery(
  f: PortalFilters,
  page: number,
  pageSize: number,
  usdToPen: number,
  columnas: string = PROPERTY_COLUMNS
): BuiltQuery {
  const w = new Where()
  applyPortalWhere(w, f, usdToPen)
  const order = orderClause(w, f, usdToPen)
  const limit = w.p(pageSize)
  const offset = w.p(page * pageSize)
  return {
    text: `select ${columnas}, count(*) over()::int as total
           from public.propiedades ${w.sql()}
           ${order}
           limit ${limit} offset ${offset}`,
    params: w.params,
  }
}

/**
 * Consultas de las listas de los filtros (departamentos, provincias, distritos, tipos y anunciantes) con su cantidad,
 * calculadas sobre lo que ya está filtrado: cada lista ignora solo el filtro de su propio nivel y los de abajo, así
 * al elegir un portal o una operación solo se ofrece (y se cuenta) lo que ese portal u operación tiene, y al elegir
 * un departamento las provincias y distritos son los de ese departamento.
 */
export function buildFacetas(f: PortalFilters, usdToPen: number) {
  const consulta = (reset: Partial<PortalFilters>, columnas: string, agrupar: string, extra: string, orden: string): BuiltQuery => {
    const w = new Where()
    applyPortalWhere(w, { ...f, ...reset }, usdToPen)
    w.add(extra)
    return { text: `select ${columnas}, count(*)::int as n from public.propiedades ${w.sql()} group by ${agrupar} ${orden}`, params: w.params }
  }
  return {
    departamentos: consulta({ departamento: "", provincia: "", distrito: "" }, "departamento as valor", "1", "departamento is not null", "order by n desc, 1"),
    provincias: consulta({ provincia: "", distrito: "" }, "provincia as valor, departamento as padre", "1, 2", "provincia is not null", "order by n desc, 1"),
    distritos: consulta({ distrito: "" }, "distrito as valor, departamento as padre, provincia", "1, 2, 3", "distrito is not null and distrito <> ''", "order by n desc, 1 limit 300"),
    inmuebles: consulta({ inmueble: null }, "inmueble as valor", "1", "inmueble is not null and inmueble <> ''", "order by n desc, 1"),
    anunciantes: consulta({ anunciante: "" }, "publicador as valor", "1", "publicador is not null and publicador <> ''", "order by n desc, 1 limit 40"),
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

/** Avisos creados en los últimos `dias` días que cumplen los filtros (búsquedas guardadas). */
export function buildPortalNewCount(f: PortalFilters, usdToPen: number, dias: number): BuiltQuery {
  const w = new Where()
  applyPortalWhere(w, f, usdToPen)
  w.add(`creado_en >= now() - ${w.p(dias)}::int * interval '1 day'`)
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
  /** Ubicación y detalle (departamento, ciudad, tipo, cocheras…): los mismos del portal. */
  detalle: FiltrosDetalle
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
    detalle: parseFiltrosDetalle(q),
  }
}

function applyAdminWhere(w: Where, f: AdminFilters) {
  if (f.distrito) w.add(condicionDistrito(w, f.distrito))
  if (f.operacion) w.add(`operacion ilike ${w.p(escapeLike(f.operacion))}`)
  if (f.portal) w.add(`portal ilike ${w.p(`%${escapeLike(f.portal)}%`)}`)
  if (f.moneda) w.add(`moneda = ${w.p(f.moneda)}`)
  if (f.minUsd !== null) w.add(`precio_usd >= ${w.p(f.minUsd)}`)
  if (f.maxUsd !== null) w.add(`precio_usd <= ${w.p(f.maxUsd)}`)
  applyDetalleWhere(w, f.detalle)
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
