import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/contexts/ToastContext"
import { isMissingRpc } from "@/lib/rpc"
import {
  EMPTY_ADMIN_SEARCH,
  PROPERTY_COLUMNS,
  fetchAdminPage,
  toUsd,
  type AdminSearchFilters,
} from "@/lib/propertyQuery"
import { supabase } from "@/lib/supabase"
import type { Propiedad } from "@/types"
import type { BusquedaGuardada } from "./BusquedasGuardadasList"

export type PropiedadesTab = "buscar" | "favoritos" | "historial" | "guardadas"

export const ITEMS_PER_PAGE = 20
const IN_CHUNK = 100
const HISTORY_LIMIT = 50

/** Trae propiedades por id (en lotes) conservando el orden de `ids`. */
async function fetchByIds(ids: string[]): Promise<Propiedad[]> {
  const found = new Map<string, Propiedad>()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await supabase
      .from("propiedades")
      .select(PROPERTY_COLUMNS)
      .in("id", ids.slice(i, i + IN_CHUNK))
    if (error) throw error
    for (const p of (data as Propiedad[] | null) ?? []) found.set(p.id, p)
  }
  return ids.map(id => found.get(id)).filter((p): p is Propiedad => !!p)
}

/** Estado y acciones de la pestaña "Propiedades" del panel de administración. */
export function useAdminPropiedades(adminId: number) {
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
    const { data, error } = await supabase
      .from("favoritos")
      .select("propiedad_id")
      .eq("admin_id", adminId)
    if (error) return console.error("Error cargando favoritos:", error)
    setFavoritos(new Set((data ?? []).map(f => f.propiedad_id as string)))
  }, [adminId])

  const loadHistorialIds = useCallback(async () => {
    const { data, error } = await supabase
      .from("historial")
      .select("propiedad_id")
      .eq("admin_id", adminId)
    if (error) return console.error("Error cargando historial:", error)
    setHistorialIds(new Set((data ?? []).map(h => h.propiedad_id as string)))
  }, [adminId])

  const loadBusquedas = useCallback(async () => {
    const { data, error } = await supabase
      .from("busquedas_guardadas")
      .select("*")
      .eq("admin_id", adminId)
      .order("creado_en", { ascending: false })
    if (error) return console.error("Error cargando búsquedas:", error)
    setBusquedas((data as BusquedaGuardada[] | null) ?? [])
  }, [adminId])

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

  const loadFavoritosTab = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("favoritos")
        .select("propiedad_id")
        .eq("admin_id", adminId)
        .order("creado_en", { ascending: false })
      if (error) throw error

      const ids = (data ?? []).map(f => f.propiedad_id as string)
      setFavoritos(new Set(ids))
      const props = await fetchByIds(ids)
      if (current !== requestId.current) return
      setPropiedades(props)
      setTotalCount(props.length)
      setPage(0)
    } catch (err) {
      if (current !== requestId.current) return
      addToast("Error al cargar favoritos", "error")
      console.error(err)
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [adminId, addToast])

  const loadHistorialTab = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("historial")
        .select("propiedad_id")
        .eq("admin_id", adminId)
        .order("visto_en", { ascending: false })
        .limit(HISTORY_LIMIT)
      if (error) throw error

      const props = await fetchByIds((data ?? []).map(h => h.propiedad_id as string))
      if (current !== requestId.current) return
      setPropiedades(props)
      setTotalCount(props.length)
      setPage(0)
    } catch (err) {
      if (current !== requestId.current) return
      addToast("Error al cargar historial", "error")
      console.error(err)
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [adminId, addToast])

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
    else if (tab === "favoritos") loadFavoritosTab()
    else if (tab === "historial") loadHistorialTab()
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
      const { error } = await supabase.from("busquedas_guardadas").insert({
        admin_id: adminId,
        nombre: trimmed,
        distrito: draft.distrito,
        operacion: draft.operacion,
        portal: draft.portal,
        // Los límites se guardan normalizados a USD.
        precio_min: toUsd(draft.precioMin, draft.moneda),
        precio_max: toUsd(draft.precioMax, draft.moneda),
      })
      if (error) throw error
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
      const { error } = await supabase.from("busquedas_guardadas").delete().eq("id", id)
      if (error) throw error
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
        const { error } = await supabase
          .from("favoritos")
          .delete()
          .eq("admin_id", adminId)
          .eq("propiedad_id", propiedadId)
        if (error) throw error

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
        const { error } = await supabase
          .from("favoritos")
          .insert({ admin_id: adminId, propiedad_id: propiedadId })
        if (error) throw error

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
      const { error } = await supabase.from("historial").upsert(
        {
          admin_id: adminId,
          propiedad_id: propiedadId,
          visto_en: new Date().toISOString(),
        },
        { onConflict: "admin_id,propiedad_id" }
      )
      if (error) throw error
      setHistorialIds(prev => new Set(prev).add(propiedadId))
    } catch (err) {
      console.error("Error al registrar historial", err)
    }
  }

  const deletePropiedad = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("propiedades").delete().eq("id", id)
      if (error) throw error
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

  /** Limpieza de registros inactivos: ejecuta la función `limpiar_inactivos` de la base de datos. */
  const runCleanup = async (): Promise<void> => {
    const { error } = await supabase.rpc("limpiar_inactivos")
    if (!error) {
      addToast("Limpieza ejecutada correctamente", "success")
      return
    }
    console.error("Error en limpiar_inactivos:", error)
    addToast(
      isMissingRpc(error)
        ? "La limpieza no está configurada: falta la función limpiar_inactivos en la base de datos."
        : "No se pudo ejecutar la limpieza",
      "error"
    )
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
