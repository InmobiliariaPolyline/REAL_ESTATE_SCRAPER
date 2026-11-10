import { KeyRound, LogOut, Moon, Sun } from "lucide-react"
import { Suspense, lazy, useState } from "react"
import AdminSidebar from "@/components/admin/AdminSidebar"
import { ADMIN_TABS, type AdminTab } from "@/components/admin/tabs"
import { sectionsFor, type SistemaSection } from "@/components/sistema/SistemaModule"
import { useTheme } from "@/contexts/ThemeContext"
import CommandPalette, { type CommandAction } from "@/components/common/CommandPalette"
import Avatar from "@/components/common/Avatar"
import PageHeader from "@/components/common/PageHeader"
import ThemeToggle from "@/components/common/ThemeToggle"
import { BuscadorCampo } from "@/components/portal/PortalTabs"

const AdminDashboard = lazy(() => import("@/components/admin/AdminDashboard"))
const AdminEnlaces = lazy(() => import("@/components/admin/AdminEnlaces"))
const AdminPropiedades = lazy(() => import("@/components/admin/AdminPropiedades"))
const SistemaModule = lazy(() => import("@/components/sistema/SistemaModule"))
const AdminUsuarios = lazy(() => import("@/components/admin/AdminUsuarios"))

interface AdminProps {
  usuario: string
  onLogout: () => void
}

export default function Admin({ usuario, onLogout }: AdminProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard")
  const [sistemaSection, setSistemaSection] = useState<SistemaSection>("perfil")
  const { theme, toggleTheme } = useTheme()

  const paletteActions: CommandAction[] = [
    ...ADMIN_TABS.map(tab => ({
      id: `tab-${tab.id}`,
      label: `Ir a ${tab.label}`,
      group: "Secciones",
      icon: tab.icon,
      keywords: [tab.title, tab.description],
      run: () => setActiveTab(tab.id),
    })),
    ...sectionsFor(true).map(sec => ({
      id: `sistema-${sec.id}`,
      label: `Sistema: ${sec.label}`,
      group: "Sistema",
      icon: sec.icon,
      keywords: [sec.title, sec.description],
      run: () => {
        setSistemaSection(sec.id)
        setActiveTab("sistema")
      },
    })),
    { id: "cuenta", label: "Mi cuenta: contraseña y sesiones", group: "Cuenta", icon: KeyRound, keywords: ["password", "clave", "dispositivos"], run: () => window.dispatchEvent(new Event("open-account")) },
    ...(toggleTheme
      ? [{ id: "tema", label: theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro", group: "Cuenta", icon: theme === "dark" ? Sun : Moon, run: toggleTheme }]
      : []),
    { id: "salir", label: "Cerrar sesión", group: "Cuenta", icon: LogOut, run: onLogout },
  ]

  const current = ADMIN_TABS.find(tab => tab.id === activeTab) ?? ADMIN_TABS[0]
  const isDashboard = activeTab === "dashboard"

  const renderContent = () => {
    switch (activeTab) {
      case "propiedades":
        return <AdminPropiedades />
      case "enlaces":
        return <AdminEnlaces />
      case "usuarios":
        return <AdminUsuarios />
      case "sistema":
        return (
          <SistemaModule
            esAdmin
            section={sistemaSection}
            onSectionChange={setSistemaSection}
            onLogout={onLogout}
          />
        )
      case "dashboard":
      default:
        return <AdminDashboard onNavigate={setActiveTab} />
    }
  }

  return (
    <div className="flex min-h-screen">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <CommandPalette actions={paletteActions} />
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        adminName={usuario}
        onLogout={onLogout}
      />

      <main id="contenido" tabIndex={-1} className="min-w-0 flex-1">
        {/* Cabecera (escritorio): dónde estás, buscador, tema y cuenta */}
        <header className="glass fixed right-0 top-0 z-30 hidden h-16 items-center gap-4 border-b border-line px-8 md:left-64 md:flex">
          <p className="label-mono shrink-0" aria-hidden="true">
            Administración <span className="mx-1.5 text-text-faint/60">/</span> <span className="text-text-muted">{current.label}</span>
          </p>
          <div className="ml-auto flex min-w-0 flex-1 justify-end">
            <BuscadorCampo />
          </div>
          <ThemeToggle className="btn-sm" />
          <span className="h-6 w-px bg-line" />
          <button
            onClick={() => window.dispatchEvent(new Event("open-account"))}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1 transition hover:bg-surface-3"
            title="Mi cuenta: contraseña y sesiones"
          >
            <Avatar name={usuario} size="sm" />
            <span className="hidden text-sm font-medium text-text xl:inline">{usuario}</span>
          </button>
        </header>

        <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-16 sm:px-8 md:pt-28">
          <PageHeader
            eyebrow={isDashboard ? "Panel de administración" : current.section}
            title={
              isDashboard ? (
                <>
                  Hola, <span className="text-gold">{usuario}</span>
                </>
              ) : (
                current.title
              )
            }
            description={current.description}
          />

          <div key={activeTab} className="page-enter">
            <Suspense fallback={<div className="skeleton h-64" aria-busy="true" />}>
              {renderContent()}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
}
