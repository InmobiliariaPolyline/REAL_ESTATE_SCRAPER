import { useEffect, useState } from 'react'
import {
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Enlace {
  id: number
  propiedad_id: string
  titulo: string
  descripcion: string | null
  url: string
  tipo: string
  creado_en: string | null
}

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

export default function AdminEnlaces() {
  const [enlaces, setEnlaces] = useState<EnlaceConPropiedad[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('TODOS')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [url, setUrl] = useState('')
  const [tipo, setTipo] = useState('OTRO')
  const [propiedadId, setPropiedadId] = useState('')

  const [propiedades, setPropiedades] = useState<Propiedad[]>([])

  const tipos = [
    'TODOS',
    'OTRO',
    'INFORMACION_ESTADISTICA',
    'INFORMACION_LEGAL',
    'DOCUMENTACION',
  ]

  const cargarDatos = async () => {
    setLoading(true)

    try {
      const { data: enlacesData, error: enlacesError } = await supabase
        .from('enlaces')
        .select('*')
        .order('creado_en', { ascending: false })

      if (enlacesError) {
        console.error('Error cargando enlaces:', enlacesError)
        setEnlaces([])
        return
      }

      const { data: propiedadesData, error: propiedadesError } =
        await supabase
          .from('propiedades')
          .select(
            'id, portal, operacion, inmueble, titulo, distrito'
          )

      if (propiedadesError) {
        console.error(
          'Error cargando propiedades:',
          propiedadesError
        )
      }

      const listaPropiedades = propiedadesData || []
      setPropiedades(listaPropiedades)

      const enlacesConPropiedad: EnlaceConPropiedad[] = (
        enlacesData || []
      ).map((enlace) => ({
        ...enlace,
        propiedad: listaPropiedades.find(
          (propiedad) => propiedad.id === enlace.propiedad_id
        ),
      }))

      setEnlaces(enlacesConPropiedad)
    } catch (error) {
      console.error('Error inesperado:', error)
      setEnlaces([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const limpiarFormulario = () => {
    setTitulo('')
    setDescripcion('')
    setUrl('')
    setTipo('OTRO')
    setPropiedadId('')
    setEditingId(null)
    setShowForm(false)
  }

  const guardarEnlace = async () => {
    if (!titulo.trim()) {
      alert('El título es obligatorio.')
      return
    }

    if (!url.trim()) {
      alert('La URL es obligatoria.')
      return
    }

    if (!propiedadId) {
      alert('Debes seleccionar una propiedad.')
      return
    }

    try {
      if (editingId !== null) {
        const { error } = await supabase
          .from('enlaces')
          .update({
            titulo: titulo.trim(),
            descripcion: descripcion.trim() || null,
            url: url.trim(),
            tipo,
            propiedad_id: propiedadId,
          })
          .eq('id', editingId)

        if (error) {
          console.error(
            'Error actualizando enlace:',
            error
          )
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
          console.error(
            'Error creando enlace:',
            error
          )
          alert('No se pudo crear el enlace.')
          return
        }
      }

      limpiarFormulario()
      await cargarDatos()
    } catch (error) {
      console.error('Error inesperado:', error)
      alert('Ocurrió un error al guardar el enlace.')
    }
  }

  const editarEnlace = (enlace: EnlaceConPropiedad) => {
    setEditingId(enlace.id)
    setTitulo(enlace.titulo)
    setDescripcion(enlace.descripcion || '')
    setUrl(enlace.url)
    setTipo(enlace.tipo)
    setPropiedadId(enlace.propiedad_id)
    setShowForm(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
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
      console.error(
        'Error eliminando enlace:',
        error
      )
      alert('No se pudo eliminar el enlace.')
      return
    }

    await cargarDatos()
  }

  const abrirEnlace = (url: string) => {
    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    )
  }

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

  const formatearFecha = (
    fecha: string | null
  ) => {
    if (!fecha) return '-'

    const fechaObj = new Date(fecha)

    if (Number.isNaN(fechaObj.getTime())) {
      return '-'
    }

    return fechaObj.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

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

              <select
                value={propiedadId}
                onChange={(e) =>
                  setPropiedadId(e.target.value)
                }
                className="w-full px-3 py-2.5 rounded outline-none"
                style={{
                  backgroundColor: '#0F0F0F',
                  color: '#F0EDE8',
                  border: '1px solid #333',
                }}
              >
                <option value="">
                  Selecciona una propiedad
                </option>

                {propiedades.map((propiedad) => (
                  <option
                    key={propiedad.id}
                    value={propiedad.id}
                  >
                    {propiedad.titulo ||
                      `Propiedad ${propiedad.id}`}
                    {propiedad.distrito
                      ? ` — ${propiedad.distrito}`
                      : ''}
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
              className="px-5 py-2.5 rounded text-sm font-medium"
              style={{
                backgroundColor: '#C9A96E',
                color: '#0F0F0F',
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
                    onClick={() =>
                      eliminarEnlace(enlace.id)
                    }
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
    </div>
  )
}
