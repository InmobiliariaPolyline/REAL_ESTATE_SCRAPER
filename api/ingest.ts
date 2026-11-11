import { DEFAULT_USD_TO_PEN_RATE } from "../shared/constants"
import { safeHttpUrl } from "../shared/url"
import { razonarTipo } from "../shared/tipoInmueble"
import { escapeRegex } from "../shared/filters"
import { limpiarUnidades, resumirUnidades, unirUnidades, type UnidadProyecto } from "../shared/proyectos"
import { ubicacionCanonica } from "../shared/ubicacion"

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
  /** Región («Lima», «Arequipa») y ciudad/provincia; si faltan se deducen del distrito (Lima y Callao). */
  departamento?: string
  provincia?: string
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
  /** Proyectos: precio más alto («Hasta»), en `moneda`. `precio` es el más bajo («Desde»). */
  precioMax?: number
  /** Proyectos: tipologías (dormitorios, baños, área y precio de cada una). Si se entregan, el precio, el rango y las cantidades se calculan de ellas. */
  unidades?: UnidadProyecto[]
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
  departamento: string | null
  provincia: string | null
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
  precio_max: number | null
  precio_max_usd: number | null
  /** JSON con las tipologías de un proyecto (`null` si no es un proyecto o no se conocen). */
  unidades: string | null
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

/**
 * Coordenadas dentro de Perú. Algunos portales entregan «0, 0» (o puntos fuera del país) cuando el anunciante no
 * marcó el mapa: se guardan vacías en lugar de ubicar el aviso en el océano.
 */
export function coordenadasDePeru(lat: number | undefined, lon: number | undefined): { latitud: number | null; longitud: number | null } {
  const ok = Number.isFinite(lat) && Number.isFinite(lon) && (lat as number) >= -19 && (lat as number) <= 0.5 && (lon as number) >= -82 && (lon as number) <= -68
  return ok ? { latitud: lat as number, longitud: lon as number } : { latitud: null, longitud: null }
}

/**
 * Precios que son claramente un error de tipeo del anunciante (una venta de US$ 145, un local de US$ 1 500 millones,
 * un departamento de 137 m² a US$ 1,5 millones el m²). Se guardan sin precio para no distorsionar medianas ni
 * comparaciones. Los límites son holgados: solo caen los absurdos.
 */
export function precioInverosimil(operacion: "VENTA" | "ALQUILER", usd: number, areaM2: number | undefined): boolean {
  if (!usd) return false
  if (operacion === "VENTA") {
    if (usd < 1000 || usd > 300_000_000) return true
    return !!areaM2 && areaM2 >= 10 && usd / areaM2 > 60_000
  }
  return usd > 200_000
}

const areaEnM2 = (area: string | undefined) => {
  const n = Number(/^\s*(\d+(?:[.,]\d+)?)/.exec(area ?? "")?.[1]?.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

const money = (n: number | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0)

/** Un proyecto no cuesta lo mismo en todas sus tipologías; un «Hasta» fuera de lo razonable se descarta. */
const MAX_VECES_EL_MINIMO = 30

/** Valida y normaliza un aviso. Devuelve `null` si no se puede identificar de forma estable. */
export function normalizarAviso(
  aviso: Aviso,
  usdToPen: number = DEFAULT_USD_TO_PEN_RATE
): FilaPropiedad | null {
  const codigo = aviso.codigo?.trim()
  if (!codigo || !PORTALES.includes(aviso.portal)) return null
  if (aviso.operacion !== "VENTA" && aviso.operacion !== "ALQUILER") return null

  const moneda = aviso.moneda === "USD" ? "USD" : "PEN"
  const inmueble = razonarTipo(aviso.inmueble, aviso.titulo)
  // Un proyecto con tipologías: el precio «Desde», el «Hasta» y las cantidades salen de ellas (así dos fuentes del mismo
  // proyecto dan el mismo resultado).
  const unidades = inmueble === "Proyecto" ? limpiarUnidades(aviso.unidades) : []
  const resumen = unidades.length ? resumirUnidades(unidades) : null
  const precio = money(resumen ? resumen.precio : aviso.precio)
  let precioMax = precio ? money(resumen ? resumen.precioMax : aviso.precioMax) : 0
  if (precioMax <= precio || precioMax > precio * MAX_VECES_EL_MINIMO) precioMax = 0
  // El dólar de un proyecto se calcula del precio «Desde» (el que trae el aviso puede ser el de una sola tipología).
  let precioUsd = resumen ? 0 : usdCoherente(money(aviso.precio), moneda, money(aviso.precioUsd), usdToPen)
  if (!precioUsd && precio) precioUsd = moneda === "USD" ? precio : precio / usdToPen

  let precioFinal = precio
  if (precioInverosimil(aviso.operacion, precioUsd, areaEnM2(resumen?.area ?? aviso.area))) {
    precioFinal = 0
    precioUsd = 0
    precioMax = 0
  }
  const precioMaxUsd = precioMax ? (moneda === "USD" ? precioMax : precioMax / usdToPen) : 0

  const imagenes = normalizarFotos(aviso.imagen, aviso.imagenes)
  // Ubicación coherente: un distrito de Lima o del Callao manda sobre lo que diga el portal (varios publican el Callao
  // como «Lima»), y una provincia que solo existe en un departamento fija ese departamento.
  const lugar = ubicacionCanonica({ departamento: aviso.departamento ?? null, provincia: aviso.provincia ?? null, distrito: clean(aviso.distrito) ?? null })
  const distrito = lugar.distrito
  return {
    id: `${aviso.portal}:${codigo}`,
    portal: aviso.portal,
    operacion: aviso.operacion,
    inmueble,
    titulo: clean(aviso.titulo),
    precio: precioFinal,
    precio_usd: Math.round(precioUsd * 100) / 100,
    moneda,
    distrito,
    departamento: lugar.departamento,
    provincia: lugar.provincia,
    dormitorios: clean(resumen?.dormitorios ?? aviso.dormitorios),
    banios: clean(resumen?.banios ?? aviso.banios),
    area: clean(resumen?.area ?? aviso.area),
    imagen: imagenes[0] ?? null,
    imagenes,
    url: safeHttpUrl(aviso.url),
    descripcion: limpiarDescripcion(aviso.descripcion),
    direccion: corto(aviso.direccion, 200),
    estacionamientos: corto(aviso.estacionamientos, 40),
    antiguedad: corto(aviso.antiguedad, 60),
    publicador: corto(aviso.publicador, 120),
    ...coordenadasDePeru(aviso.latitud, aviso.longitud),
    mantenimiento: money(aviso.mantenimiento) || null,
    precio_max: precioMax || null,
    precio_max_usd: precioMaxUsd ? Math.round(precioMaxUsd * 100) / 100 : null,
    unidades: unidades.length ? JSON.stringify(unidades) : null,
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
  "departamento", "provincia", "precio_max", "precio_max_usd", "unidades",
] as const

/** Columnas de la migración 011 (ubicación). */
const COLUMNAS_011 = ["departamento", "provincia"] as const

/** Columnas de la migración 014 (proyectos: rango de precio y tipologías). */
const COLUMNAS_014 = ["precio_max", "precio_max_usd", "unidades"] as const

/** Columnas que existen solo con las migraciones 008 (fotos) y 009 (detalles). */
const COLUMNAS_009 = ["descripcion", "direccion", "estacionamientos", "antiguedad", "publicador", "latitud", "longitud", "mantenimiento"] as const
type Columna = (typeof COLUMNAS)[number]

/** De la más completa a la más básica: se usa la primera que la base acepte. */
const en = (lista: readonly string[], c: string) => lista.includes(c)
const NIVELES: readonly (readonly Columna[])[] = [
  COLUMNAS,
  COLUMNAS.filter(c => !en(COLUMNAS_014, c)),
  COLUMNAS.filter(c => !en(COLUMNAS_014, c) && !en(COLUMNAS_011, c)),
  COLUMNAS.filter(c => !en(COLUMNAS_014, c) && !en(COLUMNAS_011, c) && !en(COLUMNAS_009, c)),
  COLUMNAS.filter(c => !en(COLUMNAS_014, c) && !en(COLUMNAS_011, c) && !en(COLUMNAS_009, c) && c !== "imagenes"),
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
       ${columnas
         .filter(c => c !== "id")
         // La portada ya copiada a Cloudinary no se pisa con la del portal en cada corrida.
         .map(c => (c === "imagen" ? `imagen = case when public.propiedades.imagen like '%res.cloudinary.com%' then public.propiedades.imagen else excluded.imagen end` : `${c} = excluded.${c}`))
         .join(", ")},
       ultima_vista_en = now()`,
    params
  )
}

/**
 * Un proyecto llega a veces como varios avisos (uno por tipología) con el mismo código: se unen sus tipologías para que
 * el aviso final tenga el rango completo en lugar de quedarse con la última.
 */
function fusionar(previo: Aviso, nuevo: Aviso): Aviso {
  if (previo.unidades?.length && nuevo.unidades?.length) return { ...nuevo, unidades: unirUnidades(previo.unidades, nuevo.unidades) }
  return nuevo
}

/**
 * Antes de agruparse por proyecto, cada tipología se guardaba como un aviso aparte («B34» tres veces, con el precio y el
 * tamaño de una sola). Al guardar el proyecto se quitan esas copias (las que apuntan a su misma dirección), salvo las
 * que tengan favoritos o enlaces. Es una limpieza de apoyo: si falla, la carga sigue.
 */
async function quitarCopiasDeProyectos(db: Db, filas: FilaPropiedad[]) {
  for (const fila of filas) {
    const slug = /^[a-z]+:proyecto-(.+)$/.exec(fila.id)?.[1]
    if (!slug || !fila.url) continue
    try {
      await db.query(
        `delete from public.propiedades p
          where p.portal = $1 and p.id <> $2
            and (p.url = $3 or p.url ~* $4)
            and not exists (select 1 from public.enlaces e where e.propiedad_id = p.id)
            and not exists (select 1 from public.favoritos f where f.propiedad_id = p.id)`,
        [fila.portal, fila.id, fila.url, `^https?://[^/]+/${escapeRegex(slug)}/[0-9]+/?$`]
      )
    } catch {
      // Sin las tablas de curación (o con un error pasajero) no se limpia; el aviso del proyecto ya quedó guardado.
    }
  }
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
  // Si un aviso viene repetido en la misma corrida se queda con el último (los proyectos unen sus tipologías).
  const unicos = new Map<string, Aviso>()
  for (const aviso of avisos) {
    const clave = `${aviso.portal}:${aviso.codigo?.trim()}`
    const previo = unicos.get(clave)
    unicos.set(clave, previo ? fusionar(previo, aviso) : aviso)
  }
  const filas = new Map<string, FilaPropiedad>()
  let descartados = 0
  for (const aviso of unicos.values()) {
    const fila = normalizarAviso(aviso, usdToPen)
    if (fila) filas.set(fila.id, fila)
    else descartados++
  }

  const lista = [...filas.values()]
  // Sin las migraciones 008/009/011/014 se sigue guardando todo lo demás, solo sin galería, detalles ni rango de proyectos.
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
  await quitarCopiasDeProyectos(db, lista)
  return { guardados: lista.length, descartados }
}
