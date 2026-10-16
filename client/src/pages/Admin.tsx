import { Suspense, lazy, useState } from "react"
import AdminSidebar from "@/components/admin/AdminSidebar"
import { ADMIN_TABS, type AdminTab } from "@/components/admin/tabs"
import PageHeader from "@/components/common/PageHeader"

const AdminDashboard = lazy(() => import("@/components/admin/AdminDashboard"))
const AdminAuditoria = lazy(() => import("@/components/admin/AdminAuditoria"))
const AdminEnlaces = lazy(() => import("@/components/admin/AdminEnlaces"))
const AdminPropiedades = lazy(() => import("@/components/admin/AdminPropiedades"))
const AdminScraper = lazy(() => import("@/components/admin/AdminScraper"))
const AdminUsuarios = lazy(() => import("@/components/admin/AdminUsuarios"))

interface AdminProps {
  usuario: string
  onLogout: () => void
}

export default function Admin({ usuario, onLogout }: AdminProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard")

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
      case "scraper":
        return <AdminScraper />
      case "auditoria":
        return <AdminAuditoria />
      case "dashboard":
      default:
        return <AdminDashboard onNavigate={setActiveTab} />
    }
  }

  return (
    <div className="flex min-h-screen">
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        adminName={usuario}
        onLogout={onLogout}
      />

      <main id="contenido" tabIndex={-1} className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-16 sm:px-8 md:pt-10">
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

          <div key={activeTab} className="animate-slideInUp">
            <Suspense fallback={<div className="skeleton h-64" aria-busy="true" />}>
              {renderContent()}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
}
