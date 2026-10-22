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
/** Márgenes absolutos: la configuración nunca puede superarlos. */
export const TOPE_MENSUAL_MAX = 5000
export const MAXIMO_CORRIDA_MAX = 2000
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
}

export type MotivoNoEjecutar = "pausada" | "tope" | "en_curso" | "sin_configurar"

export type Plan = { ok: true; items: number } | { ok: false; motivo: MotivoNoEjecutar; detalle: string }

/** Decide cuántos avisos se pueden pedir ahora (función pura, probada aparte). */
export function planificar(config: CargaConfig, usadoMes: number, hayCorridaActiva: boolean): Plan {
  if (config.pausada) return { ok: false, motivo: "pausada", detalle: "La carga automática está pausada." }
  if (hayCorridaActiva) return { ok: false, motivo: "en_curso", detalle: "Ya hay una carga en curso." }
  const restante = config.tope_mensual - usadoMes
  if (restante <= 0) {
    return { ok: false, motivo: "tope", detalle: `Se alcanzó el tope mensual (${config.tope_mensual} avisos).` }
  }
  return { ok: true, items: Math.max(1, Math.min(config.maximo_por_corrida, restante)) }
}

/** Tope en dólares para una corrida: costo esperado + 25 % de margen, redondeado hacia arriba. */
export function topeDolares(items: number, costoPorMil: number): number {
  return Math.ceil(((items * costoPorMil) / 1000) * 1.25 * 100) / 100 + 0.01
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

// ── Estado y uso ─────────────────────────────────────────────────────────────

export async function leerConfig(db: Db): Promise<CargaConfig> {
  const rows = await db.query<CargaConfig>(
    "select pausada, tope_mensual, maximo_por_corrida from public.carga_config where id = 1"
  )
  return rows[0] ?? { pausada: true, tope_mensual: 1000, maximo_por_corrida: 200 }
}

/** Avisos que cuentan contra el tope en el mes de Lima en curso. */
export async function usoDelMes(db: Db): Promise<number> {
  const rows = await db.query<{ usado: number }>(
    `select coalesce(sum(coalesce(avisos_recibidos, avisos_pedidos)), 0)::int as usado
       from public.carga_corridas
      where fuente = $1
        and iniciada_en >= (date_trunc('month', now() at time zone 'America/Lima') at time zone 'America/Lima')`,
    [FUENTE]
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

  const [config, usado, activa, previas] = await Promise.all([
    leerConfig(db),
    usoDelMes(db),
    db.query("select 1 from public.carga_corridas where fuente = $1 and estado = 'iniciada' limit 1", [FUENTE]),
    db.query<{ n: number }>("select count(*)::int as n from public.carga_corridas where fuente = $1", [FUENTE]),
  ])
  const plan = planificar(config, usado, activa.length > 0)
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
