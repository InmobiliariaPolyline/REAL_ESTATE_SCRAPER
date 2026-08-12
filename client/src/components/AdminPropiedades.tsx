import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import Pagination from '@/components/Pagination'
import PropertyCard from '@/components/PropertyCard'

interface Propiedad {
  id: string
  portal: string
  operacion: string
  titulo: string
  precio: number
  precio_usd: number
  distrito: string
  dormitorios: string
  banios: string
  area: string
  imagen: string | null
  url: string
}

interface AdminPropiedadesProps {
  adminId: number
}

const ITEMS_PER_PAGE = 20

export default function AdminPropiedades({ adminId }: AdminPropiedadesProps) {
  const [tab, setTab] = useState<'buscar' | 'favoritos'>('buscar')
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showModalLimpieza, setShowModalLimpieza] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set())

  // Estados de filtros y paginación
  const [distrito, setDistrito] = useState('')
  const [operacion, setOperacion] = useState('todos')
  const [portal, setPortal] = useState('todos')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const { addToast } = useToast()

  const COLUMNS =
    'id, portal, operacion, titulo, precio, precio_usd, distrito, dormitorios, banios, area, imagen, url'

  const loadFavoritosIds = async () => {
    const { data, error } = await supabase
      .from('favoritos')
      .select('propiedad_id')
      .eq('admin_id', adminId)

    if (!error && data) {
      setFavoritos(new Set(data.map((f: any) => f.propiedad_id)))
    }
  }

  const loadPropiedadesFiltered = async (
    filterDistrito: string,
    filterOperacion: string,
    filterPortal: string,
    targetPage: number
  ) => {
    try {
      setLoading(true)
      let query = supabase
        .from('propiedades')
        .select(COLUMNS, { count: 'exact' })
        .order('creado_en', { ascending: false })

      if (filterDistrito) {
        query = query.ilike('distrito', `%${filterDistrito}%`)
      }
      if (filterOperacion && filterOperacion !== 'todos') {
        query = query.eq('operacion', filterOperacion.toLowerCase().trim())
      }
      if (filterPortal && filterPortal !== 'todos') {
        query = query.ilike('portal', `%${filterPortal.toLowerCase().trim()}%`)
      }

      const { data, count, error } = await query.range(
        targetPage * ITEMS_PER_PAGE,
        (targetPage + 1) * ITEMS_PER_PAGE - 1
      )

      if (error) throw error
      setPropiedades((data as any) || [])
      setTotalCount(count || 0)
      setPage(targetPage)
    } catch (err) {
      addToast('Error al cargar propiedades', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadFavoritosPropiedades = async () => {
    try {
      setLoading(true)
      const { data: favData, error: favError } = await supabase
        .from('favoritos')
        .select('propiedad_id')
        .eq('admin_id', adminId)
        .order('creado_en', { ascending: false })

      if (favError) throw favError

      const ids = (favData || []).map((f: any) => f.propiedad_id)
      setFavoritos(new Set(ids))

      if (ids.length === 0) {
        setPropiedades([])
        setTotalCount(0)
        return
      }

      const { data, error } = await supabase
        .from('propiedades')
        .select(COLUMNS)
        .in('id', ids)

      if (error) throw error
      setPropiedades((data as any) || [])
      setTotalCount(ids.length)
      setPage(0)
    } catch (err) {
      addToast('Error al cargar favoritos', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadPropiedades = (targetPage: number = page) => {
    if (tab === 'buscar') {
      loadPropiedadesFiltered(distrito, operacion, portal, targetPage)
    }
  }

  useEffect(() => {
    loadFavoritosIds()
    loadPropiedadesFiltered('', 'todos', 'todos', 0)
  }, [])

  useEffect(() => {
    if (tab === 'buscar') {
      loadPropiedadesFiltered(distrito, operacion, portal, 0)
    } else {
      loadFavoritosPropiedades()
    }
  }, [tab])

  const handleToggleFavorite = async (propiedadId: string) => {
    const isFav = favoritos.has(propiedadId)
    try {
      if (isFav) {
        const { error } = await supabase
          .from('favoritos')
          .delete()
          .eq('admin_id', adminId)
          .eq('propiedad_id', propiedadId)
        if (error) throw error

        const newSet = new Set(favoritos)
        newSet.delete(propiedadId)
        setFavoritos(newSet)

        if (tab === 'favoritos') {
          setPropiedades(propiedades.filter((p) => p.id !== propiedadId))
        }
        addToast('Quitado de favoritos', 'info')
      } else {
        const { error } = await supabase
          .from('favoritos')
          .insert({ admin_id: adminId, propiedad_id: propiedadId })
        if (error) throw error

        const newSet = new Set(favoritos)
        newSet.add(propiedadId)
        setFavoritos(newSet)
        addToast('Agregado a favoritos', 'success')
      }
    } catch (err) {
      addToast('Error al actualizar favorito', 'error')
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return

    try {
      const { error } = await supabase
        .from('propiedades')
        .delete()
        .eq('id', selectedId)

      if (error) throw error

      setPropiedades(propiedades.filter((p) => p.id !== selectedId))
      addToast('Propiedad eliminada', 'success')
      setShowDeleteModal(false)
      setSelectedId(null)
    } catch (err) {
      addToast('Error al eliminar propiedad', 'error')
      console.error(err)
    }
  }

  const handleCleanup = () => {
    addToast('Proceso registrado — se ejecutará en la próxima corrida.', 'info')
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: '#2A2A2A' }}>
        <button
          onClick={() => setTab('buscar')}
          className="px-4 py-2 text-sm font-medium transition"
          style={{
            color: tab === 'buscar' ? '#C9A96E' : '#6B6B6B',
            borderBottom: tab === 'buscar' ? '2px solid #C9A96E' : '2px solid transparent',
            fontFamily: 'DM Sans',
          }}
        >
          🔍 Buscar propiedades
        </button>
        <button
          onClick={() => setTab('favoritos')}
          className="px-4 py-2 text-sm font-medium transition"
          style={{
            color: tab === 'favoritos' ? '#C9A96E' : '#6B6B6B',
            borderBottom: tab === 'favoritos' ? '2px solid #C9A96E' : '2px solid transparent',
            fontFamily: 'DM Sans',
          }}
        >
          ❤️ Mis favoritos {favoritos.size > 0 && `(${favoritos.size})`}
        </button>
      </div>

      {/* Fila superior: Limpieza de inactivos (solo en tab Buscar) */}
      {tab === 'buscar' && (
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowModalLimpieza(true)}
            className="px-4 py-2 rounded text-sm font-medium transition"
            style={{
              backgroundColor: '#450a0a',
              border: '1px solid #7f1d1d',
              color: '#fca5a5',
              fontFamily: 'DM Sans',
            }}
          >
            ⚠️ Ejecutar Limpieza de Inactivos
          </button>
        </div>
      )}

      {/* Filtros (solo en tab Buscar) */}
      {tab === 'buscar' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded" style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Distrito
            </label>
            <input
              type="text"
              value={distrito}
              onChange={(e) => setDistrito(e.target.value)}
              placeholder="Buscar distrito..."
              className="input-underline w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Operación
            </label>
            <select
              value={operacion}
              onChange={(e) => setOperacion(e.target.value)}
              className="w-full px-3 py-2 rounded text-xs"
              style={{ backgroundColor: '#252525', color: '#F0EDE8', border: '1px solid #2A2A2A', fontFamily: 'DM Sans', height: '38px' }}
            >
              <option value="todos">Todos</option>
              <option value="ALQUILER">Alquiler</option>
              <option value="VENTA">Venta</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Portal
            </label>
            <select
              value={portal}
              onChange={(e) => setPortal(e.target.value)}
              className="w-full px-3 py-2 rounded text-xs"
              style={{ backgroundColor: '#252525', color: '#F0EDE8', border: '1px solid #2A2A2A', fontFamily: 'DM Sans', height: '38px' }}
            >
              <option value="todos">Todos</option>
              <option value="Properati">Properati</option>
              <option value="Infocasas">Infocasas</option>
              <option value="Babilonia">Babilonia</option>
              <option value="Urbania">Urbania</option>
              <option value="Adondevivir">Adondevivir</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => loadPropiedadesFiltered(distrito, operacion, portal, 0)}
              className="flex-1 px-4 py-2 rounded font-medium transition"
              style={{ backgroundColor: '#C9A96E', color: '#0F0F0F', fontFamily: 'DM Sans', fontSize: '0.875rem', height: '38px' }}
            >
              Buscar
            </button>
            <button
              onClick={() => {
                setDistrito('')
                setOperacion('todos')
                setPortal('todos')
                loadPropiedadesFiltered('', 'todos', 'todos', 0)
              }}
              className="px-3 py-2 rounded transition flex items-center justify-center"
              style={{ backgroundColor: 'transparent', border: '1px solid #2A2A2A', color: '#6B6B6B', fontFamily: 'DM Sans', height: '38px', width: '38px' }}
              title="Limpiar filtros"
            >
              X
            </button>
          </div>
        </div>
      )}

      {/* Contador */}
      <div style={{ color: '#6B6B6B', fontFamily: 'DM Sans', fontSize: '0.875rem' }}>
        {!loading && `Mostrando ${propiedades.length} de ${totalCount} propiedades`}
      </div>

      {/* Cuadrícula de tarjetas */}
      {loading ? (
        <div className="text-center py-12" style={{ color: '#6B6B6B', fontFamily: 'DM Sans' }}>
          Cargando propiedades...
        </div>
      ) : propiedades.length === 0 ? (
        <div className="text-center py-12" style={{ color: '#6B6B6B', fontFamily: 'DM Sans' }}>
          {tab === 'favoritos'
            ? 'Aún no marcaste ninguna propiedad como favorita'
            : 'Sin propiedades para estos filtros'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {propiedades.map((prop, idx) => (
            <PropertyCard
              key={prop.id}
              id={prop.id}
              portal={prop.portal}
              operacion={prop.operacion}
              titulo={prop.titulo}
              precio={prop.precio}
              precioUsd={prop.precio_usd}
              moneda="USD"
              distrito={prop.distrito}
              dormitorios={prop.dormitorios}
              banios={prop.banios}
              area={prop.area}
              imagen={prop.imagen}
              url={prop.url}
              index={idx}
              isFavorite={favoritos.has(prop.id)}
              onToggleFavorite={handleToggleFavorite}
              onDelete={(id) => {
                setSelectedId(id)
                setShowDeleteModal(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Paginación (solo en tab Buscar) */}
      {tab === 'buscar' && !loading && propiedades.length > 0 && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(totalCount / ITEMS_PER_PAGE)}
          onPageChange={loadPropiedades}
          totalItems={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}

      {/* Modal de confirmación eliminar */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="p-6 rounded max-w-sm"
            style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                color: '#F0EDE8',
                fontFamily: 'DM Sans',
                fontSize: '1.125rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
              }}
            >
              ¿Confirmas eliminar esta propiedad?
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #2A2A2A',
                  color: '#6B6B6B',
                  fontFamily: 'DM Sans',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{
                  backgroundColor: '#EF4444',
                  color: 'white',
                  fontFamily: 'DM Sans',
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación limpieza */}
      {showModalLimpieza && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowModalLimpieza(false)}
        >
          <div
            className="p-6 rounded max-w-sm"
            style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                color: '#F0EDE8',
                fontFamily: 'DM Sans',
                fontSize: '1.125rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
              }}
            >
              ¿Confirmas eliminar todos los registros inactivos?
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModalLimpieza(false)}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #2A2A2A',
                  color: '#6B6B6B',
                  fontFamily: 'DM Sans',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowModalLimpieza(false)
                  handleCleanup()
                }}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{
                  backgroundColor: '#EF4444',
                  color: 'white',
                  fontFamily: 'DM Sans',
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
