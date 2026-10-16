import { parseAreaM2 } from "../shared/area"

export interface FilaPrecio {
  distrito: string | null
  operacion: string | null
  precio_usd: number
  area: string | null
}

export interface EstadisticaDistrito {
  distrito: string
  operacion: "VENTA" | "ALQUILER"
  avisos: number
  /** Mediana del precio publicado, en USD. */
  precioMediano: number
  /** Mediana del precio por m² en USD (solo avisos con área); `null` si ninguno la tiene. */
  precioM2Mediano: number | null
}

export interface ResumenMercado {
  operacion: "VENTA" | "ALQUILER"
  avisos: number
  precioM2Mediano: number | null
}

export interface Estadisticas {
  distritos: EstadisticaDistrito[]
  resumen: ResumenMercado[]
}

/** Mediana de una lista de números (0 elementos -> null). */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const v = [...valores].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}

const redondear = (n: number | null, dec = 0) =>
  n === null ? null : Math.round(n * 10 ** dec) / 10 ** dec

/** Clave de agrupación: sin tildes ni mayúsculas, para juntar "Surco" y "SURCO". */
const clave = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

/**
 * Estadísticas por distrito y operación. Usa la mediana (no el promedio) para que un aviso con
 * un precio absurdo no distorsione la cifra, y exige `minAvisos` para no mostrar medianas de
 * uno o dos casos.
 */
export function calcularEstadisticas(
  filas: FilaPrecio[],
  { minAvisos = 3, maxDistritos = 40 }: { minAvisos?: number; maxDistritos?: number } = {}
): Estadisticas {
  type Grupo = { nombre: string; operacion: "VENTA" | "ALQUILER"; precios: number[]; porM2: number[] }
  const grupos = new Map<string, Grupo>()
  const resumen = {
    VENTA: { avisos: 0, porM2: [] as number[] },
    ALQUILER: { avisos: 0, porM2: [] as number[] },
  }

  for (const f of filas) {
    const operacion = f.operacion?.toUpperCase()
    if (operacion !== "VENTA" && operacion !== "ALQUILER") continue
    if (!(f.precio_usd > 0)) continue

    const m2 = parseAreaM2(f.area)
    const porM2 = m2 ? f.precio_usd / m2 : null

    resumen[operacion].avisos++
    if (porM2) resumen[operacion].porM2.push(porM2)

    const nombre = f.distrito?.trim()
    if (!nombre) continue
    const k = `${operacion}|${clave(nombre)}`
    const g = grupos.get(k) ?? { nombre, operacion, precios: [], porM2: [] }
    g.precios.push(f.precio_usd)
    if (porM2) g.porM2.push(porM2)
    grupos.set(k, g)
  }

  const distritos = Array.from(grupos.values())
    .filter(g => g.precios.length >= minAvisos)
    .map(
      (g): EstadisticaDistrito => ({
        distrito: g.nombre,
        operacion: g.operacion,
        avisos: g.precios.length,
        precioMediano: redondear(mediana(g.precios), 0) ?? 0,
        precioM2Mediano: redondear(mediana(g.porM2), 1),
      })
    )
    .sort((a, b) => b.avisos - a.avisos || a.distrito.localeCompare(b.distrito, "es"))
    .slice(0, maxDistritos)

  return {
    distritos,
    resumen: (["VENTA", "ALQUILER"] as const).map(op => ({
      operacion: op,
      avisos: resumen[op].avisos,
      precioM2Mediano: redondear(mediana(resumen[op].porM2), 1),
    })),
  }
}
