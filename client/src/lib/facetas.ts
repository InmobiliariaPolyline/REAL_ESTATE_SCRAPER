import {
  DEPARTAMENTOS,
  DISTRITOS_CALLAO,
  DISTRITOS_LIMA,
  DISTRITOS_PRINCIPALES,
  PROVINCIAS,
  TIPOS_INMUEBLE,
  claveNombre,
  departamentoDeProvincia,
  provinciaDeDistritoPrincipal,
  ubicacionCanonica,
} from "@shared/ubicacion"
import { api } from "./api"

/** Un valor que se puede elegir en un filtro y cuántos avisos del catálogo lo tienen (0 si aún ninguno). */
export interface Faceta {
  valor: string
  n: number
  /** Departamento al que pertenece (en provincias y distritos). */
  padre?: string | null
  /** Provincia a la que pertenece (en distritos). */
  provincia?: string | null
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
  provincia?: string | null
}

const igual = (a: string | null | undefined, b: string | null | undefined) => claveNombre(a ?? "") === claveNombre(b ?? "")

/**
 * Une la lista completa (todo lo que existe en el Perú) con lo que hay en el catálogo: cada valor lleva
 * su cantidad de avisos, o 0 si aún no hay ninguno, y los valores del catálogo que no estén en la lista
 * completa se agregan. Un valor del catálogo se une al de la lista completa del mismo nombre y departamento
 * (y provincia, si ambos la traen), así «Callao» no aparece dos veces aunque un portal lo publique dentro de «Lima».
 * Primero van los que tienen avisos (de más a menos) y después el resto por orden alfabético.
 */
function unir(completo: Candidato[], catalogo: Faceta[] | undefined): Faceta[] {
  const lista: Faceta[] = completo.map(c => ({ valor: c.valor, n: 0, padre: c.padre ?? null, provincia: c.provincia ?? null }))
  for (const f of catalogo ?? []) {
    const existente = lista.find(
      x => igual(x.valor, f.valor) && (igual(x.padre, f.padre) || !f.padre || !x.padre) && (igual(x.provincia, f.provincia) || !f.provincia || !x.provincia)
    )
    if (existente) {
      existente.n += f.n
      existente.padre ??= f.padre ?? null
      existente.provincia ??= f.provincia ?? null
    } else {
      lista.push({ valor: f.valor, n: f.n, padre: f.padre ?? null, provincia: f.provincia ?? null })
    }
  }
  return ordenar(lista)
}

const ordenar = (l: Faceta[]) => l.sort((a, b) => Number(b.n > 0) - Number(a.n > 0) || b.n - a.n || a.valor.localeCompare(b.valor, "es", { sensitivity: "base" }))

/** Un departamento tal como lo guarda la base, llevado al nombre oficial (corrige «Callao» dentro de «Lima»). */
function departamentoOficial(valor: string, padre: string | null | undefined): string | null {
  return departamentoDeProvincia(valor) ?? padre ?? null
}

/** Todas las opciones de los filtros: el Perú completo más lo que haya en el catálogo (aunque no se pueda conectar). */
export function combinarFacetas(catalogo: FacetasDelCatalogo | null | undefined): Facetas {
  const provincias: Candidato[] = Object.entries(PROVINCIAS).flatMap(([padre, lista]) => lista.map(valor => ({ valor, padre })))
  const distritos: Candidato[] = [
    ...DISTRITOS_LIMA.map(valor => ({ valor, padre: "Lima", provincia: "Lima" })),
    ...DISTRITOS_CALLAO.map(valor => ({ valor, padre: "Callao", provincia: "Callao" })),
    ...Object.entries(DISTRITOS_PRINCIPALES).flatMap(([padre, lista]) => lista.map(valor => ({ valor, padre, provincia: provinciaDeDistritoPrincipal(padre, valor) }))),
  ]

  // El catálogo se lleva a la ubicación coherente antes de unirlo, aunque la base aún tenga datos contradictorios.
  const provinciasCat = (catalogo?.provincias ?? []).map(f => ({ ...f, padre: departamentoOficial(f.valor, f.padre) }))
  const distritosCat = (catalogo?.distritos ?? []).map(f => {
    const u = ubicacionCanonica({ departamento: f.padre ?? null, provincia: f.provincia ?? null, distrito: f.valor })
    return { ...f, valor: u.distrito ?? f.valor, padre: u.departamento, provincia: u.provincia }
  })

  return {
    departamentos: unir(DEPARTAMENTOS.map(valor => ({ valor })), catalogo?.departamentos),
    provincias: unir(provincias, provinciasCat),
    distritos: unir(distritos, distritosCat),
    inmuebles: unir(TIPOS_INMUEBLE.map(valor => ({ valor })), catalogo?.inmuebles),
    anunciantes: catalogo?.anunciantes ?? [],
  }
}
