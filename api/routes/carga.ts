import { audit } from "../audit"
import type { Db } from "../db"
import {
  FUENTES_IDS,
  configurada,
  contextoDeGasto,
  cupoRestante,
  gastoEstimadoUsd,
  topeMensualMaximo,
  usosPorFuente,
  topeDeFuente,
  fuentesDeCarga,
  type FuenteId,
  iniciarCarga,
  iniciarCargaTodas,
  leerConfig,
  procesarResultado,
  type EventoApify,
} from "../carga"
import { HttpError, badRequest, forbidden, readJson, timingSafeEqual } from "../http"
import type { Route } from "../router"

/** Últimas corridas; tolera una base sin la columna `actor` (aún sin re-ejecutar db/007). */
async function corridasRecientes(db: Db) {
  const columnas = `id::int as id, fuente, estado, origen, iniciada_por, avisos_pedidos, avisos_recibidos,
                    avisos_guardados, detalle, iniciada_en, finalizada_en`
  try {
    return await db.query(`select ${columnas}, actor from public.carga_corridas order by iniciada_en desc limit 10`)
  } catch (err) {
    if (!/\bactor\b/.test(String((err as { message?: string })?.message ?? ""))) throw err
    return db.query(`select ${columnas} from public.carga_corridas order by iniciada_en desc limit 10`)
  }
}

const catalogoUrbania = (env: Parameters<typeof fuentesDeCarga>[0]) => fuentesDeCarga(env).urbania.actores.principal

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
      const [usos, corridas] = await Promise.all([usosPorFuente(db, ventana.desde), corridasRecientes(db)])
      const usado = usos.adondevivir
      const tope = topeMensualMaximo(l)
      const gasto = apify ? apify.gastoUsd : gastoEstimadoUsd(usado + usos.urbania, l.costoPorMil)
      const catalogo = fuentesDeCarga(env)
      const fuentes = FUENTES_IDS.map(id => {
        const actor = catalogo[id].actores.principal
        const lim = { ...l, costoPorMil: actor.costoPorMil, costoFijoUsd: actor.costoFijoUsd }
        const maxCorrida = actor.maxPorCorrida ?? config.maximo_por_corrida
        return {
          id,
          nombre: catalogo[id].nombre,
          usado: usos[id],
          tope: topeDeFuente(config, id),
          tope_maximo: topeMensualMaximo(lim),
          maximo_por_corrida: maxCorrida,
          restante: cupoRestante({ ...config, tope_mensual: topeDeFuente(config, id) }, usos[id], lim, apify?.gastoUsd).restante,
        }
      })
      return {
        configurada: configurada(env),
        config,
        usado,
        fuentes,
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

      const urbania = catalogoUrbania(env)
      const topeUrbania =
        body.tope_urbania === undefined
          ? actual.tope_urbania
          : entero(body.tope_urbania, "El tope de Urbania", 0, topeMensualMaximo((await contextoDeGasto(env, actual.dia_reinicio, urbania)).limites))

      const dia =
        body.dia_reinicio === undefined ? actual.dia_reinicio : entero(body.dia_reinicio, "El día de reinicio", 1, 28)

      await db.query(
        `update public.carga_config
            set pausada = $1, tope_mensual = $2, maximo_por_corrida = $3, dia_reinicio = $4, tope_urbania = $5, actualizado_en = now()
          where id = 1`,
        [pausada, tope, maximo, dia, topeUrbania]
      )
      await audit({ db, req, access }, "carga.config", null, { pausada, tope_mensual: tope, maximo_por_corrida: maximo, dia_reinicio: dia, tope_urbania: topeUrbania })
      return { pausada, tope_mensual: tope, maximo_por_corrida: maximo, dia_reinicio: dia, tope_urbania: topeUrbania }
    },
  },
  {
    method: "POST",
    path: "/api/admin/carga/ejecutar",
    level: "admin",
    handler: async ({ req, db, env, access }) => {
      const pedida = (await readJson(req).catch((): Record<string, unknown> => ({}))).fuente
      if (pedida !== undefined && pedida !== "todas" && !FUENTES_IDS.includes(pedida as FuenteId)) throw badRequest("fuente desconocida")
      const fallo = (r: { motivo: string; detalle: string }) =>
        new HttpError(r.motivo === "error" ? 502 : r.motivo === "sin_configurar" ? 501 : 409, `carga_${r.motivo}`, r.detalle)

      if (pedida !== undefined && pedida !== "todas") {
        const r = await iniciarCarga(db, env, "manual", access.usuario.usuario, pedida as FuenteId)
        if (!r.ok) throw fallo(r)
        await audit({ db, req, access }, "carga.iniciar", r.fuente, { avisos: r.items, origen: "manual" })
        return { ok: true, items: r.items, fuente: r.fuente }
      }

      // Sin fuente (o «todas»): una corrida por fuente.
      const todas = await iniciarCargaTodas(db, env, "manual", access.usuario.usuario)
      const lanzadas = todas.flatMap(t => (t.resultado.ok ? [{ fuente: t.fuente, items: t.resultado.items }] : []))
      if (lanzadas.length === 0) {
        const primera = todas.find(t => !t.resultado.ok)?.resultado
        throw fallo(primera && !primera.ok ? primera : { motivo: "tope", detalle: "No se pudo iniciar ninguna carga." })
      }
      for (const l of lanzadas) await audit({ db, req, access }, "carga.iniciar", l.fuente, { avisos: l.items, origen: "manual" })
      const omitidas = todas.flatMap(t => (t.resultado.ok ? [] : [{ fuente: t.fuente, motivo: t.resultado.motivo, detalle: t.resultado.detalle }]))
      return { ok: true, items: lanzadas.reduce((n, l) => n + l.items, 0), lanzadas, omitidas }
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
