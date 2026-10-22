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
export const ACTOR_POR_DEFECTO = "gio21~adondevivir-scraper"
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

/** Búsquedas que se rotan, una por corrida, para repartir los avisos entre tipos. */
export const URLS_POR_DEFECTO = [
  "https://www.adondevivir.com/departamentos-en-venta.html",
  "https://www.adondevivir.com/departamentos-en-alquiler.html",
  "https://www.adondevivir.com/casas-en-venta.html",
  "https://www.adondevivir.com/casas-en-alquiler.html",
  "https://www.adondevivir.com/terrenos-en-venta.html",
  "https://www.adondevivir.com/locales-comerciales-en-venta.html",
]

export interface CargaConfig {
  pausada: boolean
  tope_mensual: number
  maximo_por_corrida: number
  /** Día del mes (1 a 28) en que se reinicia el crédito de Apify. */
  dia_reinicio: number
}

export type MotivoNoEjecutar = "pausada" | "tope" | "credito" | "en_curso" | "sin_configurar"

export type Plan = { ok: true; items: number } | { ok: false; motivo: MotivoNoEjecutar; detalle: string }

export interface LimitesDeGasto {
  /** US$ por 1 000 avisos. */
  costoPorMil: number
  /** Crédito gratuito del ciclo, en US$. */
  creditoUsd: number
}

const LIMITES_POR_DEFECTO: LimitesDeGasto = { costoPorMil: COSTO_POR_MIL_POR_DEFECTO, creditoUsd: CREDITO_USD_POR_DEFECTO }

/** Avisos que caben en el crédito con el margen de seguridad (el 1e-9 evita errores de coma flotante). */
const avisosQueCaben = (l: LimitesDeGasto) => Math.floor((l.creditoUsd * MARGEN_CREDITO * 1000) / l.costoPorMil + 1e-9)

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
      : Math.floor(((l.creditoUsd * MARGEN_CREDITO - gastoRealUsd) * 1000) / l.costoPorMil + 1e-9)
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
export function topeDolares(items: number, costoPorMil: number): number {
  return Math.ceil(((items * costoPorMil) / 1000) * 1.1 * 100) / 100 + 0.01
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
  const barrio = str(item.neighborhood)
  return barrio && !/^s\/?n$/i.test(barrio) ? barrio : str(item.city)
}

/** Convierte un registro del actor en un aviso del sistema; `null` si no sirve para guardarlo. */
export function mapearAviso(item: Record<string, unknown>): Aviso | null {
  const codigo = str(item.id) ?? (typeof item.id === "number" ? String(item.id) : undefined)
  const operacionRaw = str(item.operationType)?.toLowerCase()
  const operacion = operacionRaw?.startsWith("alquil") ? "ALQUILER" : operacionRaw?.startsWith("venta") ? "VENTA" : null
  const titulo = str(item.title)
  if (!codigo || !operacion || !titulo) return null // p. ej. el aviso "no-listings" del actor

  const tipo = str(item.propertyType)
  const moneda = str(item.currency)?.toUpperCase().includes("US") || str(item.currency)?.includes("$") ? "USD" : "PEN"
  const area = num(item.areaBuilt) ?? num(item.areaLot)
  return {
    portal: "adondevivir",
    codigo,
    operacion,
    inmueble: tipo ? (TIPOS[tipo.toLowerCase()] ?? tipo) : "Otro",
    titulo,
    precio: num(item.price),
    moneda,
    distrito: distrito(item),
    dormitorios: num(item.bedrooms) !== undefined ? String(item.bedrooms) : undefined,
    banios: num(item.bathrooms) !== undefined ? String(item.bathrooms) : undefined,
    area: area ? `${area} m2` : undefined,
    imagen: str(item.image),
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
  url: string
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
    body: JSON.stringify({ startUrls: [opts.url], maxItems: opts.items }),
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
export async function contextoDeGasto(env: ApiEnv, diaReinicio: number) {
  const apify = env.APIFY_TOKEN ? await leerEstadoApify(env.APIFY_TOKEN) : null
  const base = limitesDeGasto(env)
  return {
    apify,
    limites: apify ? { ...base, creditoUsd: apify.creditoUsd } : base,
    ciclo: apify ? cicloDeApify(apify) : ventanaDeUso(diaReinicio),
  }
}

// ── Estado y uso ─────────────────────────────────────────────────────────────

export async function leerConfig(db: Db): Promise<CargaConfig> {
  const defecto: CargaConfig = { pausada: true, tope_mensual: 1000, maximo_por_corrida: 200, dia_reinicio: DIA_REINICIO_POR_DEFECTO }
  try {
    const rows = await db.query<CargaConfig>(
      "select pausada, tope_mensual, maximo_por_corrida, dia_reinicio from public.carga_config where id = 1"
    )
    return rows[0] ?? defecto
  } catch (err) {
    // Base con la versión anterior de db/007 (sin la columna): se sigue con el día por defecto.
    if (!/dia_reinicio/.test(String((err as { message?: string })?.message ?? ""))) throw err
    const rows = await db.query<Omit<CargaConfig, "dia_reinicio">>(
      "select pausada, tope_mensual, maximo_por_corrida from public.carga_config where id = 1"
    )
    return { ...(rows[0] ?? defecto), dia_reinicio: DIA_REINICIO_POR_DEFECTO }
  }
}

/** Avisos que cuentan contra el tope desde el último reinicio del crédito de Apify. */
export async function usoDelCiclo(db: Db, desde: string): Promise<number> {
  const rows = await db.query<{ usado: number }>(
    `select coalesce(sum(coalesce(avisos_recibidos, avisos_pedidos)), 0)::int as usado
       from public.carga_corridas
      where fuente = $1 and iniciada_en >= $2::timestamptz`,
    [FUENTE, desde]
  )
  return rows[0]?.usado ?? 0
}

export type ResultadoInicio =
  | { ok: true; items: number; runId: string }
  | { ok: false; motivo: MotivoNoEjecutar | "error"; detalle: string }

/** Lanza una corrida si los topes lo permiten. Nunca lanza excepciones por motivos de negocio. */
export async function iniciarCarga(
  db: Db,
  env: ApiEnv,
  origen: "manual" | "programada",
  usuario: string | null
): Promise<ResultadoInicio> {
  if (!configurada(env)) {
    return { ok: false, motivo: "sin_configurar", detalle: "Faltan APIFY_TOKEN y APIFY_WEBHOOK_SECRET en el servidor." }
  }

  // Una corrida que nunca respondió se da por perdida; su reserva sigue contando contra el tope.
  await db.query(
    `update public.carga_corridas
        set estado = 'fallida', finalizada_en = now(), detalle = 'Sin respuesta de Apify'
      where fuente = $1 and estado = 'iniciada' and iniciada_en < now() - ($2::int * interval '1 hour')`,
    [FUENTE, HORAS_CORRIDA_PERDIDA]
  )

  const config = await leerConfig(db)
  // Pausada: no hace falta ni consultar a Apify.
  if (config.pausada) return { ok: false, motivo: "pausada", detalle: "La carga automática está pausada." }
  const { apify, limites, ciclo } = await contextoDeGasto(env, config.dia_reinicio)
  const [usado, activa, previas] = await Promise.all([
    usoDelCiclo(db, ciclo.desde),
    db.query("select 1 from public.carga_corridas where fuente = $1 and estado = 'iniciada' limit 1", [FUENTE]),
    db.query<{ n: number }>("select count(*)::int as n from public.carga_corridas where fuente = $1", [FUENTE]),
  ])
  const plan = planificar(config, usado, activa.length > 0, limites, apify?.gastoUsd)
  if (!plan.ok) return plan

  const url = elegirUrl(urlsDeBusqueda(env), previas[0]?.n ?? 0)

  // Se reserva el cupo ANTES de llamar a Apify: si algo falla a medias, el tope sigue protegido.
  let id: number
  try {
    const filas = await db.query<{ id: number }>(
      `insert into public.carga_corridas (fuente, origen, iniciada_por, url_busqueda, avisos_pedidos)
       values ($1, $2, $3, $4, $5) returning id::int as id`,
      [FUENTE, origen, usuario, url, plan.items]
    )
    id = filas[0].id
  } catch {
    return { ok: false, motivo: "en_curso", detalle: "Ya hay una carga en curso." }
  }

  try {
    const corrida = await lanzarCorrida({
      token: env.APIFY_TOKEN as string,
      actor: env.APIFY_ACTOR || ACTOR_POR_DEFECTO,
      url,
      items: plan.items,
      topeUsd: topeDolares(plan.items, costoPorMil(env)),
      webhookUrl: `${sitioPublico(env)}/api/internal/apify-webhook?secret=${encodeURIComponent(env.APIFY_WEBHOOK_SECRET as string)}`,
    })
    await db.query("update public.carga_corridas set run_id = $2 where id = $1", [id, corrida.runId])
    return { ok: true, items: plan.items, runId: corrida.runId }
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

export interface EventoApify {
  eventType?: string
  resource?: { id?: string; defaultDatasetId?: string; status?: string }
}

/** Procesa el aviso de Apify: descarga los avisos de la corrida y los guarda. Idempotente. */
export async function procesarResultado(db: Db, env: ApiEnv, evento: EventoApify) {
  const runId = evento.resource?.id
  const datasetId = evento.resource?.defaultDatasetId
  if (!runId || !datasetId || !env.APIFY_TOKEN) return { procesada: false as const, motivo: "datos incompletos" }

  const corridas = await db.query<{ id: number; avisos_pedidos: number }>(
    "select id::int as id, avisos_pedidos from public.carga_corridas where run_id = $1 and estado = 'iniciada'",
    [runId]
  )
  if (corridas.length === 0) return { procesada: false as const, motivo: "corrida desconocida o ya procesada" }
  const corrida = corridas[0]

  const exito = evento.eventType === "ACTOR.RUN.SUCCEEDED"
  try {
    // Aunque la corrida falle, lo que alcanzó a entregar ya se cobró: se guarda y se cuenta.
    const items = (await leerDataset(env.APIFY_TOKEN, datasetId, corrida.avisos_pedidos)).slice(0, corrida.avisos_pedidos)
    const avisos = items.map(mapearAviso).filter((a): a is Aviso => a !== null)
    const { guardados } = avisos.length > 0 ? await guardarAvisos(db, avisos, usdToPenRate(env)) : { guardados: 0 }
    await db.query(
      `update public.carga_corridas
          set estado = $2, avisos_recibidos = $3, avisos_guardados = $4, finalizada_en = now(), detalle = $5
        where id = $1`,
      [corrida.id, exito ? "completada" : "fallida", items.length, guardados, exito ? null : (evento.eventType ?? "fallo")]
    )
    return { procesada: true as const, recibidos: items.length, guardados }
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
