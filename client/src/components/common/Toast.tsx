import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToastMessage {
  id: string
  mensaje: string
  tipo: "success" | "error" | "info"
}

interface ToastProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

const STYLES = {
  success: { icon: CheckCircle2, tone: "text-green", bar: "bg-green" },
  error: { icon: AlertCircle, tone: "text-rose", bar: "bg-rose" },
  info: { icon: Info, tone: "text-blue", bar: "bg-blue" },
} as const

export function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2.5"
      aria-live="polite"
    >
      {toasts.map(toast => {
        const s = STYLES[toast.tipo]
        const Icon = s.icon
        return (
          <div
            key={toast.id}
            role={toast.tipo === "error" ? "alert" : "status"}
            className="animate-popIn pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-line-strong bg-surface-2/95 py-3 pl-5 pr-3 shadow-2xl backdrop-blur-md"
          >
            <span className={cn("absolute inset-y-0 left-0 w-1", s.bar)} />
            <Icon className={cn("mt-0.5 size-5 shrink-0", s.tone)} strokeWidth={1.75} />
            <p className="min-w-0 flex-1 text-sm leading-snug text-text">{toast.mensaje}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className="rounded-lg p-1 text-text-faint transition hover:bg-surface-3 hover:text-text"
              aria-label="Cerrar notificación"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
