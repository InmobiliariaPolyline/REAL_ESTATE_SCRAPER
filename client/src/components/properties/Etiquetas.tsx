import { Images, Sparkles, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EtiquetaVisual, TonoEtiqueta } from "@/lib/propertyTags"

const CLASE: Record<TonoEtiqueta, string> = {
  gold: "badge-gold",
  green: "badge-green",
  rose: "badge-rose",
  blue: "badge-blue",
  violet: "badge-violet",
  amber: "badge-amber",
  muted: "badge-muted",
}

/** Insignia con icono y color (tipo de inmueble, estado de la construcción, etc.). */
export function Etiqueta({ visual, className }: { visual: EtiquetaVisual; className?: string }) {
  const Icono = visual.icono
  return (
    <span className={cn("badge", CLASE[visual.tono], className)}>
      <Icono className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {visual.label}
    </span>
  )
}

/** Insignia sobre una foto: fondo oscuro translúcido para que se lea con cualquier imagen. */
export function ChipFoto({ icono: Icono, children, acento, titulo, className }: { icono: LucideIcon; children: React.ReactNode; acento?: boolean; titulo?: string; className?: string }) {
  return (
    <span
      title={titulo}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold backdrop-blur-md",
        acento ? "bg-gold text-[#10131a]" : "bg-black/60 text-white",
        className
      )}
    >
      <Icono className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** «Nuevo»: el aviso entró al sistema hace poco. */
export const ChipNuevo = () => <ChipFoto icono={Sparkles} acento titulo="Entró al sistema en los últimos 3 días">Nuevo</ChipFoto>

/** Cantidad de fotos del aviso. */
export const ChipFotos = ({ cantidad }: { cantidad: number }) => (
  <ChipFoto icono={Images} titulo={`${cantidad} fotos`}>
    {cantidad}
  </ChipFoto>
)
