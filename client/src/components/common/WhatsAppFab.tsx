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
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </a>
  )
}
