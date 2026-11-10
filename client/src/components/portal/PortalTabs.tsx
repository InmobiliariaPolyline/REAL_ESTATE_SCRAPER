import { Calculator, Home, LayoutGrid, Search, TrendingUp, UserCog, type LucideIcon } from "lucide-react"
import { openCommandPalette } from "@/components/common/CommandPalette"
import { cn } from "@/lib/utils"

export type PortalView = "inicio" | "catalogo" | "estadisticas" | "calculadora" | "cuenta"

const TABS: { id: PortalView; label: string; icon: LucideIcon }[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "catalogo", label: "Catálogo", icon: LayoutGrid },
  { id: "estadisticas", label: "Estadísticas", icon: TrendingUp },
  { id: "calculadora", label: "Calculadora", icon: Calculator },
  { id: "cuenta", label: "Cuenta", icon: UserCog },
]

interface PortalTabsProps {
  view: PortalView
  onChange: (view: PortalView) => void
  /** `barra`: pestañas con subrayado dentro de la cabecera (escritorio). `segmentado`: fila desplazable (pantallas chicas). */
  variant?: "barra" | "segmentado"
}

/** Secciones del portal. En escritorio viven en la barra superior; en pantallas chicas, en una fila bajo ella. */
export default function PortalTabs({ view, onChange, variant = "segmentado" }: PortalTabsProps) {
  if (variant === "barra") {
    return (
      <nav aria-label="Secciones del portal" role="tablist" className="hidden h-full items-stretch gap-1 lg:flex">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative inline-flex items-center gap-2 px-3.5 text-sm font-medium transition-colors",
                "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-all",
                active ? "text-text after:bg-gold" : "text-text-muted after:bg-transparent hover:text-text hover:after:bg-line-strong"
              )}
            >
              <Icon className={cn("size-4", active && "text-gold")} aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="mb-6 flex items-center gap-3 lg:hidden">
      <nav aria-label="Secciones del portal" className="segmented max-w-full overflow-x-auto" role="tablist">
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
    </div>
  )
}

/** Botón del buscador global (Ctrl K), para la barra superior. */
export function BuscadorBoton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCommandPalette} className={cn("btn btn-secondary btn-sm", className)} aria-label="Abrir el buscador global">
      <Search className="size-3.5" aria-hidden="true" />
      <span className="hidden xl:inline">Buscar</span>
      <kbd className="mono hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] text-text-muted xl:inline">Ctrl K</kbd>
    </button>
  )
}
