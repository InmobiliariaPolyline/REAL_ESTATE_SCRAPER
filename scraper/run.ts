// Corrida del scraper: ejecuta cada fuente y guarda los avisos en Neon.
//
//   pnpm scraper            (necesita DATABASE_URL; opcional USD_TO_PEN_RATE)
//
// Lo lanza el workflow .github/workflows/scraper.yml (a mano o desde "Forzar scraper").

import pg from "pg"
import { DEFAULT_USD_TO_PEN_RATE } from "../shared/constants"
import { guardarAvisos, type Aviso } from "./ingest"
import { FUENTES } from "./sources"

try {
  process.loadEnvFile()
} catch {
  /* sin .env: se usa el entorno */
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error("Falta DATABASE_URL.")
  process.exit(1)
}
const rate = Number(process.env.USD_TO_PEN_RATE)
const usdToPen = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_PEN_RATE

if (FUENTES.length === 0) {
  console.log("No hay fuentes configuradas (scraper/sources/index.ts): no se descargó ningún aviso.")
  process.exit(0)
}

// Neon despierta el cómputo al primer intento: se reintenta con espera creciente.
async function conectar(): Promise<pg.Client> {
  for (let intento = 1; ; intento++) {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 })
    try {
      await client.connect()
      return client
    } catch (err) {
      await client.end().catch(() => {})
      if (intento >= 3) throw err
      await new Promise(r => setTimeout(r, 3000 * intento))
    }
  }
}

const avisos: Aviso[] = []
let fallidas = 0
for (const fuente of FUENTES) {
  try {
    const lote = await fuente.obtener()
    console.log(`${fuente.nombre}: ${lote.length} avisos`)
    avisos.push(...lote)
  } catch (err) {
    fallidas++
    console.error(`${fuente.nombre}: falló (${err instanceof Error ? err.message : String(err)})`)
  }
}

if (avisos.length > 0) {
  const client = await conectar()
  try {
    const { guardados, descartados } = await guardarAvisos(client, avisos, usdToPen)
    console.log(`Guardados: ${guardados}. Descartados por datos inválidos: ${descartados}.`)
  } finally {
    await client.end()
  }
}

// Si todas las fuentes fallaron, la corrida se marca como fallida para que GitHub avise.
if (fallidas === FUENTES.length) process.exit(1)
