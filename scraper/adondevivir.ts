import zlib from "node:zlib"
import type { Aviso } from "./ingest"

/**
 * Lector de adondevivir.com. Solo usa lo que el propio sitio ofrece a los buscadores:
 *   - su sitemap (lista de avisos con fecha de actualización), y
 *   - las páginas públicas de cada aviso (datos estructurados schema.org + bloque de precio).
 * No toca su API interna (/avisos-api/), que su robots.txt prohíbe.
 */

export const SITE = "https://www.adondevivir.com"
export const SITEMAP_INDEX = `${SITE}/sitemaps_https.xml`

export interface SitemapEntry {
  url: string
  /** Número del aviso (clave del UPSERT: `adondevivir:<id>`). */
  id: string
  /** Fecha de última actualización según el sitio (AAAA-MM-DD) o null. */
  lastmod: string | null
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

/** Direcciones de los sitemaps de avisos individuales (no los de proyectos ni de listados). */
export function parseSitemapIndex(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g))
    .map(m => m[1])
    .filter(u => /sitemap_prop_https_\d+\.xml(\.gz)?$/.test(u))
}

export function parseUrlset(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = []
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(block[1])?.[1]
    if (!loc || !loc.includes("/propiedades/clasificado/")) continue
    const id = /-(\d+)\.html$/.exec(loc)?.[1]
    if (!id) continue
    const lastmod = /<lastmod>\s*(\d{4}-\d{2}-\d{2})/.exec(block[1])?.[1] ?? null
    out.push({ url: loc, id, lastmod })
  }
  return out
}

// ── Página de aviso ───────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " }

const decode = (s: string) =>
  s
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))

const text = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim()

/** "10,320" -> 10320; "1.200,50" no aparece en el sitio, pero se tolera. */
export function parseMonto(raw: string): number {
  let s = raw.trim().replace(/[^\d.,]/g, "")
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "")
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".")
  else s = s.replace(",", ".")
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : 0
}

interface LdAviso {
  "@type"?: string
  image?: string
  floorSize?: { value?: number }
  numberOfBedrooms?: number
  numberOfBathroomsTotal?: number
  address?: { addressRegion?: string; addressLocality?: string }
}

function ldAviso(html: string): LdAviso | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1].trim()) as LdAviso
      if (d["@type"] && !["WebSite", "Organization", "BreadcrumbList"].includes(d["@type"])) return d
    } catch {
      /* bloque inválido: se ignora */
    }
  }
  return null
}

const TIPO_POR_SCHEMA: Record<string, string> = {
  Apartment: "Departamento",
  House: "Casa",
  SingleFamilyResidence: "Casa",
}

const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s)

/**
 * Extrae un aviso de su página. Devuelve `null` si no se puede identificar con seguridad
 * (sin número, sin operación o sin título): es preferible omitirlo que guardar datos dudosos.
 */
export function parseAviso(html: string, url: string): Aviso | null {
  const codigo = /-(\d+)\.html/.exec(url)?.[1]
  if (!codigo) return null

  const titulo = /<h1[^>]*class="title-property"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]
  const tituloLimpio = titulo ? text(titulo) : ""
  if (!tituloLimpio) return null

  // Bloque de precio: "alquiler S/ 10,320 · USD 3,000" / "venta USD 250,000".
  const bloque = /class="price-value"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? ""
  const plano = text(bloque)
  const palabra = /^\s*([A-Za-zñÑáéíóúÁÉÍÓÚ]+)/.exec(plano)?.[1]?.toLowerCase() ?? ""
  const porUrl = /\/clasificado\/(ve|al)/.exec(url)?.[1]
  const operacion: Aviso["operacion"] | null = palabra.startsWith("alquil")
    ? "ALQUILER"
    : palabra.startsWith("venta")
      ? "VENTA"
      : porUrl === "al"
        ? "ALQUILER"
        : porUrl === "ve"
          ? "VENTA"
          : null
  if (!operacion) return null

  const soles = /S\/\.?\s*([\d.,]+)/.exec(plano)?.[1]
  const dolares = /(?:USD|US\$|\$)\s*([\d.,]+)/.exec(plano)?.[1]
  const pen = soles ? parseMonto(soles) : 0
  const usd = dolares ? parseMonto(dolares) : 0

  const ld = ldAviso(html)
  const tipoH2 = /class="title-type-sup-property"[^>]*>([\s\S]*?)<\/h2>/.exec(html)?.[1]
  const tipoTexto = tipoH2 ? text(tipoH2).split(/[·•�|]/)[0].trim() : ""
  const inmueble = tipoTexto ? capitalizar(tipoTexto) : (TIPO_POR_SCHEMA[ld?.["@type"] ?? ""] ?? "Otro")

  const area = ld?.floorSize?.value
  const aviso: Aviso = {
    portal: "adondevivir",
    codigo,
    operacion,
    inmueble,
    titulo: tituloLimpio,
    distrito: (ld?.address?.addressRegion ?? ld?.address?.addressLocality ?? "").replace(/[,\s]+$/, ""),
    dormitorios: ld?.numberOfBedrooms !== undefined ? String(ld.numberOfBedrooms) : undefined,
    banios: ld?.numberOfBathroomsTotal !== undefined ? String(ld.numberOfBathroomsTotal) : undefined,
    area: area ? `${area} m2` : undefined,
    imagen: ld?.image,
    url,
  }

  // Si el sitio muestra ambas monedas, se guardan las dos; si solo una, la otra se calcula.
  if (pen && usd) {
    aviso.precio = pen
    aviso.moneda = "PEN"
    aviso.precioUsd = usd
  } else if (usd) {
    aviso.precio = usd
    aviso.moneda = "USD"
  } else if (pen) {
    aviso.precio = pen
    aviso.moneda = "PEN"
  }
  return aviso
}

// ── Descarga ──────────────────────────────────────────────────────────────────

export class BloqueadoError extends Error {
  constructor(public status: number, url: string) {
    super(`El sitio rechazó la petición (HTTP ${status}) en ${url}`)
    this.name = "BloqueadoError"
  }
}

export interface FetchOptions {
  userAgent: string
  timeoutMs?: number
  retries?: number
}

/** Descarga un recurso y lo devuelve como texto (descomprime .gz aunque llegue como text/html). */
export async function fetchText(url: string, { userAgent, timeoutMs = 30_000, retries = 2 }: FetchOptions): Promise<string> {
  let ultimo: unknown
  for (let intento = 0; intento <= retries; intento++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent, Accept: "text/html,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "es-PE,es;q=0.9" },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.status === 403 || res.status === 429) throw new BloqueadoError(res.status, url)
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const raw = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf
      return raw.toString("utf8")
    } catch (err) {
      if (err instanceof BloqueadoError) throw err // no se insiste si el sitio dijo que no
      ultimo = err
      await new Promise(r => setTimeout(r, 1500 * (intento + 1)))
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo))
}
