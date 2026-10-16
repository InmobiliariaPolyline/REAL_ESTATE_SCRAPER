/**
 * Configuración central de la aplicación.
 * Todos los valores sensibles al entorno salen de variables VITE_* (ver .env.example).
 */

const env = import.meta.env

export const SUPABASE_URL: string = (env.VITE_SUPABASE_URL ?? "").trim()
export const SUPABASE_ANON_KEY: string = (env.VITE_SUPABASE_ANON_KEY ?? "").trim()

/** true cuando las variables de Supabase están definidas y no son marcadores de ejemplo. */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("http") &&
  !SUPABASE_URL.includes("TU_PROJECT") &&
  SUPABASE_ANON_KEY.length > 0 &&
  SUPABASE_ANON_KEY !== "TU_ANON_KEY"

/** WhatsApp del administrador (sin "+" ni espacios). */
export const ADMIN_WHATSAPP: string = (
  env.VITE_ADMIN_WHATSAPP ?? "51943812536"
).replace(/\D/g, "")

/** Tipo de cambio PEN por 1 USD usado para comparar y mostrar precios. */
const parsedRate = Number(env.VITE_USD_TO_PEN_RATE)
export const USD_TO_PEN_RATE: number =
  Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 3.75

/** Zona horaria con la que se calculan vencimientos (Perú no usa horario de verano). */
export const APP_TIMEZONE = "America/Lima"

/** Duración de una suscripción Premium y días de gracia previos a la eliminación. */
export const PREMIUM_DAYS = 30
export const GRACE_DAYS = 7

/** Vigencia máxima de la sesión guardada en el navegador. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000

/** Límite de intentos de login fallidos antes del bloqueo temporal en el cliente. */
export const LOGIN_MAX_ATTEMPTS = 5
export const LOGIN_LOCK_MS = 60 * 1000
