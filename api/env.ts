import { DEFAULT_USD_TO_PEN_RATE } from "../shared/constants"

/** Variables de entorno que usa la API (todas opcionales salvo DATABASE_URL). */
export interface ApiEnv {
  DATABASE_URL?: string
  /** Tipo de cambio PEN por 1 USD; debe coincidir con VITE_USD_TO_PEN_RATE del cliente. */
  USD_TO_PEN_RATE?: string
  /** Alertas del watchdog: webhook (Slack/Discord compatible) y horas sin actividad para alertar. */
  ALERT_WEBHOOK_URL?: string
  ALERT_STALE_HOURS?: string
  /** Secreto que autoriza a un planificador externo a llamar a /api/internal/watchdog. */
  CRON_SECRET?: string
  /** Carga automática con Apify (todas opcionales: sin token y secreto la carga no se puede lanzar). */
  APIFY_TOKEN?: string
  APIFY_WEBHOOK_SECRET?: string
  /** Actor de Apify (`usuario~nombre`); por defecto el de Adondevivir. */
  APIFY_ACTOR?: string
  /** Actor de Urbania (`usuario~nombre`) y sus búsquedas a rotar (direcciones de urbania.pe/buscar/…, separadas por comas). */
  APIFY_ACTOR_URBANIA?: string
  CARGA_URLS_URBANIA?: string
  /** Actor de respaldo (`usuario~nombre`); "ninguno" lo desactiva. Por defecto scrapers_lat. */
  APIFY_ACTOR_RESPALDO?: string
  /** Crédito gratuito mensual de Apify en US$ (5 en el plan Free); define el tope máximo permitido. */
  APIFY_CREDIT_USD?: string
  /** Costo por 1 000 avisos del actor en US$, para calcular el tope en dólares de cada corrida. */
  APIFY_COST_PER_1000?: string
  /** Búsquedas de Adondevivir a rotar, separadas por comas (por defecto, las incluidas en el código). */
  CARGA_URLS?: string
  /** Dirección pública del sitio; Netlify la define sola en `URL`. */
  PUBLIC_URL?: string
  URL?: string
}

export function usdToPenRate(env: ApiEnv): number {
  const n = Number(env.USD_TO_PEN_RATE)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_TO_PEN_RATE
}

export function staleHours(env: ApiEnv): number {
  const n = Number(env.ALERT_STALE_HOURS)
  return Number.isFinite(n) && n > 0 ? n : 24
}
