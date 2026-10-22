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
  /** Datos extra que algunas fuentes entregan (vista previa de la propiedad). */
  descripcion?: string
  direccion?: string
  estacionamientos?: string
  antiguedad?: string
  publicador?: string
  latitud?: number
  longitud?: number
  mantenimiento?: number
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
  descripcion: string | null
  direccion: string | null
  estacionamientos: string | null
  antiguedad: string | null
  publicador: string | null
  latitud: number | null
  longitud: number | null
  mantenimiento: number | null
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

/** Texto largo (descripción): sin etiquetas HTML, con entidades decodificadas y espacios normalizados. */
export function limpiarDescripcion(v: string | undefined, max = 4000): string | null {
  if (!v) return null
  const t = decodificarEntidades(v.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
  return t ? t.slice(0, max) : null
}

const corto = (v: string | undefined, max: number) => {
  const t = clean(v)
  return t ? t.slice(0, max) : null
}
const coord = (n: number | undefined, limite: number) => (Number.isFinite(n) && Math.abs(n as number) <= limite ? (n as number) : null)

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
    descripcion: limpiarDescripcion(aviso.descripcion),
    direccion: corto(aviso.direccion, 200),
    estacionamientos: corto(aviso.estacionamientos, 40),
    antiguedad: corto(aviso.antiguedad, 60),
    publicador: corto(aviso.publicador, 120),
    latitud: coord(aviso.latitud, 90),
    longitud: coord(aviso.longitud, 180),
    mantenimiento: money(aviso.mantenimiento) || null,
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
  "descripcion", "direccion", "estacionamientos", "antiguedad", "publicador", "latitud", "longitud", "mantenimiento",
] as const

/** Columnas que existen solo con las migraciones 008 (fotos) y 009 (detalles). */
const COLUMNAS_009 = ["descripcion", "direccion", "estacionamientos", "antiguedad", "publicador", "latitud", "longitud", "mantenimiento"] as const
type Columna = (typeof COLUMNAS)[number]

/** De la más completa a la más básica: se usa la primera que la base acepte. */
const NIVELES: readonly (readonly Columna[])[] = [
  COLUMNAS,
  COLUMNAS.filter(c => !(COLUMNAS_009 as readonly string[]).includes(c)),
  COLUMNAS.filter(c => c !== "imagenes" && !(COLUMNAS_009 as readonly string[]).includes(c)),
]

async function insertarLote(db: Db, lote: FilaPropiedad[], columnas: readonly Columna[]) {
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
  // Sin las migraciones 008/009 se sigue guardando todo lo demás, solo sin galería ni detalles.
  let nivel = 0
  for (let i = 0; i < lista.length; i += CHUNK) {
    const lote = lista.slice(i, i + CHUNK)
    for (;;) {
      try {
        await insertarLote(db, lote, NIVELES[nivel])
        break
      } catch (err) {
        const falta = /column .*does not exist|no existe la columna/i.test(String((err as { message?: string })?.message ?? ""))
        if (!falta || nivel === NIVELES.length - 1) throw err
        nivel++
      }
    }
  }
  return { guardados: lista.length, descartados }
}
