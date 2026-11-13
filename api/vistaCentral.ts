import { neon } from "@neondatabase/serverless"
import type { Db } from "./db"

/**
 * Sincronización con la «vista central» que lee el agente de Coze (solo resúmenes, nada de usuarios).
 *
 * - Es OPCIONAL: sin `CENTRAL_DATABASE_URL` no hace nada, así que no cambia el comportamiento de la app.
 * - Nunca rompe la operación principal: cualquier error o demora se registra y se ignora.
 * - Escribe con el rol `writer_scraper`, que solo puede tocar las tablas del scraper en el esquema `central`.
 * - Es idempotente: cada llamada deja la «foto» completa, así que repetirla no duplica nada.
 */

/** Cuántas propiedades recientes se copian (el resto se resume en `scraper_resumen`). */
export const MAX_PROPIEDADES_VISTA = 200
/** Mínimo de milisegundos entre dos sincronizaciones de una misma instancia (la ingesta llega en lotes). */
export const INTERVALO_MIN_MS = 60_000
/** Tiempo máximo que se espera al servidor central antes de seguir sin él. */
export const TIEMPO_MAX_MS = 4_000

export interface ResultadoSync {
  propiedades: number
  resumenes: number
}

const COLUMNAS_PROPIEDAD = `id, portal, operacion, inmueble, titulo, precio, precio_usd, moneda, distrito,
  dormitorios, banios, area, url, creado_en, ultima_vista_en`

/** Copia la foto de `origen` (la base de la app) hacia `central`. Lanza si algo falla. */
export async function sincronizarVistaCentral(origen: Db, central: Db): Promise<ResultadoSync> {
  const propiedades = await origen.query(
    `SELECT ${COLUMNAS_PROPIEDAD} FROM public.propiedades ORDER BY creado_en DESC, id DESC LIMIT ${MAX_PROPIEDADES_VISTA}`,
  )
  const resumen = await origen.query(
    `SELECT portal, COALESCE(operacion, '') AS operacion, COUNT(*)::int AS total, MAX(ultima_vista_en) AS ultima_vista
       FROM public.propiedades GROUP BY portal, COALESCE(operacion, '')`,
  )

  const jsonProps = JSON.stringify(propiedades)
  const jsonResumen = JSON.stringify(resumen)

  await central.query(
    `INSERT INTO central.scraper_propiedades
       (propiedad_id, portal, operacion, inmueble, titulo, precio, moneda, precio_usd, distrito,
        dormitorios, banios, area, url, encontrada_en, ultima_vista_en)
     SELECT t.id, t.portal, t.operacion, t.inmueble, t.titulo,
            LEAST(GREATEST(t.precio, -999999999999.99), 999999999999.99), t.moneda,
            LEAST(GREATEST(t.precio_usd, -999999999999.99), 999999999999.99), t.distrito,
            t.dormitorios, t.banios, t.area, t.url, t.creado_en, t.ultima_vista_en
       FROM jsonb_to_recordset($1::jsonb) AS t(
         id text, portal text, operacion text, inmueble text, titulo text, precio numeric, precio_usd numeric,
         moneda text, distrito text, dormitorios text, banios text, area text, url text,
         creado_en timestamptz, ultima_vista_en timestamptz)
     ON CONFLICT (propiedad_id) DO UPDATE SET
       portal = EXCLUDED.portal, operacion = EXCLUDED.operacion, inmueble = EXCLUDED.inmueble,
       titulo = EXCLUDED.titulo, precio = EXCLUDED.precio, moneda = EXCLUDED.moneda,
       precio_usd = EXCLUDED.precio_usd, distrito = EXCLUDED.distrito, dormitorios = EXCLUDED.dormitorios,
       banios = EXCLUDED.banios, area = EXCLUDED.area, url = EXCLUDED.url,
       encontrada_en = EXCLUDED.encontrada_en, ultima_vista_en = EXCLUDED.ultima_vista_en`,
    [jsonProps],
  )
  // Lo que ya no está entre las más recientes sale de la foto.
  await central.query(
    `DELETE FROM central.scraper_propiedades
      WHERE propiedad_id NOT IN (SELECT t.id FROM jsonb_to_recordset($1::jsonb) AS t(id text))`,
    [jsonProps],
  )

  await central.query(
    `INSERT INTO central.scraper_resumen (portal, operacion, total, ultima_vista)
     SELECT t.portal, t.operacion, t.total, t.ultima_vista
       FROM jsonb_to_recordset($1::jsonb) AS t(portal text, operacion text, total int, ultima_vista timestamptz)
     ON CONFLICT (portal, operacion) DO UPDATE SET total = EXCLUDED.total, ultima_vista = EXCLUDED.ultima_vista`,
    [jsonResumen],
  )
  await central.query(
    `DELETE FROM central.scraper_resumen r
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_to_recordset($1::jsonb) AS t(portal text, operacion text)
         WHERE t.portal = r.portal AND t.operacion = r.operacion)`,
    [jsonResumen],
  )

  await central.query(
    `INSERT INTO central.sync_estado (app, ultima_sync) VALUES ('scraper', now())
     ON CONFLICT (app) DO UPDATE SET ultima_sync = now()`,
  )

  return { propiedades: propiedades.length, resumenes: resumen.length }
}

let ultimaSync = 0

/** Solo para pruebas. */
export function reiniciarLimitador(): void {
  ultimaSync = 0
}

/**
 * Punto de entrada que usan las rutas tras guardar avisos. No lanza nunca.
 * Devuelve `true` si sincronizó, `false` si estaba desactivada, limitada, o falló.
 */
export async function sincronizarSiConfigurado(
  origen: Db,
  env: { CENTRAL_DATABASE_URL?: string },
  opciones: { central?: Db; ahora?: () => number } = {},
): Promise<boolean> {
  const url = env.CENTRAL_DATABASE_URL
  if (!url && !opciones.central) return false

  const ahora = (opciones.ahora ?? Date.now)()
  if (ahora - ultimaSync < INTERVALO_MIN_MS) return false
  ultimaSync = ahora

  try {
    const central: Db =
      opciones.central ??
      (() => {
        const sql = neon(url as string)
        return { query: async (text, params = []) => (await sql.query(text, params)) as never }
      })()

    let temporizador: ReturnType<typeof setTimeout> | undefined
    const limite = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => rechazar(new Error("tiempo agotado")), TIEMPO_MAX_MS)
    })
    try {
      await Promise.race([sincronizarVistaCentral(origen, central), limite])
    } finally {
      clearTimeout(temporizador)
    }
    return true
  } catch (err) {
    ultimaSync = 0 // que el siguiente lote reintente
    // Solo el mensaje y sin cadenas de conexión: nunca credenciales en los registros.
    const mensaje = err instanceof Error ? err.message.replace(/postgres(ql)?:\/\/\S+/gi, "[conexión]") : "error"
    console.warn("vista central: no se pudo sincronizar:", mensaje)
    return false
  }
}
