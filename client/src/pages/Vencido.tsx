import { LogOut, Lock, MessageCircle } from "lucide-react"
import Logo from "@/components/common/Logo"
import WhatsAppFab from "@/components/common/WhatsAppFab"
import type { VencidoMotivo } from "@/lib/auth"
import { whatsappLink } from "@/lib/whatsapp"

interface VencidoProps {
  motivo?: VencidoMotivo
  onLogout: () => void
}

export default function Vencido({ motivo = "vencida", onLogout }: VencidoProps) {
  const sinPlan = motivo === "sin_suscripcion"

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Logo className="mb-10" />

      <div className="animate-slideInUp card w-full max-w-md p-8 text-center sm:p-10">
        <span className="mx-auto mb-6 inline-flex size-16 items-center justify-center rounded-3xl bg-gold-soft ring-1 ring-gold/30">
          <Lock className="size-7 text-gold" strokeWidth={1.5} />
        </span>

        <h1 className="font-display text-4xl font-semibold leading-tight text-text">
          {sinPlan ? "No tienes una suscripción activa" : "Tu suscripción ha vencido"}
        </h1>

        <p className="mt-3 text-sm text-text-muted">
          {sinPlan
            ? "Contacta al administrador para activar tu acceso."
            : "Contacta al administrador para renovar tu acceso."}
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={whatsappLink(
              sinPlan
                ? "Hola, quiero activar mi suscripción en Real Estate Scraper"
                : "Hola, quiero renovar mi suscripción en Real Estate Scraper"
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-lg btn-block bg-[#25d366] text-[#04210f] font-semibold hover:brightness-105"
          >
            <MessageCircle className="size-5" />
            {sinPlan ? "Activar por WhatsApp" : "Renovar por WhatsApp"}
          </a>

          <button onClick={onLogout} className="btn btn-secondary btn-lg btn-block">
            <LogOut className="size-4" />
            Cerrar sesión
          </button>
        </div>
      </div>

      <WhatsAppFab />
    </div>
  )
}
