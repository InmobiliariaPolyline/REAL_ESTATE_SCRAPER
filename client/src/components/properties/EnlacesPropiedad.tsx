import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { openEnlace, validateEnlace, type Enlace } from '@/lib/enlaces'
import { ApiError, api } from '@/lib/api'

interface EnlacesPropiedadProps {
  propiedadId: string
  onClose: () => void
}

export default function EnlacesPropiedad({
  propiedadId,
  onClose,
}: EnlacesPropiedadProps) {
  const [enlaces, setEnlaces] = useState<Enlace[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

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
      const data = await api.get<Enlace[]>(`/propiedades/${encodeURIComponent(propiedadId)}/enlaces`)
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
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const eliminarEnlace = async (id: number) => {
    const confirmar = window.confirm('¿Seguro que deseas eliminar este enlace?')
    if (!confirmar) return

    try {
      await api.delete(`/enlaces/${id}`)
    } catch (error) {
      console.error('Error eliminando enlace:', error)
      addToast('No se pudo eliminar el enlace.', 'error')
      return
    }

    addToast('Enlace eliminado', 'success')
    await cargarEnlaces()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg"
        style={{
          backgroundColor: '#0F0F0F',
          border: '1px solid #2A2A2A',
        }}
      >
        {/* Encabezado */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: '#2A2A2A' }}
        >
          <div>
            <h2
              className="text-2xl font-bold"
              style={{
                fontFamily: 'Cormorant Garamond',
                color: '#C9A96E',
              }}
            >
              Enlaces de la propiedad
            </h2>

            <p
              className="text-xs mt-1"
              style={{ color: '#6B6B6B' }}
            >
              ID: {propiedadId}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded transition"
            style={{ color: '#C9A96E' }}
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6">

          {/* Botón agregar */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mb-6 px-4 py-2 rounded flex items-center gap-2 text-sm font-medium"
              style={{
                backgroundColor: '#C9A96E',
                color: '#0F0F0F',
              }}
            >
              <Plus size={16} />
              Agregar enlace
            </button>
          )}

          {/* Formulario */}
          {showForm && (
            <div
              className="mb-6 p-5 rounded-lg"
              style={{
                backgroundColor: '#1A1A1A',
                border: '1px solid #2A2A2A',
              }}
            >
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: '#F0EDE8' }}
              >
                {editingId !== null
                  ? 'Editar enlace'
                  : 'Agregar enlace'}
              </h3>

              <div className="space-y-4">

                <div>
                  <label
                    className="block text-sm mb-1"
                    style={{ color: '#B0B0B0' }}
                  >
                    Título
                  </label>

                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ej. Información estadística"
                    className="w-full px-3 py-2 rounded outline-none"
                    style={{
                      backgroundColor: '#0F0F0F',
                      color: '#F0EDE8',
                      border: '1px solid #333',
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-sm mb-1"
                    style={{ color: '#B0B0B0' }}
                  >
                    Descripción
                  </label>

                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Descripción opcional"
                    rows={3}
                    className="w-full px-3 py-2 rounded outline-none resize-none"
                    style={{
                      backgroundColor: '#0F0F0F',
                      color: '#F0EDE8',
                      border: '1px solid #333',
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-sm mb-1"
                    style={{ color: '#B0B0B0' }}
                  >
                    URL
                  </label>

                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded outline-none"
                    style={{
                      backgroundColor: '#0F0F0F',
                      color: '#F0EDE8',
                      border: '1px solid #333',
                    }}
                  />
                </div>

                <div>
                  <label
                    className="block text-sm mb-1"
                    style={{ color: '#B0B0B0' }}
                  >
                    Tipo
                  </label>

                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full px-3 py-2 rounded outline-none"
                    style={{
                      backgroundColor: '#0F0F0F',
                      color: '#F0EDE8',
                      border: '1px solid #333',
                    }}
                  >
                    <option value="OTRO">Otro</option>
                    <option value="INFORMACION_ESTADISTICA">
                      Información estadística
                    </option>
                    <option value="INFORMACION_LEGAL">
                      Información legal
                    </option>
                    <option value="DOCUMENTACION">
                      Documentación
                    </option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={guardarEnlace}
                    disabled={saving}
                    className="px-4 py-2 rounded text-sm font-medium"
                    style={{
                      backgroundColor: '#C9A96E',
                      color: '#0F0F0F',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {editingId !== null
                      ? 'Guardar cambios'
                      : 'Guardar enlace'}
                  </button>

                  <button
                    onClick={limpiarFormulario}
                    className="px-4 py-2 rounded text-sm"
                    style={{
                      backgroundColor: '#2A2A2A',
                      color: '#F0EDE8',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista */}
          {loading ? (
            <p style={{ color: '#6B6B6B' }}>
              Cargando enlaces...
            </p>
          ) : enlaces.length === 0 ? (
            <div
              className="py-10 text-center rounded-lg"
              style={{
                backgroundColor: '#151515',
                color: '#6B6B6B',
              }}
            >
              Esta propiedad todavía no tiene enlaces.
            </div>
          ) : (
            <div className="space-y-4">
              {enlaces.map((enlace) => (
                <div
                  key={enlace.id}
                  className="p-5 rounded-lg"
                  style={{
                    backgroundColor: '#151515',
                    border: '1px solid #2A2A2A',
                  }}
                >
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <div
                        className="text-xs uppercase tracking-wide mb-1"
                        style={{ color: '#C9A96E' }}
                      >
                        {enlace.tipo}
                      </div>

                      <h3
                        className="font-semibold"
                        style={{ color: '#F0EDE8' }}
                      >
                        {enlace.titulo}
                      </h3>

                      {enlace.descripcion && (
                        <p
                          className="text-sm mt-1"
                          style={{ color: '#9A9A9A' }}
                        >
                          {enlace.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">

                    {/* Abrir */}
                    <button
                      onClick={() => {
                        if (!openEnlace(enlace.url)) {
                          addToast('El enlace no es una URL válida.', 'error')
                        }
                      }}
                      className="px-3 py-2 rounded text-sm flex items-center gap-2"
                      style={{
                        backgroundColor: '#C9A96E',
                        color: '#0F0F0F',
                      }}
                    >
                      <ExternalLink size={15} />
                      Abrir enlace
                    </button>

                    {/* Editar */}
                    <button
                      onClick={() => editarEnlace(enlace)}
                      className="px-3 py-2 rounded text-sm flex items-center gap-2"
                      style={{
                        backgroundColor: '#2A2A2A',
                        color: '#F0EDE8',
                      }}
                    >
                      <Pencil size={15} />
                      Editar
                    </button>

                    {/* Eliminar */}
                    <button
                      onClick={() => eliminarEnlace(enlace.id)}
                      className="px-3 py-2 rounded text-sm flex items-center gap-2"
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
