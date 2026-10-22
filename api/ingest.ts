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
  url: string | null
}

const clean = (v: string | undefined) => {
  const t = v?.trim()
  return t ? t : null
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
  let precioUsd = money(aviso.precioUsd)
  if (!precioUsd && precio) precioUsd = moneda === "USD" ? precio : precio / usdToPen

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
    imagen: safeHttpUrl(aviso.imagen),
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
  "distrito", "dormitorios", "banios", "area", "imagen", "url",
] as const

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
  for (let i = 0; i < lista.length; i += CHUNK) {
    const lote = lista.slice(i, i + CHUNK)
    const params: unknown[] = []
    const valores = lote.map(fila => {
      const base = params.length
      for (const col of COLUMNAS) params.push(fila[col])
      return `(${COLUMNAS.map((_, j) => `$${base + j + 1}`).join(", ")}, now(), now())`
    })
    await db.query(
      `insert into public.propiedades (${COLUMNAS.join(", ")}, creado_en, ultima_vista_en)
       values ${valores.join(", ")}
       on conflict (id) do update set
         ${COLUMNAS.filter(c => c !== "id").map(c => `${c} = excluded.${c}`).join(", ")},
         ultima_vista_en = now()`,
      params
    )
  }
  return { guardados: lista.length, descartados }
}
