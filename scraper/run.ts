// Carga avisos de Adondevivir en la base.
//
//   pnpm scraper                    corrida normal (necesita DATABASE_URL en .env o en el entorno)
//   pnpm scraper --dry              solo descarga y muestra lo que entendió; NO toca la base
//   pnpm scraper --max 50           como máximo 50 páginas de aviso por corrida (por defecto 200)
//   pnpm scraper --delay 2000       espera entre páginas, en ms (por defecto 1200)
//
// Cada corrida lee el sitemap (la lista oficial del sitio), descarga solo los avisos nuevos o
// actualizados y marca como "vistos" los que siguen publicados. Es amable con el sitio: una
// petición cada ~1 s, se identifica con su User-Agent y se detiene si el sitio dice que no.

import pg from "pg"
import { DEFAULT_USD_TO_PEN_RATE } from "../shared/constants"
import {
  BloqueadoError,
  SITEMAP_INDEX,
  fetchText,
  parseAviso,
  parseSitemapIndex,
  parseUrlset,
  type SitemapEntry,
} from "./adondevivir"
import { guardarAvisos, type Aviso } from "./ingest"

try {
  process.loadEnvFile()
} catch {
  /* sin .env: se usa el entorno */
}

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const value = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`)
  const n = i >= 0 ? Number(args[i + 1]) : NaN
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

const dry = flag("dry")
const max = value("max", 200)
const delayMs = value("delay", 1200)
const UA = "Mozilla/5.0 (compatible; InmobiliariaPolylineBot/1.0)"
const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

const rate = Number(process.env.USD_TO_PEN_RATE)
const usdToPen = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_PEN_RATE

async function conectar(url: string): Promise<pg.Client> {
  // Neon despierta el cómputo al primer intento: se reintenta con espera creciente.
  for (let intento = 1; ; intento++) {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 })
    try {
      await client.connect()
      return client
    } catch (err) {
      await client.end().catch(() => {})
      if (intento >= 3) throw err
      await dormir(3000 * intento)
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!dry && !databaseUrl) {
    console.error("Falta DATABASE_URL. Usa --dry para probar sin base de datos.")
    process.exit(1)
  }

  // 1) Sitemap: lista oficial de avisos con su fecha de actualización.
  console.log("Leyendo el sitemap de Adondevivir…")
  const indice = await fetchText(SITEMAP_INDEX, { userAgent: UA })
  const entradas = new Map<string, SitemapEntry>()
  for (const dir of parseSitemapIndex(indice)) {
    for (const e of parseUrlset(await fetchText(dir, { userAgent: UA }))) entradas.set(e.id, e)
    await dormir(delayMs)
  }
  console.log(`  ${entradas.size} avisos publicados`)
  if (entradas.size === 0) throw new Error("El sitemap no trajo ningún aviso: el formato pudo haber cambiado.")

  // 2) ¿Cuáles hay que descargar? Los nuevos y los actualizados desde la última vez.
  let client: pg.Client | null = null
  const existentes = new Map<string, string>() // id -> fecha (AAAA-MM-DD) de la última vez vista
  if (!dry) {
    client = await conectar(databaseUrl as string)
    const { rows } = await client.query<{ id: string; visto: string }>(
      `select id, to_char(ultima_vista_en at time zone 'UTC', 'YYYY-MM-DD') as visto
         from public.propiedades where portal = 'adondevivir'`
    )
    for (const r of rows) existentes.set(r.id, r.visto)
  }

  const pendientes = Array.from(entradas.values())
    .filter(e => {
      const visto = existentes.get(`adondevivir:${e.id}`)
      return visto === undefined || (e.lastmod !== null && e.lastmod > visto)
    })
    .sort((a, b) => (b.lastmod ?? "").localeCompare(a.lastmod ?? ""))
  const nuevos = pendientes.filter(e => !existentes.has(`adondevivir:${e.id}`)).length
  const lote = pendientes.slice(0, max)
  console.log(`  ${pendientes.length} por descargar (${nuevos} nuevos); esta corrida: ${lote.length}`)

  // 3) Descarga y lectura de cada aviso, con calma.
  const avisos: Aviso[] = []
  let omitidos = 0
  let fallos = 0
  let bloqueos = 0
  for (const [i, e] of lote.entries()) {
    try {
      const html = await fetchText(e.url, { userAgent: UA })
      const aviso = parseAviso(html, e.url)
      if (aviso) avisos.push(aviso)
      else omitidos++
      bloqueos = 0
    } catch (err) {
      if (err instanceof BloqueadoError) {
        bloqueos++
        console.error(`  ${err.message}`)
        if (bloqueos >= 3) {
          console.error("  El sitio está bloqueando las peticiones: se detiene la corrida para no insistir.")
          break
        }
      } else {
        fallos++
        console.error(`  falló ${e.url}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    if ((i + 1) % 25 === 0) console.log(`  …${i + 1}/${lote.length}`)
    await dormir(delayMs)
  }
  console.log(`Leídos: ${avisos.length}. Omitidos por datos incompletos: ${omitidos}. Fallos: ${fallos}.`)

  if (dry || !client) {
    console.log("\nModo --dry: no se escribió nada en la base. Ejemplos de lo que se guardaría:")
    for (const a of avisos.slice(0, 3)) console.log(JSON.stringify(a, null, 2))
    return
  }

  try {
    // 4) Guardar y marcar como vistos los avisos que siguen publicados.
    if (avisos.length > 0) {
      const r = await guardarAvisos(client, avisos, usdToPen)
      console.log(`Guardados: ${r.guardados}. Descartados por datos inválidos: ${r.descartados}.`)
    }
    const vistos = Array.from(entradas.keys()).map(id => `adondevivir:${id}`)
    const res = await client.query("update public.propiedades set ultima_vista_en = now() where id = any($1::text[])", [vistos])
    console.log(`Marcados como vistos: ${res.rowCount}.`)
  } finally {
    await client.end()
  }

  // Si no se pudo leer nada y hubo bloqueos, la corrida falla para que GitHub avise.
  if (lote.length > 0 && avisos.length === 0 && bloqueos > 0) process.exit(1)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
