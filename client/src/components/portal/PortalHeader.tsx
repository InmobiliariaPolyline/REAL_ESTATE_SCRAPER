import { CalendarClock, Crown, KeyRound, LogOut, Menu, User } from "lucide-react"
import { useState } from "react"
import Avatar from "@/components/common/Avatar"
import Logo from "@/components/common/Logo"
import PasswordModal from "@/components/common/PasswordModal"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { PlanType } from "@/types"

interface PortalHeaderProps {
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
  usuario,
  planType,
  fechaVencimiento,
  onLogout,
}: PortalHeaderProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-surface-1/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-8">
        <Logo />

        {/* Escritorio */}
        <div className="hidden items-center gap-5 md:flex">
          <PlanBadge planType={planType} />
          <span className="flex items-center gap-2 text-sm text-text-muted">
            <CalendarClock className="size-4 text-text-faint" />
            Vence <strong className="mono font-medium text-text">{fechaVencimiento}</strong>
          </span>

          <span className="h-6 w-px bg-line" />

          <button
            onClick={() => setShowPassword(true)}
            className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-surface-3"
            title="Cambiar mi contraseña"
          >
            <Avatar name={usuario} size="sm" />
            <span className="text-sm font-medium text-text">{usuario}</span>
            <KeyRound className="size-3.5 text-text-faint" />
          </button>

          <button onClick={onLogout} className="btn btn-secondary btn-sm">
            <LogOut className="size-4" />
            Cerrar sesión
          </button>
        </div>

        {/* Móvil */}
        <div className="flex items-center gap-2 md:hidden">
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
                  Cambiar contraseña
                </button>
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
    {showPassword && <PasswordModal mode="self" onClose={() => setShowPassword(false)} />}
    </>
  )
}
