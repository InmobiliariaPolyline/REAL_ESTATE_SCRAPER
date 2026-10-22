// Función programada de Netlify: cada semana pide a Apify una tanda de avisos, SIEMPRE que la
// carga automática esté activada y queden avisos en el tope mensual (ver Sistema → Carga de datos).
// Si está pausada o sin cupo, no hace nada y no genera ningún costo.

import { iniciarCargaTodas } from "../../api/carga"
import { createNeonDb } from "../../api/db"
import type { ApiEnv } from "../../api/env"

export default async () => {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("carga-semanal: DATABASE_URL no está configurada")
    return
  }
  try {
    const r = await iniciarCargaTodas(createNeonDb(url), process.env as ApiEnv, "programada", null)
    console.log("carga-semanal:", JSON.stringify(r.map(t => (t.resultado.ok ? { fuente: t.fuente, ok: true, items: t.resultado.items } : { fuente: t.fuente, ...t.resultado }))))
  } catch (err) {
    console.error("carga-semanal falló:", err)
  }
}

// Lunes y jueves a las 14:00 UTC (09:00 en Lima); cada vez carga todas las fuentes, cada una con su tope.
export const config = { schedule: "0 14 * * 1,4" }
