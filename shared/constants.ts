/** Constantes compartidas entre el cliente (client/) y la API (api/). */

export const DEFAULT_USD_TO_PEN_RATE = 3.75

/** Duración de una suscripción Premium y días de gracia previos a la eliminación. */
export const PREMIUM_DAYS = 30
export const GRACE_DAYS = 7

export const MIN_PASSWORD_LENGTH = 8

export const TIPOS_ENLACE = [
  "OTRO",
  "INFORMACION_ESTADISTICA",
  "INFORMACION_LEGAL",
  "DOCUMENTACION",
] as const

export type TipoEnlace = (typeof TIPOS_ENLACE)[number]

export const PORTAL_PAGE_SIZE = 24
export const ADMIN_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 48
