import { Grid3X3, List, SearchX, SlidersHorizontal } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import EmptyState from "@/components/common/EmptyState"
import PageHeader from "@/components/common/PageHeader"
import PortalFilters from "@/components/portal/PortalFilters"
import PortalHeader from "@/components/portal/PortalHeader"
import Pagination from "@/components/properties/Pagination"
import PropertyCard from "@/components/properties/PropertyCard"
import PropertyTable from "@/components/properties/PropertyTable"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/contexts/ToastContext"
import { fetchPortalPage } from "@/lib/propertiesApi"
import {
  DEFAULT_FILTERS,
  type FilterState,
  type PlanType,
  type Propiedad,
} from "@/types"

interface PortalProps {
  usuario: string
  fechaVencimiento: string
  planType: PlanType
  onLogout: () => void
}

const ITEMS_PER_PAGE = 24

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
  // búsqueda y son los que usan la paginación y las tarjetas.
  const [filters, setFilters] = useState<FilterState>(freshFilters)
  const [applied, setApplied] = useState<FilterState>(freshFilters)

  const { addToast } = useToast()
  const requestId = useRef(0)

  const loadProperties = useCallback(
    async (activeFilters: FilterState, page: number) => {
      const current = ++requestId.current
      setLoading(true)
      try {
        const result = await fetchPortalPage(activeFilters, page, ITEMS_PER_PAGE)
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
  }, [loadProperties])

  const handleSearch = async () => {
    setApplied(filters)
    await loadProperties(filters, 0)
    addToast("Búsqueda realizada", "info")
  }

  const handleClear = async (cleared: FilterState = freshFilters()) => {
    setFilters(cleared)
    setApplied(cleared)
    await loadProperties(cleared, 0)
    addToast("Filtros limpiados", "info")
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const filtersPanel = (isMobileDrawer: boolean) => (
    <PortalFilters
      filters={filters}
      onFiltersChange={setFilters}
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

  return (
    <div className="min-h-screen pt-16">
      <PortalHeader
        usuario={usuario}
        planType={planType}
        fechaVencimiento={fechaVencimiento}
        onLogout={onLogout}
      />

      <main className="mx-auto w-full max-w-[1500px] px-4 pb-14 pt-8 sm:px-8">
        <PageHeader
          eyebrow="Catálogo"
          title={
            <>
              Hola, <span className="text-gold">{usuario}</span>
            </>
          }
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
            Mostrando <strong className="mono font-medium text-text">{properties.length}</strong> de{" "}
            <strong className="mono font-medium text-text">{totalCount}</strong> propiedades
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className="btn btn-secondary btn-sm md:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Filtrar
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

        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton h-[26rem]" />
            ))}
          </div>
        )}

        {!loading && properties.length === 0 && (
          <div className="card">
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
          </div>
        )}

        {!loading && properties.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {properties.map((prop, idx) => (
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
              />
            ))}
          </div>
        )}

        {!loading && properties.length > 0 && viewMode === "list" && (
          <PropertyTable properties={properties} moneda={applied.moneda} />
        )}

        {!loading && properties.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={page => loadProperties(applied, page)}
            totalItems={totalCount}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </main>
    </div>
  )
}
