import { cn } from "@/lib/utils"

interface LogoProps {
  /** Muestra solo el isotipo (barra lateral colapsada, móviles). */
  compact?: boolean
  className?: string
}

/** Marca: isotipo original + nombre en Cormorant Garamond. */
export default function Logo({ compact = false, className }: LogoProps) {
  return (
    <div className={cn("group flex items-center gap-3", className)}>
      <img
        src="/logo.png"
        alt="REAL ESTATE SCRAPER"
        className="size-10 rounded-xl bg-white/95 object-contain p-0.5 shadow-[0_8px_22px_-8px_rgb(var(--gold-rgb)/0.6)] transition duration-500 group-hover:-rotate-6 group-hover:scale-110"
        decoding="async"
      />
      {!compact && (
        <span className="font-display whitespace-nowrap text-[1.15rem] font-semibold leading-none tracking-[0.04em] text-gold">
          REAL ESTATE
          <span className="mt-1 block text-[0.7rem] font-medium tracking-[0.34em] text-text-muted">
            SCRAPER
          </span>
        </span>
      )}
    </div>
  )
}
