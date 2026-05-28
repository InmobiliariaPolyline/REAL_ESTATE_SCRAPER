import { Eye, Trash2 } from 'lucide-react'

interface Property {
  id: string
  portal: string
  operacion: string
  titulo: string
  precio: number
  precioUsd: number
  moneda: string
  distrito: string
  dormitorios: string
  banios: string
  area: string
  imagen: string | null
  url: string
}

interface PropertyTableProps {
  properties: Property[]
  moneda: 'PEN' | 'USD'
  onViewMore?: (url: string) => void
}

function getPortalBadgeColor(portal: string) {
  switch (portal) {
    case 'Properati':
      return '#3B82F6'
    case 'Infocasas':
      return '#8B5CF6'
    case 'Babilonia':
      return '#F59E0B'
    default:
      return '#60A5FA'
  }
}

function getOperacionBadgeColor(operacion: string) {
  return operacion === 'ALQUILER' ? '#22C55E' : '#EF4444'
}

export default function PropertyTable({
  properties,
  moneda,
  onViewMore,
}: PropertyTableProps) {
  return (
    <div
      className="overflow-x-auto rounded"
      style={{ backgroundColor: '#111111' }}
    >
      <table className="w-full text-sm" style={{ fontFamily: 'DM Sans' }}>
        <thead>
          <tr style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid #2A2A2A' }}>
            <th
              className="px-4 py-3 text-left font-semibold"
              style={{ color: '#C9A96E' }}
            >
              Thumb
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
              className="px-4 py-3 text-left font-semibold"
              style={{ color: '#C9A96E' }}
            >
              Tipo
            </th>
            <th
              className="px-4 py-3 text-left font-semibold"
              style={{ color: '#C9A96E' }}
            >
              Dorms
            </th>
            <th
              className="px-4 py-3 text-left font-semibold"
              style={{ color: '#C9A96E' }}
            >
              Área
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
          {properties.map((prop, idx) => (
            <tr
              key={prop.id}
              style={{
                borderBottom: '1px solid #2A2A2A',
                backgroundColor: idx % 2 === 0 ? '#0F0F0F' : '#111111',
              }}
            >
              {/* Thumb */}
              <td className="px-4 py-3">
                {prop.imagen ? (
                  <img
                    src={prop.imagen}
                    alt={prop.titulo}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded flex items-center justify-center"
                    style={{ backgroundColor: '#252525' }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      style={{ color: '#6B6B6B' }}
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  </div>
                )}
              </td>

              {/* Portal */}
              <td className="px-4 py-3">
                <span
                  className="badge-portal px-2 py-1 text-xs"
                  style={{
                    backgroundColor: getPortalBadgeColor(prop.portal),
                  }}
                >
                  {prop.portal}
                </span>
              </td>

              {/* Título */}
              <td
                className="px-4 py-3 truncate max-w-xs"
                style={{ color: '#F0EDE8' }}
              >
                {prop.titulo}
              </td>

              {/* Precio USD */}
              <td
                className="px-4 py-3 font-semibold"
                style={{
                  color: '#C9A96E',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                ${prop.precioUsd.toLocaleString('es-PE')}
              </td>

              {/* Distrito */}
              <td className="px-4 py-3" style={{ color: '#6B6B6B' }}>
                {prop.distrito}
              </td>

              {/* Tipo */}
              <td className="px-4 py-3">
                <span
                  className="badge-operacion px-2 py-1 text-xs"
                  style={{
                    backgroundColor: getOperacionBadgeColor(prop.operacion),
                  }}
                >
                  {prop.operacion}
                </span>
              </td>

              {/* Dorms */}
              <td className="px-4 py-3" style={{ color: '#F0EDE8' }}>
                {prop.dormitorios}
              </td>

              {/* Área */}
              <td className="px-4 py-3" style={{ color: '#F0EDE8' }}>
                {prop.area}
              </td>

              {/* Acciones */}
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <a
                    href={prop.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:opacity-70 transition"
                    style={{ color: '#C9A96E' }}
                  >
                    <Eye size={16} />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
