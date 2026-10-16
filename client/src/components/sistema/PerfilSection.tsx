import {
  Bookmark,
  CalendarClock,
  Crown,
  Heart,
  History,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { useEffect, useState } from "react"
import AnimatedNumber from "@/components/common/AnimatedNumber"
import Avatar from "@/components/common/Avatar"
import ProgressRing from "@/components/common/ProgressRing"
import StatCard from "@/components/common/StatCard"
import { useToast } from "@/contexts/ToastContext"
import { timeAgo } from "@/lib/account"
import { formatDate } from "@/lib/dates"
import { fetchProfile, fraccionRestante, type Perfil } from "@/lib/profile"
import { cn } from "@/lib/utils"

interface PerfilSectionProps {
  onLogout: () => void
}

export default function PerfilSection({ onLogout }: PerfilSectionProps) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  useEffect(() => {
    fetchProfile()
      .then(setPerfil)
      .catch(err => {
        console.error(err)
        addToast("No se pudo cargar tu perfil", "error")
      })
      .finally(() => setLoading(false))
  }, [addToast])

  const esAdmin = perfil?.rol === "admin"
  const sub = perfil?.suscripcion ?? null
  const vencida = sub !== null && sub.dias_restantes < 0
  const porVencer = sub !== null && sub.dias_restantes >= 0 && sub.dias_restantes <= 7

  return (
    <div className="space-y-6">
      {/* Cabecera del perfil */}
      <section className="card sheen relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span className="animate-float">
            <Avatar name={perfil?.usuario ?? "…"} size="xl" />
          </span>
          <div className="min-w-0 flex-1">
            {loading ? (
              <>
                <div className="skeleton h-8 w-48" />
                <div className="skeleton mt-3 h-4 w-64" />
              </>
            ) : (
              <>
                <h2 className="font-display text-3xl font-semibold text-text">{perfil?.usuario}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={esAdmin ? "badge badge-gold" : "badge badge-blue"}>
                    {esAdmin ? <ShieldCheck className="size-3.5" aria-hidden="true" /> : <UserRound className="size-3.5" aria-hidden="true" />}
                    {esAdmin ? "Administrador" : "Cliente"}
                  </span>
                  <span className="badge badge-green">
                    <span className="live-dot" aria-hidden="true" />
                    {perfil?.estado === "activo" ? "Cuenta activa" : perfil?.estado}
                  </span>
                </div>
                <p className="mt-3 text-sm text-text-muted">
                  Miembro desde <strong className="font-medium text-text">{perfil ? formatDate(perfil.creado_en) : ""}</strong>
                  {perfil?.acceso_anterior && (
                    <>
                      {" · "}último acceso <strong className="font-medium text-text">{timeAgo(perfil.acceso_anterior)}</strong>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
          <button onClick={onLogout} className="btn btn-secondary">
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </section>

      {/* Cifras */}
      <div className="stagger grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accesos (30 días)"
          icon={History}
          tone="gold"
          loading={loading}
          value={<AnimatedNumber value={perfil?.accesos_30d ?? 0} />}
          hint={perfil ? `${perfil.accesos_total.toLocaleString("es-PE")} en total` : undefined}
        />
        <StatCard
          label="Sesiones activas"
          icon={MonitorSmartphone}
          tone="blue"
          loading={loading}
          value={<AnimatedNumber value={perfil?.sesiones_activas ?? 0} />}
          hint="dispositivos con tu sesión abierta"
        />
        <StatCard
          label="Favoritos"
          icon={Heart}
          tone="rose"
          loading={loading}
          value={<AnimatedNumber value={perfil?.favoritos ?? 0} />}
        />
        <StatCard
          label="Búsquedas guardadas"
          icon={Bookmark}
          tone="violet"
          loading={loading}
          value={<AnimatedNumber value={perfil?.busquedas ?? 0} />}
        />
      </div>

      {/* Plan */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text">
          <Crown className="size-4 text-gold" aria-hidden="true" />
          {esAdmin ? "Acceso de administración" : "Tu plan"}
        </h2>

        {loading ? (
          <div className="skeleton mt-4 h-36" />
        ) : esAdmin ? (
          <p className="mt-3 flex items-start gap-3 text-sm text-text-muted">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
            Las cuentas de administración no tienen vencimiento. Tienen acceso a todos los módulos,
            incluida la auditoría y la gestión de usuarios.
          </p>
        ) : sub ? (
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <ProgressRing
              value={fraccionRestante(sub)}
              className={cn(vencida ? "text-rose" : porVencer ? "text-amber" : "text-gold")}
              label={`${Math.max(0, sub.dias_restantes)} días restantes de ${sub.dias_totales}`}
            >
              <span className="mono text-3xl font-semibold leading-none text-text">
                <AnimatedNumber value={Math.max(0, sub.dias_restantes)} />
              </span>
              <span className="mt-1 text-[0.6875rem] uppercase tracking-wider text-text-muted">días</span>
            </ProgressRing>

            <dl className="grid flex-1 grid-cols-2 gap-4 sm:max-w-md">
              <div className="rounded-2xl bg-surface-3 p-4">
                <dt className="text-xs text-text-muted">Inicio</dt>
                <dd className="mono mt-1 text-base font-semibold text-text">{formatDate(sub.fecha_inicio)}</dd>
              </div>
              <div className="rounded-2xl bg-surface-3 p-4">
                <dt className="flex items-center gap-1 text-xs text-text-muted">
                  <CalendarClock className="size-3" aria-hidden="true" /> Vencimiento
                </dt>
                <dd className="mono mt-1 text-base font-semibold text-text">{formatDate(sub.fecha_vencimiento)}</dd>
              </div>
              <p
                className={cn(
                  "col-span-2 text-sm",
                  vencida ? "text-rose" : porVencer ? "text-amber" : "text-text-muted"
                )}
              >
                {vencida
                  ? "Tu suscripción venció. Contacta al administrador para renovarla."
                  : porVencer
                    ? "Tu suscripción vence pronto: avisa al administrador para renovarla a tiempo."
                    : "Tu suscripción está al día."}
              </p>
            </dl>
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-muted">No tienes un plan activo. Contacta al administrador.</p>
        )}
      </section>
    </div>
  )
}
