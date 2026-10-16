import { Lock } from "lucide-react"
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
    <div
      className="flex h-screen items-center justify-center"
      style={{ backgroundColor: "#0F0F0F" }}
    >
      <div className="text-center max-w-md px-4">
        <div className="mb-6 flex justify-center">
          <Lock size={64} style={{ color: "#C9A96E" }} />
        </div>

        <h1
          className="text-4xl font-bold mb-4"
          style={{ fontFamily: "Cormorant Garamond", color: "#C9A96E" }}
        >
          {sinPlan
            ? "No tienes una suscripción activa"
            : "Tu suscripción ha vencido"}
        </h1>

        <p
          className="text-base mb-8"
          style={{ color: "#6B6B6B", fontFamily: "DM Sans" }}
        >
          {sinPlan
            ? "Contacta al administrador para activar tu acceso."
            : "Contacta al administrador para renovar tu acceso."}
        </p>

        <a
          href={whatsappLink(
            sinPlan
              ? "Hola, quiero activar mi suscripción en Real Estate Scraper"
              : "Hola, quiero renovar mi suscripción en Real Estate Scraper"
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-3 rounded text-white font-semibold mb-6"
          style={{ backgroundColor: "#22C55E", fontFamily: "DM Sans" }}
        >
          {sinPlan ? "Activar por WhatsApp" : "Renovar por WhatsApp"}
        </a>

        <button
          onClick={onLogout}
          className="block w-full px-8 py-3 border rounded text-sm font-medium"
          style={{
            borderColor: "#C9A96E",
            color: "#C9A96E",
            fontFamily: "DM Sans",
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <WhatsAppFab />
    </div>
  )
}
