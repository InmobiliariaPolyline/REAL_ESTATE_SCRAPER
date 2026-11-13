import { guardarAvisos, PORTALES, quitarRetirados, type Aviso } from "../ingest"
import { limpiarUnidades } from "../../shared/proyectos"
import { usdToPenRate } from "../env"
import { sincronizarSiConfigurado } from "../vistaCentral"
import { HttpError, badRequest, forbidden, readJson, timingSafeEqual } from "../http"
import type { Route } from "../router"

/** Máximo de avisos por envío (más se rechazan: se manda en varios lotes). */
export const MAX_AVISOS_POR_ENVIO = 500

/** Largo mínimo del token: uno corto se adivina con facilidad. */
const LARGO_MINIMO_TOKEN = 24

const texto = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined)
const numero = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
/** Cantidades que algunos scrapers mandan como número y otros como texto («3», 3). */
const cantidad = (v: unknown): string | undefined => (typeof v === "number" && Number.isFinite(v) ? String(v) : texto(v))
const lista = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined)

/**
 * Convierte un objeto recibido en un `Aviso`, tomando solo los campos conocidos y con el tipo correcto.
 * Devuelve `null` si no es un objeto; `normalizarAviso` descarta después los que no se pueden identificar.
 */
export function comoAviso(x: unknown): Aviso | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null
  const r = x as Record<string, unknown>
  return {
    portal: String(r.portal ?? "").toLowerCase() as Aviso["portal"],
    codigo: cantidad(r.codigo) ?? "",
    operacion: String(r.operacion ?? "").toUpperCase() as Aviso["operacion"],
    inmueble: texto(r.inmueble) ?? "",
    titulo: texto(r.titulo),
    precio: numero(r.precio),
    moneda: r.moneda === "USD" || r.moneda === "PEN" ? r.moneda : undefined,
    precioUsd: numero(r.precioUsd ?? r.precio_usd),
    distrito: texto(r.distrito),
    departamento: texto(r.departamento),
    provincia: texto(r.provincia),
    dormitorios: cantidad(r.dormitorios),
    banios: cantidad(r.banios),
    area: texto(r.area) ?? (numero(r.area) !== undefined ? `${numero(r.area)} m2` : undefined),
    imagen: texto(r.imagen),
    imagenes: lista(r.imagenes),
    url: texto(r.url),
    descripcion: texto(r.descripcion),
    direccion: texto(r.direccion),
    estacionamientos: cantidad(r.estacionamientos),
    antiguedad: cantidad(r.antiguedad),
    publicador: texto(r.publicador),
    latitud: numero(r.latitud),
    longitud: numero(r.longitud),
    mantenimiento: numero(r.mantenimiento),
    // Proyectos: precio más alto y tipologías (el resto de campos desconocidos se ignora).
    precioMax: numero(r.precioMax ?? r.precio_max),
    unidades: Array.isArray(r.unidades) ? limpiarUnidades(r.unidades) : undefined,
  }
}

/**
 * Entrada de datos para cualquier scraper propio (PHP, Python, Node…): recibe lotes de avisos con un
 * token y los guarda como la carga con Apify (sin duplicar por portal + código). Ver docs/SCRAPER_PROPIO.md.
 */
export const ingestaRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/ingesta",
    level: "public",
    handler: async ({ req, db, env }) => {
      const esperado = env.INGESTA_TOKEN
      if (!esperado || esperado.length < LARGO_MINIMO_TOKEN) {
        throw new HttpError(501, "not_configured", `INGESTA_TOKEN no está configurado (mínimo ${LARGO_MINIMO_TOKEN} caracteres)`)
      }
      const recibido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
      if (!timingSafeEqual(recibido, esperado)) throw forbidden()

      const body = await readJson(req)
      if (!Array.isArray(body.avisos)) throw badRequest("Se esperaba { \"avisos\": [ ... ] }")
      if (body.avisos.length > MAX_AVISOS_POR_ENVIO) {
        throw badRequest(`Máximo ${MAX_AVISOS_POR_ENVIO} avisos por envío: manda varios lotes`)
      }
      // Opcional: avisos que el portal ya no tiene ({ portal, codigo }); se quitan del catálogo (salvo los curados).
      const retiradosPedidos = Array.isArray(body.retirados) ? (body.retirados as { portal: string; codigo: string }[]).slice(0, MAX_AVISOS_POR_ENVIO) : []
      const retirados = retiradosPedidos.length ? await quitarRetirados(db, retiradosPedidos) : 0
      if (body.avisos.length === 0) return { recibidos: 0, guardados: 0, descartados: 0, retirados }

      const avisos = body.avisos.map(comoAviso).filter((a): a is Aviso => a !== null)
      const { guardados, descartados } = await guardarAvisos(db, avisos, usdToPenRate(env))
      // Vista central para el agente de Coze (opcional; nunca rompe la ingesta).
      await sincronizarSiConfigurado(db, env)
      return {
        recibidos: body.avisos.length,
        retirados,
        guardados,
        // Los que no eran objetos más los que no se pudieron identificar (portal, código u operación inválidos).
        descartados: body.avisos.length - avisos.length + descartados,
        portalesValidos: PORTALES,
      }
    },
  },
]
