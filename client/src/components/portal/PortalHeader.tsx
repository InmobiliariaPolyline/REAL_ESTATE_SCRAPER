import { CalendarClock, Crown, KeyRound, LogOut, Menu, User } from "lucide-react"
import { useEffect, useState } from "react"
import Avatar from "@/components/common/Avatar"
import Logo from "@/components/common/Logo"
import AccountModal from "@/components/common/AccountModal"
import ThemeToggle from "@/components/common/ThemeToggle"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { PlanType } from "@/types"
import PortalTabs, { BuscadorBoton, type PortalView } from "./PortalTabs"

interface PortalHeaderProps {
  view: PortalView
  onViewChange: (view: PortalView) => void
  usuario: string
  planType: PlanType
  fechaVencimiento: string
  onLogout: () => void
}

function PlanBadge({ planType }: { planType: PlanType }) {
  const premium = planType === "PREMIUM"
  return (
    <span className={premium ? "badge badge-gold" : "badge badge-muted"}>
      {premium && <Crown className="size-3.5" />}
      {premium ? "Premium" : "Gratis"}
    </span>
  )
}

export default function PortalHeader({
  view,
  onViewChange,
  usuario,
  planType,
  fechaVencimiento,
  onLogout,
}: PortalHeaderProps) {
  const [showPassword, setShowPassword] = useState(false)

  // El buscador global (Ctrl+K) abre "Mi cuenta" mediante este evento.
  useEffect(() => {
    const open = () => setShowPassword(true)
    window.addEventListener("open-account", open)
    return () => window.removeEventListener("open-account", open)
  }, [])

  return (
    <>
    <header className="glass fixed inset-x-0 top-0 z-40 border-b border-line shadow-[0_1px_0_rgb(var(--gold-rgb)/0.12),0_12px_30px_-24px_rgb(0_0_0/0.8)]">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-6 px-4 sm:px-8">
        <Logo />

        {/* Escritorio ancho: las secciones del portal en la propia barra */}
        <PortalTabs view={view} onChange={onViewChange} variant="barra" />

        {/* Escritorio: buscador, plan, cuenta y salida, del más usado al menos usado */}
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <BuscadorBoton />

          <span className="h-6 w-px bg-line" />

          <span className="flex items-center gap-2" title={`Tu plan vence el ${fechaVencimiento}`}>
            <PlanBadge planType={planType} />
            <span className="hidden items-center gap-1.5 text-xs text-text-muted 2xl:flex">
              <CalendarClock className="size-3.5 text-text-faint" aria-hidden="true" />
              Vence <strong className="mono font-medium text-text">{fechaVencimiento}</strong>
            </span>
          </span>

          <button
            onClick={() => setShowPassword(true)}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1 transition hover:bg-surface-3"
            title="Mi cuenta: contraseña y sesiones"
          >
            <Avatar name={usuario} size="sm" />
            <span className="hidden text-sm font-medium text-text xl:inline">{usuario}</span>
          </button>

          <ThemeToggle className="btn-sm" />

          <button onClick={onLogout} className="btn btn-secondary btn-sm btn-icon" aria-label="Cerrar sesión" title="Cerrar sesión">
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Móvil */}
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <PlanBadge planType={planType} />
          <Sheet>
            <SheetTrigger asChild>
              <button aria-label="Abrir menú" className="btn btn-secondary btn-icon">
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[300px] flex-col justify-between border-l border-line bg-surface-1 p-6"
            >
              <div className="space-y-6">
                <SheetHeader className="p-0 text-left">
                  <SheetTitle asChild>
                    <div>
                      <Logo />
                    </div>
                  </SheetTitle>
                </SheetHeader>

                <div className="space-y-4 border-t border-line pt-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={usuario} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs text-text-muted">
                        <User className="size-3.5" /> Usuario
                      </p>
                      <p className="truncate text-base font-semibold text-text">{usuario}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-surface-2 p-4">
                    <p className="text-xs text-text-muted">Vence el plan</p>
                    <p className="mono mt-1 text-base font-semibold text-gold">{fechaVencimiento}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setShowPassword(true)}
                  className="btn btn-secondary btn-lg btn-block"
                >
                  <KeyRound className="size-4" />
                  Mi cuenta
                </button>
                <ThemeToggle withLabel className="btn-secondary btn-lg btn-block justify-center" />
                <button onClick={onLogout} className="btn btn-secondary btn-lg btn-block">
                  <LogOut className="size-4" />
                  Cerrar sesión
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>

    {/* Fuera del <header>: su backdrop-filter rompería el posicionamiento `fixed` del modal. */}
    {showPassword && <AccountModal usuario={usuario} onClose={() => setShowPassword(false)} />}
    </>
  )
}
