import { useEffect, useMemo, useState } from "react"
import { combinarFacetas, fetchFacetas, type Facetas, type FacetasDelCatalogo } from "@/lib/facetas"

/**
 * Opciones de los filtros (departamentos, provincias, distritos, tipos y anunciantes). Siempre incluyen
 * todo lo que existe en el Perú, con la cantidad de avisos de cada una (0 si no hay); lo que hay en el
 * catálogo se pide una sola vez y se comparte entre todos los paneles. Si no se puede pedir, las listas
 * completas siguen disponibles.
 */
let pendiente: Promise<FacetasDelCatalogo | null> | null = null

export function useFacetas(): Facetas {
  const [catalogo, setCatalogo] = useState<FacetasDelCatalogo | null>(null)

  useEffect(() => {
    let cancelado = false
    pendiente ??= fetchFacetas().catch(() => {
      pendiente = null // se reintenta la próxima vez que se abra un panel
      return null
    })
    pendiente.then(f => !cancelado && setCatalogo(f))
    return () => {
      cancelado = true
    }
  }, [])

  return useMemo(() => combinarFacetas(catalogo), [catalogo])
}

/** Solo para pruebas: olvida lo ya pedido. */
export function reiniciarFacetas() {
  pendiente = null
}
