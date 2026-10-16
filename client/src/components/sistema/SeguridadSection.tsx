import {
  CheckCircle2,
  KeyRound,
  Lightbulb,
  LockKeyhole,
  MonitorSmartphone,
  ScrollText,
  ShieldCheck,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { SessionsPanel } from "@/components/common/AccountModal"
import PasswordForm from "@/components/common/PasswordForm"
import { IDLE_TIMEOUT_MS } from "@/lib/config"
import { cn } from "@/lib/utils"

interface SeguridadSectionProps {
  /** Solo el administrador: atajo a la auditoría. */
  onOpenAudit?: () => void
}

interface Control {
  icon: LucideIcon
  titulo: string
  detalle: string
  ok: boolean
}

const CONSEJOS = [
  "Usa una contraseña única de al menos 12 caracteres, con letras, números y símbolos.",
  "No compartas tu usuario: cada persona debe tener el suyo.",
  "Si no reconoces un dispositivo en tus sesiones, ciérralo y cambia la contraseña.",
  "Cierra sesión al terminar en equipos compartidos o públicos.",
]

export default function SeguridadSection({ onOpenAudit }: SeguridadSectionProps) {
  // Cambiar la key reinicia el formulario tras guardar o limpiar.
  const [formKey, setFormKey] = useState(0)
  const reiniciar = () => setFormKey(k => k + 1)

  const https = typeof location !== "undefined" && (location.protocol === "https:" || location.hostname === "localhost")
  const minutos = Math.round(IDLE_TIMEOUT_MS / 60000)

  const controles: Control[] = [
    {
      icon: LockKeyhole,
      titulo: "Conexión cifrada",
      detalle: https ? "Estás navegando por una conexión segura (HTTPS)." : "La conexión no está cifrada. Evita iniciar sesión aquí.",
      ok: https,
    },
    {
      icon: Timer,
      titulo: "Cierre por inactividad",
      detalle: `La sesión se cierra tras ${minutos} minutos sin actividad, con un aviso previo.`,
      ok: true,
    },
    {
      icon: MonitorSmartphone,
      titulo: "Sesión por pestaña",
      detalle: "Al cerrar la pestaña o la ventana tendrás que volver a iniciar sesión.",
      ok: true,
    },
    {
      icon: KeyRound,
      titulo: "Contraseña protegida",
      detalle: "Se guarda cifrada con bcrypt y se bloquea el acceso tras 5 intentos fallidos.",
      ok: true,
    },
  ]
  const todoOk = controles.every(c => c.ok)

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <ShieldCheck className="size-4 text-gold" aria-hidden="true" />
            Estado de seguridad
          </h2>
          <span className={cn("badge", todoOk ? "badge-green" : "badge-rose")}>
            {todoOk ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <TriangleAlert className="size-3.5" aria-hidden="true" />}
            {todoOk ? "Todo en orden" : "Requiere atención"}
          </span>
        </div>

        <ul className="stagger mt-4 grid gap-3 md:grid-cols-2">
          {controles.map(c => {
            const Icon = c.icon
            return (
              <li key={c.titulo} className="flex items-start gap-3 rounded-2xl border border-line bg-surface-1 p-4">
                <span
                  className={cn(
                    "inline-flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
                    c.ok ? "bg-green/10 text-green ring-green/25" : "bg-rose/10 text-rose ring-rose/25"
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{c.titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{c.detalle}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <KeyRound className="size-4 text-gold" aria-hidden="true" />
            Cambiar contraseña
          </h2>
          <p className="mb-5 mt-1 text-sm text-text-muted">
            Al cambiarla se cierran tus demás sesiones.
          </p>
          <PasswordForm key={formKey} mode="self" onDone={reiniciar} onCancel={reiniciar} cancelLabel="Limpiar" />
        </section>

        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text">
            <MonitorSmartphone className="size-4 text-gold" aria-hidden="true" />
            Sesiones activas
          </h2>
          <div className="mt-3">
            <SessionsPanel />
          </div>
        </section>
      </div>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text">
          <Lightbulb className="size-4 text-amber" aria-hidden="true" />
          Buenas prácticas
        </h2>
        <ul className="mt-3 grid gap-2.5 md:grid-cols-2">
          {CONSEJOS.map(c => (
            <li key={c} className="flex items-start gap-2.5 text-sm text-text-muted">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
        {onOpenAudit && (
          <button onClick={onOpenAudit} className="btn btn-outline btn-sm mt-5">
            <ScrollText className="size-4" aria-hidden="true" />
            Ver la auditoría de acciones
          </button>
        )}
      </section>
    </div>
  )
}
