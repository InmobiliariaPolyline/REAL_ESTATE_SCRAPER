import { Calculator, Home, LayoutGrid, Search, TrendingUp, UserCog, type LucideIcon } from "lucide-react"
import { openCommandPalette } from "@/components/common/CommandPalette"
import { cn } from "@/lib/utils"

export type PortalView = "inicio" | "catalogo" | "estadisticas" | "calculadora" | "cuenta"

export const PORTAL_TABS: { id: PortalView; label: string; icon: LucideIcon }[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "catalogo", label: "Catálogo", icon: LayoutGrid },
  { id: "estadisticas", label: "Estadísticas", icon: TrendingUp },
  { id: "calculadora", label: "Calculadora", icon: Calculator },
  { id: "cuenta", label: "Cuenta", icon: UserCog },
]

interface PortalTabsProps {
  view: PortalView
  onChange: (view: PortalView) => void
}

/** Secciones del portal en pantallas chicas (en escritorio viven en la barra lateral). */
export default function PortalTabs({ view, onChange }: PortalTabsProps) {
  return (
    <div className="mb-6 flex items-center gap-3 lg:hidden">
      <nav aria-label="Secciones del portal" className="segmented max-w-full overflow-x-auto" role="tablist">
        {PORTAL_TABS.map(tab => {
          const Icon = tab.icon
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn("segmented-option !h-9 shrink-0 !px-3.5")}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/** Campo de búsqueda global (abre el buscador Ctrl K); en la cabecera de escritorio. */
export function BuscadorCampo({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Abrir el buscador global"
      className={cn(
        "flex h-10 w-full max-w-sm items-center gap-2.5 rounded-xl border border-line-strong bg-surface-1 px-3.5 text-left text-sm text-text-faint transition hover:border-gold/40 hover:text-text-muted",
        className
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">Buscar propiedades, distritos, acciones…</span>
      <kbd className="mono hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] text-text-muted sm:inline">Ctrl K</kbd>
    </button>
  )
}
