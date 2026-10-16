import type { AuthLevel } from "../auth"
import { notFound, readJson, str } from "../http"
import { propertyColumns } from "../propertyQueries"
import type { Route } from "../router"

/**
 * Favoritos del usuario autenticado. Se monta dos veces con la misma lógica:
 *   /api/admin/favoritos  (admin)    y    /api/favoritos  (suscriptores vigentes y admin).
 * Siempre se opera sobre el usuario de la sesión, nunca sobre un id enviado por el cliente.
 */
export function favoritosRoutes(prefix: string, level: AuthLevel): Route[] {
  return [
    {
      method: "GET",
      path: `${prefix}/favoritos`,
      level,
      handler: async ({ db, access }) => {
        const propiedades = await db.query<{ id: string }>(
          `select ${propertyColumns("p")}
             from public.favoritos f
             join public.propiedades p on p.id = f.propiedad_id
            where f.admin_id = $1
            order by f.creado_en desc`,
          [access.usuario.id]
        )
        return { ids: propiedades.map(p => p.id), propiedades }
      },
    },
    {
      method: "POST",
      path: `${prefix}/favoritos`,
      level,
      handler: async ({ req, db, access }) => {
        const body = await readJson(req)
        const propiedadId = str(body.propiedad_id, "propiedad_id", 200)
        const exists = await db.query("select 1 from public.propiedades where id = $1", [propiedadId])
        if (exists.length === 0) throw notFound()
        await db.query(
          `insert into public.favoritos (admin_id, propiedad_id) values ($1, $2)
           on conflict (admin_id, propiedad_id) do nothing`,
          [access.usuario.id, propiedadId]
        )
        return { ok: true }
      },
    },
    {
      method: "DELETE",
      path: `${prefix}/favoritos/:propiedadId`,
      level,
      handler: async ({ params, db, access }) => {
        await db.query("delete from public.favoritos where admin_id = $1 and propiedad_id = $2", [
          access.usuario.id,
          params.propiedadId,
        ])
        return { ok: true }
      },
    },
  ]
}
