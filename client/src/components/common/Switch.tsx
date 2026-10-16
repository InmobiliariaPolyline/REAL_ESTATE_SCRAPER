import { cn } from "@/lib/utils"

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Texto accesible (obligatorio: el interruptor no tiene texto visible propio). */
  label: string
  disabled?: boolean
  className?: string
}

/** Interruptor accesible (role="switch") con animación del botón. */
export default function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("switch", className)}
    />
  )
}
