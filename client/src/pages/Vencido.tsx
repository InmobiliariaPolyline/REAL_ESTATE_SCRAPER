import { Lock } from 'lucide-react'
import { ADMIN_WHATSAPP } from '@/lib/supabase'

interface VencidoProps {
  onLogout: () => void
}

export default function Vencido({ onLogout }: VencidoProps) {
  return (
    <div className="flex h-screen items-center justify-center" style={{ backgroundColor: '#0F0F0F' }}>
      <div className="text-center max-w-md">
        {/* Ícono candado dorado */}
        <div className="mb-6 flex justify-center">
          <Lock size={64} style={{ color: '#C9A96E' }} />
        </div>

        {/* Título */}
        <h1
          className="text-4xl font-bold mb-4"
          style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
        >
          Tu suscripción ha vencido
        </h1>

        {/* Subtítulo */}
        <p
          className="text-base mb-8"
          style={{ color: '#6B6B6B', fontFamily: 'DM Sans' }}
        >
          Contacta al administrador para renovar tu acceso.
        </p>

        {/* Botón WhatsApp */}
        <a
          href={`https://wa.me/${ADMIN_WHATSAPP}?text=Hola, quiero renovar mi suscripción en Real Estate Scraper`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-3 rounded text-white font-semibold mb-6"
          style={{ backgroundColor: '#22C55E', fontFamily: 'DM Sans' }}
        >
          Renovar por WhatsApp
        </a>

        {/* Botón Cerrar sesión */}
        <button
          onClick={onLogout}
          className="block w-full px-8 py-3 border rounded text-sm font-medium"
          style={{
            borderColor: '#C9A96E',
            color: '#C9A96E',
            fontFamily: 'DM Sans',
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Botón WhatsApp flotante */}
      <a
        href={`https://wa.me/${ADMIN_WHATSAPP}?text=Hola, quiero información sobre Real Estate Scraper`}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-button"
        title="¿Quieres acceder? Contáctanos"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </a>
    </div>
  )
}
