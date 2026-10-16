import { DEFAULT_USD_TO_PEN_RATE } from "../shared/constants"

/** Variables de entorno que usa la API (todas opcionales salvo DATABASE_URL). */
export interface ApiEnv {
  DATABASE_URL?: string
  /** Tipo de cambio PEN por 1 USD; debe coincidir con VITE_USD_TO_PEN_RATE del cliente. */
  USD_TO_PEN_RATE?: string
  /** Para "Forzar scraper": token con permiso Actions (write) y destino del workflow. */
  GITHUB_PAT?: string
  GITHUB_REPO?: string
  GITHUB_WORKFLOW?: string
  GITHUB_REF?: string
}

export function usdToPenRate(env: ApiEnv): number {
  const n = Number(env.USD_TO_PEN_RATE)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_TO_PEN_RATE
}
