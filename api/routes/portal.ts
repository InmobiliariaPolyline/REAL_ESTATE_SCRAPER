import { MAX_PAGE_SIZE, PORTAL_PAGE_SIZE } from "../../shared/constants"
import { validateEnlace } from "../../shared/validation"
import { usdToPenRate } from "../env"
import { badRequest, intParam, notFound, optStr, readJson } from "../http"
import {
  ENLACE_COLUMNS,
  buildPortalCount,
  buildPortalQuery,
  parsePortalFilters,
} from "../propertyQueries"
import type { Route } from "../router"

/** Páginas del portal y enlaces de apoyo (admin y suscriptores vigentes). */
export const portalRoutes: Route[] = [
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
