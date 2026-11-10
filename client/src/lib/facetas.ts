import { api } from "./api"

/** Un valor que existe en el catálogo y cuántos avisos lo tienen. */
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

export const fetchFacetas = () => api.get<Facetas>("/propiedades/facetas")
