import { MAX_PAGE_SIZE, PORTAL_PAGE_SIZE } from "../../shared/constants"
import { sanitizeFilterState } from "../../shared/savedSearch"
import { validateEnlace } from "../../shared/validation"
import { toCsv, type CsvColumn } from "../csv"
import { usdToPenRate } from "../env"
import { badRequest, intParam, notFound, optStr, readJson, str } from "../http"
import {
  ENLACE_COLUMNS,
  PROPERTY_COLUMNS,
  buildPortalCount,
  buildPortalQuery,
  parsePortalFilters,
} from "../propertyQueries"
import type { Route } from "../router"
import { favoritosRoutes } from "./favoritos"

const MAX_EXPORT_ROWS = 5000
const MAX_SAVED_SEARCHES = 20

interface ExportRow {
  id: string
  portal: string
  operacion: string | null
  inmueble: string | null
  titulo: string | null
  precio: number
  moneda: string
  precio_usd: number
  distrito: string | null
  dormitorios: string | null
  banios: string | null
  area: string | null
  url: string | null
  creado_en: Date | string
}

const EXPORT_COLUMNS: CsvColumn<ExportRow>[] = [
  { header: "id", get: r => r.id },
  { header: "portal", get: r => r.portal },
  { header: "operacion", get: r => r.operacion },
  { header: "inmueble", get: r => r.inmueble },
  { header: "titulo", get: r => r.titulo },
  { header: "precio", get: r => r.precio },
  { header: "moneda", get: r => r.moneda },
  { header: "precio_usd", get: r => r.precio_usd },
  { header: "distrito", get: r => r.distrito },
  { header: "dormitorios", get: r => r.dormitorios },
  { header: "banios", get: r => r.banios },
  { header: "area", get: r => r.area },
  { header: "url", get: r => r.url },
  { header: "creado_en", get: r => r.creado_en },
]

/** Detecta que la tabla del historial aún no existe (migración 004 sin aplicar). */
const isMissingTable = (err: unknown) =>
  /relation .* does not exist/i.test(String((err as { message?: string })?.message ?? ""))

/** Páginas del portal, detalle, exportación, favoritos, búsquedas y enlaces (admin y suscriptores vigentes). */
export const portalRoutes: Route[] = [
  ...favoritosRoutes("/api", "member"),

  {
    method: "GET",
    path: "/api/propiedades",
    level: "member",
    handler: async ({ url, db, env }) => {
      const filters = parsePortalFilters(url.searchParams)
      const pageSize = intParam(url.searchParams.get("pageSize"), PORTAL_PAGE_SIZE, 1, MAX_PAGE_SIZE)
      const page = intParam(url.searchParams.get("page"), 0, 0, 100000)
      const rate = usdToPenRate(env)

      const query = buildPortalQuery(filters, page, pageSize, rate)
      const rows = await db.query<Record<string, unknown> & { total: number }>(
        query.text,
        query.params
      )

      let count = rows[0]?.total ?? 0
      if (rows.length === 0 && page > 0) {
        const c = buildPortalCount(filters, rate)
        count = (await db.query<{ total: number }>(c.text, c.params))[0]?.total ?? 0
      }
      return { data: rows.map(({ total: _t, ...row }) => row), count }
    },
  },

  {
    // Debe ir antes de `/api/propiedades/:id` para que "export" no se interprete como un id.
    method: "GET",
    path: "/api/propiedades/export",
    level: "member",
    handler: async ({ url, db, env }) => {
      const filters = parsePortalFilters(url.searchParams)
      const query = buildPortalQuery(filters, 0, MAX_EXPORT_ROWS, usdToPenRate(env))
      const rows = await db.query<ExportRow & { total: number }>(query.text, query.params)

      const today = new Date().toISOString().slice(0, 10)
      return new Response(toCsv(rows, EXPORT_COLUMNS), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="propiedades-${today}.csv"`,
          "Cache-Control": "no-store",
        },
      })
    },
  },
  {
    method: "GET",
    path: "/api/propiedades/:id",
    level: "member",
    handler: async ({ params, db }) => {
      const rows = await db.query(
        `select ${PROPERTY_COLUMNS} from public.propiedades where id = $1`,
        [params.id]
      )
      if (rows.length === 0) throw notFound()

      let historial: unknown[] = []
      try {
        historial = await db.query(
          `select registrado_en, precio::float8 as precio, precio_usd::float8 as precio_usd, moneda
             from public.propiedades_precios
            where propiedad_id = $1
            order by registrado_en`,
          [params.id]
        )
      } catch (err) {
        // Sin la migración 004 el detalle sigue funcionando, solo sin historial.
        if (!isMissingTable(err)) throw err
      }

      // Fotos y datos extra del aviso; sin las migraciones 008/009 se muestra lo que haya.
      const base = rows[0] as { imagen: string | null; operacion: string; distrito: string | null; precio_usd: number }
      let extra: Record<string, unknown> = {}
      for (const columnas of [
        "imagenes, ultima_vista_en, descripcion, direccion, estacionamientos, antiguedad, publicador, latitud, longitud, mantenimiento::float8 as mantenimiento",
        "imagenes, ultima_vista_en",
        "ultima_vista_en",
      ]) {
        try {
          extra = (await db.query<Record<string, unknown>>(`select ${columnas} from public.propiedades where id = $1`, [params.id]))[0] ?? {}
          break
        } catch (err) {
          if (!/column .*does not exist|no existe la columna/i.test(String((err as { message?: string })?.message ?? ""))) throw err
        }
      }
      let imagenes = Array.isArray(extra.imagenes) ? (extra.imagenes as string[]) : []
      if (imagenes.length === 0 && base.imagen) imagenes = [base.imagen]
      const { imagenes: _fotos, ...detalles } = extra

      // Mercado de la zona (mismo distrito y operación) y avisos parecidos.
      let mercado: Record<string, unknown> | null = null
      let similares: unknown[] = []
      if (base.distrito) {
        const usd = Number(base.precio_usd) || 0
        const m2 = "(case when area ~ '^[0-9]+([.,][0-9]+)?' then replace((regexp_match(area, '^[0-9]+(?:[.,][0-9]+)?'))[1], ',', '.')::numeric end)"
        mercado =
          (
            await db.query<Record<string, unknown>>(
              `select count(*)::int as avisos,
                      percentile_cont(0.5) within group (order by precio_usd)::float8 as mediana_usd,
                      min(precio_usd)::float8 as min_usd,
                      max(precio_usd)::float8 as max_usd,
                      percentile_cont(0.5) within group (order by precio_usd / nullif(${m2}, 0))::float8 as mediana_m2_usd,
                      (count(*) filter (where precio_usd < $3))::int as mas_baratos
                 from public.propiedades
                where operacion = $1 and distrito = $2 and precio_usd > 0`,
              [base.operacion, base.distrito, usd]
            )
          )[0] ?? null
        similares = await db.query(
          `select ${PROPERTY_COLUMNS} from public.propiedades
            where id <> $1 and operacion = $2 and distrito = $3
              and ($4::float8 = 0 or precio_usd between $4::float8 * 0.6 and $4::float8 * 1.4)
            order by abs(coalesce(precio_usd, 0) - $4::float8), creado_en desc
            limit 4`,
          [params.id, base.operacion, base.distrito, usd]
        )
      }
      return { propiedad: { ...rows[0], ...detalles, imagenes }, historial, mercado, similares }
    },
  },

  {
    method: "GET",
    path: "/api/busquedas",
    level: "member",
    handler: async ({ db, access }) =>
      db.query(
        `select id, nombre, filtros, creado_en
           from public.busquedas_guardadas
          where admin_id = $1 and filtros is not null
          order by creado_en desc`,
        [access.usuario.id]
      ),
  },
  {
    method: "POST",
    path: "/api/busquedas",
    level: "member",
    handler: async ({ req, db, access }) => {
      const body = await readJson(req)
      const nombre = str(body.nombre, "nombre", 80).trim()
      if (!nombre) throw badRequest("Ponle un nombre a la búsqueda")
      const filtros = sanitizeFilterState(body.filtros)

      const count = await db.query<{ n: number }>(
        "select count(*)::int as n from public.busquedas_guardadas where admin_id = $1 and filtros is not null",
        [access.usuario.id]
      )
      if ((count[0]?.n ?? 0) >= MAX_SAVED_SEARCHES) {
        throw badRequest(`Puedes guardar hasta ${MAX_SAVED_SEARCHES} búsquedas. Elimina alguna para continuar.`)
      }

      const rows = await db.query<{ id: string }>(
        `insert into public.busquedas_guardadas (admin_id, nombre, distrito, operacion, portal, filtros)
         values ($1, $2, $3, $4, 'todos', $5::jsonb)
         returning id`,
        [access.usuario.id, nombre, filtros.distrito, filtros.operacion, JSON.stringify(filtros)]
      )
      return rows[0]
    },
  },
  {
    method: "DELETE",
    path: "/api/busquedas/:id",
    level: "member",
    handler: async ({ params, db, access }) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
        throw badRequest("Id inválido")
      }
      const rows = await db.query(
        "delete from public.busquedas_guardadas where id = $1 and admin_id = $2 and filtros is not null returning id",
        [params.id, access.usuario.id]
      )
      if (rows.length === 0) throw notFound()
      return { ok: true }
    },
  },

  {
    method: "GET",
    path: "/api/propiedades/:id/enlaces",
    level: "member",
    handler: async ({ params, db }) =>
      db.query(
        `select ${ENLACE_COLUMNS} from public.enlaces
         where propiedad_id = $1 order by creado_en desc`,
        [params.id]
      ),
  },
  {
    method: "POST",
    path: "/api/propiedades/:id/enlaces",
    level: "member",
    handler: async ({ req, params, db }) => {
      const body = await readJson(req)
      const valid = validateEnlace({
        titulo: optStr(body.titulo, "titulo", 300),
        descripcion: optStr(body.descripcion, "descripcion", 2000),
        url: optStr(body.url, "url", 2000),
        tipo: optStr(body.tipo, "tipo", 40) || undefined,
      })
      if (!valid.ok) throw badRequest(valid.message)

      const exists = await db.query("select 1 from public.propiedades where id = $1", [params.id])
      if (exists.length === 0) throw notFound()

      const rows = await db.query(
        `insert into public.enlaces (propiedad_id, titulo, descripcion, url, tipo)
         values ($1, $2, $3, $4, $5) returning ${ENLACE_COLUMNS}`,
        [params.id, valid.titulo, valid.descripcion, valid.url, valid.tipo]
      )
      return rows[0]
    },
  },
  {
    method: "PUT",
    path: "/api/enlaces/:id",
    level: "member",
    handler: async ({ req, params, db, access }) => {
      const id = Number(params.id)
      if (!Number.isInteger(id)) throw badRequest("Id inválido")
      const body = await readJson(req)
      const valid = validateEnlace({
        titulo: optStr(body.titulo, "titulo", 300),
        descripcion: optStr(body.descripcion, "descripcion", 2000),
        url: optStr(body.url, "url", 2000),
        tipo: optStr(body.tipo, "tipo", 40) || undefined,
      })
      if (!valid.ok) throw badRequest(valid.message)

      // Solo el admin puede mover un enlace a otra propiedad.
      const moveTo =
        access.usuario.rol === "admin" && typeof body.propiedad_id === "string"
          ? body.propiedad_id
          : null
      if (moveTo) {
        const exists = await db.query("select 1 from public.propiedades where id = $1", [moveTo])
        if (exists.length === 0) throw badRequest("La propiedad indicada no existe")
      }

      const rows = await db.query(
        `update public.enlaces
            set titulo = $2, descripcion = $3, url = $4, tipo = $5,
                propiedad_id = coalesce($6, propiedad_id)
          where id = $1
          returning ${ENLACE_COLUMNS}`,
        [id, valid.titulo, valid.descripcion, valid.url, valid.tipo, moveTo]
      )
      if (rows.length === 0) throw notFound()
      return rows[0]
    },
  },
  {
    method: "DELETE",
    path: "/api/enlaces/:id",
    level: "member",
    handler: async ({ params, db }) => {
      const id = Number(params.id)
      if (!Number.isInteger(id)) throw badRequest("Id inválido")
      const rows = await db.query("delete from public.enlaces where id = $1 returning id", [id])
      if (rows.length === 0) throw notFound()
      return { ok: true }
    },
  },
]
