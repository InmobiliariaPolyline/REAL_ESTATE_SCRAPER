import {
  Building,
  Building2,
  Car,
  Construction,
  Hammer,
  HardHat,
  Home,
  Hotel,
  KeyRound,
  Sparkles,
  Sprout,
  Store,
  Tag,
  Trees,
  Briefcase,
  BedSingle,
  Warehouse,
  type LucideIcon,
} from "lucide-react"
import { claveNombre } from "@shared/ubicacion"
import type { DisplayPrice } from "./prices"

/** Colores de insignia disponibles (clases `badge-*` del diseño). */
export type TonoEtiqueta = "gold" | "green" | "rose" | "blue" | "violet" | "amber" | "muted"

export interface EtiquetaVisual {
  label: string
  icono: LucideIcon
  tono: TonoEtiqueta
}

/** Icono y color de cada tipo de inmueble; lo desconocido se muestra neutro, con su propio nombre. */
const TIPOS: Record<string, { icono: LucideIcon; tono: TonoEtiqueta; label: string }> = {
  departamento: { icono: Building2, tono: "blue", label: "Departamento" },
  casa: { icono: Home, tono: "green", label: "Casa" },
  terreno: { icono: Trees, tono: "amber", label: "Terreno" },
  oficina: { icono: Briefcase, tono: "violet", label: "Oficina" },
  "local comercial": { icono: Store, tono: "rose", label: "Local comercial" },
  proyecto: { icono: Construction, tono: "gold", label: "Proyecto" },
  edificio: { icono: Building, tono: "muted", label: "Edificio" },
  "local industrial": { icono: Warehouse, tono: "muted", label: "Local industrial" },
  "chacra o campo": { icono: Sprout, tono: "green", label: "Chacra o campo" },
  habitacion: { icono: BedSingle, tono: "violet", label: "Habitación" },
  cochera: { icono: Car, tono: "muted", label: "Cochera" },
  hotel: { icono: Hotel, tono: "rose", label: "Hotel" },
}

export function tipoVisual(inmueble: string | null | undefined): EtiquetaVisual {
  const t = (inmueble ?? "").trim()
  const conocido = TIPOS[claveNombre(t)]
  return conocido ?? { label: t || "Inmueble", icono: Home, tono: "muted" }
}

/** Venta o alquiler, con su icono y color. */
export function operacionVisual(operacion: string | null | undefined): EtiquetaVisual {
  return String(operacion).toUpperCase() === "ALQUILER"
    ? { label: "Alquiler", icono: KeyRound, tono: "green" }
    : { label: "Venta", icono: Tag, tono: "rose" }
}

export const esAlquiler = (operacion: string | null | undefined) => String(operacion).toUpperCase() === "ALQUILER"

/** Estado de la construcción a partir de la antigüedad que publica el aviso; `null` si no hay dato útil. */
export function estadoDeAntiguedad(antiguedad: string | null | undefined): EtiquetaVisual | null {
  const t = (antiguedad ?? "").trim()
  if (!t) return null
  const clave = claveNombre(t)
  if (/^en construccion|^en planos|^preventa/.test(clave)) return { label: "En construcción", icono: HardHat, tono: "amber" }
  if (/^estreno|^a estrenar|^nuevo/.test(clave) || /^0\b/.test(clave)) return { label: "Estreno", icono: Sparkles, tono: "green" }
  const n = Number(/^(\d+)/.exec(clave)?.[1])
  if (Number.isFinite(n) && n > 0) return { label: `${n} ${n === 1 ? "año" : "años"}`, icono: Hammer, tono: "muted" }
  return null
}

/** El aviso entró al sistema hace poco (por defecto, en los últimos 3 días). */
export function esNuevo(creadoEn: string | null | undefined, horas = 72, ahora = Date.now()): boolean {
  if (!creadoEn) return false
  const t = Date.parse(creadoEn)
  return Number.isFinite(t) && ahora - t >= 0 && ahora - t <= horas * 3_600_000
}

/** «147 m2» -> «147 m²» (y lo demás se deja igual). */
export const formatoArea = (area: string | null | undefined): string => (area ?? "").trim().replace(/\bm2\b/gi, "m²")

/** Primer número del texto de área, o `null`. */
export function areaNumero(area: string | null | undefined): number | null {
  const n = Number(/^\s*(\d+(?:[.,]\d+)?)/.exec(area ?? "")?.[1]?.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Precio por m² en la moneda mostrada; `null` si falta el precio o el área no es creíble. */
export function precioPorM2Texto(price: DisplayPrice, area: string | null | undefined): string | null {
  const m2 = areaNumero(area)
  if (price.amount <= 0 || !m2 || m2 < 8) return null
  return `${price.label} ${Math.round(price.amount / m2).toLocaleString("es-PE")} por m²`
}

/** Distrito, y el departamento cuando no es Lima: «Cayma, Arequipa». */
export function ubicacionTexto(distrito: string | null | undefined, departamento: string | null | undefined): string {
  const d = (distrito ?? "").trim()
  const dep = (departamento ?? "").trim()
  if (!d) return dep
  if (!dep || claveNombre(dep) === "lima" || claveNombre(dep) === claveNombre(d)) return d
  return `${d}, ${dep}`
}
