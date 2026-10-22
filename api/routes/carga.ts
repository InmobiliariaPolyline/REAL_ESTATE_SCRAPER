import { audit } from "../audit"
import {
  FUENTE,
  MAXIMO_CORRIDA_MAX,
  TOPE_MENSUAL_MAX,
  configurada,
  iniciarCarga,
  leerConfig,
  procesarResultado,
  usoDelMes,
  type EventoApify,
} from "../carga"
import { HttpError, badRequest, forbidden, readJson, timingSafeEqual } from "../http"
import type { Route } from "../router"

const entero = (value: unknown, campo: string, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw badRequest(`${campo} debe ser un número entero entre ${min} y ${max}`)
  }
  return value
}

/** Carga automática de avisos con Apify: estado y topes (admin) y aviso de fin de corrida (Apify). */
export const cargaRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/admin/carga",
    level: "admin",
    handler: async ({ db, env }) => {
      const [config, usado, corridas] = await Promise.all([
        leerConfig(db),
        usoDelMes(db),
        db.query(
          `select id::int as id, estado, origen, iniciada_por, avisos_pedidos, avisos_recibidos,
                  avisos_guardados, detalle, iniciada_en, finalizada_en
             from public.carga_corridas where fuente = $1
            order by iniciada_en desc limit 10`,
          [FUENTE]
        ),
      ])
      return {
        configurada: configurada(env),
        config,
        usado,
        restante: Math.max(0, config.tope_mensual - usado),
        limites: { tope_mensual: TOPE_MENSUAL_MAX, maximo_por_corrida: MAXIMO_CORRIDA_MAX },
        corridas,
      }
    },
  },
  {
    method: "PUT",
    path: "/api/admin/carga",
    level: "admin",
    handler: async ({ req, db, access }) => {
      const body = await readJson(req)
      const actual = await leerConfig(db)

      const pausada = body.pausada === undefined ? actual.pausada : body.pausada === true
      const tope = body.tope_mensual === undefined ? actual.tope_mensual : entero(body.tope_mensual, "El tope mensual", 0, TOPE_MENSUAL_MAX)
      const maximo =
        body.maximo_por_corrida === undefined
          ? actual.maximo_por_corrida
          : entero(body.maximo_por_corrida, "El máximo por corrida", 1, MAXIMO_CORRIDA_MAX)

      await db.query(
        `update public.carga_config
            set pausada = $1, tope_mensual = $2, maximo_por_corrida = $3, actualizado_en = now()
          where id = 1`,
        [pausada, tope, maximo]
      )
      await audit({ db, req, access }, "carga.config", null, { pausada, tope_mensual: tope, maximo_por_corrida: maximo })
      return { pausada, tope_mensual: tope, maximo_por_corrida: maximo }
    },
  },
  {
    method: "POST",
    path: "/api/admin/carga/ejecutar",
    level: "admin",
    handler: async ({ req, db, env, access }) => {
      const r = await iniciarCarga(db, env, "manual", access.usuario.usuario)
      if (!r.ok) {
        const status = r.motivo === "error" ? 502 : r.motivo === "sin_configurar" ? 501 : 409
        throw new HttpError(status, `carga_${r.motivo}`, r.detalle)
      }
      await audit({ db, req, access }, "carga.iniciar", FUENTE, { avisos: r.items, origen: "manual" })
      return { ok: true, items: r.items }
    },
  },
  {
    // Apify llama aquí cuando termina una corrida. Se autoriza con un secreto en la dirección.
    method: "POST",
    path: "/api/internal/apify-webhook",
    level: "public",
    handler: async ({ req, url, db, env }) => {
      if (!env.APIFY_WEBHOOK_SECRET) throw new HttpError(501, "not_configured", "APIFY_WEBHOOK_SECRET no está configurado")
      if (!timingSafeEqual(url.searchParams.get("secret") ?? "", env.APIFY_WEBHOOK_SECRET)) throw forbidden()
      const evento = (await readJson(req)) as EventoApify
      return procesarResultado(db, env, evento)
    },
  },
]
