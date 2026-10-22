import { DEFAULT_PORTAL_FILTERS } from "@shared/savedSearch"
import type { FilterState } from "@/types"

export interface FiltroActivo {
  /** Identificador estable (clave de React). */
  clave: string
  etiqueta: string
  /** Cambios que dejan este filtro en su valor por defecto. */
  quitar: Partial<FilterState>
  /** Los filtros del desglose «Más filtros» (no los de la fila principal). */
  avanzado: boolean
}

const PUBLICADO: Record<FilterState["publicado"], string> = {
  todos: "",
  hoy: "Publicado hoy",
  semana: "Última semana",
  mes: "Último mes",
}

const num = (n: number) => n.toLocaleString("es-PE")

/** Filtros que el usuario cambió respecto de los valores por defecto, listos para mostrar como chips. */
export function filtrosActivos(f: FilterState): FiltroActivo[] {
  const d = DEFAULT_PORTAL_FILTERS
  const sym = f.moneda === "PEN" ? "S/" : "USD"
  const out: FiltroActivo[] = []

  if (f.texto.trim()) out.push({ clave: "texto", etiqueta: `«${f.texto.trim()}»`, quitar: { texto: d.texto }, avanzado: false })
  if (f.distrito.trim()) out.push({ clave: "distrito", etiqueta: f.distrito.trim(), quitar: { distrito: d.distrito }, avanzado: false })
  if (f.operacion !== d.operacion) out.push({ clave: "operacion", etiqueta: f.operacion === "VENTA" ? "Venta" : "Alquiler", quitar: { operacion: d.operacion }, avanzado: false })
  if (f.inmueble !== d.inmueble) out.push({ clave: "inmueble", etiqueta: f.inmueble, quitar: { inmueble: d.inmueble }, avanzado: false })
  if (f.portales.length > 0) out.push({ clave: "portales", etiqueta: f.portales.join(", "), quitar: { portales: [] }, avanzado: false })

  if (f.precioMin !== "" || f.precioMax !== "") {
    const etiqueta =
      f.precioMin !== "" && f.precioMax !== ""
        ? `${sym} ${num(f.precioMin)} – ${num(f.precioMax)}`
        : f.precioMin !== ""
          ? `Desde ${sym} ${num(f.precioMin)}`
          : `Hasta ${sym} ${num(f.precioMax as number)}`
    out.push({ clave: "precio", etiqueta, quitar: { precioMin: "", precioMax: "" }, avanzado: false })
  }

  if (f.dormitorios !== d.dormitorios) out.push({ clave: "dormitorios", etiqueta: `${f.dormitorios} dorm.`, quitar: { dormitorios: d.dormitorios }, avanzado: true })
  if (f.banios !== d.banios) out.push({ clave: "banios", etiqueta: `${f.banios} baños`, quitar: { banios: d.banios }, avanzado: true })

  if (f.areaMin !== "" || f.areaMax !== "") {
    const etiqueta =
      f.areaMin !== "" && f.areaMax !== ""
        ? `${num(f.areaMin)} – ${num(f.areaMax)} m²`
        : f.areaMin !== ""
          ? `Desde ${num(f.areaMin)} m²`
          : `Hasta ${num(f.areaMax as number)} m²`
    out.push({ clave: "area", etiqueta, quitar: { areaMin: "", areaMax: "" }, avanzado: true })
  }

  if (f.publicado !== d.publicado) out.push({ clave: "publicado", etiqueta: PUBLICADO[f.publicado], quitar: { publicado: d.publicado }, avanzado: true })
  return out
}

/** Topes de precio rápidos (máximo) según la moneda y la operación. */
export function atajosDePrecio(moneda: FilterState["moneda"], operacion: FilterState["operacion"]): number[] {
  const alquiler = operacion === "ALQUILER"
  if (moneda === "PEN") return alquiler ? [1500, 2500, 4000, 6000] : [250000, 400000, 600000, 1000000]
  return alquiler ? [400, 700, 1000, 1500] : [70000, 120000, 200000, 350000]
}
