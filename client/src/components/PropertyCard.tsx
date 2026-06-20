import { Eye } from 'lucide-react'

interface PropertyCardProps {
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
  index: number
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

export default function PropertyCard({
  id,
  portal,
  operacion,
  titulo,
  precio,
  precioUsd,
  moneda,
  distrito,
  dormitorios,
  banios,
  area,
  imagen,
  url,
  index,
}: PropertyCardProps) {
  let displayMoneda = moneda
  let displayPrice = 0
  let isApprox = false

  if (moneda === 'USD') {
    if (precioUsd && precioUsd > 0) {
      displayPrice = precioUsd
    } else if (precio && precio > 0) {
      displayPrice = Math.round(precio / 3.75)
      isApprox = true
    } else {
      displayPrice = 0
    }
  } else {
    displayPrice = precio || 0
  }

  const formattedPrice = displayPrice.toLocaleString('es-PE')

  return (
    <div
      className="rounded overflow-hidden transition-all hover:shadow-lg"
      style={{
        backgroundColor: '#111111',
        animation: `slideInUp 0.5s ease forwards`,
        animationDelay: `${index * 40}ms`,
        opacity: 0,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow =
          '0 8px 32px rgba(201, 169, 110, 0.18)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
      }}
    >
      {/* Imagen */}
      <div className="relative w-full h-48 bg-gray-800 overflow-hidden">
        {imagen ? (
          <img
            src={imagen}
            alt={titulo}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: '#252525' }}
          >
            <svg
              width="48"
              height="48"
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

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2" style={{ zIndex: 10 }}>
          <span
            className="badge-portal"
            style={{ backgroundColor: getPortalBadgeColor(portal) }}
          >
            {portal}
          </span>
        </div>
        <div className="absolute top-3 right-3" style={{ zIndex: 10 }}>
          <span
            className="badge-operacion"
            style={{
              backgroundColor: getOperacionBadgeColor(operacion),
            }}
          >
            {operacion}
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {/* Precio */}
        <div
          className="text-2xl font-bold mb-2"
          style={{
            fontFamily: 'JetBrains Mono',
            color: '#C9A96E',
          }}
        >
          {displayPrice > 0 ? (
            <>
              {displayMoneda} {isApprox && '~'}{formattedPrice}
            </>
          ) : (
            `${displayMoneda} 0`
          )}
        </div>

        {/* Título */}
        <h3
          className="text-sm font-medium mb-3 truncate"
          style={{
            color: '#F0EDE8',
            fontFamily: 'DM Sans',
          }}
        >
          {titulo}
        </h3>

        {/* Pills */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <span className="pill">🛏 {dormitorios}</span>
          <span className="pill">🚿 {banios}</span>
          <span className="pill">📐 {area}</span>
        </div>

        {/* Distrito */}
        <div
          className="text-xs mb-4"
          style={{
            color: '#6B6B6B',
            fontFamily: 'DM Sans',
          }}
        >
          📍 {distrito}
        </div>

        {/* Botón Ver */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline-gold w-full flex items-center justify-center gap-2 h-11 md:h-10 text-sm"
          style={{ padding: 0 }} // Reset vertical padding to allow height utility to take effect
        >
          <Eye size={16} />
          Ver anuncio
        </a>
      </div>
    </div>
  )
}

