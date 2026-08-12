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

interface BusquedaGuardada {
  id: string
  nombre: string
  distrito: string
  operacion: string
  portal: string
  precio_min: number | null
  precio_max: number | null
}

interface AdminPropiedadesProps {
  adminId: number
}

const ITEMS_PER_PAGE = 20

export default function AdminPropiedades({ adminId }: AdminPropiedadesProps) {
  const [tab, setTab] = useState<'buscar' | 'favoritos' | 'historial' | 'guardadas'>('buscar')
  const [propiedades, setPropiedades] = useState<Propiedad[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showModalLimpieza, setShowModalLimpieza] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set())
  const [historialIds, setHistorialIds] = useState<Set<string>>(new Set())

  // Estados de filtros y paginación
  const [distrito, setDistrito] = useState('')
  const [operacion, setOperacion] = useState('todos')
  const [portal, setPortal] = useState('todos')
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Búsquedas guardadas
  const [busquedasGuardadas, setBusquedasGuardadas] = useState<BusquedaGuardada[]>([])
  const [activeSavedSearch, setActiveSavedSearch] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [showGuardarModal, setShowGuardarModal] = useState(false)
  const [nombreBusqueda, setNombreBusqueda] = useState('')
  const [showDeleteBusquedaModal, setShowDeleteBusquedaModal] = useState(false)
  const [selectedBusquedaId, setSelectedBusquedaId] = useState<string | null>(null)

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

  const loadHistorialIds = async () => {
    const { data, error } = await supabase
      .from('historial')
      .select('propiedad_id')
      .eq('admin_id', adminId)

    if (!error && data) {
      setHistorialIds(new Set(data.map((h: any) => h.propiedad_id)))
    }
  }

  const loadBusquedasGuardadas = async () => {
    const { data, error } = await supabase
      .from('busquedas_guardadas')
      .select('*')
      .eq('admin_id', adminId)
      .order('creado_en', { ascending: false })

    if (!error && data) {
      setBusquedasGuardadas(data as any)
    }
  }

  const loadPropiedadesFiltered = async (
    filterDistrito: string,
    filterOperacion: string,
    filterPortal: string,
    filterPrecioMin: string,
    filterPrecioMax: string,
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
      if (filterPrecioMin) {
        query = query.gte('precio_usd', Number(filterPrecioMin))
      }
      if (filterPrecioMax) {
        query = query.lte('precio_usd', Number(filterPrecioMax))
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

  const loadHistorialPropiedades = async () => {
    try {
      setLoading(true)
      const { data: histData, error: histError } = await supabase
        .from('historial')
        .select('propiedad_id')
        .eq('admin_id', adminId)
        .order('visto_en', { ascending: false })
        .limit(50)

      if (histError) throw histError

      const ids = (histData || []).map((h: any) => h.propiedad_id)

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

      const dataById = new Map((data || []).map((p: any) => [p.id, p]))
      const ordered = ids
        .map((id: string) => dataById.get(id))
        .filter((p: any) => p !== undefined)

      setPropiedades(ordered as any)
      setTotalCount(ordered.length)
      setPage(0)
    } catch (err) {
      addToast('Error al cargar historial', 'error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadPropiedades = (targetPage: number = page) => {
    if (tab === 'buscar') {
      loadPropiedadesFiltered(distrito, operacion, portal, precioMin, precioMax, targetPage)
    }
  }

  useEffect(() => {
    loadFavoritosIds()
    loadHistorialIds()
    loadBusquedasGuardadas()
    loadPropiedadesFiltered('', 'todos', 'todos', '', '', 0)
  }, [])

  useEffect(() => {
    if (tab === 'favoritos') {
      loadFavoritosPropiedades()
    } else if (tab === 'historial') {
      loadHistorialPropiedades()
    } else if (tab === 'guardadas') {
      loadBusquedasGuardadas()
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

  const handleView = async (propiedadId: string) => {
    try {
      await supabase
        .from('historial')
        .upsert(
          { admin_id: adminId, propiedad_id: propiedadId, visto_en: new Date().toISOString() },
          { onConflict: 'admin_id,propiedad_id' }
        )
      setHistorialIds((prev) => new Set(prev).add(propiedadId))
    } catch (err) {
      console.error('Error al registrar historial', err)
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

  const handleBuscarManual = () => {
    setActiveSavedSearch(false)
    setShowHidden(false)
    loadPropiedadesFiltered(distrito, operacion, portal, precioMin, precioMax, 0)
  }

  const handleLimpiarFiltros = () => {
    setDistrito('')
    setOperacion('todos')
    setPortal('todos')
    setPrecioMin('')
    setPrecioMax('')
    setActiveSavedSearch(false)
    setShowHidden(false)
    loadPropiedadesFiltered('', 'todos', 'todos', '', '', 0)
  }

  const handleGuardarBusqueda = async () => {
    if (!nombreBusqueda.trim()) {
      addToast('Ponle un nombre a la búsqueda', 'error')
      return
    }
    try {
      const { error } = await supabase.from('busquedas_guardadas').insert({
        admin_id: adminId,
        nombre: nombreBusqueda.trim(),
        distrito,
        operacion,
        portal,
        precio_min: precioMin ? Number(precioMin) : null,
        precio_max: precioMax ? Number(precioMax) : null,
      })
      if (error) throw error
      addToast('Búsqueda guardada', 'success')
      setShowGuardarModal(false)
      setNombreBusqueda('')
      loadBusquedasGuardadas()
    } catch (err) {
      addToast('Error al guardar la búsqueda', 'error')
      console.error(err)
    }
  }

  const handleEjecutarBusqueda = async (busqueda: BusquedaGuardada) => {
    setDistrito(busqueda.distrito || '')
    setOperacion(busqueda.operacion || 'todos')
    setPortal(busqueda.portal || 'todos')
    setPrecioMin(busqueda.precio_min !== null ? String(busqueda.precio_min) : '')
    setPrecioMax(busqueda.precio_max !== null ? String(busqueda.precio_max) : '')
    setActiveSavedSearch(true)
    setShowHidden(false)
    setTab('buscar')
    await loadHistorialIds()
    await loadPropiedadesFiltered(
      busqueda.distrito || '',
      busqueda.operacion || 'todos',
      busqueda.portal || 'todos',
      busqueda.precio_min !== null ? String(busqueda.precio_min) : '',
      busqueda.precio_max !== null ? String(busqueda.precio_max) : '',
      0
    )
  }

  const handleEliminarBusqueda = async () => {
    if (!selectedBusquedaId) return
    try {
      const { error } = await supabase
        .from('busquedas_guardadas')
        .delete()
        .eq('id', selectedBusquedaId)
      if (error) throw error
      setBusquedasGuardadas(busquedasGuardadas.filter((b) => b.id !== selectedBusquedaId))
      addToast('Búsqueda eliminada', 'success')
      setShowDeleteBusquedaModal(false)
      setSelectedBusquedaId(null)
    } catch (err) {
      addToast('Error al eliminar la búsqueda', 'error')
      console.error(err)
    }
  }

  // Propiedades a mostrar: si hay búsqueda guardada activa y no se pidió ver ocultas,
  // se excluyen las ya vistas que no sean favoritas
  const propiedadesVisibles =
    tab === 'buscar' && activeSavedSearch && !showHidden
      ? propiedades.filter((p) => favoritos.has(p.id) || !historialIds.has(p.id))
      : propiedades
  const cantidadOcultas = propiedades.length - propiedadesVisibles.length

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b flex-wrap" style={{ borderColor: '#2A2A2A' }}>
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
        <button
          onClick={() => setTab('historial')}
          className="px-4 py-2 text-sm font-medium transition"
          style={{
            color: tab === 'historial' ? '#C9A96E' : '#6B6B6B',
            borderBottom: tab === 'historial' ? '2px solid #C9A96E' : '2px solid transparent',
            fontFamily: 'DM Sans',
          }}
        >
          🕐 Historial
        </button>
        <button
          onClick={() => setTab('guardadas')}
          className="px-4 py-2 text-sm font-medium transition"
          style={{
            color: tab === 'guardadas' ? '#C9A96E' : '#6B6B6B',
            borderBottom: tab === 'guardadas' ? '2px solid #C9A96E' : '2px solid transparent',
            fontFamily: 'DM Sans',
          }}
        >
          🔖 Búsquedas guardadas {busquedasGuardadas.length > 0 && `(${busquedasGuardadas.length})`}
        </button>
      </div>

      {/* Fila superior: Limpieza de inactivos + Guardar búsqueda (solo en tab Buscar) */}
      {tab === 'buscar' && (
        <div className="flex justify-between items-center flex-wrap gap-2">
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
          <button
            onClick={() => setShowGuardarModal(true)}
            className="px-4 py-2 rounded text-sm font-medium transition"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #C9A96E',
              color: '#C9A96E',
              fontFamily: 'DM Sans',
            }}
          >
            🔖 Guardar esta búsqueda
          </button>
        </div>
      )}

      {/* Filtros (solo en tab Buscar) */}
      {tab === 'buscar' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 rounded" style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}>
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
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Precio min. (USD)
            </label>
            <input
              type="number"
              value={precioMin}
              onChange={(e) => setPrecioMin(e.target.value)}
              placeholder="0"
              className="input-underline w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#C9A96E', fontFamily: 'DM Sans' }}>
              Precio máx. (USD)
            </label>
            <input
              type="number"
              value={precioMax}
              onChange={(e) => setPrecioMax(e.target.value)}
              placeholder="Sin límite"
              className="input-underline w-full text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleBuscarManual}
              className="flex-1 px-4 py-2 rounded font-medium transition"
              style={{ backgroundColor: '#C9A96E', color: '#0F0F0F', fontFamily: 'DM Sans', fontSize: '0.875rem', height: '38px' }}
            >
              Buscar
            </button>
            <button
              onClick={handleLimpiarFiltros}
              className="px-3 py-2 rounded transition flex items-center justify-center"
              style={{ backgroundColor: 'transparent', border: '1px solid #2A2A2A', color: '#6B6B6B', fontFamily: 'DM Sans', height: '38px', width: '38px' }}
              title="Limpiar filtros"
            >
              X
            </button>
          </div>
        </div>
      )}

      {/* Aviso de búsqueda guardada activa */}
      {tab === 'buscar' && activeSavedSearch && (
        <div
          className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 rounded"
          style={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}
        >
          <span style={{ color: '#C9A96E', fontFamily: 'DM Sans', fontSize: '0.875rem' }}>
            🔖 Mostrando resultados de una búsqueda guardada
            {cantidadOcultas > 0 && !showHidden && ` — ${cantidadOcultas} ya vistas ocultas`}
          </span>
          {cantidadOcultas > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="px-3 py-1 rounded text-xs font-medium"
              style={{ border: '1px solid #C9A96E', color: '#C9A96E', fontFamily: 'DM Sans' }}
            >
              {showHidden ? 'Ocultar ya vistas' : 'Mostrar ya vistas también'}
            </button>
          )}
        </div>
      )}

      {/* Contenido: Búsquedas guardadas */}
      {tab === 'guardadas' ? (
        busquedasGuardadas.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#6B6B6B', fontFamily: 'DM Sans' }}>
            Aún no has guardado ninguna búsqueda. Ve a "Buscar propiedades", ajusta los filtros y usa "🔖 Guardar esta búsqueda".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {busquedasGuardadas.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded"
                style={{ backgroundColor: '#111111', border: '1px solid #2A2A2A' }}
              >
                <h3 style={{ color: '#C9A96E', fontFamily: 'DM Sans', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  {b.nombre}
                </h3>
                <div style={{ color: '#6B6B6B', fontFamily: 'DM Sans', fontSize: '0.75rem', marginBottom: '1rem' }}>
                  {b.distrito && <div>📍 {b.distrito}</div>}
                  <div>🏷 {b.operacion === 'todos' ? 'Cualquier operación' : b.operacion}</div>
                  <div>🌐 {b.portal === 'todos' ? 'Cualquier portal' : b.portal}</div>
                  {(b.precio_min || b.precio_max) && (
                    <div>
                      💲 {b.precio_min || 0} — {b.precio_max || 'sin límite'}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEjecutarBusqueda(b)}
                    className="flex-1 px-3 py-2 rounded text-sm font-medium"
                    style={{ backgroundColor: '#C9A96E', color: '#0F0F0F', fontFamily: 'DM Sans' }}
                  >
                    Ejecutar
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBusquedaId(b.id)
                      setShowDeleteBusquedaModal(true)
                    }}
                    className="px-3 py-2 rounded text-sm font-medium"
                    style={{ border: '1px solid #EF4444', color: '#EF4444', fontFamily: 'DM Sans' }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* Contador */}
          <div style={{ color: '#6B6B6B', fontFamily: 'DM Sans', fontSize: '0.875rem' }}>
            {!loading && `Mostrando ${propiedadesVisibles.length} de ${totalCount} propiedades`}
          </div>

          {/* Cuadrícula de tarjetas */}
          {loading ? (
            <div className="text-center py-12" style={{ color: '#6B6B6B', fontFamily: 'DM Sans' }}>
              Cargando propiedades...
            </div>
          ) : propiedadesVisibles.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#6B6B6B', fontFamily: 'DM Sans' }}>
              {tab === 'favoritos'
                ? 'Aún no marcaste ninguna propiedad como favorita'
                : tab === 'historial'
                  ? 'Aún no has visto ninguna propiedad'
                  : cantidadOcultas > 0
                    ? 'Todas las propiedades de esta búsqueda ya las viste antes'
                    : 'Sin propiedades para estos filtros'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {propiedadesVisibles.map((prop, idx) => (
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
                  onView={handleView}
                  onDelete={(id) => {
                    setSelectedId(id)
                    setShowDeleteModal(true)
                  }}
                />
              ))}
            </div>
          )}

          {/* Paginación (solo en tab Buscar, sin búsqueda guardada activa) */}
          {tab === 'buscar' && !activeSavedSearch && !loading && propiedades.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(totalCount / ITEMS_PER_PAGE)}
              onPageChange={loadPropiedades}
              totalItems={totalCount}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
        </>
      )}

      {/* Modal de confirmación eliminar propiedad */}
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

      {/* Modal guardar búsqueda */}
      {showGuardarModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowGuardarModal(false)}
        >
          <div
            className="p-6 rounded max-w-sm w-full mx-4"
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
              Guardar esta búsqueda
            </h3>
            <input
              type="text"
              value={nombreBusqueda}
              onChange={(e) => setNombreBusqueda(e.target.value)}
              placeholder="Ej: Depas en venta San Miguel"
              className="input-underline w-full text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowGuardarModal(false)
                  setNombreBusqueda('')
                }}
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
                onClick={handleGuardarBusqueda}
                className="flex-1 px-4 py-2 rounded text-sm font-medium"
                style={{
                  backgroundColor: '#C9A96E',
                  color: '#0F0F0F',
                  fontFamily: 'DM Sans',
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar búsqueda guardada */}
      {showDeleteBusquedaModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowDeleteBusquedaModal(false)}
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
              ¿Confirmas eliminar esta búsqueda guardada?
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteBusquedaModal(false)}
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
                onClick={handleEliminarBusqueda}
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
    </div>
  )
}
