export type AdminTab =
  | "dashboard"
  | "propiedades"
  | "enlaces"
  | "usuarios"
  | "scraper"

export interface AdminTabInfo {
  id: AdminTab
  label: string
  /** Título mostrado sobre el contenido de la pestaña. */
  title: string
  icon: string
  section: "GENERAL" | "GESTIÓN" | "SISTEMA"
}

export const ADMIN_TABS: AdminTabInfo[] = [
  { id: "dashboard", label: "Dashboard", title: "Dashboard", icon: "📊", section: "GENERAL" },
  { id: "propiedades", label: "Propiedades", title: "Propiedades", icon: "🏠", section: "GESTIÓN" },
  { id: "enlaces", label: "Enlaces", title: "Enlaces", icon: "🔗", section: "GESTIÓN" },
  { id: "usuarios", label: "Usuarios", title: "Usuarios y Suscripciones", icon: "👥", section: "GESTIÓN" },
  { id: "scraper", label: "Actividad", title: "Actividad del sistema", icon: "🔄", section: "SISTEMA" },
]
