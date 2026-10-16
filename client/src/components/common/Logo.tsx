import { cn } from "@/lib/utils"

interface LogoProps {
  /** Muestra solo el isotipo (barra lateral colapsada, móviles). */
  compact?: boolean
  className?: string
}

/** Marca: isotipo original + nombre en Cormorant Garamond. */
export default function Logo({ compact = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src="/logo.png"
        alt="REAL ESTATE SCRAPER"
        className="size-9 rounded-xl object-contain bg-white/95 p-0.5"
        decoding="async"
      />
      {!compact && (
        <span className="font-display text-[1.35rem] font-semibold leading-none tracking-wide text-gold">
          REAL ESTATE
          <span className="block text-[0.8rem] font-medium tracking-[0.32em] text-text-muted mt-1">
            SCRAPER
          </span>
        </span>
      )}
    </div>
  )
}
