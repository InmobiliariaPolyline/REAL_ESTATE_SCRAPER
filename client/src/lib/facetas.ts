import { DEPARTAMENTOS, DISTRITOS_CALLAO, DISTRITOS_LIMA, DISTRITOS_PRINCIPALES, PROVINCIAS, TIPOS_INMUEBLE, claveNombre } from "@shared/ubicacion"
import { api } from "./api"

/** Un valor que se puede elegir en un filtro y cuántos avisos del catálogo lo tienen (0 si aún ninguno). */
export interface Faceta {
  valor: string
  n: number
  /** Departamento al que pertenece (en provincias y distritos). */
  padre?: string | null
}

export interface Facetas {
  departamentos: Faceta[]
  provincias: Faceta[]
  distritos: Faceta[]
  inmuebles: Faceta[]
  anunciantes: Faceta[]
}

/** Lo que entrega el servidor: solo valores que existen en el catálogo. */
export type FacetasDelCatalogo = Partial<Facetas>

export const fetchFacetas = () => api.get<FacetasDelCatalogo>("/propiedades/facetas")

interface Candidato {
  valor: string
  padre?: string | null
}

/**
 * Une la lista completa (todo lo que existe en el Perú) con lo que hay en el catálogo: cada valor lleva
 * su cantidad de avisos, o 0 si aún no hay ninguno, y los valores del catálogo que no estén en la lista
 * completa se agregan. Primero van los que tienen avisos (de más a menos) y después el resto por orden alfabético.
 */
function unir(completo: Candidato[], catalogo: Faceta[] | undefined): Faceta[] {
  const mapa = new Map<string, Faceta>()
  const clave = (c: Candidato) => claveNombre(c.valor) + "|" + claveNombre(c.padre ?? "")
  for (const c of completo) mapa.set(clave(c), { valor: c.valor, n: 0, padre: c.padre ?? null })
  for (const f of catalogo ?? []) {
    // Un valor del catálogo sin departamento (o con otro) se une al de la lista completa del mismo nombre.
    const k = clave(f)
    const existente = mapa.get(k) ?? [...mapa.entries()].find(([kk]) => kk.startsWith(claveNombre(f.valor) + "|") && !f.padre)?.[1]
    if (existente) existente.n += f.n
    else mapa.set(k, { valor: f.valor, n: f.n, padre: f.padre ?? null })
  }
  return [...mapa.values()].sort((a, b) => Number(b.n > 0) - Number(a.n > 0) || b.n - a.n || a.valor.localeCompare(b.valor, "es", { sensitivity: "base" }))
}

/** Todas las opciones de los filtros: el Perú completo más lo que haya en el catálogo (aunque no se pueda conectar). */
export function combinarFacetas(catalogo: FacetasDelCatalogo | null | undefined): Facetas {
  const provincias: Candidato[] = Object.entries(PROVINCIAS).flatMap(([padre, lista]) => lista.map(valor => ({ valor, padre })))
  const distritos: Candidato[] = [
    ...DISTRITOS_LIMA.map(valor => ({ valor, padre: "Lima" })),
    ...DISTRITOS_CALLAO.map(valor => ({ valor, padre: "Callao" })),
    ...Object.entries(DISTRITOS_PRINCIPALES).flatMap(([padre, lista]) => lista.map(valor => ({ valor, padre }))),
  ]
  return {
    departamentos: unir(DEPARTAMENTOS.map(valor => ({ valor })), catalogo?.departamentos),
    provincias: unir(provincias, catalogo?.provincias),
    distritos: unir(distritos, catalogo?.distritos),
    inmuebles: unir(TIPOS_INMUEBLE.map(valor => ({ valor })), catalogo?.inmuebles),
    anunciantes: catalogo?.anunciantes ?? [],
  }
}
