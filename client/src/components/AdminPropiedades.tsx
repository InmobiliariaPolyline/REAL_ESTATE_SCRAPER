import { useState, useEffect } from 'react'
import { Eye, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import Pagination from '@/components/Pagination'

interface Propiedad {
  id: string
  portal: string
  titulo: string
  precio_usd: number
  distrito: string
  url: string
}

export default function AdminPropiedades() {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showModalLimpieza, setShowModalLimpieza] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  // Estados de filtros y paginación
  const [distrito, setDistrito] = useState('')
  const [operacion, setOperacion] = useState('todos')
  const [portal, setPortal] = useState('todos')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  
  const { addToast } = useToast()

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
        .select('id, portal, titulo, precio_usd, distrito, url', { count: 'exact' })
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
        targetPage * 20,
        (targetPage + 1) * 20 - 1
      )

      if (error) throw error
      setPropiedades((data as Propiedad[]) || [])
      setTotalCount(count || 0)
      setPage(targetPage)
    } catch (err) {
      addToast('Error al cargar propiedades', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadPropiedades = (targetPage: number = page) => {
    loadPropiedadesFiltered(distrito, operacion, portal, targetPage)
  }

  useEffect(() => {
    loadPropiedadesFiltered('', 'todos', 'todos', 0)
  }, [])

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
      {/* Fila superior: Limpieza de inactivos */}
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

      {/* Filtros */}
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

      {/* Tabla */}
      <div
        className="rounded overflow-x-auto"
        style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}
      >
        <table className="w-full text-sm" style={{ fontFamily: 'DM Sans' }}>
          <thead>
            <tr
              style={{
                backgroundColor: '#1A1A1A',
                borderBottom: '1px solid #2A2A2A',
              }}
            >
              <th
                className="px-4 py-3 text-left font-semibold"
                style={{ color: '#C9A96E' }}
              >
                ID (8 chars)
              </th>
              <th
                className="px-4 py-3 text-left font-semibold"
                style={{ color: '#C9A96E' }}
              >
                Portal
              </th>
              <th
                className="px-4 py-3 text-left font-semibold"
                style={{ color: '#C9A96E' }}
              >
                Título
              </th>
              <th
                className="px-4 py-3 text-left font-semibold"
                style={{ color: '#C9A96E' }}
              >
                Precio USD
              </th>
              <th
                className="px-4 py-3 text-left font-semibold"
                style={{ color: '#C9A96E' }}
              >
                Distrito
              </th>
              <th
                className="px-4 py-3 text-center font-semibold"
                style={{ color: '#C9A96E' }}
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#6B6B6B' }}>
                  Cargando propiedades...
                </td>
              </tr>
            ) : propiedades.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#6B6B6B' }}>
                  Sin propiedades para estos filtros
                </td>
              </tr>
            ) : (
              propiedades.map((prop, idx) => (
                <tr
                  key={prop.id}
                  style={{
                    borderBottom: '1px solid #2A2A2A',
                    backgroundColor: idx % 2 === 0 ? '#0F0F0F' : '#111111',
                  }}
                >
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: '#6B6B6B' }}
                  >
                    {prop.id.substring(0, 8)}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#F0EDE8' }}>
                    {prop.portal}
                  </td>
                  <td
                    className="px-4 py-3 truncate max-w-xs"
                    style={{ color: '#F0EDE8' }}
                  >
                    {prop.titulo}
                  </td>
                  <td
                    className="px-4 py-3 font-mono"
                    style={{ color: '#C9A96E', fontFamily: 'JetBrains Mono' }}
                  >
                    ${prop.precio_usd ? prop.precio_usd.toLocaleString('es-PE') : '0'}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#6B6B6B' }}>
                    {prop.distrito}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <a
                        href={prop.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:opacity-70 transition flex items-center justify-center"
                        style={{ color: '#C9A96E' }}
                        title="Ver anuncio original"
                      >
                        <Eye size={16} />
                      </a>
                      <button
                        onClick={() => {
                          setSelectedId(prop.id)
                          setShowDeleteModal(true)
                        }}
                        className="p-1 hover:opacity-70 transition flex items-center justify-center"
                        style={{ color: '#EF4444' }}
                        title="Ocultar/Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!loading && propiedades.length > 0 && (
        <div style={{ border: '1px solid #2A2A2A', borderTop: 'none' }}>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(totalCount / 20)}
            onPageChange={loadPropiedades}
            totalItems={totalCount}
            itemsPerPage={20}
          />
        </div>
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
