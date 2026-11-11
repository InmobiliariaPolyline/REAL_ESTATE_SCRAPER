import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { beforeAll, describe, expect, it } from "vitest"
// @ts-expect-error módulo JS
import { avisoDeInfocasas } from "../scraper/lib/portales.mjs"
import type { Db } from "./db"
import { createApiHandler } from "./handler"
import { normalizarAviso } from "./ingest"

const root = path.resolve(import.meta.dirname, "..")
const pg = new PGlite({ extensions: { pgcrypto } })
const db: Db = { query: async (text, params = []) => (await pg.query(text, params)).rows as never[] }
const TOKEN = "token-de-prueba-de-24-caracteres-o-mas"
const handler = createApiHandler(() => db, { USD_TO_PEN_RATE: "3.75", INGESTA_TOKEN: TOKEN })
let member = ""
const call = async (method: string, url: string, o: { token?: string; body?: unknown } = {}) => {
  const headers: Record<string, string> = {}
  if (o.token) headers.Authorization = `Bearer ${o.token}`
  if (o.body !== undefined) headers["Content-Type"] = "application/json"
  const res = await handler(new Request(`http://localhost${url}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }))
  const ct = res.headers.get("content-type") ?? ""
  return { status: res.status, body: ct.includes("json") ? await res.json() : await res.text() }
}
// Muestra reducida de avisos reales de InfoCasas (proyectos, coordenadas 0,0, precios con error de tipeo, provincias…).
const unicos = JSON.parse(fs.readFileSync(path.join(root, "scraper/fixtures/infocasas-muestra.json"), "utf8")) as any[]
const avisos = unicos.map(i => avisoDeInfocasas(i)).filter(Boolean)
const esperadas = new Map(avisos.map((a: any) => [`infocasas:${a.codigo}`, normalizarAviso(a, 3.75)!]))

beforeAll(async () => {
  await pg.exec(fs.readFileSync(path.join(root, "db/001_schema.sql"), "utf8"))
  await pg.exec(`insert into usuarios (usuario, password_hash, rol) values ('admin','admin-pass-123','admin'),('cliente','cliente-pass-1','usuario');`)
  for (const f of ["002_auth", "003_account_ops", "004_price_history", "005_sessions_audit", "006_idle_timeout", "007_carga", "008_imagenes", "009_detalles", "010_fuentes", "011_ubicacion", "012_tipos"]) await pg.exec(fs.readFileSync(path.join(root, `db/${f}.sql`), "utf8"))
  const admin = (await call("POST", "/api/login", { body: { usuario: "admin", password: "admin-pass-123" } })).body.token
  const id = (await pg.query<{ id: number }>("select id::int from usuarios where usuario='cliente'")).rows[0].id
  await call("POST", `/api/admin/usuarios/${id}/premium`, { token: admin })
  member = (await call("POST", "/api/login", { body: { usuario: "cliente", password: "cliente-pass-1" } })).body.token
}, 60000)

/**
 * Prueba de punta a punta: avisos reales de InfoCasas -> lector -> POST /api/ingesta -> base de datos -> API del portal.
 * Comprueba que nada se pierde ni se deforma y que filtros, orden, detalle, facetas y exportación cuadran con los datos.
 */
describe("E2E con avisos reales de InfoCasas", () => {
  it("entrega por /api/ingesta y no pierde ni deforma nada", async () => {
    let guardados = 0
    for (let i = 0; i < avisos.length; i += 200) {
      const r = await call("POST", "/api/ingesta", { token: TOKEN, body: { avisos: avisos.slice(i, i + 200) } })
      expect(r.status).toBe(200)
      guardados += r.body.guardados
    }
    expect(guardados).toBe(avisos.length)
    const filas = (await pg.query<any>("select * from public.propiedades")).rows
    expect(filas.length).toBe(esperadas.size)
    const dif: string[] = []
    for (const f of filas) {
      const e: any = esperadas.get(f.id)
      if (!e) { dif.push(`${f.id}: no esperado`); continue }
      for (const k of ["inmueble", "operacion", "moneda", "distrito", "departamento", "provincia", "dormitorios", "banios", "area", "imagen", "url", "antiguedad", "estacionamientos", "publicador", "titulo", "direccion", "descripcion"]) {
        if ((f[k] ?? null) !== (e[k] ?? null)) dif.push(`${f.id}.${k}: BD=${JSON.stringify(f[k])?.slice(0, 50)} esperado=${JSON.stringify(e[k])?.slice(0, 50)}`)
      }
      for (const k of ["precio", "precio_usd", "latitud", "longitud", "mantenimiento"]) {
        const a = f[k] == null ? null : Number(f[k]), b = e[k] == null ? null : Number(e[k])
        if (Math.abs((a ?? 0) - (b ?? 0)) > 0.01) dif.push(`${f.id}.${k}: BD=${a} esperado=${b}`)
      }
      if ((f.imagenes ?? []).length !== e.imagenes.length) dif.push(`${f.id}.imagenes: BD=${f.imagenes?.length} esperado=${e.imagenes.length}`)
    }
        expect(dif).toEqual([])
  })

  it("calidad de los datos guardados: sin coordenadas fuera de Perú, sin precios absurdos, tipos unificados", async () => {
    const f = (await pg.query<any>("select * from public.propiedades")).rows
    expect(f.filter(x => x.latitud != null && (x.latitud > 0.5 || x.latitud < -19 || x.longitud > -68 || x.longitud < -82))).toEqual([])
    expect(f.filter(x => x.operacion === "VENTA" && x.precio_usd > 0 && (x.precio_usd < 1000 || x.precio_usd > 300_000_000))).toEqual([])
    expect(new Set(f.map(x => x.inmueble)).has("Local Comercial")).toBe(false) // unificado como «Local comercial»
    // Un proyecto guardado nunca se queda como «Departamento» con datos de una tipología suelta.
    const ids = new Set(unicos.filter(i => i.project && !Array.isArray(i.project) && i.project.id).map(i => `infocasas:${i.id}`))
    expect(f.filter(x => ids.has(x.id)).every(x => x.inmueble === "Proyecto")).toBe(true)
    expect(ids.size).toBeGreaterThan(0)
  })

  const lista = async (q: string) => (await call("GET", `/api/propiedades?pageSize=500&${q}`, { token: member })).body
  const filas = () => [...esperadas.values()] as any[]

  it("filtros: operación, tipo, ubicación, precio, área, dormitorios, texto", async () => {
    const problemas: string[] = []
    const chequear = async (nombre: string, q: string, oraculo: (e: any) => boolean) => {
      const r = await lista(q)
      const esp = filas().filter(oraculo).length
      if (r.count !== esp) problemas.push(`${nombre}: API=${r.count} esperado=${esp}`)
    }
    const areaN = (e: any) => Number(/^(\d+(?:\.\d+)?)/.exec(e.area ?? "")?.[1])
    await chequear("VENTA", "operacion=VENTA", e => e.operacion === "VENTA")
    await chequear("ALQUILER", "operacion=ALQUILER", e => e.operacion === "ALQUILER")
    for (const t of ["Departamento", "Casa", "Terreno", "Oficina", "Local comercial", "Proyecto", "Edificio"]) await chequear(`tipo ${t}`, `inmueble=${encodeURIComponent(t)}`, e => e.inmueble === t)
    await chequear("Arequipa", "departamento=Arequipa", e => e.departamento === "Arequipa")
    await chequear("Lima", "departamento=Lima", e => e.departamento === "Lima")
    await chequear("solo con precio", "soloConPrecio=1", e => e.precio > 0 || e.precio_usd > 0)
    await chequear("portal infocasas", "portales=infocasas", () => true)
    await chequear("portal urbania (0)", "portales=urbania", () => false)
    await chequear("texto terreno", "texto=terreno", e => /terreno/i.test(e.titulo ?? "") || /terreno/i.test(e.distrito ?? ""))
    await chequear("área >= 200", "areaMin=200", e => areaN(e) >= 200)
    await chequear("área 50-100", "areaMin=50&areaMax=100", e => areaN(e) >= 50 && areaN(e) <= 100)
    const usd = (e: any) => (e.precio_usd > 0 ? e.precio_usd : 0)
    await chequear("USD 100k-200k", "moneda=USD&precioMin=100000&precioMax=200000&operacion=VENTA", e => e.operacion === "VENTA" && usd(e) >= 100000 && usd(e) <= 200000)
    await chequear("PEN 300k-600k", "moneda=PEN&precioMin=300000&precioMax=600000&operacion=VENTA", e => {
      const p = e.precio > 0 && e.moneda === "PEN" ? e.precio : e.precio_usd > 0 ? e.precio_usd * 3.75 : 0
      return e.operacion === "VENTA" && p >= 300000 && p <= 600000
    })
    await chequear("3 dormitorios", "dormitorios=3", e => e.dormitorios === "3")
    // Un distrito oficial se compara exacto: «Miraflores» no trae «San Juan de Miraflores».
    await chequear("Miraflores exacto", "distrito=Miraflores", e => e.distrito === "Miraflores")
    await chequear("San Juan de Miraflores", "distrito=San%20Juan%20de%20Miraflores", e => e.distrito === "San Juan de Miraflores")
    expect(problemas).toEqual([])
  })

  it("orden por precio: ascendente de verdad y sin precio al final", async () => {
    const r = await lista("moneda=USD&orden=precio_asc&operacion=VENTA")
    const precios = r.data.map((p: any) => (p.precio_usd > 0 ? p.precio_usd : p.precio > 0 ? p.precio / 3.75 : null))
    const conPrecio = precios.filter((x: number | null) => x != null) as number[]
    expect(conPrecio).toEqual([...conPrecio].sort((a, b) => a - b))
    const primerNull = precios.indexOf(null)
    if (primerNull >= 0) expect(precios.slice(primerNull).every((x: number | null) => x == null)).toBe(true)
  })

  it("el detalle de un proyecto y de un aviso normal", async () => {
    const proy = (await pg.query<any>("select id from public.propiedades where inmueble = 'Proyecto' limit 1")).rows[0]
    const d = await call("GET", `/api/propiedades/${encodeURIComponent(proy.id)}`, { token: member })
    expect(d.status).toBe(200)
    expect(d.body.propiedad.inmueble).toBe("Proyecto")
    expect(d.body.propiedad.imagenes.length).toBeGreaterThan(0)
    const normal = (await pg.query<any>("select id from public.propiedades where inmueble = 'Departamento' and operacion='VENTA' and precio > 0 and distrito is not null limit 1")).rows[0]
    const n = await call("GET", `/api/propiedades/${encodeURIComponent(normal.id)}`, { token: member })
    expect(n.status).toBe(200)
  })

  it("facetas, exportación, inicio y estadísticas", async () => {
    const f = (await call("GET", "/api/propiedades/facetas", { token: member })).body
    const suma = (l: any[]) => l.reduce((s, x) => s + x.n, 0)
    expect(suma(f.inmuebles)).toBe(esperadas.size)
    expect(suma(f.departamentos)).toBe(filas().filter(e => e.departamento).length)
    const csv = await call("GET", "/api/propiedades/export?operacion=VENTA", { token: member })
    expect(csv.status).toBe(200)
    const lineas = (csv.body as string).trim().split("\n").length - 1
    expect((await call("GET", "/api/inicio", { token: member })).status).toBe(200)
    expect((await call("GET", "/api/estadisticas", { token: member })).status).toBe(200)
  })

  it("el catálogo trae lo necesario para las etiquetas de las tarjetas (y sigue funcionando sin esas columnas)", async () => {
    const r = await lista("operacion=VENTA")
    const fila = r.data.find((x: any) => x.fotos > 1)
    expect(fila).toBeTruthy()
    expect(r.data.every((x: any) => typeof x.fotos === "number")).toBe(true)
    expect(Object.keys(fila)).toEqual(expect.arrayContaining(["inmueble", "creado_en", "estacionamientos", "antiguedad", "departamento", "fotos"]))
    const detalle = await call("GET", `/api/propiedades/${encodeURIComponent(fila.id)}`, { token: member })
    expect(detalle.body.propiedad).toHaveProperty("departamento")

    // Sin una de esas columnas (base sin migrar) el catálogo sigue respondiendo, con lo básico.
    await pg.exec("alter table public.propiedades drop column antiguedad")
    const basico = await lista("operacion=VENTA")
    expect(basico.data.length).toBeGreaterThan(0)
    expect(basico.data[0]).not.toHaveProperty("fotos")
  })

  it("db/013_geografia.sql corrige el Callao guardado dentro de «Lima» sin tocar un homónimo de otro departamento", async () => {
    await pg.exec(`insert into public.propiedades (id, portal, operacion, inmueble, titulo, distrito, departamento, provincia) values
      ('geo:1','infocasas','VENTA','Casa','Callao mal ubicado','Callao','Lima','Callao'),
      ('geo:2','infocasas','VENTA','Casa','Ventanilla mal ubicada','Ventanilla','Lima','Lima'),
      ('geo:3','infocasas','VENTA','Casa','La Victoria de Lambayeque','La Victoria','Lambayeque','Chiclayo'),
      ('geo:4','infocasas','VENTA','Casa','Provincia con otro departamento','Camaná','Lima','Camaná'),
      ('geo:5','infocasas','VENTA','Casa','Provincia como departamento','Asia','Cañete',null)`)
    const sql = fs.readFileSync(path.join(root, "db/013_geografia.sql"), "utf8")
    await pg.exec(sql)
    await pg.exec(sql) // idempotente
    const f = (await pg.query<any>("select id, departamento, provincia from public.propiedades where id like 'geo:%' order by id")).rows
    expect(f).toEqual([
      { id: "geo:1", departamento: "Callao", provincia: "Callao" },
      { id: "geo:2", departamento: "Callao", provincia: "Callao" },
      { id: "geo:3", departamento: "Lambayeque", provincia: "Chiclayo" },
      { id: "geo:4", departamento: "Arequipa", provincia: "Camaná" },
      { id: "geo:5", departamento: "Lima", provincia: "Cañete" },
    ])
    // El catálogo ya no tiene dos «Callao».
    const fac = (await call("GET", "/api/propiedades/facetas", { token: member })).body
    expect(fac.provincias.filter((p: any) => p.valor === "Callao")).toHaveLength(1)
    expect(fac.distritos.filter((d: any) => d.valor === "Callao" && d.padre === "Callao")).toHaveLength(1)
    await pg.exec("delete from public.propiedades where id like 'geo:%'") // para no alterar los conteos de las demás pruebas
  })

  it("las listas de los filtros se calculan sobre los filtros activos (solo lo disponible)", async () => {
    const facetas = async (q: string) => (await call("GET", `/api/propiedades/facetas?${q}`, { token: member })).body
    const total = (l: any[]) => l.reduce((n: number, x: any) => n + x.n, 0)

    // Con un portal que no tiene avisos, no hay nada que ofrecer.
    const ninguno = await facetas("portales=urbania")
    expect(total(ninguno.departamentos)).toBe(0)
    expect(ninguno.distritos).toEqual([])

    // Con una operación, las cantidades son las de esa operación.
    const alq = await facetas("operacion=ALQUILER")
    expect(total(alq.departamentos)).toBe(filas().filter(e => e.operacion === "ALQUILER" && e.departamento).length)
    expect(total(alq.inmuebles)).toBe(filas().filter(e => e.operacion === "ALQUILER").length)

    // Cada lista ignora su propio filtro (para poder cambiar de opción) y respeta el de arriba.
    const arequipa = await facetas("departamento=Arequipa")
    expect(total(arequipa.departamentos)).toBe(filas().filter(e => e.departamento).length) // se ven todos los departamentos
    expect(arequipa.provincias.every((p: any) => p.padre === "Arequipa")).toBe(true)
    expect(arequipa.distritos.every((d: any) => d.padre === "Arequipa")).toBe(true)
    expect(total(arequipa.inmuebles)).toBe(filas().filter(e => e.departamento === "Arequipa").length)

    // El portal elegido y los demás filtros se combinan.
    const venta = await facetas("portales=infocasas&operacion=VENTA&inmueble=Casa")
    expect(total(venta.departamentos)).toBe(filas().filter(e => e.operacion === "VENTA" && e.inmueble === "Casa" && e.departamento).length)
    expect(total(venta.inmuebles)).toBe(filas().filter(e => e.operacion === "VENTA").length) // el tipo ignora su propio filtro
  })
})

