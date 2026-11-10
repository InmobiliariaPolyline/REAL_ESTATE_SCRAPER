// Scraper propio: lee los listados públicos de InfoCasas Perú y los envía al sistema (POST /api/ingesta).
//
// Uso:
//   node scraper/scraper.mjs --probar                        sin enviar nada: muestra lo que leería
//   node scraper/scraper.mjs --portal infocasas --paginas 5  lee 5 páginas de cada búsqueda y las envía
//   node scraper/scraper.mjs --busqueda venta/departamentos/lima/miraflores --paginas 10
//
// Opciones:
//   --portal infocasas|todos   (por defecto: todos; hoy solo existe InfoCasas)
//   --paginas N       páginas por búsqueda (por defecto 3; hasta 25)
//   --busqueda RUTA   ruta de búsqueda del portal (se puede repetir); sin ella usa las de siempre
//   --max N           tope de avisos por ejecución (por defecto 2000)
//   --pausa S         segundos entre peticiones (por defecto 5, mínimo 3)
//   --probar          no envía; imprime un resumen y 2 avisos de muestra
//
// Variables de entorno (para enviar): INGESTA_TOKEN y, si quieres, INGESTA_URL.
//
// Reglas: un solo hilo, pausas entre peticiones, respeta el robots.txt de cada portal y se detiene
// ante un 403, 429 o 5xx (nunca reintenta ni intenta esquivar un bloqueo). Ver docs/SCRAPER_PROPIO.md.
import { pathToFileURL } from "node:url"
import { enviarAvisos } from "./enviar_avisos.mjs"
import { PORTALES } from "./lib/portales.mjs"
import { leerRobots, permitido } from "./lib/robots.mjs"

const AGENTE = "ScraperPropio/1.0"
const URL_API = "https://realestatescrapeer.netlify.app/api/ingesta"
const PAUSA_MINIMA = 3

const dormir = ms => new Promise(r => setTimeout(r, ms))

export function leerArgumentos(argv) {
  const a = { portal: "todos", paginas: 3, busquedas: [], max: 2000, pausa: 5, probar: false }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const siguiente = () => argv[++i]
    if (k === "--portal") a.portal = siguiente()
    else if (k === "--paginas") a.paginas = Number(siguiente())
    else if (k === "--busqueda") a.busquedas.push(siguiente())
    else if (k === "--max") a.max = Number(siguiente())
    else if (k === "--pausa") a.pausa = Number(siguiente())
    else if (k === "--probar") a.probar = true
    else throw new Error(`Opción desconocida: ${k}`)
  }
  if (!["todos", ...Object.keys(PORTALES)].includes(a.portal)) throw new Error(`Portal desconocido: ${a.portal}`)
  for (const [nombre, v, min] of [["--paginas", a.paginas, 1], ["--max", a.max, 1], ["--pausa", a.pausa, PAUSA_MINIMA]]) {
    if (!Number.isFinite(v) || v < min) throw new Error(`${nombre} debe ser un número de ${min} o más`)
  }
  for (const b of a.busquedas) if (!/^[\w\-/]+$/.test(b ?? "")) throw new Error(`Búsqueda no válida: ${b}`)
  return a
}

/** Pide una página con identificación clara. Lanza un error `detener` si el portal pide parar. */
async function pedir(url, fetchFn = fetch) {
  const res = await fetchFn(url, {
    headers: { "User-Agent": AGENTE, Accept: "text/html,application/xhtml+xml", "Accept-Language": "es-PE,es;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  })
  if (res.status === 403 || res.status === 429 || res.status >= 500) {
    const e = new Error(`El portal respondió ${res.status}: se detiene este portal (no se reintenta ni se esquiva)`)
    e.detener = true
    throw e
  }
  if (!res.ok) throw new Error(`El portal respondió ${res.status} para ${url}`)
  return new TextDecoder("utf-8").decode(await res.arrayBuffer())
}

/**
 * Recorre un portal y devuelve los avisos leídos. `fetchFn` y `dormirFn` se pueden cambiar para probarlo sin red.
 */
export async function leerPortal(portal, opciones, { fetchFn = fetch, dormirFn = dormir, log = console.log, alAvisos } = {}) {
  const reglas = await (async () => {
    try {
      const res = await fetchFn(`${portal.base}/robots.txt`, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(20_000) })
      return res.ok ? leerRobots(await res.text(), "ScraperPropio") : []
    } catch {
      return []
    }
  })()

  const busquedas = opciones.busquedas.length > 0 ? opciones.busquedas : portal.busquedas
  const maxPaginas = Math.min(opciones.paginas, portal.maxPaginas)
  const vistos = new Set()
  const todos = []
  let primera = true

  for (const busqueda of busquedas) {
    for (let n = 1; n <= maxPaginas; n++) {
      const url = portal.urlPagina(busqueda, n)
      const ruta = new URL(url).pathname + new URL(url).search
      if (!permitido(reglas, ruta)) {
        log(`  [${portal.nombre}] ${ruta}: no permitido por su robots.txt, se omite`)
        break
      }
      if (!primera) await dormirFn(opciones.pausa * 1000 + Math.random() * 2000)
      primera = false

      let pagina
      try {
        pagina = portal.extraer(await pedir(url, fetchFn))
      } catch (e) {
        if (e.detener) throw e
        log(`  [${portal.nombre}] ${ruta}: ${e.message}`)
        break
      }
      if (!pagina) {
        log(`  [${portal.nombre}] ${ruta}: la página no trae listados que se puedan leer`)
        break
      }
      const nuevos = pagina.avisos.filter(a => !vistos.has(a.codigo))
      for (const a of nuevos) vistos.add(a.codigo)
      todos.push(...nuevos)
      log(`  [${portal.nombre}] ${ruta}: ${pagina.crudos} avisos leídos, ${nuevos.length} nuevos${pagina.total ? ` (hay ${pagina.total.toLocaleString("es-PE")} en total)` : ""}`)
      if (alAvisos) await alAvisos(nuevos)
      if (todos.length >= opciones.max || n >= pagina.paginas) break
    }
    if (todos.length >= opciones.max) break
  }
  return todos.slice(0, opciones.max)
}

async function principal() {
  const opciones = leerArgumentos(process.argv.slice(2))
  const token = process.env.INGESTA_TOKEN
  const url = process.env.INGESTA_URL || URL_API
  if (!opciones.probar && !token) {
    console.error("Falta la variable de entorno INGESTA_TOKEN (o usa --probar para no enviar nada)")
    process.exit(1)
  }

  const ids = opciones.portal === "todos" ? Object.keys(PORTALES) : [opciones.portal]
  const total = { leidos: 0, recibidos: 0, guardados: 0, descartados: 0 }
  let hayError = false

  for (const id of ids) {
    const portal = PORTALES[id]
    console.log(`\n${portal.nombre}`)
    try {
      const avisos = await leerPortal(portal, opciones, {
        // Cada página se envía apenas se lee, así un corte no pierde lo ya leído.
        alAvisos: opciones.probar
          ? undefined
          : async lote => {
              if (lote.length === 0) return
              const r = await enviarAvisos(lote, url, token)
              for (const k of ["recibidos", "guardados", "descartados"]) total[k] += r[k]
            },
      })
      total.leidos += avisos.length
      if (opciones.probar) {
        console.log(`  ${avisos.length} avisos leídos (no se envió nada). Muestra:`)
        for (const a of avisos.slice(0, 2)) console.log("  " + JSON.stringify({ ...a, descripcion: a.descripcion?.slice(0, 60), imagenes: `${a.imagenes?.length ?? 0} fotos` }))
      }
    } catch (e) {
      hayError = true
      console.error(`  ${e.message}`)
    }
  }

  console.log(opciones.probar ? `\nListo (modo prueba): ${total.leidos} avisos leídos.` : `\nListo: ${total.leidos} leídos, ${total.guardados} guardados, ${total.descartados} descartados.`)
  if (hayError) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch(e => {
    console.error(e.message)
    process.exit(1)
  })
}
