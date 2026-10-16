import { Clock, LogOut } from "lucide-react"
import { trapFocus } from "@/lib/focusTrap"

interface IdleWarningModalProps {
  secondsLeft: number
  onStay: () => void
  onLogout: () => void
}

/** Aviso previo al cierre de sesión por inactividad, con cuenta atrás. */
export default function IdleWarningModal({ secondsLeft, onStay, onLogout }: IdleWarningModalProps) {
  return (
    <div
      className="animate-fadeIn fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        ref={trapFocus}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-desc"
        className="animate-popIn card w-full max-w-sm p-6 text-center shadow-2xl"
      >
        <span className="relative mx-auto inline-flex size-14 items-center justify-center rounded-full bg-amber/10 text-amber ring-1 ring-amber/30">
          <span className="radar-ring absolute inset-0 rounded-full ring-1 ring-amber/40" aria-hidden="true" />
          <Clock className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h3 id="idle-title" className="mt-4 text-lg font-semibold text-text">
          ¿Sigues ahí?
        </h3>
        <p id="idle-desc" className="mt-1.5 text-sm text-text-muted">
          Por seguridad, cerraremos tu sesión por inactividad en{" "}
          <strong className="mono text-base font-semibold text-amber" aria-live="polite">
            {secondsLeft} s
          </strong>
          .
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button onClick={onStay} className="btn btn-primary flex-1">
            Seguir conectado
          </button>
          <button onClick={onLogout} className="btn btn-ghost flex-1">
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
