import { useState, useEffect } from 'react'
import { Grid3X3, List } from 'lucide-react'
import PortalHeader from '@/components/PortalHeader'
import PortalFilters, { FilterState } from '@/components/PortalFilters'
import PropertyCard from '@/components/PropertyCard'
import PropertyTable from '@/components/PropertyTable'
import Pagination from '@/components/Pagination'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'

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
      if (filters.precioMin !== '') {
        const priceField =
          filters.moneda === 'USD' ? 'precio_usd' : 'precio'
        query = query.gte(priceField, Number(filters.precioMin))
      }
      if (filters.precioMax !== '') {
        const priceField =
          filters.moneda === 'USD' ? 'precio_usd' : 'precio'
        query = query.lte(priceField, Number(filters.precioMax))
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
        const precioA = Number(a.precio) || 0
        const precioB = Number(b.precio) || 0

        // Regla de oro: Si uno es 0 y el otro no, el 0 se va al fondo
        if (precioA === 0 && precioB > 0) return 1
        if (precioB === 0 && precioA > 0) return -1

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
    <div style={{ backgroundColor: '#0F0F0F', minHeight: '100vh', paddingTop: '64px' }}>
      {/* Header */}
      <PortalHeader
        usuario={usuario}
        planType={planType}
        fechaVencimiento={fechaVencimiento}
        onLogout={onLogout}
      />

      {/* Filtros */}
      <PortalFilters
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      {/* Contenido principal */}
      <main className="pt-4 pb-8">
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
