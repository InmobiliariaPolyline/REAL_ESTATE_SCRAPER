import { ExternalLink, Link2, Loader2, MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmModal from '@/components/common/ConfirmModal'
import EmptyState from '@/components/common/EmptyState'
import { useToast } from '@/contexts/ToastContext'
import { ApiError, api } from '@/lib/api'
import { formatDate } from '@/lib/dates'
import {
  TIPOS_ENLACE,
  TIPO_LABELS,
  openEnlace,
  validateEnlace,
  type Enlace,
} from '@/lib/enlaces'

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

const tipoLabel = (tipo: string) => TIPO_LABELS[tipo as keyof typeof TIPO_LABELS] ?? tipo

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
        setPropResultados(await api.get<Propiedad[]>('/admin/propiedades-lookup', { q: term }))
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

    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const abrirEnlace = (u: string) => {
    if (!openEnlace(u)) addToast('El enlace no es una URL válida.', 'error')
  }

  // Opciones del selector: resultados de la búsqueda + la propiedad ya elegida.
  const opcionesPropiedad =
    propSeleccionada && !propResultados.some(p => p.id === propSeleccionada.id)
      ? [propSeleccionada, ...propResultados]
      : propResultados

  const enlacesFiltrados = enlaces.filter(enlace => {
    const texto = busqueda.toLowerCase().trim()

    const coincideBusqueda =
      !texto ||
      enlace.titulo.toLowerCase().includes(texto) ||
      enlace.url.toLowerCase().includes(texto) ||
      enlace.propiedad_id.toLowerCase().includes(texto) ||
      enlace.descripcion?.toLowerCase().includes(texto) ||
      enlace.propiedad?.titulo?.toLowerCase().includes(texto) ||
      enlace.propiedad?.distrito?.toLowerCase().includes(texto) ||
      enlace.propiedad?.portal?.toLowerCase().includes(texto)

    const coincideTipo = filtroTipo === 'TODOS' || enlace.tipo === filtroTipo

    return coincideBusqueda && coincideTipo
  })

  const nombrePropiedad = (enlace: EnlaceConPropiedad) =>
    enlace.propiedad?.titulo || `Propiedad ${enlace.propiedad_id}`

  return (
    <div className="space-y-6">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          <strong className="mono font-medium text-text">{enlacesFiltrados.length}</strong> de{' '}
          <strong className="mono font-medium text-text">{enlaces.length}</strong> enlaces
        </p>
        <button
          onClick={() => (showForm ? limpiarFormulario() : setShowForm(true))}
          className={showForm ? 'btn btn-secondary' : 'btn btn-primary'}
        >
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? 'Cerrar formulario' : 'Nuevo enlace'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <section className="card animate-popIn p-6">
          <h2 className="mb-5 text-base font-semibold text-text">
            {editingId !== null ? 'Editar enlace' : 'Nuevo enlace'}
          </h2>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label htmlFor="ae-buscar-prop" className="field-label">Propiedad *</label>
              <div className="field-icon mb-2">
                <Search className="size-4" />
                <input
                  id="ae-buscar-prop"
                  value={propBusqueda}
                  onChange={e => setPropBusqueda(e.target.value)}
                  placeholder="Busca por título, distrito o ID (mín. 2 letras)..."
                  className="field"
                />
              </div>
              <select
                aria-label="Propiedad seleccionada"
                value={propiedadId}
                onChange={e => {
                  const id = e.target.value
                  setPropiedadId(id)
                  setPropSeleccionada(opcionesPropiedad.find(p => p.id === id) ?? null)
                }}
                className="field"
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

            <div>
              <label htmlFor="ae-titulo" className="field-label">Título *</label>
              <input
                id="ae-titulo"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ej. Información estadística"
                className="field"
              />
            </div>

            <div>
              <label htmlFor="ae-tipo" className="field-label">Tipo</label>
              <select
                id="ae-tipo"
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="field"
              >
                {TIPOS_ENLACE.map(t => (
                  <option key={t} value={t}>
                    {TIPO_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="ae-url" className="field-label">URL *</label>
              <input
                id="ae-url"
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="field"
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="ae-desc" className="field-label">Descripción</label>
              <textarea
                id="ae-desc"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Descripción opcional"
                rows={3}
                className="field"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={guardarEnlace} disabled={saving} className="btn btn-primary">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId !== null ? 'Guardar cambios' : 'Crear enlace'}
            </button>
            <button onClick={limpiarFormulario} className="btn btn-ghost">
              Cancelar
            </button>
          </div>
        </section>
      )}

      {/* Búsqueda y filtro */}
      <div className="card flex flex-col gap-3 p-4 md:flex-row">
        <div className="field-icon flex-1">
          <Search className="size-4" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por título, propiedad, portal, distrito o URL..."
            className="field"
            aria-label="Buscar enlaces"
          />
        </div>

        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="field md:w-64"
          aria-label="Filtrar por tipo"
        >
          <option value="TODOS">Todos los tipos</option>
          {TIPOS_ENLACE.map(t => (
            <option key={t} value={t}>
              {TIPO_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      ) : enlacesFiltrados.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Link2}
            title={enlaces.length === 0 ? 'Todavía no hay enlaces registrados' : 'Sin resultados'}
            description={
              enlaces.length === 0
                ? 'Crea el primero con el botón "Nuevo enlace".'
                : 'Prueba con otra búsqueda o cambia el tipo.'
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {enlacesFiltrados.map(enlace => (
            <li
              key={enlace.id}
              className="card card-interactive flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="badge badge-gold">{tipoLabel(enlace.tipo)}</span>
                  {enlace.propiedad?.portal && (
                    <span className="badge badge-muted capitalize">{enlace.propiedad.portal}</span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-text">{enlace.titulo}</h3>
                {enlace.descripcion && (
                  <p className="mt-1 text-sm text-text-muted">{enlace.descripcion}</p>
                )}

                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span className="flex items-center gap-1.5 text-text">
                    <MapPin className="size-3.5 text-text-faint" />
                    {nombrePropiedad(enlace)}
                  </span>
                  {enlace.propiedad?.distrito && <span>{enlace.propiedad.distrito}</span>}
                  {enlace.propiedad?.operacion && <span>{enlace.propiedad.operacion}</span>}
                  <span className="mono text-text-faint">ID: {enlace.propiedad_id}</span>
                </p>

                <p className="mono mt-2 truncate text-xs text-text-faint" title={enlace.url}>
                  {enlace.url}
                </p>
                <p className="mt-1 text-xs text-text-faint">Creado: {formatDate(enlace.creado_en)}</p>
              </div>

              <div className="flex flex-wrap gap-2 lg:flex-col">
                <button onClick={() => abrirEnlace(enlace.url)} className="btn btn-primary btn-sm">
                  <ExternalLink className="size-4" />
                  Abrir
                </button>
                <button onClick={() => editarEnlace(enlace)} className="btn btn-secondary btn-sm">
                  <Pencil className="size-4" />
                  Editar
                </button>
                <button onClick={() => setEnlaceAEliminar(enlace)} className="btn btn-danger btn-sm">
                  <Trash2 className="size-4" />
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
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
