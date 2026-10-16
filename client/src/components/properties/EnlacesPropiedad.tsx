import { ExternalLink, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmModal from '@/components/common/ConfirmModal'
import EmptyState from '@/components/common/EmptyState'
import { useToast } from '@/contexts/ToastContext'
import { ApiError, api } from '@/lib/api'
import {
  TIPOS_ENLACE,
  TIPO_LABELS,
  openEnlace,
  validateEnlace,
  type Enlace,
} from '@/lib/enlaces'
import { trapFocus } from '@/lib/focusTrap'

interface EnlacesPropiedadProps {
  propiedadId: string
  onClose: () => void
}

export default function EnlacesPropiedad({ propiedadId, onClose }: EnlacesPropiedadProps) {
  const [enlaces, setEnlaces] = useState<Enlace[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [aEliminar, setAEliminar] = useState<Enlace | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [url, setUrl] = useState('')
  const [tipo, setTipo] = useState('OTRO')

  const { addToast } = useToast()
  const requestId = useRef(0)

  const cargarEnlaces = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)

    try {
      const data = await api.get<Enlace[]>(
        `/propiedades/${encodeURIComponent(propiedadId)}/enlaces`
      )
      if (current !== requestId.current) return
      setEnlaces(data)
    } catch (error) {
      if (current !== requestId.current) return
      console.error('Error cargando enlaces:', error)
      addToast('No se pudieron cargar los enlaces.', 'error')
      setEnlaces([])
    }

    setLoading(false)
  }, [propiedadId, addToast])

  useEffect(() => {
    cargarEnlaces()
  }, [cargarEnlaces])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !aEliminar) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, aEliminar])

  const limpiarFormulario = () => {
    setTitulo('')
    setDescripcion('')
    setUrl('')
    setTipo('OTRO')
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

    const payload = {
      titulo: valid.titulo,
      descripcion: valid.descripcion ?? '',
      url: valid.url,
      tipo,
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
      await cargarEnlaces()
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

  const editarEnlace = (enlace: Enlace) => {
    setEditingId(enlace.id)
    setTitulo(enlace.titulo)
    setDescripcion(enlace.descripcion || '')
    setUrl(enlace.url)
    setTipo(enlace.tipo)
    setShowForm(true)
  }

  const confirmarEliminar = async () => {
    if (!aEliminar) return
    setDeleting(true)
    try {
      await api.delete(`/enlaces/${aEliminar.id}`)
      addToast('Enlace eliminado', 'success')
      setAEliminar(null)
      await cargarEnlaces()
    } catch (error) {
      console.error('Error eliminando enlace:', error)
      addToast('No se pudo eliminar el enlace.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={trapFocus}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Enlaces de la propiedad"
        className="animate-popIn card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Enlaces de apoyo</p>
            <h2 className="font-display text-2xl font-semibold text-text">Enlaces de la propiedad</h2>
            <p className="mono mt-1 truncate text-xs text-text-faint">ID: {propiedadId}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary">
              <Plus className="size-4" />
              Agregar enlace
            </button>
          )}

          {showForm && (
            <div className="rounded-2xl border border-line bg-surface-1 p-5">
              <h3 className="mb-4 text-base font-semibold text-text">
                {editingId !== null ? 'Editar enlace' : 'Agregar enlace'}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="enl-titulo">Título</label>
                  <input
                    id="enl-titulo"
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ej. Información estadística"
                    className="field"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="enl-url">URL</label>
                  <input
                    id="enl-url"
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="field"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="enl-tipo">Tipo</label>
                  <select
                    id="enl-tipo"
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

                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="enl-desc">Descripción</label>
                  <textarea
                    id="enl-desc"
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
                  {editingId !== null ? 'Guardar cambios' : 'Guardar enlace'}
                </button>
                <button onClick={limpiarFormulario} className="btn btn-ghost">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-24" />
              <div className="skeleton h-24" />
            </div>
          ) : enlaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong">
              <EmptyState
                icon={Link2}
                title="Sin enlaces"
                description="Esta propiedad todavía no tiene enlaces de apoyo."
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {enlaces.map(enlace => (
                <li key={enlace.id} className="rounded-2xl border border-line bg-surface-1 p-4">
                  <span className="badge badge-gold mb-2">
                    {TIPO_LABELS[enlace.tipo as keyof typeof TIPO_LABELS] ?? enlace.tipo}
                  </span>
                  <h3 className="text-sm font-semibold text-text">{enlace.titulo}</h3>
                  {enlace.descripcion && (
                    <p className="mt-1 text-sm text-text-muted">{enlace.descripcion}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (!openEnlace(enlace.url)) {
                          addToast('El enlace no es una URL válida.', 'error')
                        }
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      <ExternalLink className="size-4" />
                      Abrir
                    </button>
                    <button onClick={() => editarEnlace(enlace)} className="btn btn-secondary btn-sm">
                      <Pencil className="size-4" />
                      Editar
                    </button>
                    <button onClick={() => setAEliminar(enlace)} className="btn btn-danger btn-sm">
                      <Trash2 className="size-4" />
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </div>

      {aEliminar && (
        <ConfirmModal
          title="¿Eliminar este enlace?"
          confirmLabel="Eliminar"
          busyLabel="Eliminando..."
          tone="danger"
          busy={deleting}
          onConfirm={confirmarEliminar}
          onCancel={() => setAEliminar(null)}
        >
          {aEliminar.titulo}
        </ConfirmModal>
      )}
    </>
  )
}
