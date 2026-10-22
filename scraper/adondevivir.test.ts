import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BloqueadoError, fetchText, parseAviso, parseMonto, parseSitemapIndex, parseUrlset } from "./adondevivir"

const fx = (name: string) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8")
const URL_ALQUILER =
  "https://www.adondevivir.com/propiedades/clasificado/alclapin-precioso-departamento-vista-al-golf-areas-comunes-51684898.html"
const URL_VENTA = "https://www.adondevivir.com/propiedades/clasificado/vecltain-lote-industrial-en-cajamarquilla-51214316.html"

describe("parseMonto", () => {
  it("entiende separadores de miles", () => {
    expect(parseMonto("10,320")).toBe(10320)
    expect(parseMonto("1,250,000")).toBe(1250000)
    expect(parseMonto("10320")).toBe(10320)
    expect(parseMonto("1.200,50")).toBe(1200.5)
    expect(parseMonto("S/")).toBe(0)
  })
})

describe("sitemap", () => {
  it("el índice solo devuelve los sitemaps de avisos individuales", () => {
    const xml = `<sitemapindex>
      <sitemap><loc>https://www.adondevivir.com/sitemap_core_https.xml.gz</loc></sitemap>
      <sitemap><loc>https://www.adondevivir.com/sitemap_prop_https_1.xml.gz</loc></sitemap>
      <sitemap><loc>https://www.adondevivir.com/sitemap_prop_https_2.xml.gz</loc></sitemap>
      <sitemap><loc>https://www.adondevivir.com/sitemap_prop_emp_https_1.xml.gz</loc></sitemap>
    </sitemapindex>`
    expect(parseSitemapIndex(xml)).toEqual([
      "https://www.adondevivir.com/sitemap_prop_https_1.xml.gz",
      "https://www.adondevivir.com/sitemap_prop_https_2.xml.gz",
    ])
  })

  it("lee id y fecha, e ignora lo que no es un aviso o no tiene número", () => {
    const e = parseUrlset(fx("sitemap.xml"))
    expect(e).toEqual([
      { url: URL_VENTA, id: "51214316", lastmod: "2026-10-18" },
      { url: URL_ALQUILER, id: "51684898", lastmod: "2026-10-15" },
    ])
  })
})

describe("parseAviso", () => {
  it("alquiler con ambas monedas: guarda las dos y los datos del aviso", () => {
    const a = parseAviso(fx("aviso-alquiler.html"), URL_ALQUILER)!
    expect(a).toMatchObject({
      portal: "adondevivir",
      codigo: "51684898",
      operacion: "ALQUILER",
      inmueble: "Departamento",
      titulo: "Precioso Departamento Vista Al Golf - Areas Comunes - Country Club & Golf",
      precio: 10320,
      moneda: "PEN",
      precioUsd: 3000,
      distrito: "San Isidro",
      dormitorios: "3",
      banios: "3",
      area: "220 m2",
      url: URL_ALQUILER,
    })
    expect(a.imagen).toContain("naventcdn.com")
  })

  it("venta en dólares, tipo terreno y datos que faltan sin inventar", () => {
    const a = parseAviso(fx("aviso-venta-terreno.html"), URL_VENTA)!
    expect(a).toMatchObject({
      operacion: "VENTA",
      inmueble: "Terreno",
      precio: 1250000,
      moneda: "USD",
      distrito: "Lurigancho",
      area: "1200 m2",
    })
    expect(a.precioUsd).toBeUndefined()
    expect(a.dormitorios).toBeUndefined()
  })

  it("una página sin título, sin operación o sin número se omite", () => {
    expect(parseAviso("<html><body>nada</body></html>", URL_VENTA)).toBeNull()
    expect(parseAviso(fx("aviso-alquiler.html"), "https://www.adondevivir.com/propiedades/clasificado/sin-numero.html")).toBeNull()
    const sinOperacion = fx("aviso-alquiler.html").replace("alquiler", "consultar")
    // Sin la palabra en el bloque de precio se usa la pista de la URL ("al" = alquiler).
    expect(parseAviso(sinOperacion, URL_ALQUILER)!.operacion).toBe("ALQUILER")
    expect(parseAviso(sinOperacion, "https://www.adondevivir.com/propiedades/clasificado/xxyy-algo-1234.html")).toBeNull()
  })

  it("sin precio publicado el aviso se guarda con precio 0 (no se omite)", () => {
    const html = fx("aviso-venta-terreno.html").replace(/USD 1,250,000/, "Consultar")
    const a = parseAviso(html, URL_VENTA)!
    expect(a.precio).toBeUndefined()
  })
})

describe("fetchText", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("descomprime un .gz aunque llegue como texto y envía el User-Agent", async () => {
    const xml = "<urlset>hola</urlset>"
    const fetchMock = vi.fn(async () => new Response(zlib.gzipSync(xml), { status: 200, headers: { "content-type": "text/html" } }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await fetchText("https://x/y.xml.gz", { userAgent: "Bot/1.0" })).toBe(xml)
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("Bot/1.0")
  })

  it("un 403 o 429 lanza BloqueadoError sin reintentar", async () => {
    const fetchMock = vi.fn(async () => new Response("no", { status: 403 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(fetchText("https://x/y", { userAgent: "Bot", retries: 3 })).rejects.toBeInstanceOf(BloqueadoError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("reintenta los errores pasajeros y termina por rendirse", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => new Response("err", { status: 500 }))
    vi.stubGlobal("fetch", fetchMock)
    const p = fetchText("https://x/y", { userAgent: "Bot", retries: 2 })
    const asegurado = expect(p).rejects.toThrow("HTTP 500")
    await vi.advanceTimersByTimeAsync(10_000)
    await asegurado
    expect(fetchMock).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})
