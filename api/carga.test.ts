import { afterEach, describe, expect, it, vi } from "vitest"
import {
  URLS_POR_DEFECTO,
  configurada,
  costoPorMil,
  elegirUrl,
  lanzarCorrida,
  mapearAviso,
  planificar,
  sitioPublico,
  topeDolares,
  urlsDeBusqueda,
  type CargaConfig,
} from "./carga"

const config: CargaConfig = { pausada: false, tope_mensual: 1000, maximo_por_corrida: 200 }

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

describe("topeDolares", () => {
  it("costo esperado + 25 % de margen, redondeado hacia arriba, más un centavo", () => {
    expect(topeDolares(100, 3)).toBeCloseTo(0.39, 5) // 0.30 x 1.25 = 0.375 -> 0.38 -> 0.39
    expect(topeDolares(50, 3)).toBeCloseTo(0.2, 5)
    expect(topeDolares(1000, 8)).toBeCloseTo(10.01, 5)
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
