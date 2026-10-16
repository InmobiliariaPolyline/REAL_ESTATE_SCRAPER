import { ADMIN_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PASSWORD_LENGTH, PREMIUM_DAYS } from "../../shared/constants"
import { escapeLike } from "../../shared/filters"
import { AUDIT_ACTIONS, audit } from "../audit"
import { CLEANUP_MAX_DAYS, CLEANUP_MIN_DAYS, previewCleanup, runCleanup } from "../cleanup"
import { HttpError, badRequest, forbidden, intParam, notFound, optNumber, optStr, readJson, str } from "../http"
import {
  buildAdminCount,
  buildAdminQuery,
  parseAdminFilters,
  propertyColumns,
} from "../propertyQueries"
import type { Db } from "../db"
import type { Route } from "../router"
import { favoritosRoutes } from "./favoritos"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HISTORY_LIMIT = 50
const ACCESS_LOG_LIMIT = 50
const ENLACES_LIMIT = 5000
const LOOKUP_LIMIT = 20

/** Días de inactividad para la limpieza, validados al rango permitido. */
function cleanupDays(value: string | null): number {
  const days = intParam(value, 30, 1, 100000)
  if (days < CLEANUP_MIN_DAYS || days > CLEANUP_MAX_DAYS) {
    throw badRequest(`Los días deben estar entre ${CLEANUP_MIN_DAYS} y ${CLEANUP_MAX_DAYS}`)
  }
  return days
}

/** Nombre de usuario para los registros de auditoría (null si no existe). */
async function nameOf(db: Db, id: number): Promise<string | null> {
  const rows = await db.query<{ usuario: string }>("select usuario from public.usuarios where id = $1", [id])
  return rows[0]?.usuario ?? null
}

const bigintId = (value: string, field = "id"): number => {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${field} inválido`)
  return n
}

/** Traduce los errores de las funciones SQL a respuestas HTTP con mensaje claro. */
function mapDbError(err: unknown): never {
  const msg = String((err as { message?: string })?.message ?? "")
  if (err instanceof HttpError) throw err
  if (/usuario_duplicado/.test(msg)) throw new HttpError(409, "duplicado", "Ese nombre de usuario ya existe")
  if (/password_corta/.test(msg)) throw badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  if (/usuario_vacio|rol_invalido|estado_invalido|dias_invalidos/.test(msg)) throw badRequest("Datos inválidos")
  if (/usuario_inexistente/.test(msg)) throw notFound()
  throw err
}

export const adminRoutes: Route[] = [
  ...favoritosRoutes("/api/admin", "admin"),

  // ── Propiedades ──────────────────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/admin/propiedades",
    level: "admin",
    handler: async ({ url, db }) => {
      const filters = parseAdminFilters(url.searchParams)
      const pageSize = intParam(url.searchParams.get("pageSize"), ADMIN_PAGE_SIZE, 1, MAX_PAGE_SIZE)
      const page = intParam(url.searchParams.get("page"), 0, 0, 100000)

      const q = buildAdminQuery(filters, page, pageSize)
      const rows = await db.query<Record<string, unknown> & { total: number }>(q.text, q.params)
      let count = rows[0]?.total ?? 0
      if (rows.length === 0 && page > 0) {
        const c = buildAdminCount(filters)
        count = (await db.query<{ total: number }>(c.text, c.params))[0]?.total ?? 0
      }
      return { data: rows.map(({ total: _t, ...row }) => row), count }
    },
  },
  {
    method: "DELETE",
    path: "/api/admin/propiedades/:id",
    level: "admin",
    handler: async ({ req, params, db, access }) => {
      const rows = await db.query("delete from public.propiedades where id = $1 returning id", [params.id])
      if (rows.length === 0) throw notFound()
      await audit({ db, req, access }, "propiedad.eliminar", params.id)
      return { ok: true }
    },
  },
  {
    method: "GET",
    path: "/api/admin/propiedades-lookup",
    level: "admin",
    handler: async ({ url, db }) => {
      const term = (url.searchParams.get("q") ?? "").trim().slice(0, 80)
      if (term.length < 2) return []
      return db.query(
        `select id, portal, operacion, inmueble, titulo, distrito
           from public.propiedades
          where titulo ilike $1 or distrito ilike $1 or id = $2
          order by creado_en desc
          limit ${LOOKUP_LIMIT}`,
        [`%${escapeLike(term)}%`, term]
      )
    },
  },

  // ── Enlaces (vista global del admin) ─────────────────────────────────────
  {
    method: "GET",
    path: "/api/admin/enlaces",
    level: "admin",
    handler: async ({ db }) =>
      db.query(
        `select e.id::int as id, e.propiedad_id, e.titulo, e.descripcion, e.url, e.tipo, e.creado_en,
                case when p.id is null then null else json_build_object(
                  'id', p.id, 'portal', p.portal, 'operacion', p.operacion,
                  'inmueble', p.inmueble, 'titulo', p.titulo, 'distrito', p.distrito
                ) end as propiedad
           from public.enlaces e
           left join public.propiedades p on p.id = e.propiedad_id
          order by e.creado_en desc
          limit ${ENLACES_LIMIT}`
      ),
  },

  // ── Historial de vistos ──────────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/admin/historial",
    level: "admin",
    handler: async ({ db, access }) => {
      const [ids, propiedades] = await Promise.all([
        db.query<{ propiedad_id: string }>(
          "select propiedad_id from public.historial where admin_id = $1",
          [access.usuario.id]
        ),
        db.query(
          `select ${propertyColumns("p")}
             from public.historial h
             join public.propiedades p on p.id = h.propiedad_id
            where h.admin_id = $1
            order by h.visto_en desc
            limit ${HISTORY_LIMIT}`,
          [access.usuario.id]
        ),
      ])
      return { ids: ids.map(r => r.propiedad_id), propiedades }
    },
  },
  {
    method: "PUT",
    path: "/api/admin/historial",
    level: "admin",
    handler: async ({ req, db, access }) => {
      const body = await readJson(req)
      const propiedadId = str(body.propiedad_id, "propiedad_id", 200)
      await db.query(
        `insert into public.historial (admin_id, propiedad_id, visto_en)
         select $1, id, now() from public.propiedades where id = $2
         on conflict (admin_id, propiedad_id) do update set visto_en = excluded.visto_en`,
        [access.usuario.id, propiedadId]
      )
      return { ok: true }
    },
  },

  // ── Búsquedas guardadas ──────────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/admin/busquedas",
    level: "admin",
    handler: async ({ db, access }) =>
      db.query(
        `select id, nombre, distrito, operacion, portal,
                precio_min::float8 as precio_min, precio_max::float8 as precio_max
           from public.busquedas_guardadas
          where admin_id = $1
          order by creado_en desc`,
        [access.usuario.id]
      ),
  },
  {
    method: "POST",
    path: "/api/admin/busquedas",
    level: "admin",
    handler: async ({ req, db, access }) => {
      const body = await readJson(req)
      const nombre = str(body.nombre, "nombre", 80).trim()
      if (!nombre) throw badRequest("Ponle un nombre a la búsqueda")
      const num = (v: unknown) => (v === null || v === undefined ? null : optNumber(String(v)))

      const rows = await db.query(
        `insert into public.busquedas_guardadas
           (admin_id, nombre, distrito, operacion, portal, precio_min, precio_max)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id`,
        [
          access.usuario.id,
          nombre,
          optStr(body.distrito, "distrito", 80),
          optStr(body.operacion, "operacion", 40) || "todos",
          optStr(body.portal, "portal", 40) || "todos",
          num(body.precio_min),
          num(body.precio_max),
        ]
      )
      return rows[0]
    },
  },
  {
    method: "DELETE",
    path: "/api/admin/busquedas/:id",
    level: "admin",
    handler: async ({ params, db, access }) => {
      if (!UUID.test(params.id)) throw badRequest("Id inválido")
      const rows = await db.query(
        "delete from public.busquedas_guardadas where id = $1 and admin_id = $2 returning id",
        [params.id, access.usuario.id]
      )
      if (rows.length === 0) throw notFound()
      return { ok: true }
    },
  },

  // ── Usuarios y suscripciones ─────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/admin/usuarios",
    level: "admin",
    handler: async ({ db }) =>
      db.query(
        `select u.id::int as id, u.usuario, u.rol, u.estado, u.creado_en, u.ultima_conexion,
                (select json_build_object(
                          'id', s.id, 'usuario_id', s.usuario_id, 'fecha_inicio', s.fecha_inicio,
                          'fecha_vencimiento', s.fecha_vencimiento,
                          'fecha_limite_eliminacion', s.fecha_limite_eliminacion)
                   from public.suscripciones s
                  where s.usuario_id = u.id
                    and s.fecha_vencimiento >= (now() at time zone 'America/Lima')::date
                  order by s.fecha_vencimiento desc
                  limit 1) as "suscripcionActiva"
           from public.usuarios u
          order by u.creado_en desc`
      ),
  },
  {
    method: "POST",
    path: "/api/admin/usuarios",
    level: "admin",
    handler: async ({ req, db, access }) => {
      const body = await readJson(req)
      const usuario = str(body.usuario, "usuario", 100).trim()
      const password = str(body.password, "password", 200)
      const rol = optStr(body.rol, "rol", 20) || "usuario"
      const estado = optStr(body.estado, "estado", 20) || "activo"
      try {
        const rows = await db.query<{ id: string | number }>(
          "select public.crear_usuario($1, $2, $3, $4, $5) as id",
          [usuario, password, rol, estado, body.premium === true]
        )
        await audit({ db, req, access }, "usuario.crear", usuario, { rol, estado, premium: body.premium === true })
        return { id: Number(rows[0].id) }
      } catch (err) {
        mapDbError(err)
      }
    },
  },
  {
    method: "PATCH",
    path: "/api/admin/usuarios/:id/estado",
    level: "admin",
    handler: async ({ req, params, db, access }) => {
      const id = bigintId(params.id)
      const body = await readJson(req)
      const estado = str(body.estado, "estado", 20)
      if (estado !== "activo" && estado !== "baneado") throw badRequest("Estado inválido")

      const target = await db.query<{ rol: string }>("select rol from public.usuarios where id = $1", [id])
      if (target.length === 0) throw notFound()
      // Evita bloquear a todos los administradores.
      if (target[0].rol === "admin" && estado === "baneado") throw forbidden()

      await db.query("update public.usuarios set estado = $2 where id = $1", [id, estado])
      if (estado === "baneado") {
        await db.query("delete from public.app_sessions where usuario_id = $1", [id])
      }
      await audit({ db, req, access }, "usuario.estado", await nameOf(db, id), { estado })
      return { ok: true }
    },
  },
  {
    method: "POST",
    path: "/api/admin/usuarios/:id/premium",
    level: "admin",
    handler: async ({ req, params, db, access }) => {
      const id = bigintId(params.id)
      try {
        await db.query("select public.activar_premium($1::bigint, $2::int)", [id, PREMIUM_DAYS])
      } catch (err) {
        mapDbError(err)
      }
      await audit({ db, req, access }, "usuario.premium", await nameOf(db, id), { dias: PREMIUM_DAYS })
      return { ok: true }
    },
  },

  {
    method: "POST",
    path: "/api/admin/usuarios/:id/cerrar-sesiones",
    level: "admin",
    handler: async ({ req, params, db, access }) => {
      const id = bigintId(params.id)
      const nombre = await nameOf(db, id)
      if (!nombre) throw notFound()
      const rows = await db.query("delete from public.app_sessions where usuario_id = $1 returning sid", [id])
      await audit({ db, req, access }, "usuario.cerrar_sesiones", nombre, { cerradas: rows.length })
      return { ok: true, cerradas: rows.length }
    },
  },

  // ── Auditoría ────────────────────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/admin/auditoria",
    level: "admin",
    handler: async ({ url, db }) => {
      const page = intParam(url.searchParams.get("page"), 0, 0, 100000)
      const pageSize = intParam(url.searchParams.get("pageSize"), 50, 1, 200)
      const accion = (url.searchParams.get("accion") ?? "").trim()
      const usuario = (url.searchParams.get("usuario") ?? "").trim().slice(0, 100)
      if (accion && !(AUDIT_ACTIONS as string[]).includes(accion)) throw badRequest("Acción inválida")

      const params: unknown[] = []
      const where: string[] = []
      if (accion) where.push(`accion = $${params.push(accion)}`)
      if (usuario) where.push(`usuario ilike $${params.push(`%${escapeLike(usuario)}%`)}`)
      const clause = where.length ? `where ${where.join(" and ")}` : ""

      const [rows, total] = await Promise.all([
        db.query(
          `select id::int as id, usuario_id::int as usuario_id, usuario, accion, objetivo, detalle, ip, creado_en
             from public.auditoria ${clause}
            order by creado_en desc, id desc
            limit ${pageSize} offset ${page * pageSize}`,
          params
        ),
        db.query<{ n: number }>(`select count(*)::int as n from public.auditoria ${clause}`, params),
      ])
      return { data: rows, count: total[0]?.n ?? 0, acciones: AUDIT_ACTIONS }
    },
  },

  // ── Métricas y accesos ───────────────────────────────────────────────────
  {
    method: "GET",
    path: "/api/admin/stats",
    level: "admin",
    handler: async ({ db }) => {
      const [totals, porPortal, porDia] = await Promise.all([
        db.query(
          `select
             (select count(*)::int from public.propiedades) as "totalProps",
             (select count(*)::int from public.usuarios) as "totalUsers",
             (select count(distinct usuario_id)::int from public.suscripciones
               where fecha_vencimiento >= (now() at time zone 'America/Lima')::date) as "subsActivas",
             (select count(*)::int from public.propiedades
               where creado_en >= (date_trunc('day', now() at time zone 'America/Lima') at time zone 'America/Lima')) as "addedHoy",
             (select count(*)::int from public.propiedades
               where creado_en >= now() - interval '24 hours') as "added24h",
             (select max(creado_en) from public.propiedades) as "ultimoAviso"`
        ),
        db.query(
          `select portal, count(*)::int as count
             from public.propiedades group by portal order by count desc`
        ),
        // Avisos nuevos por día (hora de Lima) en los últimos 30 días, con ceros incluidos.
        db.query(
          `select to_char(d.dia, 'YYYY-MM-DD') as dia, count(p.id)::int as total
             from generate_series(
                    (now() at time zone 'America/Lima')::date - 29,
                    (now() at time zone 'America/Lima')::date,
                    interval '1 day') as d(dia)
             left join public.propiedades p
               on (p.creado_en at time zone 'America/Lima')::date = d.dia::date
            group by d.dia
            order by d.dia`
        ),
      ])
      return { ...totals[0], porPortal, porDia }
    },
  },
  {
    method: "GET",
    path: "/api/admin/accesos",
    level: "admin",
    handler: async ({ db }) =>
      db.query(
        `select h.id::int as id, h.usuario_id::int as usuario_id, h.fecha_acceso, u.usuario
           from public.historial_accesos h
           left join public.usuarios u on u.id = h.usuario_id
          order by h.fecha_acceso desc
          limit ${ACCESS_LOG_LIMIT}`
      ),
  },

  // ── Scraper ──────────────────────────────────────────────────────────────
  {
    method: "POST",
    path: "/api/admin/scraper",
    level: "admin",
    handler: async ({ req, db, env, access }) => {
      const { GITHUB_PAT: pat, GITHUB_REPO: repo, GITHUB_WORKFLOW: workflow } = env
      const faltan = [
        !pat && "GITHUB_PAT",
        !repo && "GITHUB_REPO",
        !workflow && "GITHUB_WORKFLOW",
      ].filter(Boolean)
      if (faltan.length > 0) {
        // Solo nombres de variables, nunca sus valores.
        throw new HttpError(501, "not_configured", `Faltan variables en el servidor: ${faltan.join(", ")}`)
      }
      const res = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: env.GITHUB_REF || "main" }),
        }
      )
      if (!res.ok) {
        console.error("GitHub respondió", res.status, await res.text())
        const motivo =
          res.status === 401 || res.status === 403
            ? "el token (GITHUB_PAT) no es válido o no tiene permiso Actions: write"
            : res.status === 404
              ? "no se encontró el repositorio o el workflow (revisa GITHUB_REPO y GITHUB_WORKFLOW)"
              : res.status === 422
                ? "el workflow no admite ejecución manual (falta workflow_dispatch) o la rama no existe"
                : "respuesta inesperada de GitHub"
        throw new HttpError(502, "github_error", `GitHub rechazó la solicitud (${res.status}): ${motivo}`)
      }
      await audit({ db, req, access }, "scraper.lanzar", env.GITHUB_WORKFLOW ?? null)
      return { ok: true }
    },
  },
  {
    // Vista previa: cuántos avisos se eliminarían y si es seguro hacerlo.
    method: "GET",
    path: "/api/admin/limpieza",
    level: "admin",
    handler: async ({ url, db }) => previewCleanup(db, cleanupDays(url.searchParams.get("dias"))),
  },
  {
    method: "POST",
    path: "/api/admin/limpiar-inactivos",
    level: "admin",
    handler: async ({ req, db, access }) => {
      const body = await readJson(req)
      const dias = cleanupDays(body.dias === undefined ? null : String(body.dias))

      const preview = await previewCleanup(db, dias)
      if (!preview.seguro) {
        throw new HttpError(409, "limpieza_no_segura", preview.motivo ?? "La limpieza no es segura")
      }
      const eliminadas = await runCleanup(db, dias)
      await audit({ db, req, access }, "limpieza.ejecutar", null, { dias, eliminadas, protegidas: preview.protegidas })
      return { ok: true, eliminadas, protegidas: preview.protegidas }
    },
  },
  {
    method: "POST",
    path: "/api/admin/usuarios/:id/password",
    level: "admin",
    handler: async ({ req, params, db, access }) => {
      const id = bigintId(params.id)
      const body = await readJson(req)
      const password = str(body.password, "password", 200)
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
      }
      const rows = await db.query<{ r: string }>(
        "select public.restablecer_password($1::bigint, $2) as r",
        [id, password]
      )
      if (rows[0]?.r === "inexistente") throw notFound()
      if (rows[0]?.r !== "ok") throw badRequest("No se pudo restablecer la contraseña")
      await audit({ db, req, access }, "usuario.password_reset", await nameOf(db, id))
      return { ok: true }
    },
  },
]
