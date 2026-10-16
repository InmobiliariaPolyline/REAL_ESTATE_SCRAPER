// Función programada de Netlify: vigila que el scraper siga cargando avisos y, si no, envía una
// alerta al webhook (ALERT_WEBHOOK_URL). Se ejecuta cada 6 horas; el umbral y el destino se
// configuran con ALERT_STALE_HOURS y ALERT_WEBHOOK_URL (ver README).

import { createNeonDb } from "../../api/db"
import type { ApiEnv } from "../../api/env"
import { runWatchdog } from "../../api/watchdog"

export default async () => {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("scraper-watchdog: DATABASE_URL no está configurada")
    return
  }
  try {
    const result = await runWatchdog(createNeonDb(url), process.env as ApiEnv)
    console.log("scraper-watchdog:", JSON.stringify(result))
  } catch (err) {
    console.error("scraper-watchdog falló:", err)
  }
}

export const config = { schedule: "0 */6 * * *" }
