import { APP_TIMEZONE } from "./config"

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la aplicación, no en UTC. */
export function todayISO(now: Date = new Date()): string {
  return isoFormatter.format(now)
}

/** Suma (o resta) días a una fecha YYYY-MM-DD sin depender de la zona horaria local. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** Inicio del día de hoy (hora de Lima) como timestamp ISO con offset, para filtros `creado_en`. */
export function startOfTodayTimestamp(): string {
  // Lima es UTC-5 todo el año.
  return `${todayISO()}T00:00:00-05:00`
}

/** Formatea una fecha YYYY-MM-DD (o timestamp) para mostrar; "—" si no es válida. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  // Las fechas "solo día" se interpretan como locales para evitar el desfase de un día.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** Formatea fecha y hora para mostrar; "—" si no es válida. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("es-PE", { timeZone: APP_TIMEZONE })
}
