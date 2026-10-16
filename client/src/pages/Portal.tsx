import { useCallback, useEffect, useRef, useState } from "react"
import { Filter, Grid3X3, List } from "lucide-react"
import Pagination from "@/components/properties/Pagination"
import PortalFilters from "@/components/portal/PortalFilters"
import PortalHeader from "@/components/portal/PortalHeader"
import PropertyCard from "@/components/properties/PropertyCard"
import PropertyTable from "@/components/properties/PropertyTable"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/contexts/ToastContext"
import { fetchPortalPage } from "@/lib/propertyQuery"
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
    <div
      className="overflow-x-hidden max-w-full"
      style={{ backgroundColor: "#0F0F0F", minHeight: "100vh", paddingTop: "64px" }}
    >
      <PortalHeader
        usuario={usuario}
        planType={planType}
        fechaVencimiento={fechaVencimiento}
        onLogout={onLogout}
      />

      {/* Mobile Sticky Filter Trigger (below navigation header) */}
      <div
        className="sticky top-16 md:hidden z-30 px-6 py-3 flex items-center justify-between border-b"
        style={{
          backgroundColor: "#1A1A1A",
          borderColor: "#2A2A2A",
          fontFamily: "DM Sans",
        }}
      >
        <span style={{ color: "#6B6B6B", fontSize: "0.875rem" }}>
          Mostrando <strong style={{ color: "#C9A96E" }}>{totalCount}</strong>{" "}
          propiedades
        </span>
        <button
          onClick={() => setIsFilterDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90 cursor-pointer"
          style={{
            backgroundColor: "#C9A96E",
            color: "#0F0F0F",
            height: "44px",
            minHeight: "44px",
          }}
        >
          <Filter size={16} />
          Filtrar
        </button>
      </div>

      {/* Filtros (Desktop) */}
      <div className="hidden md:block relative z-40">{filtersPanel(false)}</div>

      {/* Filtros (Mobile Drawer) */}
      <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md border-l border-[#2A2A2A] p-0 flex flex-col h-full"
          style={{ backgroundColor: "#1A1A1A" }}
        >
          <SheetHeader className="px-6 py-4 border-b border-[#2A2A2A] flex flex-row items-center justify-between text-left">
            <SheetTitle
              className="text-xl font-bold"
              style={{ fontFamily: "Cormorant Garamond", color: "#C9A96E" }}
            >
              Filtros
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">{filtersPanel(true)}</div>
        </SheetContent>
      </Sheet>

      <main className="pt-4 pb-8 overflow-x-hidden max-w-full">
        {/* Controles de vista */}
        <div
          className="flex items-center justify-between px-6 mb-6"
          style={{ fontFamily: "DM Sans" }}
        >
          <span style={{ color: "#6B6B6B", fontSize: "0.875rem" }}>
            Mostrando{" "}
            <strong style={{ color: "#C9A96E" }}>{properties.length}</strong> de{" "}
            <strong style={{ color: "#C9A96E" }}>{totalCount}</strong>{" "}
            propiedades
          </span>
          <div className="flex gap-2">
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
                aria-pressed={viewMode === mode}
                className="p-2 rounded transition"
                style={{
                  backgroundColor: viewMode === mode ? "#C9A96E" : "transparent",
                  color: viewMode === mode ? "#0F0F0F" : "#6B6B6B",
                  border: "1px solid #2A2A2A",
                }}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div
              className="skeleton w-full h-96"
              style={{ borderRadius: "8px" }}
            ></div>
          </div>
        )}

        {!loading && properties.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              style={{ color: "#6B6B6B", marginBottom: "1rem" }}
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <p
              style={{
                color: "#6B6B6B",
                fontFamily: "DM Sans",
                marginBottom: "1rem",
              }}
            >
              Sin propiedades para estos filtros
            </p>
            <button onClick={() => handleClear()} className="btn-outline-gold">
              Limpiar filtros
            </button>
          </div>
        )}

        {!loading && properties.length > 0 && viewMode === "grid" && (
          <div className="px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
          <div className="px-6">
            <PropertyTable properties={properties} moneda={applied.moneda} />
          </div>
        )}
      </main>

      {!loading && properties.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={page => loadProperties(applied, page)}
          totalItems={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </div>
  )
}
