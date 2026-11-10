// Función programada de Netlify: cada hora copia a Cloudinary una tanda de portadas que aún apuntan al
// portal de origen (ver api/imagenes.ts). Sin CLOUDINARY_URL no hace nada.

import { createNeonDb } from "../../api/db"
import type { ApiEnv } from "../../api/env"
import { copiarPortadas } from "../../api/imagenes"

export default async () => {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("copiar-portadas: DATABASE_URL no está configurada")
    return
  }
  try {
    console.log("copiar-portadas:", JSON.stringify(await copiarPortadas(createNeonDb(url), process.env as ApiEnv)))
  } catch (err) {
    console.error("copiar-portadas falló:", err)
  }
}

export const config = { schedule: "15 * * * *" }
