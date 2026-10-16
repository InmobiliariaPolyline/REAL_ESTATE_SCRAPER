import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import ConfirmModal from '@/components/common/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/dates'
import {
  TIPOS_ENLACE,
  openEnlace,
  validateEnlace,
  type Enlace,
} from '@/lib/enlaces'
import { ApiError, api } from '@/lib/api'

interface Propiedad {
  id: string
  portal: string | null
  operacion: string | null
  inmueble: string | null
  titulo: string | null
  distrito: string | null
}

interface EnlaceConPropiedad extends Enlace {
  propiedad?: Propiedad
}

const TIPO_LABELS: Record<(typeof TIPOS_ENLACE)[number], string> = {
  OTRO: 'Otro',
  INFORMACION_ESTADISTICA: 'Información estadística',
  INFORMACION_LEGAL: 'Información legal',
  DOCUMENTACION: 'Documentación',
}


export default function AdminEnlaces() {
  const [enlaces, setEnlaces] = useState<EnlaceConPropiedad[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [enlaceAEliminar, setEnlaceAEliminar] = useState<Enlace | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [url, setUrl] = useState('')
  const [tipo, setTipo] = useState('OTRO')
  const [propiedadId, setPropiedadId] = useState('')

  // Selector de propiedad: búsqueda en el servidor (no se descargan todas las propiedades).
  const [propBusqueda, setPropBusqueda] = useState('')
  const [propResultados, setPropResultados] = useState<Propiedad[]>([])
  const [propSeleccionada, setPropSeleccionada] = useState<Propiedad | null>(null)

  const { addToast } = useToast()
  const requestId = useRef(0)

  const tipos = ['TODOS', ...TIPOS_ENLACE]

  const cargarDatos = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)

    try {
      // El servidor ya devuelve cada enlace con los datos de su propiedad.
      const lista = await api.get<EnlaceConPropiedad[]>('/admin/enlaces')
      if (current !== requestId.current) return
      setEnlaces(lista.map(e => ({ ...e, propiedad: e.propiedad ?? undefined })))
    } catch (error) {
      if (current !== requestId.current) return
      console.error('Error cargando enlaces:', error)
      addToast('Error al cargar los enlaces', 'error')
      setEnlaces([])
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Búsqueda de propiedades con debounce mientras el formulario está abierto.
  useEffect(() => {
    if (!showForm) return
    const term = propBusqueda.trim()
    if (term.length < 2) {
      setPropResultados([])
      return
    }
    const handle = setTimeout(async () => {
      try {
        setPropResultados(
          await api.get<Propiedad[]>('/admin/propiedades-lookup', { q: term })
        )
      } catch (error) {
        console.error('Error buscando propiedades:', error)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [propBusqueda, showForm])

  const limpiarFormulario = () => {
    setTitulo('')
    setDescripcion('')
    setUrl('')
    setTipo('OTRO')
    setPropiedadId('')
    setPropBusqueda('')
    setPropResultados([])
    setPropSeleccionada(null)
    setEditingId(null)
    setShowForm(false)
  }

  const guardarEnlace = async () => {
    if (saving) return
    const valid = validateEnlace({ titulo, descripcion, url })
    if (!valid.ok) {
      addToast(valid.message, 'error')
      return
    }
    if (!propiedadId) {
      addToast('Debes seleccionar una propiedad.', 'error')
      return
    }

    const payload = {
      titulo: valid.titulo,
      descripcion: valid.descripcion ?? '',
      url: valid.url,
      tipo,
      propiedad_id: propiedadId,
    }

    setSaving(true)
    try {
      if (editingId !== null) {
        await api.put(`/enlaces/${editingId}`, payload)
      } else {
        await api.post(`/propiedades/${encodeURIComponent(propiedadId)}/enlaces`, payload)
      }

      addToast('Enlace guardado', 'success')
      limpiarFormulario()
      await cargarDatos()
    } catch (error) {
      console.error('Error guardando enlace:', error)
      addToast(
        error instanceof ApiError && error.status === 400
          ? error.message
          : editingId !== null
            ? 'No se pudo actualizar el enlace.'
            : 'No se pudo crear el enlace.',
        'error'
      )
    } finally {
      setSaving(false)
    }
  }

  const editarEnlace = (enlace: EnlaceConPropiedad) => {
    setEditingId(enlace.id)
    setTitulo(enlace.titulo)
    setDescripcion(enlace.descripcion || '')
    setUrl(enlace.url)
    setTipo(enlace.tipo)
    setPropiedadId(enlace.propiedad_id)
    setPropSeleccionada(enlace.propiedad ?? null)
    setPropBusqueda('')
    setPropResultados([])
    setShowForm(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const confirmarEliminar = async () => {
    if (!enlaceAEliminar) return
    setDeleting(true)
    try {
      await api.delete(`/enlaces/${enlaceAEliminar.id}`)
      addToast('Enlace eliminado', 'success')
      setEnlaceAEliminar(null)
      await cargarDatos()
    } catch (error) {
      console.error('Error eliminando enlace:', error)
      addToast('No se pudo eliminar el enlace.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const abrirEnlace = (url: string) => {
    if (!openEnlace(url)) {
      addToast('El enlace no es una URL válida.', 'error')
    }
  }

  // Opciones del selector: resultados de la búsqueda + la propiedad ya elegida.
  const opcionesPropiedad =
    propSeleccionada && !propResultados.some(p => p.id === propSeleccionada.id)
      ? [propSeleccionada, ...propResultados]
      : propResultados

  const enlacesFiltrados = enlaces.filter((enlace) => {
    const texto = busqueda.toLowerCase().trim()

    const coincideBusqueda =
      !texto ||
      enlace.titulo.toLowerCase().includes(texto) ||
      enlace.url.toLowerCase().includes(texto) ||
      enlace.propiedad_id.toLowerCase().includes(texto) ||
      enlace.descripcion?.toLowerCase().includes(texto) ||
      enlace.propiedad?.titulo
        ?.toLowerCase()
        .includes(texto) ||
      enlace.propiedad?.distrito
        ?.toLowerCase()
        .includes(texto) ||
      enlace.propiedad?.portal
        ?.toLowerCase()
        .includes(texto)

    const coincideTipo =
      filtroTipo === 'TODOS' ||
      enlace.tipo === filtroTipo

    return coincideBusqueda && coincideTipo
  })

  const obtenerNombrePropiedad = (
    enlace: EnlaceConPropiedad
  ) => {
    if (enlace.propiedad?.titulo) {
      return enlace.propiedad.titulo
    }

    return `Propiedad ${enlace.propiedad_id}`
  }

  const formatearFecha = formatDate

  return (
    <div
      style={{
        fontFamily: 'DM Sans',
      }}
    >
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{
              color: '#F0EDE8',
              fontFamily: 'Cormorant Garamond',
            }}
          >
            Enlaces
          </h2>

          <p
            className="text-sm mt-1"
            style={{ color: '#6B6B6B' }}
          >
            Administra los enlaces asociados a las propiedades.
          </p>
        </div>

        <button
          onClick={() => {
            if (showForm) {
              limpiarFormulario()
            } else {
              setShowForm(true)
            }
          }}
          className="px-4 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium"
          style={{
            backgroundColor: '#C9A96E',
            color: '#0F0F0F',
          }}
        >
          {showForm ? (
            <>
              <X size={17} />
              Cancelar
            </>
          ) : (
            <>
              <Plus size={17} />
              Agregar enlace
            </>
          )}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div
          className="mb-6 p-5 rounded-lg"
          style={{
            backgroundColor: '#151515',
            border: '1px solid #2A2A2A',
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3
              className="text-lg font-semibold"
              style={{ color: '#F0EDE8' }}
            >
              {editingId !== null
                ? 'Editar enlace'
                : 'Nuevo enlace'}
            </h3>

            <button
              onClick={limpiarFormulario}
              className="p-2 rounded"
              style={{ color: '#6B6B6B' }}
              aria-label="Cerrar formulario"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Propiedad */}
            <div className="lg:col-span-2">
              <label
                className="block text-sm mb-2"
                style={{ color: '#B0B0B0' }}
              >
                Propiedad *
              </label>

              <input
                value={propBusqueda}
                onChange={e => setPropBusqueda(e.target.value)}
                placeholder="Busca por título, distrito o ID (mín. 2 letras)..."
                className="w-full px-3 py-2.5 rounded outline-none mb-2"
                style={{
                  backgroundColor: '#0F0F0F',
                  color: '#F0EDE8',
                  border: '1px solid #333',
                }}
              />

              <select
                value={propiedadId}
                onChange={e => {
                  const id = e.target.value
                  setPropiedadId(id)
                  setPropSeleccionada(
                    opcionesPropiedad.find(p => p.id === id) ?? null
                  )
                }}
                className="w-full px-3 py-2.5 rounded outline-none"
                style={{
                  backgroundColor: '#0F0F0F',
                  color: '#F0EDE8',
                  border: '1px solid #333',
                }}
              >
                <option value="">Selecciona una propiedad</option>

                {opcionesPropiedad.map(propiedad => (
                  <option key={propiedad.id} value={propiedad.id}>
                    {propiedad.titulo || `Propiedad ${propiedad.id}`}
                    {propiedad.distrito ? ` — ${propiedad.distrito}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div>
              <label
                className="block text-sm mb-2"
                style={{ color: '#B0B0B0' }}
              >
                Título *
              </label>

              <input
                value={titulo}
                onChange={(e) =>
                  setTitulo(e.target.value)
                }
                placeholder="Ej. Información estadística"
                className="w-full px-3 py-2.5 rounded outline-none"
                style={{
                  backgroundColor: '#0F0F0F',
                  color: '#F0EDE8',
                  border: '1px solid #333',
                }}
              />
            </div>

            {/* Tipo */}
            <div>
              <label
                className="block text-sm mb-2"
                style={{ color: '#B0B0B0' }}
              >
                Tipo
              </label>

              <select
                value={tipo}
                onChange={(e) =>
                  setTipo(e.target.value)
                }
                className="w-full px-3 py-2.5 rounded outline-none"
                style={{
                  backgroundColor: '#0F0F0F',
                  color: '#F0EDE8',
                  border: '1px solid #333',
                }}
              >
                {TIPOS_ENLACE.map(t => (
                  <option key={t} value={t}>
                    {TIPO_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* URL */}
            <div className="lg:col-span-2">
              <label
                className="block text-sm mb-2"
                style={{ color: '#B0B0B0' }}
              >
                URL *
              </label>

              <input
                type="url"
                value={url}
                onChange={(e) =>
                  setUrl(e.target.value)
                }
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded outline-none"
                style={{
                  backgroundColor: '#0F0F0F',
                  color: '#F0EDE8',
                  border: '1px solid #333',
                }}
              />
            </div>

            {/* Descripción */}
            <div className="lg:col-span-2">
              <label
                className="block text-sm mb-2"
                style={{ color: '#B0B0B0' }}
              >
                Descripción
              </label>

              <textarea
                value={descripcion}
                onChange={(e) =>
                  setDescripcion(e.target.value)
                }
                placeholder="Descripción opcional"
                rows={3}
                className="w-full px-3 py-2.5 rounded outline-none resize-none"
                style={{
                  backgroundColor: '#0F0F0F',
                  color: '#F0EDE8',
                  border: '1px solid #333',
                }}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={guardarEnlace}
              disabled={saving}
              className="px-5 py-2.5 rounded text-sm font-medium"
              style={{
                backgroundColor: '#C9A96E',
                color: '#0F0F0F',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {editingId !== null
                ? 'Guardar cambios'
                : 'Crear enlace'}
            </button>

            <button
              onClick={limpiarFormulario}
              className="px-5 py-2.5 rounded text-sm"
              style={{
                backgroundColor: '#2A2A2A',
                color: '#F0EDE8',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div
        className="p-4 rounded-lg mb-6"
        style={{
          backgroundColor: '#151515',
          border: '1px solid #2A2A2A',
        }}
      >
        <div className="flex flex-col md:flex-row gap-3">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#6B6B6B' }}
            />

            <input
              value={busqueda}
              onChange={(e) =>
                setBusqueda(e.target.value)
              }
              placeholder="Buscar por título, propiedad, portal, distrito o URL..."
              className="w-full pl-10 pr-3 py-2.5 rounded outline-none text-sm"
              style={{
                backgroundColor: '#0F0F0F',
                color: '#F0EDE8',
                border: '1px solid #333',
              }}
            />
          </div>

          {/* Filtro tipo */}
          <select
            value={filtroTipo}
            onChange={(e) =>
              setFiltroTipo(e.target.value)
            }
            className="md:w-64 px-3 py-2.5 rounded outline-none text-sm"
            style={{
              backgroundColor: '#0F0F0F',
              color: '#F0EDE8',
              border: '1px solid #333',
            }}
          >
            {tipos.map((tipoFiltro) => (
              <option
                key={tipoFiltro}
                value={tipoFiltro}
              >
                {tipoFiltro === 'TODOS'
                  ? 'Todos los tipos'
                  : tipoFiltro}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Contador */}
      <div
        className="text-sm mb-4"
        style={{ color: '#6B6B6B' }}
      >
        Mostrando{' '}
        <span style={{ color: '#C9A96E' }}>
          {enlacesFiltrados.length}
        </span>{' '}
        de {enlaces.length} enlaces
      </div>

      {/* Lista */}
      {loading ? (
        <div
          className="py-16 text-center"
          style={{ color: '#6B6B6B' }}
        >
          Cargando enlaces...
        </div>
      ) : enlacesFiltrados.length === 0 ? (
        <div
          className="py-16 text-center rounded-lg"
          style={{
            backgroundColor: '#151515',
            border: '1px solid #2A2A2A',
          }}
        >
          <div
            className="text-4xl mb-3"
            style={{ opacity: 0.6 }}
          >
            🔗
          </div>

          <p
            className="text-base"
            style={{ color: '#B0B0B0' }}
          >
            {enlaces.length === 0
              ? 'Todavía no hay enlaces registrados.'
              : 'No encontramos enlaces con esos filtros.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {enlacesFiltrados.map((enlace) => (
            <div
              key={enlace.id}
              className="p-5 rounded-lg transition"
              style={{
                backgroundColor: '#151515',
                border: '1px solid #2A2A2A',
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                {/* Información */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className="px-2 py-1 rounded text-xs uppercase tracking-wide"
                      style={{
                        backgroundColor:
                          'rgba(201, 169, 110, 0.12)',
                        color: '#C9A96E',
                      }}
                    >
                      {enlace.tipo}
                    </span>

                    <span
                      className="text-xs"
                      style={{ color: '#555' }}
                    >
                      #{enlace.id}
                    </span>
                  </div>

                  <h3
                    className="text-lg font-semibold mb-1"
                    style={{ color: '#F0EDE8' }}
                  >
                    {enlace.titulo}
                  </h3>

                  {enlace.descripcion && (
                    <p
                      className="text-sm mb-3"
                      style={{ color: '#9A9A9A' }}
                    >
                      {enlace.descripcion}
                    </p>
                  )}

                  {/* Propiedad */}
                  <div
                    className="p-3 rounded mb-3"
                    style={{
                      backgroundColor: '#101010',
                      border: '1px solid #222',
                    }}
                  >
                    <div
                      className="text-xs uppercase tracking-wide mb-1"
                      style={{ color: '#6B6B6B' }}
                    >
                      Propiedad asociada
                    </div>

                    <div
                      className="text-sm font-medium"
                      style={{ color: '#F0EDE8' }}
                    >
                      {obtenerNombrePropiedad(enlace)}
                    </div>

                    <div
                      className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs"
                      style={{ color: '#6B6B6B' }}
                    >
                      {enlace.propiedad?.portal && (
                        <span>
                          Portal:{' '}
                          {enlace.propiedad.portal}
                        </span>
                      )}

                      {enlace.propiedad?.operacion && (
                        <span>
                          Operación:{' '}
                          {enlace.propiedad.operacion}
                        </span>
                      )}

                      {enlace.propiedad?.distrito && (
                        <span>
                          Distrito:{' '}
                          {enlace.propiedad.distrito}
                        </span>
                      )}

                      <span>
                        ID: {enlace.propiedad_id}
                      </span>
                    </div>
                  </div>

                  {/* URL */}
                  <div
                    className="text-xs truncate"
                    style={{ color: '#5F5F5F' }}
                    title={enlace.url}
                  >
                    {enlace.url}
                  </div>

                  <div
                    className="text-xs mt-2"
                    style={{ color: '#555' }}
                  >
                    Creado:{' '}
                    {formatearFecha(
                      enlace.creado_en
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap lg:flex-col gap-2">
                  <button
                    onClick={() =>
                      abrirEnlace(enlace.url)
                    }
                    className="px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: '#C9A96E',
                      color: '#0F0F0F',
                    }}
                  >
                    <ExternalLink size={15} />
                    Abrir
                  </button>

                  <button
                    onClick={() =>
                      editarEnlace(enlace)
                    }
                    className="px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: '#2A2A2A',
                      color: '#F0EDE8',
                    }}
                  >
                    <Pencil size={15} />
                    Editar
                  </button>

                  <button
                    onClick={() => setEnlaceAEliminar(enlace)}
                    className="px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: '#2A2A2A',
                      color: '#E57373',
                    }}
                  >
                    <Trash2 size={15} />
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {enlaceAEliminar && (
        <ConfirmModal
          title="¿Eliminar este enlace?"
          confirmLabel="Eliminar"
          busyLabel="Eliminando..."
          tone="danger"
          busy={deleting}
          onConfirm={confirmarEliminar}
          onCancel={() => setEnlaceAEliminar(null)}
        >
          {enlaceAEliminar.titulo}
        </ConfirmModal>
      )}
    </div>
  )
}
