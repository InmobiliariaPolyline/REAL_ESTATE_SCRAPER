import { passwordStrength } from "@/lib/passwordStrength"
import { cn } from "@/lib/utils"

const COLORS = ["", "bg-rose", "bg-amber", "bg-gold", "bg-green"] as const
const TEXT = ["", "text-rose", "text-amber", "text-gold", "text-green"] as const

/** Barra de 4 segmentos que se llena con transición suave según la fortaleza. */
export default function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password)
  if (!password) return null

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map(i => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 origin-left rounded-full transition-all duration-500 ease-out",
              i <= score ? cn(COLORS[score], "scale-x-100") : "scale-x-100 bg-surface-4"
            )}
          />
        ))}
      </div>
      <p className={cn("mt-1.5 text-xs font-medium transition-colors", TEXT[score])}>
        Seguridad: {label}
      </p>
    </div>
  )
}
