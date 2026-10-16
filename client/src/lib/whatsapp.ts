import { ADMIN_WHATSAPP } from "./config"

/** Enlace de WhatsApp al administrador con el mensaje correctamente codificado. */
export function whatsappLink(message: string): string {
  return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`
}
