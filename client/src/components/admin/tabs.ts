import { Building2, LayoutDashboard, Link2, Settings2, Users, type LucideIcon } from "lucide-react"

export type AdminTab =
  | "dashboard"
  | "propiedades"
  | "enlaces"
  | "usuarios"
  | "sistema"

export interface AdminTabInfo {
  id: AdminTab
  label: string
  /** Título mostrado sobre el contenido de la pestaña. */
  title: string
  description: string
  icon: LucideIcon
  section: "GENERAL" | "GESTIÓN" | "SISTEMA"
}

export const ADMIN_TABS: AdminTabInfo[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "Dashboard",
    description: "Resumen del sistema: avisos, usuarios, suscripciones y estado de los datos.",
    icon: LayoutDashboard,
    section: "GENERAL",
  },
  {
    id: "propiedades",
    label: "Propiedades",
    title: "Propiedades",
    description: "Busca y cura los avisos recolectados: favoritos, historial y búsquedas guardadas.",
    icon: Building2,
    section: "GESTIÓN",
  },
  {
    id: "enlaces",
    label: "Enlaces",
    title: "Enlaces",
    description: "Administra los enlaces de apoyo asociados a cada propiedad.",
    icon: Link2,
    section: "GESTIÓN",
  },
  {
    id: "usuarios",
    label: "Usuarios",
    title: "Usuarios y suscripciones",
    description: "Crea usuarios, activa o renueva Premium y gestiona el acceso.",
    icon: Users,
    section: "GESTIÓN",
  },
  {
    id: "sistema",
    label: "Sistema",
    title: "Sistema",
    description: "Tu perfil, seguridad, apariencia, actividad y el historial de versiones.",
    icon: Settings2,
    section: "SISTEMA",
  },
]
