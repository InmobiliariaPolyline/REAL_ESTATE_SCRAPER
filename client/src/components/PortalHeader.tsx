import { LogOut, Menu } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

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
      <div className="flex items-center gap-3">
        <img
          src="/logo.png"
          alt="REAL ESTATE SCRAPER Logo"
          className="w-8 h-8 object-contain"
          decoding="async"
        />
        <span
          className="text-2xl font-bold"
          style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
        >
          REAL ESTATE SCRAPER
        </span>
      </div>

      {/* Desktop Navigation (>= 768px) */}
      <div className="hidden md:flex items-center gap-8">
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
      </div>

      {/* Mobile Navigation (< 768px) */}
      <div className="md:hidden flex items-center">
        <Sheet>
          <SheetTrigger asChild>
            <button
              aria-label="Abrir menú"
              className="flex items-center justify-center rounded transition hover:bg-[#2A2A2A] text-[#C9A96E]"
              style={{
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
                border: '1px solid #2A2A2A',
                backgroundColor: 'transparent',
              }}
            >
              <Menu size={24} />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[280px] border-l border-[#2A2A2A] p-6 flex flex-col justify-between"
            style={{ backgroundColor: '#111111' }}
          >
            <div className="space-y-6">
              <SheetHeader className="p-0 text-left">
                <SheetTitle
                  className="text-2xl font-bold flex items-center gap-3"
                  style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
                >
                  <img
                    src="/logo.png"
                    alt="REAL ESTATE SCRAPER Logo"
                    className="w-8 h-8 object-contain"
                    decoding="async"
                  />
                  REAL ESTATE SCRAPER
                </SheetTitle>
              </SheetHeader>

              {/* Detalle de usuario */}
              <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
                <div className="flex flex-col gap-2">
                  <span style={{ color: '#6B6B6B', fontSize: '0.875rem', fontFamily: 'DM Sans' }}>Usuario</span>
                  <div className="flex items-center justify-between">
                    <strong style={{ color: '#F0EDE8', fontSize: '1.1rem', fontFamily: 'DM Sans' }}>{usuario}</strong>
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
                </div>

                <div className="flex flex-col gap-1 pt-2">
                  <span style={{ color: '#6B6B6B', fontSize: '0.875rem', fontFamily: 'DM Sans' }}>Vence el plan</span>
                  <strong style={{ color: '#C9A96E', fontSize: '1rem', fontFamily: 'DM Sans' }}>{fechaVencimiento}</strong>
                </div>
              </div>
            </div>

            {/* Logout al fondo */}
            <div className="pt-6 border-t border-[#2A2A2A]">
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 h-11 rounded font-semibold transition"
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #C9A96E',
                  color: '#C9A96E',
                  fontFamily: 'DM Sans',
                  fontSize: '0.9rem',
                }}
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

