import type { Db } from "./db"
import type { ApiEnv } from "./env"
import { usdToPenRate } from "./env"
import { guardarAvisos, type Aviso } from "./ingest"

/**
 * Carga automática de avisos con Apify, con varias barreras para no pasarse del presupuesto:
 *   1. interruptor de pausa (empieza pausada),
 *   2. tope mensual de avisos y máximo por corrida (reserva antes de lanzar),
 *   3. `maxItems` y `maxTotalChargeUsd` enviados a Apify en cada corrida (tope en dólares),
 *   4. una sola corrida activa a la vez.
 */

export const FUENTE = "adondevivir"
/** Fuentes de avisos que se pueden cargar; cada una tiene su actor, sus búsquedas y su tope. */
export type FuenteId = "adondevivir" | "urbania"
export const FUENTES_IDS: FuenteId[] = ["adondevivir", "urbania"]
export const ACTOR_URBANIA_POR_DEFECTO = "sian.agency~urbania-property-scraper"
export const TOPE_URBANIA_POR_DEFECTO = 200
export const ACTOR_POR_DEFECTO = "gio21~adondevivir-scraper"
export const ACTOR_RESPALDO_POR_DEFECTO = "scrapers_lat~adondevivir-scraper"
/** Costo por 1 000 avisos del actor (US$); se usa solo para calcular el tope en dólares. */
export const COSTO_POR_MIL_POR_DEFECTO = 3
/** Crédito gratuito mensual del plan Free de Apify (US$). Se puede ajustar con APIFY_CREDIT_USD. */
export const CREDITO_USD_POR_DEFECTO = 5
/** Solo se planea gastar este porcentaje del crédito: el resto queda de colchón (almacenamiento, etc.). */
export const MARGEN_CREDITO = 0.9
/** El crédito de Apify se reinicia un día fijo de cada mes (en el plan del usuario, el 23). */
export const DIA_REINICIO_POR_DEFECTO = 23
/** Límite duro de la base de datos para el tope mensual. */
export const TOPE_MENSUAL_ABSOLUTO = 5000
/** Una corrida sin respuesta pasado este tiempo se da por perdida (su reserva se conserva). */
export const HORAS_CORRIDA_PERDIDA = 3

/** Un actor de Apify que sabe leer Adondevivir, con su costo y la forma de pedirle los avisos. */
export interface ActorCarga {
  id: string
  /** Nombre corto para el historial. */
  nombre: string
  /** US$ por 1 000 avisos (medido; se usa para los topes en dólares). */
  costoPorMil: number
  /** Tope de avisos por corrida impuesto por el actor (p. ej. el plan gratuito de scrapers_lat). */
  maxPorCorrida?: number
  /** Tarifa fija por arrancar una corrida, en US$ (Urbania cobra US$ 0.015 por corrida). */
  costoFijoUsd?: number
  /** Cuerpo de entrada del actor para una búsqueda (cada actor nombra sus campos distinto). */
  entrada: (busqueda: string, items: number) => Record<string, unknown>
}

/** Actor de respaldo: más completo pero más caro, y limitado a 10 avisos por corrida en el plan Free. */
const COSTO_RESPALDO_POR_MIL = 9
const MAX_RESPALDO_PLAN_FREE = 10

export interface ActoresDeCarga {
  principal: ActorCarga
  respaldo: ActorCarga | null
}

export function actoresDeCarga(env: ApiEnv): ActoresDeCarga {
  const principal: ActorCarga = {
    id: env.APIFY_ACTOR || ACTOR_POR_DEFECTO,
    nombre: "gio21",
    costoPorMil: costoPorMil(env),
    entrada: (url, items) => ({ startUrls: [url], maxItems: items }),
  }
  const idRespaldo = (env.APIFY_ACTOR_RESPALDO || ACTOR_RESPALDO_POR_DEFECTO).trim()
  const respaldo: ActorCarga | null =
    idRespaldo.toLowerCase() === "ninguno" || idRespaldo === principal.id
      ? null
      : {
          id: idRespaldo,
          nombre: "scrapers_lat",
          costoPorMil: COSTO_RESPALDO_POR_MIL,
          maxPorCorrida: MAX_RESPALDO_PLAN_FREE,
          // Sin detalles: son de pago y el plan gratuito solo entrega el listado.
          entrada: (url, items) => ({ startUrls: [url], maxListings: items, withDetails: false }),
        }
  return { principal, respaldo }
}

/**
 * Qué actor usa la próxima corrida: el principal, salvo que la última corrida haya fallado; en
 * ese caso se prueba el otro. Si el otro también falla, se vuelve al principal (alterna).
 */
export function elegirActor(ultima: { estado: string; actor: string | null } | null, a: ActoresDeCarga): ActorCarga {
  if (!ultima || ultima.estado !== "fallida" || !a.respaldo) return a.principal
  // Sin actor registrado (base anterior a la columna `actor`) la corrida fue del principal.
  const fueDelPrincipal = !ultima.actor || ultima.actor === a.principal.id
  return fueDelPrincipal ? a.respaldo : a.principal
}

/** Búsquedas de Adondevivir que se rotan, una por corrida, para repartir los avisos entre tipos. */
export const URLS_POR_DEFECTO = [
  "https://www.adondevivir.com/departamentos-en-venta.html",
  "https://www.adondevivir.com/departamentos-en-alquiler.html",
  "https://www.adondevivir.com/casas-en-venta.html",
  "https://www.adondevivir.com/casas-en-alquiler.html",
  "https://www.adondevivir.com/terrenos-en-venta.html",
  "https://www.adondevivir.com/locales-comerciales-en-venta.html",
]

/** Búsquedas de Urbania (por enlace: así salen avisos sueltos además de los proyectos promocionados). */
export const URLS_URBANIA_POR_DEFECTO = [
  "https://urbania.pe/buscar/venta-de-departamentos",
  "https://urbania.pe/buscar/alquiler-de-departamentos",
  "https://urbania.pe/buscar/venta-de-casas",
  "https://urbania.pe/buscar/alquiler-de-casas",
]

/** Todo lo que hace falta saber de una fuente para cargarla. */
export interface FuenteCarga {
  id: FuenteId
  nombre: string
  /** Búsquedas a rotar, una por corrida. */
  busquedas: string[]
  actores: ActoresDeCarga
  mapear: (item: Record<string, unknown>) => Aviso | null
}

/** Urbania: actor de sian.agency (US$ 0.015 por corrida + US$ 0.006 por aviso; 25 por corrida en el plan Free). */
const COSTO_URBANIA_POR_MIL = 6
const COSTO_URBANIA_POR_CORRIDA = 0.015
const MAX_URBANIA_PLAN_FREE = 25

export function fuentesDeCarga(env: ApiEnv): Record<FuenteId, FuenteCarga> {
  const urbaniaPropias = (env.CARGA_URLS_URBANIA ?? "")
    .split(",")
    .map(u => u.trim())
    .filter(u => /^https:\/\/urbania\.pe\/buscar\/[\w\-/]+$/.test(u))
  return {
    adondevivir: {
      id: "adondevivir",
      nombre: "Adondevivir",
      busquedas: urlsDeBusqueda(env),
      actores: actoresDeCarga(env),
      mapear: mapearAviso,
    },
    urbania: {
      id: "urbania",
      nombre: "Urbania",
      busquedas: urbaniaPropias.length > 0 ? urbaniaPropias : URLS_URBANIA_POR_DEFECTO,
      actores: {
        principal: {
          id: env.APIFY_ACTOR_URBANIA || ACTOR_URBANIA_POR_DEFECTO,
          nombre: "sian.agency",
          costoPorMil: COSTO_URBANIA_POR_MIL,
          costoFijoUsd: COSTO_URBANIA_POR_CORRIDA,
          maxPorCorrida: MAX_URBANIA_PLAN_FREE,
          entrada: (url, items) => ({ scrapeMode: "overview", searchMode: "bySearchUrl", searchUrls: [url], maxResults: items }),
        },
        respaldo: null,
      },
      mapear: mapearAvisoUrbania,
    },
  }
}

export interface CargaConfig {
  pausada: boolean
  tope_mensual: number
  maximo_por_corrida: number
  /** Día del mes (1 a 28) en que se reinicia el crédito de Apify. */
  dia_reinicio: number
  /** Tope propio de Urbania (avisos por ciclo). */
  tope_urbania: number
}

export type MotivoNoEjecutar = "pausada" | "tope" | "credito" | "en_curso" | "sin_configurar"

export type Plan = { ok: true; items: number } | { ok: false; motivo: MotivoNoEjecutar; detalle: string }

export interface LimitesDeGasto {
  /** US$ por 1 000 avisos. */
  costoPorMil: number
  /** Crédito gratuito del ciclo, en US$. */
  creditoUsd: number
  /** Tarifa fija por corrida (US$), si el actor la cobra. */
  costoFijoUsd?: number
}

const LIMITES_POR_DEFECTO: LimitesDeGasto = { costoPorMil: COSTO_POR_MIL_POR_DEFECTO, creditoUsd: CREDITO_USD_POR_DEFECTO }

/** Avisos que caben en el crédito con el margen de seguridad (el 1e-9 evita errores de coma flotante). */
const avisosQueCaben = (l: LimitesDeGasto) =>
  Math.floor(((l.creditoUsd * MARGEN_CREDITO - (l.costoFijoUsd ?? 0)) * 1000) / l.costoPorMil + 1e-9)

/** Tope mensual máximo que se acepta: lo que cabe en el crédito con el margen de seguridad. */
export function topeMensualMaximo(l: LimitesDeGasto = LIMITES_POR_DEFECTO): number {
  return Math.max(0, Math.min(TOPE_MENSUAL_ABSOLUTO, avisosQueCaben(l)))
}

/** Gasto estimado, en US$, de haber pedido `avisos` avisos. */
export const gastoEstimadoUsd = (avisos: number, costoPorMil: number) => (avisos * costoPorMil) / 1000

/**
 * Avisos que aún se pueden pedir en el ciclo: el menor entre lo que queda del tope configurado
 * y lo que queda del crédito en dólares (con margen). Son dos barreras independientes.
 * Si se conoce el gasto REAL de la cuenta (lo informa Apify) se usa ese; si no, se estima.
 */
export function cupoRestante(
  config: CargaConfig,
  usadoMes: number,
  l: LimitesDeGasto = LIMITES_POR_DEFECTO,
  gastoRealUsd?: number
) {
  const topeEfectivo = Math.min(config.tope_mensual, topeMensualMaximo(l))
  const porTope = topeEfectivo - usadoMes
  const porCredito =
    gastoRealUsd === undefined
      ? avisosQueCaben(l) - usadoMes
      : Math.floor(((l.creditoUsd * MARGEN_CREDITO - gastoRealUsd - (l.costoFijoUsd ?? 0)) * 1000) / l.costoPorMil + 1e-9)
  return { porTope, porCredito, restante: Math.max(0, Math.min(porTope, porCredito)) }
}

/** Decide cuántos avisos se pueden pedir ahora (función pura, probada aparte). */
export function planificar(
  config: CargaConfig,
  usadoMes: number,
  hayCorridaActiva: boolean,
  limites: LimitesDeGasto = LIMITES_POR_DEFECTO,
  gastoRealUsd?: number
): Plan {
  if (config.pausada) return { ok: false, motivo: "pausada", detalle: "La carga automática está pausada." }
  if (hayCorridaActiva) return { ok: false, motivo: "en_curso", detalle: "Ya hay una carga en curso." }
  const { porTope, porCredito, restante } = cupoRestante(config, usadoMes, limites, gastoRealUsd)
  if (porTope <= 0) {
    return { ok: false, motivo: "tope", detalle: `Se alcanzó el tope del ciclo (${Math.min(config.tope_mensual, topeMensualMaximo(limites))} avisos).` }
  }
  if (porCredito <= 0) {
    return { ok: false, motivo: "credito", detalle: "Se agotó el crédito gratuito planeado de Apify para este ciclo." }
  }
  return { ok: true, items: Math.max(1, Math.min(config.maximo_por_corrida, restante)) }
}

/** Tope en dólares para una corrida: costo esperado + 10 % de margen, redondeado hacia arriba. */
export function topeDolares(items: number, costoPorMil: number, costoFijoUsd = 0): number {
  return Math.ceil(((items * costoPorMil) / 1000 * 1.1 + costoFijoUsd) * 100) / 100 + 0.01
}

/** Crédito gratuito del ciclo en US$ (APIFY_CREDIT_USD o el del plan Free). */
export function creditoUsd(env: ApiEnv): number {
  const n = Number(env.APIFY_CREDIT_USD)
  return Number.isFinite(n) && n > 0 && n <= 500 ? n : CREDITO_USD_POR_DEFECTO
}

export function limitesDeGasto(env: ApiEnv): LimitesDeGasto {
  return { costoPorMil: costoPorMil(env), creditoUsd: creditoUsd(env) }
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Ciclo de uso actual: empieza el último día de reinicio ya pasado (hora de Lima, UTC-5 todo el
 * año) y termina el siguiente. `desde` va listo para comparar con timestamptz.
 */
export function ventanaDeUso(diaReinicio: number, ahora: Date = new Date()) {
  const dia = Math.min(28, Math.max(1, Math.trunc(diaReinicio) || DIA_REINICIO_POR_DEFECTO))
  const lima = new Date(ahora.getTime() - 5 * 3600 * 1000)
  let y = lima.getUTCFullYear()
  let m = lima.getUTCMonth() + 1 // 1 a 12
  if (lima.getUTCDate() < dia) {
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  const desdeFecha = `${y}-${pad(m)}-${pad(dia)}`
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return { desde: `${desdeFecha}T00:00:00-05:00`, desdeFecha, reiniciaFecha: `${ny}-${pad(nm)}-${pad(dia)}` }
}

export function costoPorMil(env: ApiEnv): number {
  const n = Number(env.APIFY_COST_PER_1000)
  return Number.isFinite(n) && n > 0 && n <= 20 ? n : COSTO_POR_MIL_POR_DEFECTO
}

/** Rota las búsquedas: la corrida número N usa la dirección N mod cantidad. */
export function elegirUrl(urls: string[], corridasPrevias: number): string {
  return urls[corridasPrevias % urls.length]
}

export function urlsDeBusqueda(env: ApiEnv): string[] {
  const propias = (env.CARGA_URLS ?? "")
    .split(",")
    .map(u => u.trim())
    .filter(u => /^https:\/\/www\.adondevivir\.com\/[\w\-/.]+\.html$/.test(u))
  return propias.length > 0 ? propias : URLS_POR_DEFECTO
}

export function sitioPublico(env: ApiEnv): string | null {
  const raw = (env.PUBLIC_URL || env.URL || "").trim().replace(/\/+$/, "")
  return /^https:\/\/[^\s/]+$/.test(raw) ? raw : null
}

export function configurada(env: ApiEnv): boolean {
  return Boolean(env.APIFY_TOKEN && env.APIFY_WEBHOOK_SECRET && sitioPublico(env))
}

// ── Mapeo de lo que devuelve el actor ────────────────────────────────────────

const TIPOS: Record<string, string> = {
  casas: "Casa",
  casa: "Casa",
  departamentos: "Departamento",
  departamento: "Departamento",
  terrenos: "Terreno",
  terreno: "Terreno",
  "locales comerciales": "Local comercial",
  desarrollo: "Proyecto",
  // Las búsquedas de Adondevivir mezclan avisos sueltos con proyectos inmobiliarios.
  edificios: "Proyecto",
  "desarrollos verticales": "Proyecto",
  "desarrollos horizontales": "Proyecto",
  oficinas: "Oficina",
  habitaciones: "Habitación",
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined)

/** El actor a veces devuelve "S/n" (sin número) como barrio: en ese caso vale la ciudad. */
const distrito = (item: Record<string, unknown>) => {
  const sinNumero = (v: string | undefined) => (v && !/^s\/?n$/i.test(v) ? v : undefined)
  const porLugar = str(item.location)?.split(",").pop()?.trim() // «Lobaton, Lince» -> «Lince»
  return str(item.district) ?? sinNumero(str(item.neighborhood)) ?? porLugar ?? str(item.city)
}

/** Convierte un registro del actor en un aviso del sistema; `null` si no sirve para guardarlo. */
export function mapearAviso(item: Record<string, unknown>): Aviso | null {
  // Cada actor nombra los campos distinto: gio21 usa `id`, `image`, `areaBuilt`…; scrapers_lat
  // usa `listingId`, `imageUrl`, `totalAreaM2`… Se aceptan ambos formatos.
  const codigo = str(item.id) ?? (typeof item.id === "number" ? String(item.id) : undefined) ?? str(item.listingId) ?? (typeof item.listingId === "number" ? String(item.listingId) : undefined)
  const operacionRaw = str(item.operationType)?.toLowerCase()
  const operacion = operacionRaw?.startsWith("alquil") ? "ALQUILER" : operacionRaw?.startsWith("venta") ? "VENTA" : null
  const titulo = str(item.title)
  if (!codigo || !operacion || !titulo) return null // p. ej. el aviso "no-listings" del actor

  const tipo = str(item.propertyType)
  const monedaTexto = str(item.currency) ?? ""
  const moneda = monedaTexto.toUpperCase().includes("US") || monedaTexto.includes("$") ? "USD" : "PEN"
  const area = num(item.areaBuilt) ?? num(item.areaLot) ?? num(item.totalAreaM2) ?? num(item.builtAreaM2)
  return {
    portal: "adondevivir",
    codigo,
    operacion,
    inmueble: tipo ? (TIPOS[tipo.toLowerCase()] ?? tipo) : "Otro",
    titulo,
    precio: num(item.price),
    moneda,
    precioUsd: num(item.priceUsd),
    distrito: distrito(item),
    dormitorios: num(item.bedrooms) !== undefined ? String(item.bedrooms) : undefined,
    banios: num(item.bathrooms) !== undefined ? String(item.bathrooms) : undefined,
    area: area ? `${area} m2` : undefined,
    imagen: str(item.image) ?? str(item.imageUrl),
    imagenes: fotosDe(item),
    url: str(item.url),
  }
}

/** Distrito a partir de `location_path`: «Orrantia > San Isidro > Lima > Lima > Peru urbania» -> «San Isidro». */
function distritoUrbania(item: Record<string, unknown>): string | undefined {
  const partes = (str(item.location_path) ?? "")
    .split(">")
    .map(p => p.trim())
    .filter(p => p && !/^peru\b/i.test(p))
  const distrito = partes.length > 0 ? partes[Math.max(0, partes.length - 3)] : undefined
  return distrito && !/^s\/?n$/i.test(distrito) ? distrito : str(item.location_name)
}

/** Fotos de un registro: listas de textos o de objetos con `url`/`src`, en cualquiera de los campos habituales. */
export function fotosDe(item: Record<string, unknown>): string[] {
  const salida: string[] = []
  for (const campo of ["images", "imageUrls", "photos", "pictures", "gallery"]) {
    const lista = item[campo]
    if (!Array.isArray(lista)) continue
    for (const f of lista) {
      const url = typeof f === "string" ? f : str((f as Record<string, unknown> | null)?.url) ?? str((f as Record<string, unknown> | null)?.src)
      if (url) salida.push(url)
    }
  }
  return salida
}

/** Convierte un registro del actor de Urbania (`sian.agency`) en un aviso del sistema. */
export function mapearAvisoUrbania(item: Record<string, unknown>): Aviso | null {
  const codigo = str(item.code) ?? str(item.id) ?? (typeof item.id === "number" ? String(item.id) : undefined)
  const operacionRaw = str(item.operation_type)?.toLowerCase()
  const operacion = operacionRaw?.startsWith("venta")
    ? "VENTA"
    : operacionRaw?.startsWith("alquil") || operacionRaw?.startsWith("temporal")
      ? "ALQUILER"
      : null // traspasos y otros: no encajan en venta ni alquiler
  const titulo = str(item.propertyTitle) ?? str(item.title)
  if (!codigo || !operacion || !titulo) return null

  const tipo = str(item.property_type)
  const esProyecto = item.posting_kind === "DEVELOPMENT" || (tipo ? TIPOS[tipo.toLowerCase()] === "Proyecto" : false)
  const monedaTexto = str(item.currency) ?? ""
  const area = num(item.total_area) ?? num(item.covered_area)
  const imagenes = Array.isArray(item.images) ? (item.images as unknown[]) : []
  return {
    portal: "urbania",
    codigo,
    operacion,
    inmueble: esProyecto ? "Proyecto" : tipo ? (TIPOS[tipo.toLowerCase()] ?? tipo) : "Otro",
    titulo,
    precio: num(item.price),
    moneda: monedaTexto.toUpperCase().includes("US") || monedaTexto.includes("$") ? "USD" : "PEN",
    precioUsd: num(item.price_usd),
    distrito: distritoUrbania(item),
    dormitorios: num(item.bedrooms) !== undefined ? String(item.bedrooms) : undefined,
    banios: num(item.bathrooms) !== undefined ? String(item.bathrooms) : undefined,
    area: area ? `${area} m2` : undefined,
    imagen: str(item.thumbnail) ?? str(imagenes[0]),
    imagenes: fotosDe(item),
    url: str(item.url),
  }
}

// ── Cliente de Apify ─────────────────────────────────────────────────────────

const API = "https://api.apify.com/v2"

export interface CorridaApify {
  runId: string
  datasetId: string
}

export async function lanzarCorrida(opts: {
  token: string
  actor: string
  /** Cuerpo de entrada del actor (cada uno nombra sus campos distinto). */
  input: Record<string, unknown>
  items: number
  topeUsd: number
  webhookUrl: string
}): Promise<CorridaApify> {
  const webhooks = Buffer.from(
    JSON.stringify([
      {
        eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
        requestUrl: opts.webhookUrl,
      },
    ])
  ).toString("base64")

  const qs = new URLSearchParams({
    maxItems: String(opts.items),
    maxTotalChargeUsd: String(opts.topeUsd),
    timeout: "900",
    webhooks,
  })
  const res = await fetch(`${API}/acts/${encodeURIComponent(opts.actor)}/runs?${qs}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(opts.input),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Apify respondió ${res.status} al lanzar la corrida`)
  const body = (await res.json()) as { data?: { id?: string; defaultDatasetId?: string } }
  if (!body.data?.id || !body.data.defaultDatasetId) throw new Error("Apify no devolvió el identificador de la corrida")
  return { runId: body.data.id, datasetId: body.data.defaultDatasetId }
}

export async function leerDataset(token: string, datasetId: string, limit: number): Promise<Record<string, unknown>[]> {
  const qs = new URLSearchParams({ format: "json", clean: "true", limit: String(limit) })
  const res = await fetch(`${API}/datasets/${encodeURIComponent(datasetId)}/items?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Apify respondió ${res.status} al leer los resultados`)
  const data = (await res.json()) as unknown
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : []
}

/** Lo que informa Apify sobre la cuenta: ciclo de uso, crédito y gasto reales (solo lectura, gratis). */
export interface EstadoApify {
  creditoUsd: number
  gastoUsd: number
  /** Inicio del ciclo (ISO). */
  cicloInicio: string
  /** Fin del ciclo (ISO); el siguiente empieza un instante después. */
  cicloFin: string
}

/**
 * Consulta el ciclo, el crédito y el gasto reales. Devuelve `null` si Apify no responde o el
 * formato no es el esperado: en ese caso el sistema sigue con sus estimaciones (más prudentes).
 */
export async function leerEstadoApify(token: string): Promise<EstadoApify | null> {
  try {
    const res = await fetch(`${API}/users/me/limits`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const d = ((await res.json()) as { data?: Record<string, any> }).data
    const credito = Number(d?.limits?.maxMonthlyUsageUsd)
    const gasto = Number(d?.current?.monthlyUsageUsd)
    const inicio = String(d?.monthlyUsageCycle?.startAt ?? "")
    const fin = String(d?.monthlyUsageCycle?.endAt ?? "")
    if (!Number.isFinite(credito) || credito <= 0 || !Number.isFinite(gasto) || gasto < 0) return null
    if (Number.isNaN(Date.parse(inicio)) || Number.isNaN(Date.parse(fin))) return null
    return { creditoUsd: credito, gastoUsd: gasto, cicloInicio: inicio, cicloFin: fin }
  } catch {
    return null
  }
}

/** Ciclo de uso según Apify, en el mismo formato que `ventanaDeUso`. */
export function cicloDeApify(e: EstadoApify) {
  const desdeFecha = e.cicloInicio.slice(0, 10)
  const reinicia = new Date(Date.parse(e.cicloFin) + 1).toISOString().slice(0, 10)
  return { desde: e.cicloInicio, desdeFecha, reiniciaFecha: reinicia }
}

/** Límites, ciclo y estado a usar: los reales de Apify si responde y, si no, los estimados. */
export async function contextoDeGasto(
  env: ApiEnv,
  diaReinicio: number,
  actor?: { costoPorMil: number; costoFijoUsd?: number }
) {
  const apify = env.APIFY_TOKEN ? await leerEstadoApify(env.APIFY_TOKEN) : null
  const base: LimitesDeGasto = actor
    ? { ...limitesDeGasto(env), costoPorMil: actor.costoPorMil, costoFijoUsd: actor.costoFijoUsd }
    : limitesDeGasto(env)
  return {
    apify,
    limites: apify ? { ...base, creditoUsd: apify.creditoUsd } : base,
    ciclo: apify ? cicloDeApify(apify) : ventanaDeUso(diaReinicio),
  }
}

// ── Estado y uso ─────────────────────────────────────────────────────────────

export async function leerConfig(db: Db): Promise<CargaConfig> {
  // `select *`: tolera bases que aún no tienen alguna columna nueva (se usa su valor por defecto).
  const rows = await db.query<Record<string, unknown>>("select * from public.carga_config where id = 1")
  const r = rows[0] ?? {}
  const entero = (v: unknown, defecto: number) => (typeof v === "number" && Number.isInteger(v) ? v : defecto)
  return {
    pausada: rows[0] ? r.pausada === true : true,
    tope_mensual: entero(r.tope_mensual, 1000),
    maximo_por_corrida: entero(r.maximo_por_corrida, 200),
    dia_reinicio: entero(r.dia_reinicio, DIA_REINICIO_POR_DEFECTO),
    tope_urbania: entero(r.tope_urbania, TOPE_URBANIA_POR_DEFECTO),
  }
}

/** Tope de avisos por ciclo de una fuente. */
export const topeDeFuente = (config: CargaConfig, fuente: FuenteId) => (fuente === "urbania" ? config.tope_urbania : config.tope_mensual)

/** Avisos que cuentan contra el tope de una fuente desde el último reinicio del crédito de Apify. */
export async function usoDelCiclo(db: Db, desde: string, fuente: string = FUENTE): Promise<number> {
  const rows = await db.query<{ usado: number }>(
    `select coalesce(sum(coalesce(avisos_recibidos, avisos_pedidos)), 0)::int as usado
       from public.carga_corridas
      where fuente = $1 and iniciada_en >= $2::timestamptz`,
    [fuente, desde]
  )
  return rows[0]?.usado ?? 0
}

/** Uso del ciclo de todas las fuentes. */
export async function usosPorFuente(db: Db, desde: string): Promise<Record<FuenteId, number>> {
  const [a, u] = await Promise.all(FUENTES_IDS.map(f => usoDelCiclo(db, desde, f)))
  return { adondevivir: a, urbania: u }
}

/**
 * Qué fuente toca cargar: la que lleva menos de su tope (en proporción) entre las que aún tienen
 * cupo. En empate, la primera. `null` si ninguna tiene cupo.
 */
export function elegirFuente(config: CargaConfig, usos: Record<FuenteId, number>): FuenteId | null {
  const candidatas = FUENTES_IDS.map(id => ({ id, tope: topeDeFuente(config, id), usado: usos[id] })).filter(c => c.tope > 0 && c.usado < c.tope)
  if (candidatas.length === 0) return null
  candidatas.sort((x, y) => x.usado / x.tope - y.usado / y.tope)
  return candidatas[0].id
}

const esColumnaActor = (err: unknown) => /\bactor\b/.test(String((err as { message?: string })?.message ?? ""))

/** Última corrida (de cualquier actor). Tolera una base sin la columna `actor`. */
async function ultimaCorrida(db: Db, fuente: string): Promise<{ estado: string; actor: string | null } | null> {
  try {
    const rows = await db.query<{ estado: string; actor: string | null }>(
      "select estado, actor from public.carga_corridas where fuente = $1 order by id desc limit 1",
      [fuente]
    )
    return rows[0] ?? null
  } catch (err) {
    if (!esColumnaActor(err)) throw err
    const rows = await db.query<{ estado: string }>(
      "select estado from public.carga_corridas where fuente = $1 order by id desc limit 1",
      [fuente]
    )
    return rows[0] ? { estado: rows[0].estado, actor: null } : null
  }
}

/** Reserva el cupo de la corrida antes de llamar a Apify. */
async function reservarCorrida(
  db: Db,
  d: { fuente: string; origen: string; usuario: string | null; url: string; items: number; actor: string }
): Promise<number> {
  try {
    const filas = await db.query<{ id: number }>(
      `insert into public.carga_corridas (fuente, origen, iniciada_por, url_busqueda, avisos_pedidos, actor)
       values ($1, $2, $3, $4, $5, $6) returning id::int as id`,
      [d.fuente, d.origen, d.usuario, d.url, d.items, d.actor]
    )
    return filas[0].id
  } catch (err) {
    if (!esColumnaActor(err)) throw err
    const filas = await db.query<{ id: number }>(
      `insert into public.carga_corridas (fuente, origen, iniciada_por, url_busqueda, avisos_pedidos)
       values ($1, $2, $3, $4, $5) returning id::int as id`,
      [d.fuente, d.origen, d.usuario, d.url, d.items]
    )
    return filas[0].id
  }
}

export type ResultadoInicio =
  | { ok: true; items: number; runId: string; fuente: FuenteId }
  | { ok: false; motivo: MotivoNoEjecutar | "error"; detalle: string }

/** Lanza una corrida si los topes lo permiten. Nunca lanza excepciones por motivos de negocio. */
export async function iniciarCarga(
  db: Db,
  env: ApiEnv,
  origen: "manual" | "programada",
  usuario: string | null,
  fuenteSolicitada?: FuenteId
): Promise<ResultadoInicio> {
  if (!configurada(env)) {
    return { ok: false, motivo: "sin_configurar", detalle: "Faltan APIFY_TOKEN y APIFY_WEBHOOK_SECRET en el servidor." }
  }

  // Una corrida que nunca respondió se da por perdida; su reserva sigue contando contra el tope.
  await db.query(
    `update public.carga_corridas
        set estado = 'fallida', finalizada_en = now(), detalle = 'Sin respuesta de Apify'
      where estado = 'iniciada' and iniciada_en < now() - ($1::int * interval '1 hour')`,
    [HORAS_CORRIDA_PERDIDA]
  )

  const config = await leerConfig(db)
  // Pausada: no hace falta ni consultar a Apify.
  if (config.pausada) return { ok: false, motivo: "pausada", detalle: "La carga automática está pausada." }
  const fuentes = fuentesDeCarga(env)
  const ciclo = (await contextoDeGasto(env, config.dia_reinicio)).ciclo
  const usos = await usosPorFuente(db, ciclo.desde)

  // La fuente: la pedida, o la que lleva menos de su tope.
  const idFuente = fuenteSolicitada ?? elegirFuente(config, usos)
  if (!idFuente) return { ok: false, motivo: "tope", detalle: "Todas las fuentes alcanzaron su tope del ciclo." }
  const fuente = fuentes[idFuente]
  const actor = elegirActor(await ultimaCorrida(db, idFuente), fuente.actores)

  const { apify, limites } = await contextoDeGasto(env, config.dia_reinicio, actor)
  const [activa, previas] = await Promise.all([
    db.query("select 1 from public.carga_corridas where estado = 'iniciada' and fuente = $1 limit 1", [idFuente]),
    db.query<{ n: number }>("select count(*)::int as n from public.carga_corridas where fuente = $1", [idFuente]),
  ])
  const configFuente: CargaConfig = {
    ...config,
    tope_mensual: topeDeFuente(config, idFuente),
    maximo_por_corrida: idFuente === "urbania" ? (actor.maxPorCorrida ?? config.maximo_por_corrida) : config.maximo_por_corrida,
  }
  const plan = planificar(configFuente, usos[idFuente], activa.length > 0, limites, apify?.gastoUsd)
  if (!plan.ok) return plan
  const items = Math.min(plan.items, actor.maxPorCorrida ?? plan.items)

  const busqueda = elegirUrl(fuente.busquedas, previas[0]?.n ?? 0)

  // Se reserva el cupo ANTES de llamar a Apify: si algo falla a medias, el tope sigue protegido.
  let id: number
  try {
    id = await reservarCorrida(db, { fuente: idFuente, origen, usuario, url: busqueda, items, actor: actor.id })
  } catch {
    return { ok: false, motivo: "en_curso", detalle: "Ya hay una carga en curso." }
  }

  try {
    const corrida = await lanzarCorrida({
      token: env.APIFY_TOKEN as string,
      actor: actor.id,
      input: actor.entrada(busqueda, items),
      items,
      topeUsd: topeDolares(items, actor.costoPorMil, actor.costoFijoUsd),
      webhookUrl: `${sitioPublico(env)}/api/internal/apify-webhook?secret=${encodeURIComponent(env.APIFY_WEBHOOK_SECRET as string)}`,
    })
    await db.query("update public.carga_corridas set run_id = $2 where id = $1", [id, corrida.runId])
    return { ok: true, items, runId: corrida.runId, fuente: idFuente }
  } catch (err) {
    console.error("No se pudo lanzar la corrida de Apify:", err)
    // No llegó a empezar: la reserva se libera (0 avisos) para no gastar cupo en vano.
    await db.query(
      "update public.carga_corridas set estado = 'fallida', avisos_recibidos = 0, finalizada_en = now(), detalle = $2 where id = $1",
      [id, "No se pudo lanzar en Apify"]
    )
    return { ok: false, motivo: "error", detalle: "No se pudo lanzar la corrida en Apify." }
  }
}

/**
 * Carga todas las fuentes, una corrida por fuente (cada una con su tope y su actor). Las que no
 * pueden correr (sin cupo, ya en curso) se informan sin frenar a las demás.
 */
export async function iniciarCargaTodas(
  db: Db,
  env: ApiEnv,
  origen: "manual" | "programada",
  usuario: string | null
): Promise<{ fuente: FuenteId; resultado: ResultadoInicio }[]> {
  const salida: { fuente: FuenteId; resultado: ResultadoInicio }[] = []
  for (const fuente of FUENTES_IDS) {
    salida.push({ fuente, resultado: await iniciarCarga(db, env, origen, usuario, fuente) })
  }
  return salida
}

/** Separa los avisos reales de los registros que el actor usa para avisar de un problema. */
export function separarResultados(items: Record<string, unknown>[]) {
  const errores = items.filter(i => typeof i.error === "string")
  const validos = items.filter(i => typeof i.error !== "string" && i.type !== "no-listings")
  return { validos, errores }
}

/** Resultado legible de una corrida: estado y explicación (null si todo salió normal). */
export function veredicto(
  exito: boolean,
  evento: string | undefined,
  validos: number,
  errores: Record<string, unknown>[],
  nombreFuente = "Adondevivir"
): { estado: "completada" | "fallida"; detalle: string | null } {
  const motivoError = () => {
    const m = String(errores[0]?.message ?? errores[0]?.error ?? "error desconocido")
    return `${nombreFuente} no respondió bien (${m.slice(0, 120)})`
  }
  if (!exito) return { estado: "fallida", detalle: evento ?? "fallo" }
  if (validos === 0 && errores.length > 0) return { estado: "fallida", detalle: motivoError() }
  if (validos === 0) return { estado: "completada", detalle: "Esa búsqueda no devolvió avisos" }
  if (errores.length > 0) return { estado: "completada", detalle: `${errores.length} página(s) fallaron` }
  return { estado: "completada", detalle: null }
}

export interface EventoApify {
  eventType?: string
  resource?: { id?: string; defaultDatasetId?: string; status?: string }
}

/** Procesa el aviso de Apify: descarga los avisos de la corrida y los guarda. Idempotente. */
export async function procesarResultado(db: Db, env: ApiEnv, evento: EventoApify) {
  const runId = evento.resource?.id
  const datasetId = evento.resource?.defaultDatasetId
  if (!runId || !datasetId || !env.APIFY_TOKEN) return { procesada: false as const, motivo: "datos incompletos" }

  const corridas = await db.query<{ id: number; avisos_pedidos: number; fuente: string }>(
    "select id::int as id, avisos_pedidos, fuente from public.carga_corridas where run_id = $1 and estado = 'iniciada'",
    [runId]
  )
  if (corridas.length === 0) return { procesada: false as const, motivo: "corrida desconocida o ya procesada" }
  const corrida = corridas[0]

  const exito = evento.eventType === "ACTOR.RUN.SUCCEEDED"
  try {
    // Aunque la corrida falle, lo que alcanzó a entregar ya se cobró: se guarda y se cuenta.
    const crudos = (await leerDataset(env.APIFY_TOKEN, datasetId, corrida.avisos_pedidos)).slice(0, corrida.avisos_pedidos)
    const { validos, errores } = separarResultados(crudos)
    const fuente = fuentesDeCarga(env)[corrida.fuente === "urbania" ? "urbania" : "adondevivir"]
    const avisos = validos.map(fuente.mapear).filter((a): a is Aviso => a !== null)
    const { guardados } = avisos.length > 0 ? await guardarAvisos(db, avisos, usdToPenRate(env)) : { guardados: 0 }

    // Los registros de error del actor no son avisos ni se cobran: no cuentan como recibidos.
    const { estado, detalle } = veredicto(exito, evento.eventType, validos.length, errores, fuente.nombre)
    await db.query(
      `update public.carga_corridas
          set estado = $2, avisos_recibidos = $3, avisos_guardados = $4, finalizada_en = now(), detalle = $5
        where id = $1`,
      [corrida.id, estado, validos.length, guardados, detalle]
    )
    return { procesada: true as const, recibidos: validos.length, guardados, errores: errores.length }
  } catch (err) {
    console.error("No se pudo procesar el resultado de Apify:", err)
    // Se conserva la reserva (avisos_recibidos queda null) y se marca para revisión.
    await db.query(
      "update public.carga_corridas set estado = 'fallida', finalizada_en = now(), detalle = 'No se pudieron leer los resultados' where id = $1",
      [corrida.id]
    )
    return { procesada: false as const, motivo: "error al leer resultados" }
  }
}
