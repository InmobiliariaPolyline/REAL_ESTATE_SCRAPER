import { useEffect, useMemo, useState } from "react"
import { combinarFacetas, fetchFacetas, type Facetas, type FacetasDelCatalogo } from "@/lib/facetas"
import { portalParams } from "@/lib/propertiesApi"
import type { FilterState } from "@/types"

/**
 * Opciones de los filtros (departamentos, provincias, distritos, tipos y anunciantes). Siempre incluyen
 * todo lo que existe en el Perú, con la cantidad de avisos de cada una (0 si no hay).
 *
 * - Sin `filtros`: la cantidad es la de todo el catálogo, que se pide una sola vez y se comparte entre paneles.
 * - Con `filtros`: la cantidad se calcula sobre lo ya filtrado (portal, operación, precio…), un instante después del
 *   último cambio, para que la ventana muestre solo lo que está disponible con esos filtros.
 *
 * Si no se puede pedir, las listas completas siguen disponibles.
 */
let pendiente: Promise<FacetasDelCatalogo | null> | null = null

/** Lo que cambia las opciones: todo menos el orden y la moneda no, pero sí los filtros; se compara por su forma en la URL. */
const claveDe = (f: FilterState) => JSON.stringify(portalParams(f, "relevancia"))

export function useFacetas(filtros?: FilterState): Facetas {
  const [catalogo, setCatalogo] = useState<FacetasDelCatalogo | null>(null)
  const clave = filtros ? claveDe(filtros) : ""

  useEffect(() => {
    let cancelado = false
    if (!filtros) {
      pendiente ??= fetchFacetas().catch(() => {
        pendiente = null // se reintenta la próxima vez que se abra un panel
        return null
      })
      pendiente.then(f => !cancelado && setCatalogo(f))
      return () => {
        cancelado = true
      }
    }
    const t = setTimeout(() => {
      fetchFacetas(filtros)
        .then(f => !cancelado && setCatalogo(f))
        .catch(() => !cancelado && setCatalogo(null))
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
    // Solo importan los filtros, no la identidad del objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return useMemo(() => combinarFacetas(catalogo), [catalogo])
}

/** Solo para pruebas: olvida lo ya pedido. */
export function reiniciarFacetas() {
  pendiente = null
}
