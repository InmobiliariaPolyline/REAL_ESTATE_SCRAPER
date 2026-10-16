/**
 * Configuración central de la aplicación.
 * Todos los valores sensibles al entorno salen de variables VITE_* (ver .env.example).
 * Aquí NO hay secretos: la cadena de conexión a la base vive solo en el servidor (api/).
 */
import { DEFAULT_USD_TO_PEN_RATE, GRACE_DAYS, PREMIUM_DAYS } from "@shared/constants"

const env = import.meta.env

/**
 * URL base de la API. Vacía = mismo origen (`/api`, con Netlify Functions o el servidor
 * Express). Solo se define si la API se despliega en otro dominio.
 */
export const API_BASE_URL: string = (env.VITE_API_URL ?? "").trim().replace(/\/+$/, "")

/** WhatsApp del administrador (sin "+" ni espacios). */
export const ADMIN_WHATSAPP: string = (
  env.VITE_ADMIN_WHATSAPP ?? "51943812536"
).replace(/\D/g, "")

/** Tipo de cambio PEN por 1 USD usado para mostrar precios (debe coincidir con el de la API). */
const parsedRate = Number(env.VITE_USD_TO_PEN_RATE)
export const USD_TO_PEN_RATE: number =
  Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : DEFAULT_USD_TO_PEN_RATE

/** Zona horaria con la que se muestran fechas (Perú no usa horario de verano). */
export const APP_TIMEZONE = "America/Lima"

export { GRACE_DAYS, PREMIUM_DAYS }

/** Vigencia máxima de la sesión guardada en el navegador (el servidor usa el mismo plazo). */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000

/** Inactividad (sin mover el ratón, teclear ni tocar) tras la cual se cierra la sesión. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000

/** Aviso con cuenta atrás antes de cerrar por inactividad. */
export const IDLE_WARNING_MS = 60 * 1000

/** Mientras el usuario está activo, se avisa al servidor cada tanto para no caducar su sesión. */
export const KEEPALIVE_MS = 5 * 60 * 1000
