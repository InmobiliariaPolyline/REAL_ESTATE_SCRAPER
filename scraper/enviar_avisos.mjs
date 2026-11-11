// Envía avisos a la API del sistema (POST /api/ingesta) en lotes.
//
// Uso:  node scraper/enviar_avisos.mjs avisos.json
// Env:  INGESTA_TOKEN  (obligatorio)  el mismo token que INGESTA_TOKEN en Netlify
//       INGESTA_URL    (opcional)     por defecto https://realestatescrapeer.netlify.app/api/ingesta
//
// El archivo es un arreglo JSON de avisos o un objeto {"avisos": [...]}. Ver docs/SCRAPER_PROPIO.md.
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const LOTE = 200

/**
 * Envía los avisos en lotes. `retirados` (opcional) son avisos que el portal ya no tiene, como `{ portal, codigo }`: el sistema
 * los quita del catálogo (salvo los que tengan favoritos o enlaces).
 */
export async function enviarAvisos(avisos, url, token, retirados = []) {
  const total = { recibidos: 0, guardados: 0, descartados: 0, retirados: 0 }
  const post = async cuerpo => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "ScraperPropio/1.0" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`La API respondió ${res.status} ${await res.text()}`)
    const r = await res.json()
    for (const k of Object.keys(total)) total[k] += Number(r[k] ?? 0)
  }
  for (let i = 0; i < avisos.length; i += LOTE) {
    // Los retirados viajan con el primer lote.
    await post(i === 0 && retirados.length ? { avisos: avisos.slice(i, i + LOTE), retirados } : { avisos: avisos.slice(i, i + LOTE) })
  }
  if (avisos.length === 0 && retirados.length) await post({ avisos: [], retirados })
  return total
}

const comoPrograma = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
const archivo = comoPrograma ? process.argv[2] : undefined
if (archivo) {
  const token = process.env.INGESTA_TOKEN
  if (!token) {
    console.error("Falta la variable de entorno INGESTA_TOKEN")
    process.exit(1)
  }
  const datos = JSON.parse(readFileSync(archivo, "utf8"))
  const avisos = Array.isArray(datos) ? datos : datos.avisos
  if (!Array.isArray(avisos)) {
    console.error("El archivo no tiene una lista de avisos")
    process.exit(1)
  }
  try {
    console.log(await enviarAvisos(avisos, process.env.INGESTA_URL || "https://realestatescrapeer.netlify.app/api/ingesta", token))
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
