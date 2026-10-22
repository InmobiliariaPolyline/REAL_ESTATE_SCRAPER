import { afterEach, describe, expect, it, vi } from "vitest"
import {
  URLS_POR_DEFECTO,
  configurada,
  cicloDeApify,
  costoPorMil,
  creditoUsd,
  cupoRestante,
  elegirUrl,
  lanzarCorrida,
  leerEstadoApify,
  mapearAviso,
  planificar,
  sitioPublico,
  topeDolares,
  topeMensualMaximo,
  urlsDeBusqueda,
  ventanaDeUso,
  type CargaConfig,
} from "./carga"

const config: CargaConfig = { pausada: false, tope_mensual: 1000, maximo_por_corrida: 200, dia_reinicio: 23 }

describe("planificar (los topes)", () => {
  it("pausada: nunca se pide nada", () => {
    expect(planificar({ ...config, pausada: true }, 0, false)).toMatchObject({ ok: false, motivo: "pausada" })
  })

  it("con una corrida en curso no se lanza otra", () => {
    expect(planificar(config, 0, true)).toMatchObject({ ok: false, motivo: "en_curso" })
  })

  it("pide como máximo lo permitido por corrida", () => {
    expect(planificar(config, 0, false)).toEqual({ ok: true, items: 200 })
  })

  it("nunca pide más de lo que queda del tope mensual", () => {
    expect(planificar(config, 950, false)).toEqual({ ok: true, items: 50 })
    expect(planificar(config, 999, false)).toEqual({ ok: true, items: 1 })
  })

  it("con el tope agotado (o superado) no se pide nada", () => {
    expect(planificar(config, 1000, false)).toMatchObject({ ok: false, motivo: "tope" })
    expect(planificar(config, 1500, false)).toMatchObject({ ok: false, motivo: "tope" })
    expect(planificar({ ...config, tope_mensual: 0 }, 0, false)).toMatchObject({ ok: false, motivo: "tope" })
  })
})

describe("tope mensual máximo según el crédito gratuito", () => {
  it("con US$ 5 y US$ 3 por 1 000 caben 1 500 avisos (se usa el 90 % del crédito)", () => {
    expect(topeMensualMaximo()).toBe(1500)
    expect(topeMensualMaximo({ costoPorMil: 3, creditoUsd: 5 })).toBe(1500)
  })

  it("se ajusta si cambia el precio o el crédito, y nunca supera el límite de la base", () => {
    expect(topeMensualMaximo({ costoPorMil: 8, creditoUsd: 5 })).toBe(562)
    expect(topeMensualMaximo({ costoPorMil: 3, creditoUsd: 10 })).toBe(3000)
    expect(topeMensualMaximo({ costoPorMil: 0.1, creditoUsd: 500 })).toBe(5000)
  })

  it("un tope configurado más alto que el permitido se recorta", () => {
    expect(cupoRestante({ ...config, tope_mensual: 5000 }, 0).restante).toBe(1500)
    expect(planificar({ ...config, tope_mensual: 5000, maximo_por_corrida: 2000 }, 1400, false)).toEqual({ ok: true, items: 100 })
    expect(planificar({ ...config, tope_mensual: 5000 }, 1500, false)).toMatchObject({ ok: false, motivo: "tope" })
  })

  it("APIFY_CREDIT_USD ajusta el crédito, con valores inválidos ignorados", () => {
    expect(creditoUsd({})).toBe(5)
    expect(creditoUsd({ APIFY_CREDIT_USD: "10" })).toBe(10)
    expect(creditoUsd({ APIFY_CREDIT_USD: "-3" })).toBe(5)
    expect(creditoUsd({ APIFY_CREDIT_USD: "100000" })).toBe(5)
  })
})

describe("ventanaDeUso (el ciclo del crédito de Apify)", () => {
  const v = (dia: number, iso: string) => ventanaDeUso(dia, new Date(iso))

  it("antes del día de reinicio el ciclo empezó el mes anterior", () => {
    expect(v(23, "2026-10-22T17:00:00Z")).toMatchObject({ desdeFecha: "2026-09-23", reiniciaFecha: "2026-10-23" })
  })

  it("el cambio ocurre a medianoche de Lima (05:00 UTC)", () => {
    expect(v(23, "2026-10-23T04:59:00Z").desdeFecha).toBe("2026-09-23")
    expect(v(23, "2026-10-23T05:00:00Z")).toMatchObject({ desdeFecha: "2026-10-23", reiniciaFecha: "2026-11-23" })
  })

  it("cruza el cambio de año en ambos sentidos", () => {
    expect(v(23, "2027-01-10T12:00:00Z")).toMatchObject({ desdeFecha: "2026-12-23", reiniciaFecha: "2027-01-23" })
    expect(v(23, "2026-12-30T12:00:00Z")).toMatchObject({ desdeFecha: "2026-12-23", reiniciaFecha: "2027-01-23" })
  })

  it("con el día 1 equivale al mes calendario", () => {
    expect(v(1, "2026-10-22T12:00:00Z")).toMatchObject({ desdeFecha: "2026-10-01", reiniciaFecha: "2026-11-01" })
  })

  it("un día inválido se corrige a un valor seguro y `desde` es un instante de Lima", () => {
    expect(v(0, "2026-10-22T12:00:00Z").desdeFecha).toBe("2026-09-23") // 0 -> día por defecto (23)
    expect(v(99, "2026-10-22T12:00:00Z").desdeFecha).toBe("2026-09-28") // se recorta a 28
    expect(v(23, "2026-10-22T12:00:00Z").desde).toBe("2026-09-23T00:00:00-05:00")
  })
})

describe("topeDolares", () => {
  it("costo esperado + 10 % de margen, redondeado hacia arriba, más un centavo", () => {
    expect(topeDolares(100, 3)).toBeCloseTo(0.34, 5) // 0.30 x 1.10 = 0.33 -> 0.34
    expect(topeDolares(50, 3)).toBeCloseTo(0.18, 5)
    expect(topeDolares(1000, 8)).toBeGreaterThanOrEqual(8.81)
    expect(topeDolares(1000, 8)).toBeLessThanOrEqual(8.83)
  })

  it("siempre cubre el costo real esperado", () => {
    for (const n of [1, 10, 137, 1000, 2000]) expect(topeDolares(n, 3)).toBeGreaterThan((n * 3) / 1000)
  })
})

describe("configuración por entorno", () => {
  it("el costo por 1 000 usa el valor válido o el predeterminado", () => {
    expect(costoPorMil({})).toBe(3)
    expect(costoPorMil({ APIFY_COST_PER_1000: "8" })).toBe(8)
    expect(costoPorMil({ APIFY_COST_PER_1000: "-1" })).toBe(3)
    expect(costoPorMil({ APIFY_COST_PER_1000: "999" })).toBe(3)
  })

  it("el sitio público exige https y acepta URL o PUBLIC_URL", () => {
    expect(sitioPublico({ URL: "https://sitio.netlify.app/" })).toBe("https://sitio.netlify.app")
    expect(sitioPublico({ PUBLIC_URL: "https://propio.com", URL: "https://otro.app" })).toBe("https://propio.com")
    expect(sitioPublico({ URL: "http://inseguro.com" })).toBeNull()
    expect(sitioPublico({})).toBeNull()
  })

  it("solo está configurada con token, secreto y sitio", () => {
    const base = { APIFY_TOKEN: "t", APIFY_WEBHOOK_SECRET: "s", URL: "https://x.app" }
    expect(configurada(base)).toBe(true)
    expect(configurada({ ...base, APIFY_TOKEN: undefined })).toBe(false)
    expect(configurada({ ...base, APIFY_WEBHOOK_SECRET: "" })).toBe(false)
    expect(configurada({ ...base, URL: undefined })).toBe(false)
  })

  it("las búsquedas propias solo se aceptan si son de Adondevivir; si no, se usan las del código", () => {
    expect(urlsDeBusqueda({})).toEqual(URLS_POR_DEFECTO)
    expect(urlsDeBusqueda({ CARGA_URLS: "https://www.adondevivir.com/casas-en-venta.html, https://malo.com/x.html" })).toEqual([
      "https://www.adondevivir.com/casas-en-venta.html",
    ])
    expect(urlsDeBusqueda({ CARGA_URLS: "javascript:alert(1)" })).toEqual(URLS_POR_DEFECTO)
  })

  it("rota las búsquedas una por corrida", () => {
    const urls = ["a", "b", "c"]
    expect([0, 1, 2, 3, 4].map(n => elegirUrl(urls, n))).toEqual(["a", "b", "c", "a", "b"])
  })
})

describe("mapearAviso", () => {
  const base = {
    id: "147842493",
    title: "Se Vende Casa Comercial en Carabayllo",
    operationType: "Venta",
    price: 717500,
    currency: "S/",
    propertyType: "Casas",
    areaBuilt: 279,
    bedrooms: 5,
    bathrooms: 4,
    neighborhood: "Carabayllo",
    city: "Lima",
    image: "https://img/foto.jpg",
    url: "https://www.adondevivir.com/propiedades/clasificado/veclcain-x-147842493.html",
  }

  it("convierte un registro completo", () => {
    expect(mapearAviso(base)).toMatchObject({
      portal: "adondevivir",
      codigo: "147842493",
      operacion: "VENTA",
      inmueble: "Casa",
      precio: 717500,
      moneda: "PEN",
      distrito: "Carabayllo",
      dormitorios: "5",
      banios: "4",
      area: "279 m2",
    })
  })

  it("reconoce dólares, alquiler y tipos nuevos", () => {
    const a = mapearAviso({ ...base, operationType: "Alquiler", currency: "US$", propertyType: "Terrenos", areaBuilt: null, areaLot: 1200 })!
    expect(a).toMatchObject({ operacion: "ALQUILER", moneda: "USD", inmueble: "Terreno", area: "1200 m2" })
  })

  it("los proyectos inmobiliarios se agrupan y un barrio «S/n» se reemplaza por la ciudad", () => {
    const a = mapearAviso({ id: "1", title: "Vizuale 5", operationType: "Alquiler", propertyType: "Desarrollos verticales", neighborhood: "S/n", city: "Lince", price: null })!
    expect(a).toMatchObject({ inmueble: "Proyecto", distrito: "Lince" })
    expect(mapearAviso({ id: "2", title: "x", operationType: "Venta", propertyType: "Edificios", neighborhood: "Miraflores" })).toMatchObject({ inmueble: "Proyecto", distrito: "Miraflores" })
  })

  it("los campos que faltan quedan sin inventar", () => {
    const a = mapearAviso({ id: 9, title: "Lote", operationType: "Venta", price: null, bedrooms: null })!
    expect(a.codigo).toBe("9")
    expect(a.precio).toBeUndefined()
    expect(a.dormitorios).toBeUndefined()
    expect(a.distrito).toBeUndefined()
  })

  it("omite registros que no sirven (aviso «no-listings», sin operación o sin título)", () => {
    expect(mapearAviso({ type: "no-listings" })).toBeNull()
    expect(mapearAviso({ ...base, operationType: "Traspaso" })).toBeNull()
    expect(mapearAviso({ ...base, title: "  " })).toBeNull()
    expect(mapearAviso({ ...base, id: undefined })).toBeNull()
  })
})

describe("lanzarCorrida", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("envía los topes, la búsqueda y el aviso de fin; el token va en la cabecera", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: "run9", defaultDatasetId: "ds9" } }), { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    const r = await lanzarCorrida({
      token: "TOKEN-SECRETO",
      actor: "gio21~adondevivir-scraper",
      url: "https://www.adondevivir.com/casas-en-venta.html",
      items: 50,
      topeUsd: 0.2,
      webhookUrl: "https://sitio.app/api/internal/apify-webhook?secret=abc",
    })
    expect(r).toEqual({ runId: "run9", datasetId: "ds9" })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const u = new URL(url)
    expect(u.pathname).toBe("/v2/acts/gio21~adondevivir-scraper/runs")
    expect(u.searchParams.get("maxItems")).toBe("50")
    expect(u.searchParams.get("maxTotalChargeUsd")).toBe("0.2")
    expect(u.searchParams.get("timeout")).toBe("900")
    expect(url).not.toContain("TOKEN-SECRETO") // el token nunca va en la dirección
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN-SECRETO")
    expect(JSON.parse(init.body as string)).toEqual({ startUrls: ["https://www.adondevivir.com/casas-en-venta.html"], maxItems: 50 })

    const hooks = JSON.parse(Buffer.from(u.searchParams.get("webhooks")!, "base64").toString("utf8"))
    expect(hooks[0].requestUrl).toBe("https://sitio.app/api/internal/apify-webhook?secret=abc")
    expect(hooks[0].eventTypes).toContain("ACTOR.RUN.SUCCEEDED")
    expect(hooks[0].eventTypes).toContain("ACTOR.RUN.FAILED")
  })

  it("falla con claridad si Apify rechaza la petición", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })))
    await expect(
      lanzarCorrida({ token: "t", actor: "a~b", url: "u", items: 1, topeUsd: 1, webhookUrl: "w" })
    ).rejects.toThrow("401")
  })
})

describe("gasto real de la cuenta (cupoRestante con datos de Apify)", () => {
  it("usa el gasto real y no el estimado para saber cuánto crédito queda", () => {
    // Con US$ 4.40 gastados y el 90 % de US$ 5 = 4.50, quedan US$ 0.10 -> 33 avisos a US$ 3 por 1 000.
    expect(cupoRestante(config, 0, undefined, 4.4)).toMatchObject({ porCredito: 33, restante: 33 })
    expect(cupoRestante(config, 0, undefined, 0.015).porCredito).toBe(1495)
  })

  it("con el gasto real al límite del colchón no queda nada, aunque el tope configurado permita más", () => {
    expect(cupoRestante(config, 0, undefined, 4.5).restante).toBe(0)
    expect(planificar(config, 0, false, undefined, 4.5)).toMatchObject({ ok: false, motivo: "credito" })
    expect(planificar(config, 0, false, undefined, 4.4)).toEqual({ ok: true, items: 33 })
  })

  it("el gasto de otras ventanas de uso (p. ej. pruebas manuales) también cuenta", () => {
    // La cuenta ya gastó US$ 3 por su cuenta: ese dinero ya no está disponible para la carga.
    expect(planificar(config, 0, false, undefined, 3)).toEqual({ ok: true, items: 200 })
    expect(cupoRestante({ ...config, tope_mensual: 1500 }, 0, undefined, 3).restante).toBe(500)
  })
})

describe("estado real de Apify", () => {
  afterEach(() => vi.unstubAllGlobals())

  const respuesta = (data: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify({ data }), { status }))
  const buena = {
    monthlyUsageCycle: { startAt: "2026-10-22T00:00:00.000Z", endAt: "2026-11-21T23:59:59.999Z" },
    limits: { maxMonthlyUsageUsd: 5 },
    current: { monthlyUsageUsd: 0.015 },
  }

  it("lee ciclo, crédito y gasto, con el token en la cabecera", async () => {
    const f = respuesta(buena)
    vi.stubGlobal("fetch", f)
    const e = await leerEstadoApify("TOKEN-X")
    expect(e).toEqual({ creditoUsd: 5, gastoUsd: 0.015, cicloInicio: "2026-10-22T00:00:00.000Z", cicloFin: "2026-11-21T23:59:59.999Z" })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.apify.com/v2/users/me/limits")
    expect(url).not.toContain("TOKEN-X")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN-X")
  })

  it("el siguiente ciclo empieza justo después del fin del actual", () => {
    const e = { creditoUsd: 5, gastoUsd: 0, cicloInicio: "2026-10-22T00:00:00.000Z", cicloFin: "2026-11-21T23:59:59.999Z" }
    expect(cicloDeApify(e)).toEqual({ desde: "2026-10-22T00:00:00.000Z", desdeFecha: "2026-10-22", reiniciaFecha: "2026-11-22" })
  })

  it("devuelve null (y el sistema usa sus estimaciones) si Apify falla o responde algo inesperado", async () => {
    for (const f of [
      respuesta(buena, 401),
      respuesta({ ...buena, limits: { maxMonthlyUsageUsd: 0 } }),
      respuesta({ ...buena, current: {} }),
      respuesta({ ...buena, monthlyUsageCycle: { startAt: "x", endAt: "y" } }),
      respuesta(undefined),
      vi.fn(async () => {
        throw new Error("sin red")
      }),
    ]) {
      vi.stubGlobal("fetch", f)
      expect(await leerEstadoApify("t")).toBeNull()
    }
  })
})
