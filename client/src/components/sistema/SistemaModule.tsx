import {
  Activity,
  Info,
  Palette,
  ScrollText,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { Suspense, lazy, useMemo } from "react"
import { cn } from "@/lib/utils"

const PerfilSection = lazy(() => import("./PerfilSection"))
const SeguridadSection = lazy(() => import("./SeguridadSection"))
const PersonalizacionSection = lazy(() => import("./PersonalizacionSection"))
const AcercaSection = lazy(() => import("./AcercaSection"))
const AdminActividad = lazy(() => import("@/components/admin/AdminActividad"))
const AdminAuditoria = lazy(() => import("@/components/admin/AdminAuditoria"))

export type SistemaSection =
  | "perfil"
  | "seguridad"
  | "personalizacion"
  | "actividad"
  | "auditoria"
  | "acerca"

export interface SistemaSectionInfo {
  id: SistemaSection
  label: string
  title: string
  description: string
  icon: LucideIcon
  adminOnly?: boolean
}

export const SISTEMA_SECTIONS: SistemaSectionInfo[] = [
  { id: "perfil", label: "Perfil", title: "Tu perfil", description: "Tu cuenta, tu plan y tu actividad en un vistazo.", icon: UserRound },
  { id: "seguridad", label: "Seguridad", title: "Seguridad", description: "Contraseña, dispositivos conectados y estado de protección.", icon: ShieldCheck },
  { id: "personalizacion", label: "Tema y personalización", title: "Tema y personalización", description: "Color, tamaño y movimiento de la interfaz a tu gusto.", icon: Palette },
  { id: "actividad", label: "Actividad", title: "Actividad del sistema", description: "Los últimos inicios de sesión de los usuarios.", icon: Activity, adminOnly: true },
  { id: "auditoria", label: "Auditoría", title: "Auditoría", description: "Registro de las acciones administrativas: quién hizo qué, sobre quién y cuándo.", icon: ScrollText, adminOnly: true },
  { id: "acerca", label: "Acerca del sistema", title: "Acerca del sistema", description: "Versión, estado en vivo e historial de implementaciones, mejoras y correcciones.", icon: Info },
]

/** Secciones visibles según el rol. */
export const sectionsFor = (esAdmin: boolean) => SISTEMA_SECTIONS.filter(s => esAdmin || !s.adminOnly)

interface SistemaModuleProps {
  esAdmin: boolean
  section: SistemaSection
  onSectionChange: (section: SistemaSection) => void
  onLogout: () => void
}

/**
 * Módulo "Sistema": sub-barra lateral con las secciones personales (perfil, seguridad,
 * personalización, acerca de) y, para el administrador, actividad y auditoría.
 */
export default function SistemaModule({ esAdmin, section, onSectionChange, onLogout }: SistemaModuleProps) {
  const sections = useMemo(() => sectionsFor(esAdmin), [esAdmin])
  const current = sections.find(s => s.id === section) ?? sections[0]
  const CurrentIcon = current.icon

  const renderSection = () => {
    switch (current.id) {
      case "seguridad":
        return <SeguridadSection onOpenAudit={esAdmin ? () => onSectionChange("auditoria") : undefined} />
      case "personalizacion":
        return <PersonalizacionSection />
      case "actividad":
        return <AdminActividad />
      case "auditoria":
        return <AdminAuditoria />
      case "acerca":
        return <AcercaSection />
      case "perfil":
      default:
        return <PerfilSection onLogout={onLogout} />
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
      {/* Sub-barra lateral: vertical en escritorio, píldoras desplazables en móvil */}
      <nav
        aria-label="Secciones del sistema"
        className="xl:sticky xl:top-6 xl:self-start"
      >
        <ul className="card stagger flex gap-1.5 overflow-x-auto p-2 xl:flex-col xl:overflow-visible xl:p-3">
          {sections.map(s => {
            const Icon = s.icon
            const active = s.id === current.id
            return (
              <li key={s.id} className="shrink-0 xl:shrink">
                <button
                  type="button"
                  onClick={() => onSectionChange(s.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all duration-300",
                    active
                      ? "bg-gold-soft text-text shadow-[inset_0_0_0_1px_rgb(var(--gold-rgb)/0.3)]"
                      : "text-text-muted hover:bg-surface-3 hover:text-text"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[1.1rem] shrink-0 transition-all duration-300 group-hover:scale-110",
                      active ? "text-gold" : "text-text-faint group-hover:text-gold"
                    )}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {s.label}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mono mt-3 hidden px-3 text-xs text-text-faint xl:block">v{__APP_VERSION__}</p>
      </nav>

      <div key={current.id} className="animate-slideInUp min-w-0">
        <header className="mb-5 flex items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gold-soft ring-1 ring-gold/25">
            <CurrentIcon className="size-5 text-gold" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold leading-tight text-text">{current.title}</h2>
            <p className="mt-0.5 text-sm text-text-muted">{current.description}</p>
          </div>
        </header>
        <Suspense fallback={<div className="skeleton h-72" aria-busy="true" />}>{renderSection()}</Suspense>
      </div>
    </div>
  )
}
