import { Calculator, Home, LayoutGrid, Search, TrendingUp, type LucideIcon } from "lucide-react"
import { openCommandPalette } from "@/components/common/CommandPalette"
import { cn } from "@/lib/utils"

export type PortalView = "inicio" | "catalogo" | "estadisticas" | "calculadora"

const TABS: { id: PortalView; label: string; icon: LucideIcon }[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "catalogo", label: "Catálogo", icon: LayoutGrid },
  { id: "estadisticas", label: "Estadísticas", icon: TrendingUp },
  { id: "calculadora", label: "Calculadora", icon: Calculator },
]

interface PortalTabsProps {
  view: PortalView
  onChange: (view: PortalView) => void
}

/** Barra de secciones del portal, con el acceso al buscador global (Ctrl+K). */
export default function PortalTabs({ view, onChange }: PortalTabsProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label="Secciones del portal"
        className="segmented max-w-full overflow-x-auto"
        role="tablist"
      >
        {TABS.map(tab => {
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

      <button
        type="button"
        onClick={openCommandPalette}
        className="btn btn-secondary btn-sm hidden sm:inline-flex"
        aria-label="Abrir el buscador global"
      >
        <Search className="size-3.5" aria-hidden="true" />
        Buscar
        <kbd className="mono rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] text-text-muted">
          Ctrl K
        </kbd>
      </button>
    </div>
  )
}
