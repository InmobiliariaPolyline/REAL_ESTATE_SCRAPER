import { parseAreaM2 } from "@shared/area"
import { cuotaMensual } from "./finance"
import { USD_TO_PEN_RATE } from "./config"
import type { Propiedad } from "@/types"

/** Datos de la zona (mismo distrito y operación) que entrega el detalle. */
export interface MercadoZona {
  avisos: number
  mediana_usd: number | null
  min_usd: number | null
  max_usd: number | null
  mediana_m2_usd: number | null
  /** Avisos de la zona más baratos que este. */
  mas_baratos: number
}

/** Supuestos de la hipoteca de referencia (los mismos de la calculadora). */
export const HIPOTECA = { inicialPct: 20, tasaAnualPct: 9, anios: 20, ingresoCuotaPct: 30 } as const

/** Meses de garantía y adelanto que suele pedir un alquiler. */
export const MESES_GARANTIA = 2

const positivo = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0
const toNumber = (v: string | null | undefined): number | null => {
  const n = Number((v ?? "").replace(/[^\d.]/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

export const dormitoriosN = (p: Pick<Propiedad, "dormitorios">) => toNumber(p.dormitorios)
export const baniosN = (p: Pick<Propiedad, "banios">) => toNumber(p.banios)

/** Precio del aviso en dólares y en soles, aunque la fuente solo traiga una de las dos monedas. */
export function preciosDelAviso(p: Pick<Propiedad, "precio" | "precio_usd" | "moneda">, tipoCambio = USD_TO_PEN_RATE) {
  let usd = positivo(p.precio_usd) ? p.precio_usd : 0
  let pen = p.moneda === "PEN" && positivo(p.precio) ? p.precio : 0
  if (!usd && positivo(p.precio) && p.moneda === "USD") usd = p.precio
  if (!usd && pen) usd = pen / tipoCambio
  if (!pen && usd) pen = usd * tipoCambio
  return { usd, pen, aproximado: !positivo(p.precio_usd) || (p.moneda === "PEN" ? false : !positivo(p.precio)) }
}

/** Precio por m² en dólares y en soles. */
export function precioPorM2(p: Pick<Propiedad, "precio" | "precio_usd" | "moneda" | "area">) {
  const m2 = parseAreaM2(p.area)
  const { usd, pen } = preciosDelAviso(p)
  return { m2, usd: m2 && usd ? usd / m2 : null, pen: m2 && pen ? pen / m2 : null }
}

export interface Posicion {
  /** Diferencia con la mediana de la zona, en porcentaje (negativo = más barato). */
  difPct: number
  nivel: "bajo" | "rango" | "alto"
  /** Porcentaje de avisos de la zona que son más baratos que este. */
  percentil: number
}

/** Dónde queda el precio del aviso frente a la mediana de su zona; `null` si no hay datos para comparar. */
export function posicionEnZona(usd: number, mercado: MercadoZona | null | undefined): Posicion | null {
  if (!positivo(usd) || !mercado || !positivo(mercado.mediana_usd) || mercado.avisos < 3) return null
  const difPct = ((usd - mercado.mediana_usd) / mercado.mediana_usd) * 100
  return {
    difPct,
    nivel: difPct <= -10 ? "bajo" : difPct >= 10 ? "alto" : "rango",
    percentil: Math.round((mercado.mas_baratos / mercado.avisos) * 100),
  }
}

/** Posición (0 a 100) del precio dentro del rango min–max de la zona, para dibujar el marcador. */
export function posicionEnRango(usd: number, min: number | null, max: number | null): number | null {
  if (!positivo(usd) || !positivo(min) || !positivo(max) || max <= min) return null
  return Math.min(100, Math.max(0, ((usd - min) / (max - min)) * 100))
}

export interface Financiamiento {
  inicial: number
  prestamo: number
  cuota: number
  /** Ingreso mensual que haría que la cuota sea el 30 % (referencia habitual de los bancos). */
  ingresoSugerido: number
  totalIntereses: number
}

/** Hipoteca de referencia para una venta (en la moneda de `precio`). */
export function financiamiento(precio: number): Financiamiento | null {
  if (!positivo(precio)) return null
  const inicial = (precio * HIPOTECA.inicialPct) / 100
  const prestamo = precio - inicial
  const cuota = cuotaMensual(prestamo, HIPOTECA.tasaAnualPct, HIPOTECA.anios)
  return {
    inicial,
    prestamo,
    cuota,
    ingresoSugerido: cuota / (HIPOTECA.ingresoCuotaPct / 100),
    totalIntereses: Math.max(0, cuota * HIPOTECA.anios * 12 - prestamo),
  }
}

/** Categoría de tamaño según los m² (referencia para departamentos y casas urbanas). */
export function categoriaTamano(m2: number | null): "compacto" | "medio" | "amplio" | "muy amplio" | null {
  if (!positivo(m2)) return null
  return m2 < 50 ? "compacto" : m2 < 100 ? "medio" : m2 < 200 ? "amplio" : "muy amplio"
}

/** Días enteros desde `iso` hasta `ahora`; `null` si la fecha no es válida. */
export function diasDesde(iso: string | null | undefined, ahora: number = Date.now()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((ahora - t) / 86_400_000))
}

/** «hoy», «ayer», «hace 5 días», «hace 3 meses»… */
export function antiguedadTexto(dias: number | null): string {
  if (dias === null) return "—"
  if (dias < 1) return "hoy"
  if (dias === 1) return "ayer"
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses < 12 ? `hace ${meses} ${meses === 1 ? "mes" : "meses"}` : `hace ${Math.floor(meses / 12)} año(s)`
}

export interface VariacionPrecio {
  primero: number
  ultimo: number
  minimo: number
  maximo: number
  cambioPct: number
  registros: number
}

/** Resumen del historial de precios (en la moneda dada); `null` con menos de dos registros. */
export function variacionDePrecio(serie: number[]): VariacionPrecio | null {
  const v = serie.filter(positivo)
  if (v.length < 2) return null
  const primero = v[0]
  const ultimo = v[v.length - 1]
  return { primero, ultimo, minimo: Math.min(...v), maximo: Math.max(...v), cambioPct: ((ultimo - primero) / primero) * 100, registros: v.length }
}

/** Dirección de Google Maps: por coordenadas si las hay, si no por dirección y distrito. */
export function mapaUrl(p: Pick<Propiedad, "distrito"> & { direccion?: string | null; latitud?: number | null; longitud?: number | null }): string | null {
  if (typeof p.latitud === "number" && typeof p.longitud === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`
  }
  const lugar = [p.direccion, p.distrito, "Perú"].filter(Boolean).join(", ")
  return p.distrito || p.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugar)}` : null
}

/** Texto corto del aviso para copiar o compartir. */
export function resumenDelAviso(p: Propiedad, precioTexto: string): string {
  const partes = [
    p.titulo,
    precioTexto,
    [p.dormitorios && `${p.dormitorios} dorm.`, p.banios && `${p.banios} baños`, p.area].filter(Boolean).join(" · "),
    p.distrito,
    p.url,
  ]
  return partes.filter(Boolean).join("\n")
}

/** Enlace para compartir el resumen por WhatsApp. */
export const whatsappUrl = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`
