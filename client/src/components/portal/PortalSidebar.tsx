import { Crown, LogOut } from "lucide-react"
import Logo from "@/components/common/Logo"
import { cn } from "@/lib/utils"
import type { PlanType } from "@/types"
import { PORTAL_TABS, type PortalView } from "./PortalTabs"

interface PortalSidebarProps {
  view: PortalView
  onChange: (view: PortalView) => void
  planType: PlanType
  fechaVencimiento: string
  /** Fecha de vencimiento (AAAA-MM-DD) para calcular los días que quedan. */
  venceEn?: string
  onLogout: () => void
}

/** Días que faltan para `iso` (redondeado hacia arriba); `null` si la fecha no es válida. */
export function diasHasta(iso: string | undefined, ahora = Date.now()): number | null {
  if (!iso) return null
  const t = Date.parse(iso.length <= 10 ? `${iso}T23:59:59` : iso)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.ceil((t - ahora) / 86_400_000))
}

/** Barra lateral del portal (escritorio): marca, secciones y estado del plan. */
export default function PortalSidebar({ view, onChange, planType, fechaVencimiento, venceEn, onLogout }: PortalSidebarProps) {
  const premium = planType === "PREMIUM"
  const dias = diasHasta(venceEn)
  // La barra muestra cuánto del último año de plan queda; con menos de 30 días se pone en alerta.
  const fraccion = dias === null ? 0 : Math.min(1, dias / 365)
  const porVencer = dias !== null && dias <= 30

  return (
    <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line px-4 py-5 lg:flex" aria-label="Navegación del portal">
      <div className="px-2 pb-6">
        <Logo />
      </div>

      <p className="label-mono px-3 pb-2">Navegación</p>
      <nav className="flex flex-col gap-1" role="tablist" aria-label="Secciones del portal" aria-orientation="vertical">
        {PORTAL_TABS.map(tab => {
          const Icon = tab.icon
          const activa = view === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activa}
              aria-current={activa ? "page" : undefined}
              onClick={() => onChange(tab.id)}
              className="nav-item"
            >
              <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {/* Estado del plan: tarjeta con barra de tiempo restante */}
        <div className={cn("card card-edge halo p-4", porVencer && "border-amber/40")}>
          <p className="flex items-center gap-2 text-sm font-semibold text-text">
            {premium && <Crown className="size-4 text-gold" aria-hidden="true" />}
            {premium ? "Plan Premium" : "Plan gratuito"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {dias !== null ? (
              <>
                {dias === 0 ? "Vence hoy" : `${dias} ${dias === 1 ? "día" : "días"} restantes`} · <span className="mono">{fechaVencimiento}</span>
              </>
            ) : (
              <>Vence <span className="mono">{fechaVencimiento}</span></>
            )}
          </p>
          {dias !== null && (
            <div className="bar mt-3" role="img" aria-label={`${dias} días restantes del plan`}>
              <span style={{ width: `${Math.max(4, fraccion * 100)}%` }} />
            </div>
          )}
        </div>

        <button onClick={onLogout} className="nav-item" title="Cerrar sesión">
          <LogOut className="size-[1.125rem] shrink-0" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
