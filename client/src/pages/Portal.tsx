import { useState, useEffect } from 'react'
import { Grid3X3, List, Filter } from 'lucide-react'
import PortalHeader from '@/components/PortalHeader'
import PortalFilters, { FilterState } from '@/components/PortalFilters'
import PropertyCard from '@/components/PropertyCard'
import PropertyTable from '@/components/PropertyTable'
import Pagination from '@/components/Pagination'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface PortalProps {
  usuario: string
  usuarioId: number
  fechaVencimiento: string
  planType: 'PREMIUM' | 'GRATIS'
  onLogout: () => void
}

interface PropertyData {
  id: string
  portal: string
  operacion: string
  inmueble: string
  titulo: string
  precio: number
  precio_usd: number
  moneda: string
  distrito: string
  dormitorios: string
  banios: string
  area: string
  imagen: string | null
  url: string
  creado_en?: string
}

const ITEMS_PER_PAGE = 24

function cleanAccentsRegex(str: string): string {
  let cleaned = str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  cleaned = cleaned
    .replace(/[aáÁ]/gi, '[aáÁ]')
    .replace(/[eéÉ]/gi, '[eéÉ]')
    .replace(/[iíÍ]/gi, '[iíÍ]')
    .replace(/[oóÓ]/gi, '[oóÓ]')
    .replace(/[uúÚüÜ]/gi, '[uúÚüÜ]')
  return cleaned
}

export default function Portal({
  usuario,
  usuarioId,
  fechaVencimiento,
  planType,
  onLogout,
}: PortalProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [properties, setProperties] = useState<PropertyData[]>([])
  const [filteredProperties, setFilteredProperties] = useState<PropertyData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    distrito: '',
    operacion: 'todos',
    inmueble: 'todos',
    portales: [],
    moneda: 'PEN',
    precioMin: '',
    precioMax: '',
    dormitorios: 'todos',
  })
  const { addToast } = useToast()

  // Cargar propiedades
  const loadProperties = async (page: number = 0) => {
    setLoading(true)
    try {
      let query = supabase
        .from('propiedades')
        .select('*', { count: 'exact' })
        .order('creado_en', { ascending: false })

      // Aplicar filtros
      if (filters.operacion && filters.operacion.toLowerCase() !== 'todos') {
        query = query.ilike('operacion', filters.operacion)
      }
      if (filters.inmueble && filters.inmueble.toLowerCase() !== 'todos') {
        query = query.ilike('inmueble', filters.inmueble)
      }
      if (filters.distrito && filters.distrito.trim() !== '') {
        const regexPattern = cleanAccentsRegex(filters.distrito.trim())
        query = query.filter('distrito', 'imatch', regexPattern)
      }
      const activePortals = filters.portales
        .filter(p => p && p.toLowerCase() !== 'todos')
        .map(p => p.toLowerCase())
      if (activePortals.length > 0) {
        query = query.in('portal', activePortals)
      }
      if (filters.moneda === 'USD') {
        const minUsd = filters.precioMin !== '' ? Number(filters.precioMin) : 0
        const maxUsd = filters.precioMax !== '' ? Number(filters.precioMax) : null

        if (minUsd > 0 || maxUsd !== null) {
          const conditions: string[] = []

          // Case A: precio_usd is set (>0) and in range
          let condA = `precio_usd.gt.0`
          if (minUsd > 0) condA += `,precio_usd.gte.${minUsd}`
          if (maxUsd !== null) condA += `,precio_usd.lte.${maxUsd}`
          conditions.push(`and(${condA})`)

          // Case B: precio_usd is 0, convert PEN to USD
          const minPen = minUsd * 3.75
          const maxPen = maxUsd !== null ? maxUsd * 3.75 : null
          
          let condB = `precio_usd.eq.0`
          if (minPen > 0) condB += `,precio.gte.${minPen}`
          if (maxPen !== null) condB += `,precio.lte.${maxPen}`
          conditions.push(`and(${condB})`)

          // Case C: precio_usd is null, convert PEN to USD
          let condC = `precio_usd.is.null`
          if (minPen > 0) condC += `,precio.gte.${minPen}`
          if (maxPen !== null) condC += `,precio.lte.${maxPen}`
          conditions.push(`and(${condC})`)

          query = query.or(conditions.join(','))
        }
      } else {
        // PEN moneda
        const minPen = filters.precioMin !== '' ? Number(filters.precioMin) : 0
        const maxPen = filters.precioMax !== '' ? Number(filters.precioMax) : null

        if (minPen > 0 || maxPen !== null) {
          const conditions: string[] = []

          // Case A: precio is set (>0) and in range
          let condA = `precio.gt.0`
          if (minPen > 0) condA += `,precio.gte.${minPen}`
          if (maxPen !== null) condA += `,precio.lte.${maxPen}`
          conditions.push(`and(${condA})`)

          // Case B: precio is 0, convert USD to PEN
          const minUsd = minPen / 3.75
          const maxUsd = maxPen !== null ? maxPen / 3.75 : null

          let condB = `precio.eq.0`
          if (minUsd > 0) condB += `,precio_usd.gte.${minUsd}`
          if (maxUsd !== null) condB += `,precio_usd.lte.${maxUsd}`
          conditions.push(`and(${condB})`)

          // Case C: precio is null, convert USD to PEN
          let condC = `precio.is.null`
          if (minUsd > 0) condC += `,precio_usd.gte.${minUsd}`
          if (maxUsd !== null) condC += `,precio_usd.lte.${maxUsd}`
          conditions.push(`and(${condC})`)

          query = query.or(conditions.join(','))
        }
      }
      if (filters.dormitorios && filters.dormitorios.toLowerCase() !== 'todos') {
        query = query.ilike('dormitorios', `%${filters.dormitorios}%`)
      }

      // Paginación
      const { data, count, error } = await query.range(
        page * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE + ITEMS_PER_PAGE - 1
      )

      if (error) {
        addToast('Error al cargar propiedades', 'error')
        console.error(error)
        return
      }

      // Ordenar: precios en cero al final (conversión estricta)
      const sortedData = ((data as PropertyData[]) || []).sort((a, b) => {
        const getEffectivePrice = (p: PropertyData) => {
          if (filters.moneda === 'USD') {
            if (p.precio_usd && p.precio_usd > 0) return p.precio_usd
            if (p.precio && p.precio > 0) return p.precio / 3.75
            return 0
          } else {
            if (p.precio && p.precio > 0) return p.precio
            if (p.precio_usd && p.precio_usd > 0) return p.precio_usd * 3.75
            return 0
          }
        }

        const priceA = getEffectivePrice(a)
        const priceB = getEffectivePrice(b)

        // Regla de oro: Si uno es 0 y el otro no, el 0 se va al fondo
        if (priceA === 0 && priceB > 0) return 1
        if (priceB === 0 && priceA > 0) return -1

        // Si ambos tienen precio real (o ambos son 0), ordenar por fecha más reciente
        const fechaA = new Date(a.creado_en || 0).getTime()
        const fechaB = new Date(b.creado_en || 0).getTime()
        return fechaB - fechaA
      })

      setProperties(sortedData)
      setTotalCount(count || 0)
      setCurrentPage(page)
    } catch (err) {
      addToast('Error al conectar con el servidor', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Cargar propiedades al montar
  useEffect(() => {
    loadProperties(0)
  }, [])

  // Manejar cambio de filtros
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters)
  }

  // Buscar
  const handleSearch = async () => {
    setCurrentPage(0)
    await loadProperties(0)
    addToast('Búsqueda realizada', 'info')
  }

  // Limpiar filtros
  const handleClear = async () => {
    setFilters({
      distrito: '',
      operacion: 'todos',
      inmueble: 'todos',
      portales: [],
      moneda: 'PEN',
      precioMin: '',
      precioMax: '',
      dormitorios: 'todos',
    })
    setCurrentPage(0)
    await loadProperties(0)
    addToast('Filtros limpiados', 'info')
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  return (
    <div
      className="overflow-x-hidden max-w-full"
      style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', paddingTop: '64px' }}
    >
      {/* Header */}
      <PortalHeader
        usuario={usuario}
        planType={planType}
        fechaVencimiento={fechaVencimiento}
        onLogout={onLogout}
      />

      {/* Mobile Sticky Filter Trigger (below navigation header) */}
      <div
        className="sticky top-16 md:hidden z-30 px-6 py-3 flex items-center justify-between border-b"
        style={{ backgroundColor: '#1A1A1A', borderColor: '#2A2A2A', fontFamily: 'DM Sans' }}
      >
        <span style={{ color: '#6B6B6B', fontSize: '0.875rem' }}>
          Mostrando <strong style={{ color: '#C9A96E' }}>{totalCount}</strong> propiedades
        </span>
        <button
          onClick={() => setIsFilterDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded font-semibold text-sm transition hover:opacity-90 cursor-pointer"
          style={{
            backgroundColor: '#C9A96E',
            color: '#0F0F0F',
            height: '44px',
            minHeight: '44px',
          }}
        >
          <Filter size={16} />
          Filtrar
        </button>
      </div>

      {/* Filtros (Desktop) */}
      <div className="hidden md:block relative z-40">
        <PortalFilters
          onFilterChange={handleFilterChange}
          onSearch={handleSearch}
          onClear={handleClear}
        />
      </div>

      {/* Filtros (Mobile Drawer) */}
      <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md border-l border-[#2A2A2A] p-0 flex flex-col h-full"
          style={{ backgroundColor: '#1A1A1A' }}
        >
          <SheetHeader className="px-6 py-4 border-b border-[#2A2A2A] flex flex-row items-center justify-between text-left">
            <SheetTitle
              className="text-xl font-bold"
              style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
            >
              Filtros
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <PortalFilters
              onFilterChange={handleFilterChange}
              onSearch={() => {
                setIsFilterDrawerOpen(false)
                handleSearch()
              }}
              onClear={() => {
                setIsFilterDrawerOpen(false)
                handleClear()
              }}
              isMobileDrawer={true}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Contenido principal */}
      <main className="pt-4 pb-8 overflow-x-hidden max-w-full">
        {/* Controles de vista */}
        <div
          className="flex items-center justify-between px-6 mb-6"
          style={{ fontFamily: 'DM Sans' }}
        >
          <span style={{ color: '#6B6B6B', fontSize: '0.875rem' }}>
            Mostrando <strong style={{ color: '#C9A96E' }}>{properties.length}</strong> propiedades
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className="p-2 rounded transition"
              style={{
                backgroundColor:
                  viewMode === 'grid' ? '#C9A96E' : 'transparent',
                color: viewMode === 'grid' ? '#0F0F0F' : '#6B6B6B',
                border: '1px solid #2A2A2A',
              }}
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 rounded transition"
              style={{
                backgroundColor:
                  viewMode === 'list' ? '#C9A96E' : 'transparent',
                color: viewMode === 'list' ? '#0F0F0F' : '#6B6B6B',
                border: '1px solid #2A2A2A',
              }}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <div
              className="skeleton w-full h-96"
              style={{ borderRadius: '8px' }}
            ></div>
          </div>
        )}

        {/* Empty state */}
        {!loading && properties.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              style={{ color: '#6B6B6B', marginBottom: '1rem' }}
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <p
              style={{
                color: '#6B6B6B',
                fontFamily: 'DM Sans',
                marginBottom: '1rem',
              }}
            >
              Sin propiedades para estos filtros
            </p>
            <button
              onClick={handleClear}
              className="btn-outline-gold"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Grid view */}
        {!loading && properties.length > 0 && viewMode === 'grid' && (
          <div className="px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(properties as PropertyData[]).map((prop, idx) => (
              <PropertyCard
                key={prop.id}
                id={prop.id}
                portal={prop.portal}
                operacion={prop.operacion}
                titulo={prop.titulo}
                precio={prop.precio}
                precioUsd={prop.precio_usd}
                moneda={filters.moneda}
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

        {/* List view */}
        {!loading && properties.length > 0 && viewMode === 'list' && (
          <div className="px-6">
            <PropertyTable
              properties={properties.map(p => ({
                ...p,
                precioUsd: p.precio_usd
              })) as any}
              moneda={filters.moneda}
            />
          </div>
        )}
      </main>

      {/* Paginación */}
      {!loading && properties.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={loadProperties}
          totalItems={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </div>
  )
}
