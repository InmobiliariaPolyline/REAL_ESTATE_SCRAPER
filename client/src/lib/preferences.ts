/** Preferencias de personalización de la interfaz (se guardan solo en este navegador). */

export const ACCENTS = [
  { id: "gold", label: "Dorado", swatch: "#d4b782" },
  { id: "teal", label: "Turquesa", swatch: "#4fd1b5" },
  { id: "blue", label: "Azul", swatch: "#6ea8fe" },
  { id: "violet", label: "Violeta", swatch: "#a78bfa" },
  { id: "green", label: "Verde", swatch: "#4ade80" },
  { id: "amber", label: "Ámbar", swatch: "#f5b454" },
] as const
export type Accent = (typeof ACCENTS)[number]["id"]

export const SCALES = [
  { id: "compact", label: "Compacta", hint: "Más contenido en pantalla" },
  { id: "normal", label: "Normal", hint: "Tamaño recomendado" },
  { id: "large", label: "Amplia", hint: "Texto y controles más grandes" },
] as const
export type UiScale = (typeof SCALES)[number]["id"]

export interface Preferences {
  accent: Accent
  scale: UiScale
  /** `auto` sigue la preferencia del sistema; `reduced` desactiva las animaciones. */
  motion: "auto" | "reduced"
  /** Luz ambiental animada detrás de la interfaz. */
  ambient: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  accent: "gold",
  scale: "normal",
  motion: "auto",
  ambient: true,
}

const STORAGE_KEY = "prefs"

const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback

/** Valida un objeto cualquiera y devuelve preferencias seguras (ignora valores desconocidos). */
export function sanitizePreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  return {
    accent: oneOf(r.accent, ACCENTS.map(a => a.id), DEFAULT_PREFERENCES.accent),
    scale: oneOf(r.scale, SCALES.map(s => s.id), DEFAULT_PREFERENCES.scale),
    motion: oneOf(r.motion, ["auto", "reduced"] as const, DEFAULT_PREFERENCES.motion),
    ambient: typeof r.ambient === "boolean" ? r.ambient : DEFAULT_PREFERENCES.ambient,
  }
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return sanitizePreferences(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* sin almacenamiento: la preferencia vale solo para esta visita */
  }
}

/** Refleja las preferencias en atributos de <html>, que el CSS usa para cambiar la apariencia. */
export function applyPreferences(prefs: Preferences, root: HTMLElement = document.documentElement): void {
  const set = (name: string, value: string | null) =>
    value === null ? root.removeAttribute(name) : root.setAttribute(name, value)
  set("data-accent", prefs.accent === "gold" ? null : prefs.accent)
  set("data-scale", prefs.scale === "normal" ? null : prefs.scale)
  set("data-motion", prefs.motion === "reduced" ? "reduced" : null)
  set("data-ambient", prefs.ambient ? null : "off")
}
