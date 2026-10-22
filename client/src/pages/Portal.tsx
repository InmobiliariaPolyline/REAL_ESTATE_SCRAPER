import {
  Bookmark,
  Calculator,
  Download,
  Grid3X3,
  Heart,
  Home,
  KeyRound,
  LayoutGrid,
  List,
  Loader2,
  LogOut,
  Moon,
  SearchX,
  SlidersHorizontal,
  Sun,
  TrendingUp,
} from "lucide-react"
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import CommandPalette, { type CommandAction } from "@/components/common/CommandPalette"
import EmptyState from "@/components/common/EmptyState"
import PageHeader from "@/components/common/PageHeader"
import CompareTray from "@/components/portal/CompareTray"
import PortalFilters from "@/components/portal/PortalFilters"
import PortalCalculadora from "@/components/portal/PortalCalculadora"
import PortalEstadisticas from "@/components/portal/PortalEstadisticas"
import PortalHeader from "@/components/portal/PortalHeader"
import PortalInicio from "@/components/portal/PortalInicio"
import PortalTabs, { type PortalView } from "@/components/portal/PortalTabs"
import { sectionsFor, type SistemaSection } from "@/components/sistema/SistemaModule"
import Pagination from "@/components/properties/Pagination"
import PropertyCard from "@/components/properties/PropertyCard"
import PropertyTable from "@/components/properties/PropertyTable"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTheme } from "@/contexts/ThemeContext"
import { useToast } from "@/contexts/ToastContext"
import {
  ORDEN_OPTIONS,
  addFavorito,
  exportPortalCsv,
  fetchFavoritos,
  fetchPortalPage,
  removeFavorito,
  type Orden,
} from "@/lib/propertiesApi"
import {
  DEFAULT_FILTERS,
  type FilterState,
  type PlanType,
  type Propiedad,
} from "@/types"

// Modales pesados (gráficos, comparador): se descargan al abrirse por primera vez.
const SistemaModule = lazy(() => import("@/components/sistema/SistemaModule"))
const CompareModal = lazy(() => import("@/components/portal/CompareModal"))
const PropertyDetailModal = lazy(() => import("@/components/portal/PropertyDetailModal"))
const SavedSearchesModal = lazy(() => import("@/components/portal/SavedSearchesModal"))

interface PortalProps {
  usuario: string
  fechaVencimiento: string
  planType: PlanType
  onLogout: () => void
}

const ITEMS_PER_PAGE = 24
const MAX_COMPARE = 3

const freshFilters = (): FilterState => ({ ...DEFAULT_FILTERS, portales: [] })

export default function Portal({
  usuario,
  fechaVencimiento,
  planType,
  onLogout,
}: PortalProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [properties, setProperties] = useState<Propiedad[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)

  // `filters` es el borrador que edita el usuario; `applied` son los filtros de la última
  // búsqueda y son los que usan la paginación, el orden y las tarjetas.
  const [filters, setFilters] = useState<FilterState>(freshFilters)
  const [applied, setApplied] = useState<FilterState>(freshFilters)
  const [orden, setOrden] = useState<Orden>("relevancia")
  const ordenRef = useRef<Orden>("relevancia")

  // Favoritos, comparación, detalle, búsquedas guardadas y exportación.
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set())
  const [soloFavoritos, setSoloFavoritos] = useState(false)
  const [favList, setFavList] = useState<Propiedad[]>([])
  const [compare, setCompare] = useState<Map<string, Propiedad>>(new Map())
  const [showCompare, setShowCompare] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { addToast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const requestId = useRef(0)
  const [view, setView] = useState<PortalView>("inicio")
  const [sistemaSection, setSistemaSection] = useState<SistemaSection>("perfil")

  const loadProperties = useCallback(
    async (activeFilters: FilterState, page: number, activeOrden: Orden = ordenRef.current) => {
      const current = ++requestId.current
      setLoading(true)
      try {
        const result = await fetchPortalPage(activeFilters, page, ITEMS_PER_PAGE, activeOrden)
        if (current !== requestId.current) return // llegó una búsqueda más reciente
        setProperties(result.data)
        setTotalCount(result.count)
        setCurrentPage(page)
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

  useEffect(() => {
    loadProperties(freshFilters(), 0)
    fetchFavoritos()
      .then(f => setFavoritos(new Set(f.ids)))
      .catch(err => console.error("Error cargando favoritos:", err))
  }, [loadProperties])

  const handleSearch = async () => {
    setSoloFavoritos(false)
    setApplied(filters)
    await loadProperties(filters, 0)
    addToast("Búsqueda realizada", "info")
  }

  const handleClear = async (cleared: FilterState = freshFilters()) => {
    setSoloFavoritos(false)
    setFilters(cleared)
    setApplied(cleared)
    await loadProperties(cleared, 0)
    addToast("Filtros limpiados", "info")
  }

  const handleOrden = (value: Orden) => {
    setOrden(value)
    ordenRef.current = value
    if (!soloFavoritos) loadProperties(applied, 0, value)
  }

  const applySavedSearch = (saved: FilterState) => {
    setSoloFavoritos(false)
    setFilters(saved)
    setApplied(saved)
    loadProperties(saved, 0)
    addToast("Búsqueda aplicada", "info")
  }

  /** Aplica filtros y lleva al catálogo (desde Inicio y Estadísticas). */
  const searchInCatalog = (next: FilterState) => {
    setView("catalogo")
    applySavedSearch(next)
  }

  // ── Favoritos ──────────────────────────────────────────────────────────
  const toggleFavorito = async (id: string) => {
    const isFav = favoritos.has(id)
    try {
      if (isFav) await removeFavorito(id)
      else await addFavorito(id)
      setFavoritos(prev => {
        const next = new Set(prev)
        if (isFav) next.delete(id)
        else next.add(id)
        return next
      })
      if (isFav) setFavList(prev => prev.filter(p => p.id !== id))
      addToast(isFav ? "Quitado de favoritos" : "Agregado a favoritos", isFav ? "info" : "success")
    } catch (err) {
      console.error(err)
      addToast("No se pudo actualizar el favorito", "error")
    }
  }

  const toggleSoloFavoritos = async () => {
    if (soloFavoritos) {
      setSoloFavoritos(false)
      return
    }
    try {
      const data = await fetchFavoritos()
      setFavList(data.propiedades)
      setFavoritos(new Set(data.ids))
      setSoloFavoritos(true)
    } catch (err) {
      console.error(err)
      addToast("No se pudieron cargar tus favoritos", "error")
    }
  }

  // ── Comparación ────────────────────────────────────────────────────────
  const toggleCompare = (prop: Propiedad) =>
    setCompare(prev => {
      const next = new Map(prev)
      if (next.has(prop.id)) next.delete(prop.id)
      else if (next.size < MAX_COMPARE) next.set(prop.id, prop)
      return next
    })

  const removeCompare = (id: string) =>
    setCompare(prev => {
      const next = new Map(prev)
      next.delete(id)
      if (next.size < 2) setShowCompare(false)
      return next
    })

  // ── Exportación ────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await exportPortalCsv(applied, orden)
      addToast("Exportación lista: revisa tus descargas", "success")
    } catch (err) {
      console.error(err)
      addToast("No se pudo exportar la búsqueda", "error")
    } finally {
      setExporting(false)
    }
  }

  const list = soloFavoritos ? favList : properties
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const compareItems = Array.from(compare.values())
  const canCompareMore = compare.size < MAX_COMPARE

  const filtersPanel = (isMobileDrawer: boolean) => (
    <PortalFilters
      filters={filters}
      onFiltersChange={setFilters}
      onApply={next => {
        setSoloFavoritos(false)
        setFilters(next)
        setApplied(next)
        loadProperties(next, 0)
      }}
      onSearch={() => {
        if (isMobileDrawer) setIsFilterDrawerOpen(false)
        handleSearch()
      }}
      onClear={cleared => {
        if (isMobileDrawer) setIsFilterDrawerOpen(false)
        handleClear(cleared)
      }}
      isMobileDrawer={isMobileDrawer}
    />
  )

  const paletteActions: CommandAction[] = [
    { id: "v-inicio", label: "Ir a Inicio", group: "Secciones", icon: Home, keywords: ["resumen", "novedades"], run: () => setView("inicio") },
    { id: "v-catalogo", label: "Ir al Catálogo", group: "Secciones", icon: LayoutGrid, keywords: ["propiedades", "avisos", "buscar"], run: () => setView("catalogo") },
    { id: "v-estad", label: "Ir a Estadísticas", group: "Secciones", icon: TrendingUp, keywords: ["distritos", "precio m2", "mercado"], run: () => setView("estadisticas") },
    { id: "v-calc", label: "Ir a la Calculadora", group: "Secciones", icon: Calculator, keywords: ["hipoteca", "rentabilidad", "cuota"], run: () => setView("calculadora") },
    { id: "a-fav", label: "Ver mis favoritos", group: "Acciones", icon: Heart, run: () => { setView("catalogo"); if (!soloFavoritos) toggleSoloFavoritos() } },
    { id: "a-busquedas", label: "Mis búsquedas guardadas", group: "Acciones", icon: Bookmark, run: () => setShowSaved(true) },
    ...sectionsFor(false).map(sec => ({
      id: `cuenta-${sec.id}`,
      label: `Cuenta: ${sec.label}`,
      group: "Cuenta",
      icon: sec.icon,
      keywords: [sec.title, sec.description],
      run: () => {
        setSistemaSection(sec.id)
        setView("cuenta")
      },
    })),
    { id: "a-cuenta", label: "Mi cuenta: contraseña y sesiones", group: "Cuenta", icon: KeyRound, keywords: ["password", "clave", "dispositivos"], run: () => window.dispatchEvent(new Event("open-account")) },
    ...(toggleTheme
      ? [{ id: "a-tema", label: theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro", group: "Cuenta", icon: theme === "dark" ? Sun : Moon, run: toggleTheme }]
      : []),
    { id: "a-salir", label: "Cerrar sesión", group: "Cuenta", icon: LogOut, run: onLogout },
  ]

  return (
    <div className="min-h-screen pt-16">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <CommandPalette actions={paletteActions} />
      <PortalHeader
        usuario={usuario}
        planType={planType}
        fechaVencimiento={fechaVencimiento}
        onLogout={onLogout}
      />

      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-8 sm:px-8">
        <PortalTabs view={view} onChange={setView} />

        {view === "inicio" && (
          <>
            <PageHeader
              eyebrow="Inicio"
              title={
                <>
                  Hola, <span className="text-gold">{usuario}</span>
                </>
              }
              description="Lo nuevo del mercado y lo que pasó con tus favoritos y búsquedas."
            />
            <PortalInicio
              onOpenProperty={setDetailId}
              onApplySearch={searchInCatalog}
              onGoCatalog={() => setView("catalogo")}
            />
          </>
        )}

        {view === "estadisticas" && (
          <>
            <PageHeader
              eyebrow="Mercado"
              title="Estadísticas por distrito"
              description="Compara zonas con la mediana del precio por m², que no se distorsiona por avisos con precios raros."
            />
            <PortalEstadisticas
              onSelectDistrito={(distrito, operacion) =>
                searchInCatalog({ ...freshFilters(), distrito, operacion })
              }
            />
          </>
        )}

        {view === "calculadora" && (
          <>
            <PageHeader
              eyebrow="Herramientas"
              title="Calculadora"
              description="Estima la cuota de una hipoteca y cuánto rinde un inmueble puesto en alquiler."
            />
            <PortalCalculadora />
          </>
        )}

        {view === "cuenta" && (
          <>
            <PageHeader
              eyebrow="Cuenta"
              title="Tu cuenta"
              description="Perfil, seguridad, apariencia y novedades del sistema."
            />
            <Suspense fallback={<div className="skeleton h-72" aria-busy="true" />}>
              <SistemaModule
                esAdmin={false}
                section={sistemaSection}
                onSectionChange={setSistemaSection}
                onLogout={onLogout}
              />
            </Suspense>
          </>
        )}

        <div hidden={view !== "catalogo"}>
        <PageHeader
          eyebrow="Catálogo"
          title="Catálogo de propiedades"
          description="Explora los avisos de todos los portales con precios normalizados en soles y dólares."
        />

        {/* Filtros (escritorio) */}
        <div className="relative z-20 hidden md:block">{filtersPanel(false)}</div>

        {/* Filtros (móvil) */}
        <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
          <SheetContent
            side="right"
            className="flex h-full w-full flex-col border-l border-line bg-surface-1 p-0 sm:max-w-md"
          >
            <SheetHeader className="border-b border-line px-5 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-text">
                <SlidersHorizontal className="size-4 text-gold" />
                Filtros
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">{filtersPanel(true)}</div>
          </SheetContent>
        </Sheet>

        {/* Barra de resultados */}
        <div className="mb-5 mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-muted" aria-live="polite">
            {soloFavoritos ? (
              <>
                Mostrando tus{" "}
                <strong className="mono font-medium text-text">{favList.length}</strong> favoritos
              </>
            ) : (
              <>
                Mostrando <strong className="mono font-medium text-text">{properties.length}</strong> de{" "}
                <strong className="mono font-medium text-text">{totalCount}</strong> propiedades
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="btn btn-secondary btn-sm md:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Filtrar
            </button>

            <select
              value={orden}
              onChange={e => handleOrden(e.target.value as Orden)}
              disabled={soloFavoritos}
              className="field !h-8 !w-auto !rounded-[0.625rem] !text-[0.8125rem]"
              aria-label="Ordenar resultados"
            >
              {ORDEN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <button onClick={() => setShowSaved(true)} className="btn btn-secondary btn-sm">
              <Bookmark className="size-4" />
              Mis búsquedas
            </button>

            <button
              onClick={toggleSoloFavoritos}
              aria-pressed={soloFavoritos}
              className={soloFavoritos ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            >
              <Heart className="size-4" />
              Favoritos
              {favoritos.size > 0 && (
                <span className="mono rounded-full bg-black/20 px-1.5 py-0.5 text-[0.6875rem]">
                  {favoritos.size}
                </span>
              )}
            </button>

            <button
              onClick={handleExport}
              disabled={exporting || soloFavoritos || totalCount === 0}
              className="btn btn-secondary btn-sm"
              title="Descarga la búsqueda actual (hasta 5000 avisos)"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Exportar CSV
            </button>

            <div className="segmented" role="group" aria-label="Tipo de vista">
              {(
                [
                  ["grid", Grid3X3, "Vista en cuadrícula"],
                  ["list", List, "Vista en lista"],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  aria-label={label}
                  title={label}
                  aria-pressed={viewMode === mode}
                  className="segmented-option !flex-none !px-3"
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && !soloFavoritos && (
          <div className="stagger grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton h-[26rem]" />
            ))}
          </div>
        )}

        {(!loading || soloFavoritos) && list.length === 0 && (
          <div className="card">
            {soloFavoritos ? (
              <EmptyState
                icon={Heart}
                title="Aún no tienes favoritos"
                description="Pulsa el corazón de una propiedad para guardarla aquí."
                action={
                  <button onClick={() => setSoloFavoritos(false)} className="btn btn-outline">
                    Ver todas las propiedades
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="Sin propiedades para estos filtros"
                description="Prueba ampliando el rango de precio o quitando algún filtro."
                action={
                  <button onClick={() => handleClear()} className="btn btn-outline">
                    Limpiar filtros
                  </button>
                }
              />
            )}
          </div>
        )}

        {(!loading || soloFavoritos) && list.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.map((prop, idx) => (
              <PropertyCard
                key={prop.id}
                id={prop.id}
                portal={prop.portal}
                operacion={prop.operacion}
                titulo={prop.titulo}
                precio={prop.precio}
                precioUsd={prop.precio_usd}
                moneda={applied.moneda}
                distrito={prop.distrito}
                dormitorios={prop.dormitorios}
                banios={prop.banios}
                area={prop.area}
                imagen={prop.imagen}
                url={prop.url}
                index={idx}
                isFavorite={favoritos.has(prop.id)}
                onToggleFavorite={toggleFavorito}
                onOpenDetail={setDetailId}
                isCompared={compare.has(prop.id)}
                compareDisabled={!canCompareMore}
                onToggleCompare={() => toggleCompare(prop)}
              />
            ))}
          </div>
        )}

        {(!loading || soloFavoritos) && list.length > 0 && viewMode === "list" && (
          <PropertyTable properties={list} moneda={applied.moneda} />
        )}

        {!loading && !soloFavoritos && properties.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={page => loadProperties(applied, page)}
            totalItems={totalCount}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
        </div>
      </main>

      <CompareTray
        items={compareItems}
        max={MAX_COMPARE}
        onCompare={() => setShowCompare(true)}
        onRemove={removeCompare}
        onClear={() => {
          setCompare(new Map())
          setShowCompare(false)
        }}
      />

      <Suspense fallback={null}>
      {showCompare && compareItems.length >= 2 && (
        <CompareModal
          items={compareItems}
          moneda={applied.moneda}
          onRemove={removeCompare}
          onClose={() => setShowCompare(false)}
        />
      )}

      {detailId && (
        <PropertyDetailModal
          propertyId={detailId}
          moneda={applied.moneda}
          isFavorite={favoritos.has(detailId)}
          onToggleFavorite={toggleFavorito}
          isCompared={compare.has(detailId)}
          compareDisabled={!canCompareMore}
          onToggleCompare={toggleCompare}
          onOpenProperty={setDetailId}
          onClose={() => setDetailId(null)}
        />
      )}

      {showSaved && (
        <SavedSearchesModal
          currentFilters={filters}
          onApply={applySavedSearch}
          onClose={() => setShowSaved(false)}
        />
      )}
      </Suspense>
    </div>
  )
}
