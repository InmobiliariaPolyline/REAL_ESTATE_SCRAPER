import { useEffect, useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Enlace {
  id: number
  propiedad_id: string
  titulo: string
  descripcion: string | null
  url: string
  tipo: string
  creado_en: string
}

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

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [url, setUrl] = useState('')
  const [tipo, setTipo] = useState('OTRO')

  const cargarEnlaces = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('enlaces')
      .select('*')
      .eq('propiedad_id', propiedadId)
      .order('creado_en', { ascending: false })

    if (error) {
      console.error('Error cargando enlaces:', error)
      setEnlaces([])
    } else {
      setEnlaces(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    cargarEnlaces()
  }, [propiedadId])

  const limpiarFormulario = () => {
    setTitulo('')
    setDescripcion('')
    setUrl('')
    setTipo('OTRO')
    setEditingId(null)
    setShowForm(false)
  }

  const guardarEnlace = async () => {
    if (!titulo.trim() || !url.trim()) {
      alert('El título y la URL son obligatorios.')
      return
    }

    if (editingId !== null) {
      const { error } = await supabase
        .from('enlaces')
        .update({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          url: url.trim(),
          tipo,
        })
        .eq('id', editingId)

      if (error) {
        console.error('Error actualizando enlace:', error)
        alert('No se pudo actualizar el enlace.')
        return
      }
    } else {
      const { error } = await supabase
        .from('enlaces')
        .insert({
          propiedad_id: propiedadId,
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          url: url.trim(),
          tipo,
        })

      if (error) {
        console.error('Error creando enlace:', error)
        alert('No se pudo crear el enlace.')
        return
      }
    }

    limpiarFormulario()
    await cargarEnlaces()
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
    const confirmar = window.confirm(
      '¿Seguro que deseas eliminar este enlace?'
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('enlaces')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando enlace:', error)
      alert('No se pudo eliminar el enlace.')
      return
    }

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
                    className="px-4 py-2 rounded text-sm font-medium"
                    style={{
                      backgroundColor: '#C9A96E',
                      color: '#0F0F0F',
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
                      onClick={() =>
                        window.open(
                          enlace.url,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
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
