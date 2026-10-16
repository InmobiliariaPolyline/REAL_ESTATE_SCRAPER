import type { Db } from "./db"
import { staleHours, type ApiEnv } from "./env"

const ALERT_KEY = "scraper_inactivo"
/** Mínimo entre dos alertas del mismo incidente. */
const REPEAT_EVERY_HOURS = 24

export interface WatchdogResult {
  /** Horas desde la última actividad del scraper (`null` si aún no hay datos). */
  hours: number | null
  stale: boolean
  /** true si en esta ejecución se envió una alerta. */
  alerted: boolean
  reason?: "sin_datos" | "ya_alertado" | "webhook_no_configurado" | "recuperado"
}

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>

/**
 * Vigila al scraper: si no hay avisos nuevos ni refrescados en `ALERT_STALE_HOURS`, envía una
 * alerta al webhook (una vez cada 24 h por incidente). Se ejecuta desde una función programada
 * o desde `POST /api/internal/watchdog` con un planificador externo.
 */
export async function runWatchdog(
  db: Db,
  env: ApiEnv,
  fetchFn: FetchLike = fetch,
  now: Date = new Date()
): Promise<WatchdogResult> {
  const [row] = await db.query<{ ultimo: string | null }>(
    `select greatest(max(creado_en), max(ultima_vista_en)) as ultimo from public.propiedades`
  )
  if (!row?.ultimo) return { hours: null, stale: false, alerted: false, reason: "sin_datos" }

  const last = new Date(row.ultimo)
  const hours = (now.getTime() - last.getTime()) / 36e5
  const threshold = staleHours(env)

  if (hours <= threshold) {
    // Recuperado: se limpia el incidente para que el próximo fallo alerte de inmediato.
    const cleared = await db.query("delete from public.app_alerts where clave = $1 returning clave", [
      ALERT_KEY,
    ])
    return { hours, stale: false, alerted: false, reason: cleared.length ? "recuperado" : undefined }
  }

  const sent = await db.query<{ horas: number }>(
    `select extract(epoch from (now() - ultimo_envio)) / 3600 as horas
       from public.app_alerts where clave = $1`,
    [ALERT_KEY]
  )
  if (sent.length && Number(sent[0].horas) < REPEAT_EVERY_HOURS) {
    return { hours, stale: true, alerted: false, reason: "ya_alertado" }
  }

  const webhook = env.ALERT_WEBHOOK_URL
  if (!webhook) return { hours, stale: true, alerted: false, reason: "webhook_no_configurado" }

  const text =
    `Alerta Real Estate Scraper: el scraper lleva ${Math.floor(hours)} h sin actividad ` +
    `(último aviso: ${last.toISOString()}). Umbral: ${threshold} h.`
  const res = await fetchFn(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // `text` (Slack, Mattermost) y `content` (Discord) en el mismo cuerpo.
    body: JSON.stringify({ text, content: text }),
  })
  if (!res.ok) throw new Error(`El webhook respondió ${res.status}`)

  await db.query(
    `insert into public.app_alerts (clave, ultimo_envio) values ($1, now())
     on conflict (clave) do update set ultimo_envio = excluded.ultimo_envio`,
    [ALERT_KEY]
  )
  return { hours, stale: true, alerted: true }
}
