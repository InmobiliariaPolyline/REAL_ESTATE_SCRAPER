import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
// @ts-expect-error módulos .mjs sin tipos: son los scripts que se entregan para correr con Node
import { leerArgumentos, leerPortal } from "./scraper.mjs"
// @ts-expect-error módulo .mjs sin tipos
import { avisoDeInfocasas, infocasas } from "./lib/portales.mjs"
// @ts-expect-error módulo .mjs sin tipos
import { leerRobots, permitido } from "./lib/robots.mjs"

const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/infocasas.json"), "utf8"))
const paginaHtml = (data = fixture.searchFast.data, ultima = 203) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: { pageProps: { fetchResult: { searchFast: { data, paginatorInfo: { currentPage: 1, lastPage: ultima, total: 4245 } } } } },
  })}</script></body></html>`

describe("robots.txt", () => {
  const texto = `
User-agent: BadBot
Disallow: /

User-agent: *
Disallow: /admin/
Disallow: /venta/*-y-*
Allow: /*pagina-2.html$
Disallow: /*pagina-*.html
Disallow: /privado$
# comentario
`
  const reglas = leerRobots(texto, "ScraperPropio")

  it("aplica las reglas del grupo general y no las de otros agentes", () => {
    expect(permitido(reglas, "/venta/departamentos/lima")).toBe(true)
    expect(permitido(reglas, "/admin/panel")).toBe(false)
  })

  it("entiende comodines y fin de ruta, y gana la regla más específica", () => {
    expect(permitido(reglas, "/venta/casa-y-terreno")).toBe(false) // «*-y-*»
    expect(permitido(reglas, "/buscar/x-pagina-2.html")).toBe(true) // Allow más largo que el Disallow general
    expect(permitido(reglas, "/buscar/x-pagina-9.html")).toBe(false)
    expect(permitido(reglas, "/privado")).toBe(false)
    expect(permitido(reglas, "/privado/otro")).toBe(true) // «$» solo cierra la ruta exacta
  })

  it("un grupo que nombra al scraper manda sobre el general; sin reglas todo se puede", () => {
    const propio = leerRobots("User-agent: ScraperPropio\nDisallow: /todo\n\nUser-agent: *\nAllow: /", "ScraperPropio/1.0")
    expect(permitido(propio, "/todo/algo")).toBe(false)
    expect(permitido(leerRobots("", "ScraperPropio"), "/cualquier")).toBe(true)
  })
})

describe("InfoCasas: lectura de la página", () => {
  it("convierte los avisos reales en avisos del sistema", () => {
    const r = infocasas.extraer(paginaHtml())
    expect(r.avisos).toHaveLength(3)
    expect(r).toMatchObject({ crudos: 3, paginas: 203, total: 4245 })
    expect(r.avisos[0]).toMatchObject({
      portal: "infocasas", codigo: "193636298", operacion: "VENTA", inmueble: "Departamento", moneda: "USD", precio: 249000, precioUsd: 249000,
      distrito: "Miraflores", departamento: "Lima", dormitorios: "3", banios: "3", area: "127 m2", estacionamientos: "2", publicador: "Century 21 Seven",
      url: "https://www.infocasas.com.pe/se-vende-departamento-miraflores/193636298", latitud: -12.132292, longitud: -77.0215079,
    })
    expect(r.avisos[0].imagenes.length).toBeGreaterThan(0)
    expect(r.avisos[0].direccion).toContain("Miraflores")
  })

  it("sin datos en la página devuelve null; descarta los avisos sin operación, título o código", () => {
    expect(infocasas.extraer("<html>nada</html>")).toBeNull()
    expect(infocasas.extraer(`<script id="__NEXT_DATA__" type="application/json">no es json</script>`)).toBeNull()
    const base = fixture.searchFast.data[0]
    expect(avisoDeInfocasas({ ...base, operation_type: { name: "Anticrético" } })).toBeNull()
    expect(avisoDeInfocasas({ ...base, title: "" })).toBeNull()
    expect(avisoDeInfocasas({ ...base, id: undefined })).toBeNull()
  })

  it("trata el precio oculto, la moneda, la antigüedad, la dirección y los gastos comunes", () => {
    const base = fixture.searchFast.data[0]
    expect(avisoDeInfocasas({ ...base, price: { ...base.price, hidePrice: true } })).toMatchObject({ precio: undefined, precioUsd: undefined })
    expect(avisoDeInfocasas({ ...base, price: { amount: 2500, currency: { name: "S/" } }, price_amount_usd: 650, operation_type: { name: "Alquiler" } })).toMatchObject({ moneda: "PEN", precio: 2500, operacion: "ALQUILER" })
    expect(avisoDeInfocasas({ ...base, showAddress: false }).direccion).toBeUndefined()
    const ficha = (extra: Record<string, string>) => ({ ...base, technicalSheet: Object.entries(extra).map(([field, value]) => ({ field, value, text: field })) })
    const anio = new Date().getFullYear()
    expect(avisoDeInfocasas(ficha({ constructionYear: String(anio - 7) })).antiguedad).toBe("7 años")
    expect(avisoDeInfocasas(ficha({ constructionYear: String(anio) })).antiguedad).toBe("Estreno")
    expect(avisoDeInfocasas(ficha({ constructionYear: "" })).antiguedad).toBeUndefined()
    // Gastos comunes: solo si están en la moneda del precio (el precio base es USD).
    expect(avisoDeInfocasas(ficha({ commonExpenses: "U$S 120" })).mantenimiento).toBe(120)
    expect(avisoDeInfocasas(ficha({ commonExpenses: "S/ 300" })).mantenimiento).toBeUndefined()
    expect(avisoDeInfocasas(ficha({ garage: "0" })).estacionamientos).toBe("0")
    expect(avisoDeInfocasas(ficha({})).estacionamientos).toBeUndefined()
  })

  it("un registro con `project: []` o sin `project` y sin marca de proyecto es un aviso normal", () => {
    const base = fixture.searchFast.data[0]
    expect(avisoDeInfocasas({ ...base, project: [] })).toMatchObject({ inmueble: "Departamento" })
    expect(avisoDeInfocasas({ ...base, project: undefined }).codigo).toBe(String(base.id))
    // Los proyectos (isProject o con `project`) se prueban con datos reales en scraper/proyectos.test.ts.
  })

  it("el área se corrige cuando el portal la entrega mal escalada o solo trae la del terreno", () => {
    const base = fixture.searchFast.data[0]
    const con = (extra: Record<string, unknown>, built?: string) => avisoDeInfocasas({
      ...base, project: [], ...extra,
      technicalSheet: [{ field: "m2Built", value: built ?? "", text: "m2" }],
    })
    expect(con({ m2: 127 }, "127 m2").area).toBe("127 m2")
    // «218.000 m2» llega como 218000: se usa el texto de la ficha.
    expect(con({ m2: 218000, property_type: { name: "Casa" } }, "218.000 m2").area).toBe("218 m2")
    // «24.268» es ambiguo (miles o decimales): mejor sin área que con una que puede estar mal.
    expect(con({ m2: 24268 }, "24.268 m2").area).toBeUndefined()
    // Sin superficie construida se usa la del terreno.
    expect(con({ m2: 0, m2Terrain: 300, property_type: { name: "Casa" } }).area).toBe("300 m2")
    // Un terreno puede ser grande de verdad.
    expect(con({ m2: 120000, property_type: { name: "Terreno" } }).area).toBe("120000 m2")
  })

  it("arma la dirección de cada página (la primera sin sufijo)", () => {
    expect(infocasas.urlPagina("venta/casas/lima", 1)).toBe("https://www.infocasas.com.pe/venta/casas/lima")
    expect(infocasas.urlPagina("venta/casas/lima", 3)).toBe("https://www.infocasas.com.pe/venta/casas/lima/pagina3")
  })
})

describe("recorrido del portal", () => {
  const opciones = { busquedas: ["venta/departamentos/lima"], paginas: 3, max: 2000, pausa: 5 }
  const respuesta = (cuerpo: string, status = 200) => new Response(cuerpo, { status })

  it("pide robots.txt y las páginas con pausa entre peticiones, y no repite avisos", async () => {
    const pedidas: string[] = []
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      pedidas.push(url)
      expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("ScraperPropio/1.0")
      return url.endsWith("/robots.txt") ? respuesta("User-agent: *\nDisallow: /admin/") : respuesta(paginaHtml())
    })
    const dormirFn = vi.fn(async () => {})
    const enviados: unknown[][] = []
    const avisos = await leerPortal(infocasas, opciones, { fetchFn, dormirFn, log: () => {}, alAvisos: async (l: unknown[]) => void enviados.push(l) })
    expect(pedidas).toEqual([
      "https://www.infocasas.com.pe/robots.txt",
      "https://www.infocasas.com.pe/venta/departamentos/lima",
      "https://www.infocasas.com.pe/venta/departamentos/lima/pagina2",
      "https://www.infocasas.com.pe/venta/departamentos/lima/pagina3",
    ])
    expect(dormirFn).toHaveBeenCalledTimes(2) // entre la 1.ª y la 2.ª, y entre la 2.ª y la 3.ª; nunca antes de la primera
    expect(dormirFn.mock.calls[0][0]).toBeGreaterThanOrEqual(5000)
    expect(avisos).toHaveLength(3) // las páginas 2 y 3 traen los mismos 3: no se repiten
    expect(enviados.map(l => l.length)).toEqual([3, 0, 0])
  })

  it("se detiene ante un 403 sin reintentar ni esquivar", async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith("/robots.txt") ? respuesta("") : respuesta("bloqueado", 403)))
    await expect(leerPortal(infocasas, opciones, { fetchFn, dormirFn: async () => {}, log: () => {} })).rejects.toThrow(/403/)
    expect(fetchFn).toHaveBeenCalledTimes(2) // robots.txt y una sola página
  })

  it("también se detiene con 429 y con errores del servidor", async () => {
    for (const status of [429, 503]) {
      const fetchFn = vi.fn(async (url: string) => (url.endsWith("/robots.txt") ? respuesta("") : respuesta("x", status)))
      await expect(leerPortal(infocasas, opciones, { fetchFn, dormirFn: async () => {}, log: () => {} })).rejects.toThrow(String(status))
    }
  })

  it("no entra a rutas que el robots.txt prohíbe", async () => {
    const log = vi.fn()
    const fetchFn = vi.fn(async (url: string) => (url.endsWith("/robots.txt") ? respuesta("User-agent: *\nDisallow: /venta/") : respuesta(paginaHtml())))
    const avisos = await leerPortal(infocasas, opciones, { fetchFn, dormirFn: async () => {}, log })
    expect(avisos).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(1) // solo el robots.txt
    expect(log.mock.calls[0][0]).toContain("no permitido por su robots.txt")
  })

  it("respeta el tope de avisos, el de páginas del portal y la última página", async () => {
    const muchos = Array.from({ length: 21 }, (_, i) => ({ ...fixture.searchFast.data[0], id: 1000 + i }))
    const fetchFn = vi.fn(async (url: string) => (url.endsWith("/robots.txt") ? respuesta("") : respuesta(paginaHtml(muchos, 1))))
    expect(await leerPortal(infocasas, { ...opciones, max: 5 }, { fetchFn, dormirFn: async () => {}, log: () => {} })).toHaveLength(5)
    // Con una sola página en total, no pide la 2 ni la 3.
    fetchFn.mockClear()
    await leerPortal(infocasas, opciones, { fetchFn, dormirFn: async () => {}, log: () => {} })
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it("una página sin listados se registra y se pasa a la siguiente búsqueda", async () => {
    const log = vi.fn()
    const fetchFn = vi.fn(async (url: string) => (url.endsWith("/robots.txt") ? respuesta("") : respuesta("<html>sin datos</html>")))
    const avisos = await leerPortal(infocasas, { ...opciones, busquedas: ["a", "b"] }, { fetchFn, dormirFn: async () => {}, log })
    expect(avisos).toEqual([])
    expect(log.mock.calls.filter(c => String(c[0]).includes("no trae listados")).length).toBe(2)
  })
})

describe("argumentos de la línea de comandos", () => {
  it("por defecto: todos los portales, 3 páginas y 5 segundos de pausa", () => {
    expect(leerArgumentos([])).toMatchObject({ portal: "todos", paginas: 3, max: 2000, pausa: 5, probar: false, busquedas: [] })
  })

  it("lee las opciones y acepta varias búsquedas", () => {
    expect(leerArgumentos(["--portal", "infocasas", "--paginas", "10", "--busqueda", "venta/casas/lima", "--busqueda", "alquiler/casas/lima", "--max", "100", "--pausa", "8", "--probar"])).toMatchObject({
      portal: "infocasas", paginas: 10, busquedas: ["venta/casas/lima", "alquiler/casas/lima"], max: 100, pausa: 8, probar: true,
    })
  })

  it("rechaza lo inválido, incluida una pausa menor al mínimo", () => {
    expect(leerArgumentos(["--provincias"]).provincias).toBe(true)
    expect(leerArgumentos([]).provincias).toBe(false)
    expect(() => leerArgumentos(["--portal", "otro"])).toThrow("Portal desconocido")
    expect(() => leerArgumentos(["--pausa", "1"])).toThrow("--pausa")
    expect(() => leerArgumentos(["--paginas", "0"])).toThrow("--paginas")
    expect(() => leerArgumentos(["--busqueda", "../etc/passwd?x=1"])).toThrow("Búsqueda no válida")
    expect(() => leerArgumentos(["--raro"])).toThrow("Opción desconocida")
  })
})
