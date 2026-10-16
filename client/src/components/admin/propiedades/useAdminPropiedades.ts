import { useCallback, useEffect, useRef, useState } from "react"
import { ADMIN_PAGE_SIZE } from "@shared/constants"
import { useToast } from "@/contexts/ToastContext"
import { ApiError, api } from "@/lib/api"
import {
  EMPTY_ADMIN_SEARCH,
  fetchAdminPage,
  toUsd,
  type AdminSearchFilters,
} from "@/lib/propertiesApi"
import type { Propiedad } from "@/types"
import type { BusquedaGuardada } from "./BusquedasGuardadasList"

export type PropiedadesTab = "buscar" | "favoritos" | "historial" | "guardadas"

export const ITEMS_PER_PAGE = ADMIN_PAGE_SIZE

interface IdsAndProps {
  ids: string[]
  propiedades: Propiedad[]
}

const enc = encodeURIComponent

/** Estado y acciones de la pestaña "Propiedades" del panel de administración. */
export function useAdminPropiedades() {
  const { addToast } = useToast()

  const [tab, setTab] = useState<PropiedadesTab>("buscar")
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const [favoritos, setFavoritos] = useState<Set<string>>(new Set())
  const [historialIds, setHistorialIds] = useState<Set<string>>(new Set())
  const [busquedas, setBusquedas] = useState<BusquedaGuardada[]>([])

  // `draft` es lo que se edita en el formulario; `applied` lo que usa la paginación.
  const [draft, setDraft] = useState<AdminSearchFilters>(EMPTY_ADMIN_SEARCH)
  const [applied, setApplied] = useState<AdminSearchFilters>(EMPTY_ADMIN_SEARCH)
  const [activeSavedSearch, setActiveSavedSearch] = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  const requestId = useRef(0)

  // ── Carga de datos ──────────────────────────────────────────────────────

  const loadFavoritosIds = useCallback(async () => {
    try {
      const data = await api.get<IdsAndProps>("/admin/favoritos")
      setFavoritos(new Set(data.ids))
    } catch (err) {
      console.error("Error cargando favoritos:", err)
    }
  }, [])

  const loadHistorialIds = useCallback(async () => {
    try {
      const data = await api.get<IdsAndProps>("/admin/historial")
      setHistorialIds(new Set(data.ids))
    } catch (err) {
      console.error("Error cargando historial:", err)
    }
  }, [])

  const loadBusquedas = useCallback(async () => {
    try {
      setBusquedas(await api.get<BusquedaGuardada[]>("/admin/busquedas"))
    } catch (err) {
      console.error("Error cargando búsquedas:", err)
    }
  }, [])

  /** Ejecuta una búsqueda y deja `filters` como los filtros aplicados. */
  const runSearch = useCallback(
    async (filters: AdminSearchFilters, targetPage: number) => {
      const current = ++requestId.current
      setApplied(filters)
      setLoading(true)
      try {
        const result = await fetchAdminPage(filters, targetPage, ITEMS_PER_PAGE)
        if (current !== requestId.current) return
        setPropiedades(result.data)
        setTotalCount(result.count)
        setPage(targetPage)
      } catch (err) {
        if (current !== requestId.current) return
        addToast("Error al cargar propiedades", "error")
        console.error(err)
      } finally {
        if (current === requestId.current) setLoading(false)
      }
    },
    [addToast]
  )

  const loadListTab = useCallback(
    async (path: "/admin/favoritos" | "/admin/historial", errorMessage: string) => {
      const current = ++requestId.current
      setLoading(true)
      try {
        const data = await api.get<IdsAndProps>(path)
        if (current !== requestId.current) return
        if (path === "/admin/favoritos") setFavoritos(new Set(data.ids))
        setPropiedades(data.propiedades)
        setTotalCount(data.propiedades.length)
        setPage(0)
      } catch (err) {
        if (current !== requestId.current) return
        addToast(errorMessage, "error")
        console.error(err)
      } finally {
        if (current === requestId.current) setLoading(false)
      }
    },
    [addToast]
  )

  // Carga inicial de listas auxiliares.
  useEffect(() => {
    loadFavoritosIds()
    loadHistorialIds()
    loadBusquedas()
  }, [loadFavoritosIds, loadHistorialIds, loadBusquedas])

  // Cada pestaña recarga su propio contenido (la lista `propiedades` es compartida,
  // así que al volver a "Buscar" hay que repetir la búsqueda aplicada).
  useEffect(() => {
    if (tab === "buscar") runSearch(applied, page)
    else if (tab === "favoritos") loadListTab("/admin/favoritos", "Error al cargar favoritos")
    else if (tab === "historial") loadListTab("/admin/historial", "Error al cargar historial")
    else loadBusquedas()
    // Solo reacciona al cambio de pestaña.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── Acciones de búsqueda ────────────────────────────────────────────────

  const buscar = () => {
    setActiveSavedSearch(false)
    setShowHidden(false)
    return runSearch(draft, 0)
  }

  const limpiar = () => {
    setDraft(EMPTY_ADMIN_SEARCH)
    setActiveSavedSearch(false)
    setShowHidden(false)
    return runSearch(EMPTY_ADMIN_SEARCH, 0)
  }

  const cambiarPagina = (targetPage: number) => runSearch(applied, targetPage)

  const guardarBusqueda = async (nombre: string): Promise<boolean> => {
    const trimmed = nombre.trim()
    if (!trimmed) {
      addToast("Ponle un nombre a la búsqueda", "error")
      return false
    }
    try {
      await api.post("/admin/busquedas", {
        nombre: trimmed,
        distrito: draft.distrito,
        operacion: draft.operacion,
        portal: draft.portal,
        // Los límites se guardan normalizados a USD.
        precio_min: toUsd(draft.precioMin, draft.moneda),
        precio_max: toUsd(draft.precioMax, draft.moneda),
      })
      addToast("Búsqueda guardada", "success")
      loadBusquedas()
      return true
    } catch (err) {
      addToast("Error al guardar la búsqueda", "error")
      console.error(err)
      return false
    }
  }

  const ejecutarBusqueda = async (b: BusquedaGuardada) => {
    // Los precios guardados están en USD y la búsqueda no filtra por moneda original,
    // porque `precio_usd` ya está normalizado para todos los avisos.
    const form: AdminSearchFilters = {
      distrito: b.distrito || "",
      operacion: b.operacion || "todos",
      portal: b.portal || "todos",
      precioMin: b.precio_min !== null ? String(b.precio_min) : "",
      precioMax: b.precio_max !== null ? String(b.precio_max) : "",
      moneda: "USD",
    }
    setDraft(form)
    setActiveSavedSearch(true)
    setShowHidden(false)
    await loadHistorialIds()

    const filters = { ...form, moneda: null }
    setApplied(filters)
    setPage(0)
    if (tab === "buscar") await runSearch(filters, 0)
    else setTab("buscar") // el efecto de pestaña ejecuta la búsqueda con `applied`
  }

  const eliminarBusqueda = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/admin/busquedas/${enc(id)}`)
      setBusquedas(prev => prev.filter(b => b.id !== id))
      addToast("Búsqueda eliminada", "success")
      return true
    } catch (err) {
      addToast("Error al eliminar la búsqueda", "error")
      console.error(err)
      return false
    }
  }

  // ── Favoritos / historial / eliminación ─────────────────────────────────

  const toggleFavorite = async (propiedadId: string) => {
    const isFav = favoritos.has(propiedadId)
    try {
      if (isFav) {
        await api.delete(`/admin/favoritos/${enc(propiedadId)}`)
        setFavoritos(prev => {
          const next = new Set(prev)
          next.delete(propiedadId)
          return next
        })
        if (tab === "favoritos") {
          setPropiedades(prev => prev.filter(p => p.id !== propiedadId))
          setTotalCount(prev => Math.max(0, prev - 1))
        }
        addToast("Quitado de favoritos", "info")
      } else {
        await api.post("/admin/favoritos", { propiedad_id: propiedadId })
        setFavoritos(prev => new Set(prev).add(propiedadId))
        addToast("Agregado a favoritos", "success")
      }
    } catch (err) {
      addToast("Error al actualizar favorito", "error")
      console.error(err)
    }
  }

  const registerView = async (propiedadId: string) => {
    try {
      await api.put("/admin/historial", { propiedad_id: propiedadId })
      setHistorialIds(prev => new Set(prev).add(propiedadId))
    } catch (err) {
      console.error("Error al registrar historial", err)
    }
  }

  const deletePropiedad = async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/admin/propiedades/${enc(id)}`)
      setPropiedades(prev => prev.filter(p => p.id !== id))
      setTotalCount(prev => Math.max(0, prev - 1))
      addToast("Propiedad eliminada", "success")
      return true
    } catch (err) {
      addToast("Error al eliminar propiedad", "error")
      console.error(err)
      return false
    }
  }

  /** Limpieza de registros inactivos: aún no está definida en el servidor (responde 501). */
  const runCleanup = async (): Promise<void> => {
    try {
      await api.post("/admin/limpiar-inactivos")
      addToast("Limpieza ejecutada correctamente", "success")
    } catch (err) {
      console.error("Error en limpiar-inactivos:", err)
      addToast(
        err instanceof ApiError && err.status === 501
          ? "La limpieza de inactivos aún no está configurada en el servidor."
          : "No se pudo ejecutar la limpieza",
        "error"
      )
    }
  }

  // ── Derivados ───────────────────────────────────────────────────────────

  // En una búsqueda guardada se ocultan las ya vistas (salvo favoritas) a menos que se pida verlas.
  const hideSeen = tab === "buscar" && activeSavedSearch && !showHidden
  const visibles = hideSeen
    ? propiedades.filter(p => favoritos.has(p.id) || !historialIds.has(p.id))
    : propiedades
  const cantidadOcultas = propiedades.length - visibles.length

  return {
    tab,
    setTab,
    loading,
    page,
    totalCount,
    propiedades,
    visibles,
    cantidadOcultas,
    favoritos,
    busquedas,
    draft,
    setDraft,
    activeSavedSearch,
    showHidden,
    setShowHidden,
    buscar,
    limpiar,
    cambiarPagina,
    guardarBusqueda,
    ejecutarBusqueda,
    eliminarBusqueda,
    toggleFavorite,
    registerView,
    deletePropiedad,
    runCleanup,
  }
}
