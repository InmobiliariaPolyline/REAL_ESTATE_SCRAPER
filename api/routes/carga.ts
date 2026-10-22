import { audit } from "../audit"
import type { Db } from "../db"
import {
  FUENTE,
  configurada,
  contextoDeGasto,
  cupoRestante,
  gastoEstimadoUsd,
  topeMensualMaximo,
  usoDelCiclo,
  iniciarCarga,
  leerConfig,
  procesarResultado,
  type EventoApify,
} from "../carga"
import { HttpError, badRequest, forbidden, readJson, timingSafeEqual } from "../http"
import type { Route } from "../router"

/** Últimas corridas; tolera una base sin la columna `actor` (aún sin re-ejecutar db/007). */
async function corridasRecientes(db: Db) {
  const columnas = `id::int as id, estado, origen, iniciada_por, avisos_pedidos, avisos_recibidos,
                    avisos_guardados, detalle, iniciada_en, finalizada_en`
  try {
    return await db.query(`select ${columnas}, actor from public.carga_corridas where fuente = $1 order by iniciada_en desc limit 10`, [FUENTE])
  } catch (err) {
    if (!/\bactor\b/.test(String((err as { message?: string })?.message ?? ""))) throw err
    return db.query(`select ${columnas} from public.carga_corridas where fuente = $1 order by iniciada_en desc limit 10`, [FUENTE])
  }
}

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
      const config = await leerConfig(db)
      const { apify, limites: l, ciclo: ventana } = await contextoDeGasto(env, config.dia_reinicio)
      const [usado, corridas] = await Promise.all([usoDelCiclo(db, ventana.desde), corridasRecientes(db)])
      const tope = topeMensualMaximo(l)
      const gasto = apify ? apify.gastoUsd : gastoEstimadoUsd(usado, l.costoPorMil)
      return {
        configurada: configurada(env),
        config,
        usado,
        restante: cupoRestante(config, usado, l, apify?.gastoUsd).restante,
        // `apify`: los datos de ciclo, crédito y gasto vienen de la cuenta de Apify (automáticos).
        origen_datos: apify ? "apify" : "estimado",
        ventana: { desde: ventana.desdeFecha, reinicia: ventana.reiniciaFecha },
        credito: {
          usd: l.creditoUsd,
          costo_por_mil: l.costoPorMil,
          gasto_usd: Math.round(gasto * 1000) / 1000,
        },
        limites: { tope_mensual: tope, maximo_por_corrida: tope, dia_reinicio: [1, 28] },
        corridas,
      }
    },
  },
  {
    method: "PUT",
    path: "/api/admin/carga",
    level: "admin",
    handler: async ({ req, db, env, access }) => {
      const body = await readJson(req)
      const actual = await leerConfig(db)
      const maximoPermitido = topeMensualMaximo((await contextoDeGasto(env, actual.dia_reinicio)).limites)

      const pausada = body.pausada === undefined ? actual.pausada : body.pausada === true
      const tope = body.tope_mensual === undefined ? actual.tope_mensual : entero(body.tope_mensual, "El tope mensual", 0, maximoPermitido)
      const maximo =
        body.maximo_por_corrida === undefined
          ? actual.maximo_por_corrida
          : entero(body.maximo_por_corrida, "El máximo por corrida", 1, Math.max(1, maximoPermitido))

      const dia =
        body.dia_reinicio === undefined ? actual.dia_reinicio : entero(body.dia_reinicio, "El día de reinicio", 1, 28)

      await db.query(
        `update public.carga_config
            set pausada = $1, tope_mensual = $2, maximo_por_corrida = $3, dia_reinicio = $4, actualizado_en = now()
          where id = 1`,
        [pausada, tope, maximo, dia]
      )
      await audit({ db, req, access }, "carga.config", null, { pausada, tope_mensual: tope, maximo_por_corrida: maximo, dia_reinicio: dia })
      return { pausada, tope_mensual: tope, maximo_por_corrida: maximo, dia_reinicio: dia }
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
