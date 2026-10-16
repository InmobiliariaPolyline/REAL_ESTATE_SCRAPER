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
}

export function usdToPenRate(env: ApiEnv): number {
  const n = Number(env.USD_TO_PEN_RATE)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_TO_PEN_RATE
}

export function staleHours(env: ApiEnv): number {
  const n = Number(env.ALERT_STALE_HOURS)
  return Number.isFinite(n) && n > 0 ? n : 24
}
