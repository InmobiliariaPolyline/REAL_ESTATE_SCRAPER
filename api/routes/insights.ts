import { usdToPenRate } from "../env"
import {
  PROPERTY_COLUMNS,
  buildPortalNewCount,
  parsePortalFilters,
  propertyColumns,
} from "../propertyQueries"
import type { Route } from "../router"
import { calcularEstadisticas, type FilaPrecio } from "../stats"

/** Ventana (días) en que un aviso cuenta como "nuevo" para una búsqueda guardada. */
const NUEVOS_DIAS = 7
/** Una bajada de precio solo se muestra si ocurrió en los últimos N días. */
const BAJADAS_DIAS = 30
const MAX_FILAS_ESTADISTICAS = 20000

const isMissingTable = (err: unknown) =>
  /relation .* does not exist/i.test(String((err as { message?: string })?.message ?? ""))

interface SavedSearchRow {
  id: string
  nombre: string
  filtros: Record<string, unknown>
}

/** Convierte los filtros guardados de una búsqueda a los filtros de consulta del portal. */
function filtrosDeBusqueda(filtros: Record<string, unknown>) {
  const q = new URLSearchParams()
  const set = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v))
  }
  set("distrito", filtros.distrito)
  set("operacion", filtros.operacion)
  set("inmueble", filtros.inmueble)
  set("moneda", filtros.moneda)
  set("precioMin", filtros.precioMin)
  set("precioMax", filtros.precioMax)
  set("dormitorios", filtros.dormitorios)
  set("banios", filtros.banios)
  set("areaMin", filtros.areaMin)
  set("areaMax", filtros.areaMax)
  set("publicado", filtros.publicado)
  set("texto", filtros.texto)
  if (Array.isArray(filtros.portales)) q.set("portales", filtros.portales.join(","))
  return parsePortalFilters(q)
}

/** Resumen de inicio, estadísticas por distrito (suscriptores vigentes y admin). */
export const insightsRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/inicio",
    level: "member",
    handler: async ({ db, env, access }) => {
      const userId = access.usuario.id
      const rate = usdToPenRate(env)

      const [conteos, recientes, busquedas] = await Promise.all([
        db.query<{ hoy: number; ultimas24h: number }>(
          `select
             count(*) filter (where creado_en >= (date_trunc('day', now() at time zone 'America/Lima') at time zone 'America/Lima'))::int as hoy,
             count(*) filter (where creado_en >= now() - interval '24 hours')::int as "ultimas24h"
           from public.propiedades`
        ),
        db.query(
          `select ${PROPERTY_COLUMNS} from public.propiedades
            where precio > 0 or precio_usd > 0
            order by creado_en desc, id desc limit 6`
        ),
        db.query<SavedSearchRow>(
          `select id, nombre, filtros from public.busquedas_guardadas
            where admin_id = $1 and filtros is not null
            order by creado_en desc limit 20`,
          [userId]
        ),
      ])

      // Bajadas de precio de los favoritos (necesita el historial de la migración 004).
      let bajadas: unknown[] = []
      try {
        bajadas = await db.query(
          `with h as (
             select propiedad_id, precio_usd, registrado_en,
                    lag(precio_usd) over (partition by propiedad_id order by registrado_en) as anterior,
                    row_number() over (partition by propiedad_id order by registrado_en desc) as rn
               from public.propiedades_precios
              where propiedad_id in (select propiedad_id from public.favoritos where admin_id = $1)
           )
           select ${propertyColumns("p")},
                  h.anterior::float8 as precio_anterior_usd,
                  round(((h.anterior - h.precio_usd) / h.anterior * 100)::numeric, 1)::float8 as baja_pct,
                  h.registrado_en as bajo_en
             from h join public.propiedades p on p.id = h.propiedad_id
            where h.rn = 1 and h.anterior > 0 and h.precio_usd > 0 and h.precio_usd < h.anterior
              and h.registrado_en >= now() - interval '${BAJADAS_DIAS} days'
            order by (h.anterior - h.precio_usd) / h.anterior desc
            limit 8`,
          [userId]
        )
      } catch (err) {
        if (!isMissingTable(err)) throw err
      }

      const conNuevos = await Promise.all(
        busquedas.map(async b => {
          try {
            const q = buildPortalNewCount(filtrosDeBusqueda(b.filtros ?? {}), rate, NUEVOS_DIAS)
            const r = await db.query<{ total: number }>(q.text, q.params)
            return { id: b.id, nombre: b.nombre, filtros: b.filtros, nuevos: r[0]?.total ?? 0 }
          } catch {
            // Una búsqueda guardada con filtros viejos no debe romper la pantalla de inicio.
            return { id: b.id, nombre: b.nombre, filtros: b.filtros, nuevos: 0 }
          }
        })
      )

      return {
        hoy: conteos[0]?.hoy ?? 0,
        ultimas24h: conteos[0]?.ultimas24h ?? 0,
        nuevosDias: NUEVOS_DIAS,
        recientes,
        bajadas,
        busquedas: conNuevos,
      }
    },
  },
  {
    method: "GET",
    path: "/api/estadisticas",
    level: "member",
    handler: async ({ db }) => {
      const filas = await db.query<FilaPrecio>(
        `select distrito, operacion, precio_usd::float8 as precio_usd, area
           from public.propiedades
          where precio_usd > 0
          limit ${MAX_FILAS_ESTADISTICAS}`
      )
      return calcularEstadisticas(filas)
    },
  },
]
