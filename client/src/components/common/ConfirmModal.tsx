import { AlertTriangle, Info } from "lucide-react"
import { useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { trapFocus } from '@/lib/focusTrap'

interface ConfirmModalProps {
  title: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Texto del botón de confirmar mientras `busy` es true. */
  busyLabel?: string
  busy?: boolean
  /** Color del botón principal. */
  tone?: "gold" | "danger"
  onConfirm: () => void
  onCancel: () => void
}

/** Diálogo de confirmación reutilizable (cierra con clic fuera o con Escape). */
export default function ConfirmModal({
  title,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  busyLabel = "Procesando...",
  busy = false,
  tone = "gold",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onCancel])

  const danger = tone === "danger"
  const Icon = danger ? AlertTriangle : Info

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        ref={trapFocus}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-popIn card w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex gap-4">
          <span
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1",
              danger ? "bg-rose/10 text-rose ring-rose/25" : "bg-gold-soft text-gold ring-gold/25"
            )}
          >
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-snug text-text">{title}</h3>
            {children && <div className="mt-2 text-sm text-text-muted">{children}</div>}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="btn btn-ghost">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={cn("btn", danger ? "btn-danger" : "btn-primary")}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
