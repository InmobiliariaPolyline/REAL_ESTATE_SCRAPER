import { KeyRound, LogOut, Menu, X } from "lucide-react"
import { useState } from "react"
import Avatar from "@/components/common/Avatar"
import Logo from "@/components/common/Logo"
import AccountModal from "@/components/common/AccountModal"
import { cn } from "@/lib/utils"
import { ADMIN_TABS, type AdminTab } from "./tabs"

interface AdminSidebarProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
  adminName: string
  onLogout: () => void
}

export default function AdminSidebar({
  activeTab,
  onTabChange,
  adminName,
  onLogout,
}: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const sections = ADMIN_TABS.reduce<Record<string, typeof ADMIN_TABS>>((acc, tab) => {
    ;(acc[tab.section] ??= []).push(tab)
    return acc
  }, {})

  return (
    <>
      {/* Botón de menú (móvil) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Cerrar menú de administración" : "Abrir menú de administración"}
        aria-expanded={isOpen}
        className="btn btn-secondary btn-icon fixed right-4 top-4 z-50 shadow-lg md:hidden"
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Fondo (móvil) */}
      {isOpen && (
        <div
          className="animate-fadeIn fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface-1 px-3 py-5 transition-transform duration-300 md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-3 pb-5">
          <Logo />
        </div>

        {/* Perfil */}
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          className="group mx-1 mb-2 flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition hover:border-gold/40"
          title="Mi cuenta: contraseña y sesiones"
        >
          <Avatar name={adminName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{adminName}</p>
            <p className="text-xs text-text-muted">Administrador</p>
          </div>
          <KeyRound className="size-4 shrink-0 text-text-faint transition group-hover:text-gold" />
        </button>

        <nav className="-mr-1 flex-1 overflow-y-auto pr-1" aria-label="Administración">
          {Object.entries(sections).map(([section, tabs]) => (
            <div key={section}>
              <p className="nav-label">{section}</p>
              <div className="space-y-1 pl-3 -ml-3 pr-0">
                {tabs.map(tab => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        onTabChange(tab.id)
                        setIsOpen(false)
                      }}
                      aria-current={activeTab === tab.id ? "page" : undefined}
                      className="nav-item ml-3 w-[calc(100%-0.75rem)]"
                    >
                      <Icon className="size-[1.15rem] shrink-0" strokeWidth={1.75} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <button onClick={onLogout} className="btn btn-secondary mx-1 mt-3">
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </aside>

      {showPassword && <AccountModal usuario={adminName} onClose={() => setShowPassword(false)} />}

      {/* Espaciador (escritorio) */}
      <div className="hidden w-64 shrink-0 md:block" aria-hidden="true" />
    </>
  )
}
