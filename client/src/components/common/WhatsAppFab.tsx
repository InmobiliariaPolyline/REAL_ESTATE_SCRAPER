import { MessageCircle } from "lucide-react"
import { whatsappLink } from "@/lib/whatsapp"

/** Botón flotante de WhatsApp (clase `.wa-button` definida en index.css). */
export default function WhatsAppFab({
  message = "Hola, quiero información sobre Real Estate Scraper",
}: {
  message?: string
}) {
  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className="wa-button"
      title="¿Quieres acceder? Contáctanos"
      aria-label="Contactar al administrador por WhatsApp"
    >
      <MessageCircle className="size-7" strokeWidth={2} />
    </a>
  )
}
