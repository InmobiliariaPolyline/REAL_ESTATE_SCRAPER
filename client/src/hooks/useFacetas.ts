import { useEffect, useState } from "react"
import { fetchFacetas, type Facetas } from "@/lib/facetas"

/**
 * Valores que existen en el catálogo (departamentos, provincias, distritos, tipos y anunciantes) para las
 * listas de los filtros. Se piden una sola vez y se comparten entre todos los paneles; `null` mientras
 * llegan o si no se pudieron cargar (los filtros siguen funcionando con sus listas de respaldo).
 */
let pendiente: Promise<Facetas | null> | null = null

export function useFacetas(): Facetas | null {
  const [facetas, setFacetas] = useState<Facetas | null>(null)

  useEffect(() => {
    let cancelado = false
    pendiente ??= fetchFacetas().catch(() => {
      pendiente = null // se reintenta la próxima vez que se abra un panel
      return null
    })
    pendiente.then(f => !cancelado && setFacetas(f))
    return () => {
      cancelado = true
    }
  }, [])

  return facetas
}

/** Solo para pruebas: olvida lo ya pedido. */
export function reiniciarFacetas() {
  pendiente = null
}
