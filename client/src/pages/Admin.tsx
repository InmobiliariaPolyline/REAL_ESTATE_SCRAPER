import { useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import AdminDashboard from '@/components/AdminDashboard'
import AdminPropiedades from '@/components/AdminPropiedades'
import AdminUsuarios from '@/components/AdminUsuarios'
import AdminScraper from '@/components/AdminScraper'

interface AdminProps {
  usuario: string
  usuarioId: number
  onLogout: () => void
}

export default function Admin({ usuario, usuarioId, onLogout }: AdminProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'propiedades' | 'usuarios' | 'scraper'>(
    'dashboard'
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />
      case 'propiedades':
        return <AdminPropiedades />
      case 'usuarios':
        return <AdminUsuarios />
      case 'scraper':
        return <AdminScraper />
      default:
        return <AdminDashboard />
    }
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#0F0F0F' }}>
      {/* Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        adminName={usuario}
        onLogout={onLogout}
      />

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-8">
          {/* Título de pestaña */}
          <h1
            className="text-3xl font-bold mb-8"
            style={{
              fontFamily: 'Cormorant Garamond',
              color: '#C9A96E',
            }}
          >
            {activeTab === 'dashboard'
              ? 'Dashboard'
              : activeTab === 'propiedades'
                ? 'Propiedades'
                : activeTab === 'usuarios'
                  ? 'Usuarios y Suscripciones'
                  : 'Estado Scraper'}
          </h1>

          {/* Contenido */}
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
