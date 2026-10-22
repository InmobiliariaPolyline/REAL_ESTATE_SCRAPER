import { DEFAULT_USD_TO_PEN_RATE } from "../shared/constants"
import { safeHttpUrl } from "../shared/url"

export const PORTALES = ["properati", "infocasas", "babilonia", "urbania", "adondevivir"] as const
export type Portal = (typeof PORTALES)[number]

/** Aviso tal como lo entrega una fuente (adaptador de portal). */
export interface Aviso {
  portal: Portal
  /** Código del aviso en el portal: junto al portal forma el `id` estable (clave del UPSERT). */
  codigo: string
  operacion: "VENTA" | "ALQUILER"
  inmueble: string
  titulo?: string
  /** Precio publicado, en `moneda`. Omitir si el aviso no lo tiene. */
  precio?: number
  moneda?: "PEN" | "USD"
  /** Si la fuente ya lo conoce; si no, se calcula con el tipo de cambio. */
  precioUsd?: number
  distrito?: string
  dormitorios?: string
  banios?: string
  area?: string
  imagen?: string
  /** Todas las fotos del aviso, en orden (si se omite, solo `imagen`). */
  imagenes?: string[]
  url?: string
}

/** Fila lista para `public.propiedades`. */
export interface FilaPropiedad {
  id: string
  portal: string
  operacion: string
  inmueble: string
  titulo: string | null
  precio: number
  precio_usd: number
  moneda: "PEN" | "USD"
  distrito: string | null
  dormitorios: string | null
  banios: string | null
  area: string | null
  imagen: string | null
  imagenes: string[]
  url: string | null
}

const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", sup2: "²", sup3: "³", deg: "°", ordm: "º", ordf: "ª",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", iexcl: "¡", iquest: "¿",
}

/** Convierte entidades HTML (`&sup2;`, `&amp;`, `&#39;`…) en sus caracteres; las desconocidas quedan igual. */
export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return ENTIDADES[e] ?? ENTIDADES[e.toLowerCase()] ?? m
  })
}

const clean = (v: string | undefined) => {
  const t = v ? decodificarEntidades(v).trim() : ""
  return t ? t : null
}
/** Máximo de fotos que se guardan por aviso. */
export const MAX_FOTOS = 20

/** Fotos válidas (http/https), sin repetir y en orden; la portada va primero. */
/** Las fotos de Adondevivir/Urbania (naventcdn) traen el tamaño en la dirección; se pide el grande (720x532). */
export function fotoGrande(url: string): string {
  return /^https:\/\/[\w.-]*naventcdn\.com\//.test(url) ? url.replace(/\/\d{3,4}x\d{3,4}\//, "/720x532/") : url
}

export function normalizarFotos(portada: string | undefined, fotos: string[] | undefined): string[] {
  const salida: string[] = []
  for (const f of [portada, ...(fotos ?? [])]) {
    const seguro = safeHttpUrl(f)
    const u = seguro ? fotoGrande(seguro) : null
    if (u && !salida.includes(u)) salida.push(u)
    if (salida.length >= MAX_FOTOS) break
  }
  return salida
}
/**
 * Algunas fuentes entregan un precio en dólares que no cuadra con el publicado (p. ej. US$ 357 000
 * para un alquiler de S/ 1 199). Si se aleja mucho de lo esperado con el tipo de cambio, se descarta
 * y se recalcula.
 */
export function usdCoherente(precio: number, moneda: "PEN" | "USD", usd: number, usdToPen: number): number {
  if (!usd || !precio) return usd
  const esperado = moneda === "USD" ? precio : precio / usdToPen
  const razon = usd / esperado
  return razon >= 0.7 && razon <= 1.45 ? usd : 0
}

const money = (n: number | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0)

/** Valida y normaliza un aviso. Devuelve `null` si no se puede identificar de forma estable. */
export function normalizarAviso(
  aviso: Aviso,
  usdToPen: number = DEFAULT_USD_TO_PEN_RATE
): FilaPropiedad | null {
  const codigo = aviso.codigo?.trim()
  if (!codigo || !PORTALES.includes(aviso.portal)) return null
  if (aviso.operacion !== "VENTA" && aviso.operacion !== "ALQUILER") return null

  const moneda = aviso.moneda === "USD" ? "USD" : "PEN"
  const precio = money(aviso.precio)
  let precioUsd = usdCoherente(money(aviso.precio), moneda, money(aviso.precioUsd), usdToPen)
  if (!precioUsd && precio) precioUsd = moneda === "USD" ? precio : precio / usdToPen

  const imagenes = normalizarFotos(aviso.imagen, aviso.imagenes)
  return {
    id: `${aviso.portal}:${codigo}`,
    portal: aviso.portal,
    operacion: aviso.operacion,
    inmueble: aviso.inmueble.trim() || "Departamento",
    titulo: clean(aviso.titulo),
    precio,
    precio_usd: Math.round(precioUsd * 100) / 100,
    moneda,
    distrito: clean(aviso.distrito),
    dormitorios: clean(aviso.dormitorios),
    banios: clean(aviso.banios),
    area: clean(aviso.area),
    imagen: imagenes[0] ?? null,
    imagenes,
    url: safeHttpUrl(aviso.url),
  }
}

/** Lo mínimo que necesita de la base (compatible con `pg.Client` y con PGlite). */
export interface Db {
  query: (text: string, params?: unknown[]) => Promise<unknown>
}

const CHUNK = 200
const COLUMNAS = [
  "id", "portal", "operacion", "inmueble", "titulo", "precio", "precio_usd", "moneda",
  "distrito", "dormitorios", "banios", "area", "imagen", "url", "imagenes",
] as const

async function insertarLote(db: Db, lote: FilaPropiedad[], columnas: readonly (typeof COLUMNAS)[number][]) {
  const params: unknown[] = []
  const valores = lote.map(fila => {
    const base = params.length
    for (const col of columnas) params.push(fila[col])
    return `(${columnas.map((_, j) => `$${base + j + 1}`).join(", ")}, now(), now())`
  })
  await db.query(
    `insert into public.propiedades (${columnas.join(", ")}, creado_en, ultima_vista_en)
     values ${valores.join(", ")}
     on conflict (id) do update set
       ${columnas.filter(c => c !== "id").map(c => `${c} = excluded.${c}`).join(", ")},
       ultima_vista_en = now()`,
    params
  )
}

/**
 * UPSERT por `id` (ver docs/INGESTA.md): `creado_en` no se toca y `ultima_vista_en` se refresca
 * en cada corrida en que el aviso sigue publicado.
 */
export async function guardarAvisos(
  db: Db,
  avisos: Aviso[],
  usdToPen: number = DEFAULT_USD_TO_PEN_RATE
): Promise<{ guardados: number; descartados: number }> {
  // Si un aviso viene repetido en la misma corrida se queda con el último.
  const filas = new Map<string, FilaPropiedad>()
  let descartados = 0
  for (const aviso of avisos) {
    const fila = normalizarAviso(aviso, usdToPen)
    if (fila) filas.set(fila.id, fila)
    else descartados++
  }

  const lista = [...filas.values()]
  // Sin la migración 008 (columna `imagenes`) se sigue guardando todo, solo sin la galería.
  let columnas: readonly (typeof COLUMNAS)[number][] = COLUMNAS
  for (let i = 0; i < lista.length; i += CHUNK) {
    const lote = lista.slice(i, i + CHUNK)
    try {
      await insertarLote(db, lote, columnas)
    } catch (err) {
      if (columnas === COLUMNAS && /\bimagenes\b/.test(String((err as { message?: string })?.message ?? ""))) {
        columnas = COLUMNAS.filter(c => c !== "imagenes")
        await insertarLote(db, lote, columnas)
      } else {
        throw err
      }
    }
  }
  return { guardados: lista.length, descartados }
}
