/**
 * Proyectos inmobiliarios. Un proyecto (un edificio en construcción, un condominio) no tiene un solo precio ni un solo
 * tamaño: ofrece varias tipologías («1 dormitorio de 54 m² a US$ 108,700», «3 dormitorios de 66 m² a US$ 130,600»). Los
 * portales lo publican como un aviso con su lista de unidades; el sistema guarda un aviso por proyecto con el rango
 * («Desde … hasta …») y la lista de tipologías.
 */

/** Una tipología del proyecto. El precio está en la moneda del aviso. */
export interface UnidadProyecto {
  /** Código de la unidad en el portal. */
  codigo?: string
  dormitorios?: number
  banios?: number
  /** m² */
  area?: number
  precio?: number
}

/** Lo que el aviso muestra de un proyecto, calculado a partir de sus unidades. */
export interface ResumenProyecto {
  /** Precio más bajo («Desde»). */
  precio?: number
  /** Precio más alto («Hasta»); solo si es mayor que el más bajo. */
  precioMax?: number
  /** Cantidades distintas, de menor a mayor: «1, 2, 3». */
  dormitorios?: string
  banios?: string
  /** «54 m2» o «54 – 66 m2». */
  area?: string
}

/** Máximo de tipologías que se guardan por proyecto. */
export const MAX_UNIDADES = 60

const positivo = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Unidades válidas: solo números positivos, sin tipologías vacías ni repetidas, con tope. */
export function limpiarUnidades(lista: unknown): UnidadProyecto[] {
  if (!Array.isArray(lista)) return []
  const salida: UnidadProyecto[] = []
  const vistas = new Set<string>()
  for (const x of lista) {
    if (!x || typeof x !== "object") continue
    const u = x as Record<string, unknown>
    const codigo = typeof u.codigo === "string" || typeof u.codigo === "number" ? String(u.codigo).trim().slice(0, 40) || undefined : undefined
    const unidad: UnidadProyecto = {
      ...(codigo ? { codigo } : {}),
      ...(positivo(u.dormitorios) ? { dormitorios: Math.round(positivo(u.dormitorios) as number) } : {}),
      ...(positivo(u.banios) ? { banios: Math.round(positivo(u.banios) as number) } : {}),
      ...(positivo(u.area) ? { area: redondear(positivo(u.area) as number) } : {}),
      ...(positivo(u.precio) ? { precio: redondear(positivo(u.precio) as number) } : {}),
    }
    if (Object.keys(unidad).filter(k => k !== "codigo").length === 0) continue
    const clave = codigo ?? JSON.stringify(unidad)
    if (vistas.has(clave)) continue
    vistas.add(clave)
    salida.push(unidad)
    if (salida.length >= MAX_UNIDADES) break
  }
  return salida
}

const lista = (valores: (number | undefined)[]): string | undefined => {
  const distintos = [...new Set(valores.filter((v): v is number => v !== undefined))].sort((a, b) => a - b)
  return distintos.length ? distintos.join(", ") : undefined
}

/** Precio, dormitorios, baños y área del proyecto a partir de sus tipologías. */
export function resumirUnidades(unidades: UnidadProyecto[]): ResumenProyecto {
  const precios = unidades.map(u => u.precio).filter((p): p is number => p !== undefined)
  const areas = unidades.map(u => u.area).filter((a): a is number => a !== undefined)
  const precio = precios.length ? Math.min(...precios) : undefined
  const max = precios.length ? Math.max(...precios) : undefined
  const areaMin = areas.length ? Math.min(...areas) : undefined
  const areaMax = areas.length ? Math.max(...areas) : undefined
  return {
    precio,
    precioMax: precio !== undefined && max !== undefined && max > precio ? max : undefined,
    dormitorios: lista(unidades.map(u => u.dormitorios)),
    banios: lista(unidades.map(u => u.banios)),
    area: areaMin === undefined ? undefined : areaMax !== undefined && areaMax > areaMin ? `${areaMin} – ${areaMax} m2` : `${areaMin} m2`,
  }
}

/** Une las tipologías de dos avisos del mismo proyecto (la misma unidad no se repite; la más reciente manda). */
export function unirUnidades(a: UnidadProyecto[], b: UnidadProyecto[]): UnidadProyecto[] {
  const por = new Map<string, UnidadProyecto>()
  for (const u of [...a, ...b]) por.set(u.codigo ?? JSON.stringify(u), u)
  return limpiarUnidades([...por.values()])
}
