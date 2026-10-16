import { useState } from "react"
import AdminDashboard from "@/components/admin/AdminDashboard"
import AdminEnlaces from "@/components/admin/AdminEnlaces"
import AdminPropiedades from "@/components/admin/AdminPropiedades"
import AdminScraper from "@/components/admin/AdminScraper"
import AdminSidebar from "@/components/admin/AdminSidebar"
import AdminUsuarios from "@/components/admin/AdminUsuarios"
import { ADMIN_TABS, type AdminTab } from "@/components/admin/tabs"

interface AdminProps {
  usuario: string
  onLogout: () => void
}

export default function Admin({ usuario, onLogout }: AdminProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard")

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
        return <AdminDashboard />
    }
  }

  const title = ADMIN_TABS.find(tab => tab.id === activeTab)?.title ?? ""

  return (
    <div className="flex h-screen" style={{ backgroundColor: "#0F0F0F" }}>
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        adminName={usuario}
        onLogout={onLogout}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-8">
          <h1
            className="text-3xl font-bold mb-8"
            style={{ fontFamily: "Cormorant Garamond", color: "#C9A96E" }}
          >
            {title}
          </h1>

          {renderContent()}
        </div>
      </main>
    </div>
  )
}
