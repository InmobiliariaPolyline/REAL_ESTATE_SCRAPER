import { LogOut } from 'lucide-react'

interface PortalHeaderProps {
  usuario: string
  planType: 'PREMIUM' | 'GRATIS'
  fechaVencimiento: string
  onLogout: () => void
}

export default function PortalHeader({
  usuario,
  planType,
  fechaVencimiento,
  onLogout,
}: PortalHeaderProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-40"
      style={{ backgroundColor: '#111111', borderBottom: '1px solid #2A2A2A' }}
    >
      {/* Izquierda: Logo */}
      <div
        className="text-2xl font-bold"
        style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
      >
        INMODAPERU
      </div>

      {/* Centro: Bienvenida + Badge Plan */}
      <div className="flex items-center gap-4">
        <span style={{ color: '#F0EDE8', fontFamily: 'DM Sans' }}>
          Bienvenido, <strong>{usuario}</strong>
        </span>
        <span
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{
            backgroundColor: planType === 'PREMIUM' ? '#C9A96E' : '#6B6B6B',
            color: planType === 'PREMIUM' ? '#0F0F0F' : '#F0EDE8',
            fontFamily: 'DM Sans',
          }}
        >
          {planType}
        </span>
      </div>

      {/* Derecha: Vencimiento + Logout */}
      <div className="flex items-center gap-6">
        <span style={{ color: '#6B6B6B', fontFamily: 'DM Sans', fontSize: '0.875rem' }}>
          Vence: <strong style={{ color: '#C9A96E' }}>{fechaVencimiento}</strong>
        </span>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded hover:opacity-80 transition"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #C9A96E',
            color: '#C9A96E',
            fontFamily: 'DM Sans',
            fontSize: '0.875rem',
          }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
