export interface PortalInfo {
  /** Valor tal como lo guarda el scraper en `propiedades.portal` (minúsculas). */
  key: string
  label: string
  color: string
}

export const PORTALS: PortalInfo[] = [
  { key: "properati", label: "Properati", color: "#3B82F6" },
  { key: "infocasas", label: "Infocasas", color: "#8B5CF6" },
  { key: "babilonia", label: "Babilonia", color: "#F59E0B" },
  { key: "urbania", label: "Urbania", color: "#EC4899" },
  { key: "adondevivir", label: "Adondevivir", color: "#10B981" },
]

const DEFAULT_PORTAL_COLOR = "#60A5FA"

export function getPortalColor(portal: string | null | undefined): string {
  const key = (portal ?? "").toLowerCase().trim()
  return PORTALS.find(p => p.key === key)?.color ?? DEFAULT_PORTAL_COLOR
}

export function getOperacionColor(operacion: string | null | undefined): string {
  return (operacion ?? "").toUpperCase() === "ALQUILER" ? "#22C55E" : "#EF4444"
}
