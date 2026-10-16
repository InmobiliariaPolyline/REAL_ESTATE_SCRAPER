import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
  /** Muestra la etiqueta junto al icono (para la barra lateral). */
  withLabel?: boolean
}

/** Botón para alternar entre tema claro y oscuro. */
export default function ThemeToggle({ className, withLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  if (!toggleTheme) return null

  const toLight = theme === "dark"
  const label = toLight ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
  const Icon = toLight ? Sun : Moon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn("btn btn-ghost", withLabel ? "justify-start" : "btn-icon", className)}
    >
      <Icon className="size-4" aria-hidden="true" />
      {withLabel && (toLight ? "Tema claro" : "Tema oscuro")}
    </button>
  )
}
