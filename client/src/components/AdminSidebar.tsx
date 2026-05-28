import { LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

interface AdminSidebarProps {
  activeTab: 'dashboard' | 'propiedades' | 'usuarios' | 'scraper'
  onTabChange: (tab: 'dashboard' | 'propiedades' | 'usuarios' | 'scraper') => void
  adminName: string
  onLogout: () => void
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', section: 'GENERAL' },
  { id: 'propiedades', label: 'Propiedades', icon: '🏠', section: 'GESTIÓN' },
  { id: 'usuarios', label: 'Usuarios', icon: '👥', section: 'GESTIÓN' },
  { id: 'scraper', label: 'Estado Scraper', icon: '🔄', section: 'SISTEMA' },
]

export default function AdminSidebar({
  activeTab,
  onTabChange,
  adminName,
  onLogout,
}: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const renderMenuItems = () => {
    const sections: { [key: string]: typeof menuItems } = {}

    menuItems.forEach((item) => {
      if (!sections[item.section]) {
        sections[item.section] = []
      }
      sections[item.section].push(item)
    })

    return Object.entries(sections).map(([section, items]) => (
      <div key={section}>
        <div
          className="px-6 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{ color: '#6B6B6B', fontFamily: 'DM Sans' }}
        >
          {section}
        </div>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onTabChange(item.id as any)
              setIsOpen(false)
            }}
            className="w-full text-left px-6 py-3 transition flex items-center gap-3"
            style={{
              backgroundColor:
                activeTab === item.id ? '#1A1A1A' : 'transparent',
              borderLeft:
                activeTab === item.id ? '3px solid #C9A96E' : '3px solid transparent',
              color: activeTab === item.id ? '#C9A96E' : '#6B6B6B',
              fontFamily: 'DM Sans',
              fontSize: '0.875rem',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    ))
  }

  return (
    <>
      {/* Hamburger button (mobile) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded"
        style={{ backgroundColor: '#1A1A1A', color: '#C9A96E' }}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-60 flex flex-col z-40 transition-transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: '#0A0A0A',
          borderRight: '1px solid #1F1F1F',
          fontFamily: 'DM Sans',
        }}
      >
        {/* Header */}
        <div className="px-6 py-6 border-b" style={{ borderColor: '#1F1F1F' }}>
          <h1
            className="text-lg font-bold"
            style={{ fontFamily: 'Cormorant Garamond', color: '#C9A96E' }}
          >
            INMODAPERU
          </h1>
          <p
            className="text-xs"
            style={{ color: '#6B6B6B' }}
          >
            [Admin]
          </p>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-6">
          {renderMenuItems()}
        </nav>

        {/* Divider */}
        <div
          style={{ borderTop: '1px solid #1F1F1F' }}
        ></div>

        {/* Footer */}
        <div className="px-6 py-6 space-y-3">
          <div
            className="text-sm"
            style={{ color: '#F0EDE8' }}
          >
            👤 {adminName}
          </div>
          <button
            onClick={onLogout}
            className="w-full px-4 py-2 rounded text-sm font-medium transition flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #C9A96E',
              color: '#C9A96E',
            }}
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Spacer (desktop) */}
      <div className="hidden md:block w-60"></div>
    </>
  )
}
