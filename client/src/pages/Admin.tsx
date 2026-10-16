import { useState } from "react"
import AdminDashboard from "@/components/admin/AdminDashboard"
import AdminEnlaces from "@/components/admin/AdminEnlaces"
import AdminPropiedades from "@/components/admin/AdminPropiedades"
import AdminScraper from "@/components/admin/AdminScraper"
import AdminSidebar from "@/components/admin/AdminSidebar"
import AdminUsuarios from "@/components/admin/AdminUsuarios"
import { ADMIN_TABS, type AdminTab } from "@/components/admin/tabs"
import PageHeader from "@/components/common/PageHeader"

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
      case "dashboard":
      default:
        return <AdminDashboard onNavigate={setActiveTab} />
    }
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        adminName={usuario}
        onLogout={onLogout}
      />

      <main className="min-w-0 flex-1">
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
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  )
}
