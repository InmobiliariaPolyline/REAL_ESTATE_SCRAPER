import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
// @ts-expect-error módulo .mjs sin tipos
import { avisoDeInfocasas } from "../scraper/lib/portales.mjs"
import { mapearAvisoInfocasas } from "./carga"
import type { Db } from "./db"
import { createApiHandler } from "./handler"
import { guardarAvisos, normalizarAviso, type Aviso } from "./ingest"

/**
 * Proyectos de punta a punta con datos reales de InfoCasas (B34, Surquillo): lo que se lee, lo que se guarda y lo que
 * muestra la API. El caso que se leía mal: el mismo proyecto llegaba como un «Departamento» de una sola tipología.
 */
const root = path.resolve(import.meta.dirname, "..")
const reales: any[] = JSON.parse(fs.readFileSync(path.join(root, "scraper/fixtures/infocasas-proyectos.json"), "utf8"))
const real = (id: number) => reales.find(i => i.id === id)

async function crearBase(migraciones: string[]) {
  const pg = new PGlite({ extensions: { pgcrypto } })
  await pg.exec(fs.readFileSync(path.join(root, "db/001_schema.sql"), "utf8"))
  await pg.exec(`insert into usuarios (usuario, password_hash, rol) values ('admin', 'admin-pass-123', 'admin')`)
  for (const m of migraciones) await pg.exec(fs.readFileSync(path.join(root, `db/${m}.sql`), "utf8"))
  const db: Db = { query: async (text, params = []) => (await pg.query(text, params as never[])).rows as never[] }
  const handler = createApiHandler(() => db, { USD_TO_PEN_RATE: "4" })
  const login = await handler(new Request("http://localhost/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario: "admin", password: "admin-pass-123" }) }))
  const token = (await login.json()).token as string
  const get = async (url: string) => {
    const res = await handler(new Request(`http://localhost${url}`, { headers: { Authorization: `Bearer ${token}` } }))
    return { status: res.status, body: await res.json() }
  }
  return { pg, db, get }
}

const TODAS = ["002_auth", "003_account_ops", "004_price_history", "005_sessions_audit", "006_idle_timeout", "007_carga", "008_imagenes", "009_detalles", "010_fuentes", "011_ubicacion"]

describe("con la migración 014", () => {
  let ctx: Awaited<ReturnType<typeof crearBase>>
  beforeAll(async () => {
    ctx = await crearBase([...TODAS, "014_proyectos"])
  })
  afterAll(async () => {
    await ctx.pg.close()
  })
  const filas = async (donde = "true") => (await ctx.pg.query(`select * from propiedades where ${donde} order by id`)).rows as any[]

  it("guardar B34 deja UN proyecto con su rango y sus tres tipologías, y quita las copias antiguas", async () => {
    // Como lo dejaban las versiones anteriores: cada tipología (y el proyecto) como un aviso aparte, con los datos de una sola.
    await ctx.pg.exec(`
      insert into propiedades (id, portal, operacion, inmueble, titulo, precio, precio_usd, moneda, distrito, dormitorios, banios, area, url) values
        ('infocasas:187068547','infocasas','VENTA','Departamento','B34',130600,130600,'USD','Surquillo','3','2','66 m2','https://www.infocasas.com.pe/b34/187068547'),
        ('infocasas:5349','infocasas','VENTA','Departamento','B34',108700,108700,'USD','Surquillo','1','1','54 m2','https://www.infocasas.com.pe/proyectos/b34'),
        ('infocasas:187068541','infocasas','VENTA','Departamento','B34',120580,120580,'USD','Surquillo','2','2','65 m2','https://www.infocasas.com.pe/b34/187068541'),
        ('infocasas:999','infocasas','VENTA','Casa','Otra casa',500000,500000,'USD','Surquillo','4','3','200 m2','https://www.infocasas.com.pe/casa-b34/999')
    `)
    // Un favorito del administrador en una de las copias: no se borra.
    const adminId = (await ctx.pg.query<{ id: number }>("select id::int from usuarios where usuario = 'admin'")).rows[0].id
    await ctx.pg.exec(`insert into favoritos (admin_id, propiedad_id) values (${adminId}, 'infocasas:187068541')`)

    // El proyecto llega desde las dos formas en que lo publica el portal (en una sola corrida).
    const r = await guardarAvisos(ctx.db, [avisoDeInfocasas(real(187068547)), avisoDeInfocasas(real(5349))], 3.4)
    expect(r).toEqual({ guardados: 1, descartados: 0 })

    const proyecto = (await filas("id = 'infocasas:proyecto-b34'"))[0]
    expect(proyecto).toMatchObject({
      inmueble: "Proyecto", titulo: "B34", moneda: "USD", dormitorios: "1, 2, 3", banios: "1, 2", area: "54 – 66 m2",
      url: "https://www.infocasas.com.pe/proyectos/b34", distrito: "Surquillo", departamento: "Lima",
    })
    expect(Number(proyecto.precio)).toBe(108700)
    expect(Number(proyecto.precio_usd)).toBe(108700)
    expect(Number(proyecto.precio_max)).toBe(130600)
    expect(proyecto.unidades).toHaveLength(3)
    expect(proyecto.unidades.map((u: any) => u.precio)).toEqual([108700, 120580, 130600])

    // Las copias antiguas desaparecen (salvo la que tiene favorito) y lo que no es de B34 no se toca.
    const ids = (await filas()).map(f => f.id)
    expect(ids).not.toContain("infocasas:187068547")
    expect(ids).not.toContain("infocasas:5349")
    expect(ids).toContain("infocasas:187068541") // con favorito
    expect(ids).toContain("infocasas:999")
    expect(ids).toContain("infocasas:proyecto-b34")
  })

  it("guardarlo otra vez no lo duplica, conserva su fecha de alta y registra el cambio de precio", async () => {
    const antes = (await filas("id = 'infocasas:proyecto-b34'"))[0]
    const cambiado = avisoDeInfocasas(real(5349))
    cambiado.unidades = cambiado.unidades.map((u: any) => (u.dormitorios === 3 ? { ...u, precio: 135000 } : u))
    await guardarAvisos(ctx.db, [cambiado], 3.4)
    const despues = await filas("id = 'infocasas:proyecto-b34'")
    expect(despues).toHaveLength(1)
    expect(despues[0].creado_en).toEqual(antes.creado_en)
    expect(Number(despues[0].precio)).toBe(108700)
    expect(Number(despues[0].precio_max)).toBe(135000)
    // Vuelve al valor real para las pruebas siguientes.
    await guardarAvisos(ctx.db, [avisoDeInfocasas(real(5349))], 3.4)
  })

  it("la API del portal entrega el precio «Hasta» en el catálogo y las tipologías en el detalle", async () => {
    const lista = await ctx.get("/api/propiedades?inmueble=Proyecto")
    expect(lista.status).toBe(200)
    expect(lista.body.data).toHaveLength(1)
    expect(lista.body.data[0]).toMatchObject({ id: "infocasas:proyecto-b34", inmueble: "Proyecto", precio: 108700, precio_max: 130600, dormitorios: "1, 2, 3", area: "54 – 66 m2" })

    const detalle = await ctx.get(`/api/propiedades/${encodeURIComponent("infocasas:proyecto-b34")}`)
    expect(detalle.status).toBe(200)
    expect(detalle.body.propiedad).toMatchObject({ precio: 108700, precio_max: 130600 })
    expect(detalle.body.propiedad.unidades).toEqual([
      { codigo: "187065797", dormitorios: 1, banios: 1, area: 54, precio: 108700 },
      { codigo: "187068541", dormitorios: 2, banios: 2, area: 65, precio: 120580 },
      { codigo: "187068547", dormitorios: 3, banios: 2, area: 66, precio: 130600 },
    ])
  })

  it("el panel de administración también entrega el precio «Hasta» del proyecto", async () => {
    const r = await ctx.get("/api/admin/propiedades?inmueble=Proyecto")
    expect(r.status).toBe(200)
    expect(r.body.data[0]).toMatchObject({ id: "infocasas:proyecto-b34", precio: 108700, precio_max: 130600 })
  })

  it("los filtros del portal encuentran el proyecto por cualquiera de sus tipologías", async () => {
    const ids = async (q: string) => (await ctx.get(`/api/propiedades?${q}`)).body.data.map((d: any) => d.id)
    expect(await ids("inmueble=Proyecto&dormitorios=2")).toEqual(["infocasas:proyecto-b34"]) // tiene una de 2 dormitorios
    expect(await ids("inmueble=Proyecto&dormitorios=3")).toEqual(["infocasas:proyecto-b34"])
    expect(await ids("inmueble=Proyecto&dormitorios=4%2B")).toEqual([])
    expect(await ids("inmueble=Proyecto&banios=2")).toEqual(["infocasas:proyecto-b34"])
    expect(await ids("inmueble=Proyecto&moneda=USD&precioMax=110000")).toEqual(["infocasas:proyecto-b34"]) // «desde» 108,700
    expect(await ids("inmueble=Proyecto&moneda=USD&precioMax=100000")).toEqual([])
    expect(await ids("inmueble=Proyecto&departamento=Lima&provincia=Lima&distrito=Surquillo")).toEqual(["infocasas:proyecto-b34"])
  })

  it("los tres registros de la carga con Apify (una tipología cada uno) se unen en un solo proyecto con el rango completo", async () => {
    const unidad = (id: number, dorm: number, banos: number, m2: number, precio: number) => ({
      listingId: id, listingUrl: `https://www.infocasas.com.pe/b34/${id}`, propertyTitle: "B34", operationType: "Venta", propertyType: "Departamento",
      isProject: true, bedrooms: dorm, bathrooms: banos, areaBuilt: m2, priceAmount: precio, priceCurrency: "U$S", priceUsd: precio, priceHidden: false,
      neighbourhood: "Surquillo", state: "Lima", advertiserName: "Jopesa",
    })
    const avisos = [unidad(187065797, 1, 1, 54, 108700), unidad(187068541, 2, 2, 65, 120580), unidad(187068547, 3, 2, 66, 130600)].map(x => mapearAvisoInfocasas(x) as Aviso)
    expect(avisos.every(a => a.codigo === "proyecto-b34" && a.inmueble === "Proyecto")).toBe(true)
    await ctx.pg.exec("delete from propiedades where id = 'infocasas:proyecto-b34'")
    const r = await guardarAvisos(ctx.db, avisos, 3.4)
    expect(r.guardados).toBe(1)
    const p = (await filas("id = 'infocasas:proyecto-b34'"))[0]
    // La dirección es la que entrega el actor (la de una tipología: el portal la lleva al proyecto); no se arma una nueva.
    expect(p).toMatchObject({ inmueble: "Proyecto", dormitorios: "1, 2, 3", banios: "1, 2", area: "54 – 66 m2", url: "https://www.infocasas.com.pe/b34/187068547" })
    expect(Number(p.precio)).toBe(108700)
    expect(Number(p.precio_max)).toBe(130600)
  })



  it("POST /api/ingesta (el scraper propio) conserva el «Hasta» y las tipologías del proyecto", async () => {
    const TOKEN = "token-de-prueba-con-mas-de-24-caracteres"
    const handler = createApiHandler(() => ctx.db, { USD_TO_PEN_RATE: "4", INGESTA_TOKEN: TOKEN })
    const enviar = async (avisos: unknown[]) =>
      handler(new Request("http://localhost/api/ingesta", { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ avisos }) }))
    await ctx.pg.exec("delete from propiedades where id = 'infocasas:proyecto-b34'")
    // Se envía tal como sale del scraper, pasando por JSON.
    const res = await enviar([avisoDeInfocasas(real(5349))])
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ recibidos: 1, guardados: 1, descartados: 0 })
    const p = (await filas("id = 'infocasas:proyecto-b34'"))[0]
    expect(Number(p.precio)).toBe(108700)
    expect(Number(p.precio_max)).toBe(130600)
    expect(p.unidades).toHaveLength(3)
    expect(p).toMatchObject({ inmueble: "Proyecto", dormitorios: "1, 2, 3", area: "54 – 66 m2" })
  })

  it("POST /api/ingesta quita los avisos retirados, sin tocar los que tienen favoritos ni los de otros portales", async () => {
    const TOKEN = "token-de-prueba-con-mas-de-24-caracteres"
    const handler = createApiHandler(() => ctx.db, { USD_TO_PEN_RATE: "4", INGESTA_TOKEN: TOKEN })
    const enviar = async (cuerpo: unknown, token = TOKEN) =>
      handler(new Request("http://localhost/api/ingesta", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }))
    await ctx.pg.exec("delete from propiedades where id like 'infocasas:ret%' or id like 'urbania:ret%'")
    await ctx.pg.exec(`
      insert into propiedades (id, portal, operacion, inmueble, titulo, precio, precio_usd, moneda, distrito, url) values
        ('infocasas:ret-muerto','infocasas','VENTA','Proyecto','Madre Selva',100000,100000,'USD','Lince','https://www.infocasas.com.pe/proyectos/madre-selva'),
        ('infocasas:ret-favorito','infocasas','VENTA','Proyecto','Con favorito',100000,100000,'USD','Lince','https://www.infocasas.com.pe/proyectos/x'),
        ('infocasas:ret-vivo','infocasas','VENTA','Proyecto','Vivo',100000,100000,'USD','Lince','https://www.infocasas.com.pe/proyectos/y'),
        ('urbania:ret-muerto','urbania','VENTA','Casa','Otro portal',100000,100000,'USD','Lince','https://urbania.pe/z')
    `)
    const adminId = (await ctx.pg.query<{ id: number }>("select id::int from usuarios where usuario = 'admin'")).rows[0].id
    await ctx.pg.exec(`insert into favoritos (admin_id, propiedad_id) values (${adminId}, 'infocasas:ret-favorito')`)

    // Sin token válido no se borra nada.
    expect((await enviar({ avisos: [], retirados: [{ portal: "infocasas", codigo: "ret-muerto" }] }, "token-equivocado-con-mas-de-24-caracteres")).status).toBe(403)
    expect((await filas("id = 'infocasas:ret-muerto'")).length).toBe(1)

    const res = await enviar({
      avisos: [],
      retirados: [
        { portal: "infocasas", codigo: "ret-muerto" },
        { portal: "infocasas", codigo: "ret-favorito" }, // protegido
        { portal: "INFOCASAS", codigo: "ret-inexistente" }, // no existe
        { portal: "portal-falso", codigo: "ret-muerto" }, // portal desconocido
        { portal: "infocasas" }, // sin código
        null,
      ],
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ recibidos: 0, retirados: 1 })
    const ids = (await filas("id like '%:ret-%'")).map(f => f.id).sort()
    expect(ids).toEqual(["infocasas:ret-favorito", "infocasas:ret-vivo", "urbania:ret-muerto"])
  })

  it("un aviso normal no se ve afectado: sin rango, sin tipologías y con su propio código", async () => {
    const normal: Aviso = { portal: "infocasas", codigo: "777", operacion: "VENTA", inmueble: "Departamento", titulo: "Depa en Miraflores", precio: 300000, moneda: "PEN", dormitorios: "2", banios: "2", area: "80 m2", distrito: "Miraflores" }
    await guardarAvisos(ctx.db, [normal], 3.4)
    const p = (await filas("id = 'infocasas:777'"))[0]
    expect(p).toMatchObject({ inmueble: "Departamento", dormitorios: "2", precio_max: null, unidades: null })
    expect(Number(p.precio)).toBe(300000)
  })
})

describe("normalizar proyectos (sin base de datos)", () => {
  const unidad = (precio: number | undefined, dorm = 1, area = 50) => ({ dormitorios: dorm, banios: 1, area, precio })
  const base = (extra: Partial<Aviso>): Aviso => ({ portal: "infocasas", codigo: "proyecto-x", operacion: "VENTA", inmueble: "Proyecto", titulo: "X", moneda: "PEN", ...extra })

  it("el «hasta» absurdo (más de 30 veces el «desde») se descarta; uno razonable se guarda", () => {
    expect(normalizarAviso(base({ unidades: [unidad(200000), unidad(250000, 2)] }), 3.4)).toMatchObject({ precio: 200000, precio_max: 250000 })
    expect(normalizarAviso(base({ unidades: [unidad(200000), unidad(99_000_000, 2)] }), 3.4)).toMatchObject({ precio: 200000, precio_max: null })
  })

  it("el dólar del «hasta» sale del tipo de cambio si el proyecto está en soles, y es el mismo monto si está en dólares", () => {
    expect(normalizarAviso(base({ moneda: "PEN", unidades: [unidad(340000), unidad(680000, 2)] }), 3.4)).toMatchObject({ precio_usd: 100000, precio_max_usd: 200000 })
    expect(normalizarAviso(base({ moneda: "USD", unidades: [unidad(100000), unidad(150000, 2)] }), 3.4)).toMatchObject({ precio_usd: 100000, precio_max_usd: 150000 })
  })

  it("el precio y las cantidades salen de las tipologías aunque el aviso traiga los de una sola", () => {
    const f = normalizarAviso(base({ precio: 130600, dormitorios: "3", area: "66 m2", moneda: "USD", unidades: [unidad(108700, 1, 54), unidad(130600, 3, 66)] }), 3.4)!
    expect(f).toMatchObject({ precio: 108700, precio_max: 130600, dormitorios: "1, 3", area: "54 – 66 m2" })
  })

  it("las tipologías solo se guardan en proyectos y vacías o repetidas se limpian", () => {
    expect(normalizarAviso(base({ inmueble: "Departamento", unidades: [unidad(1)] }), 3.4)!.unidades).toBeNull()
    const f = normalizarAviso(base({ unidades: [{}, { codigo: "a", precio: 100000 }, { codigo: "a", precio: 100000 }, { dormitorios: -2 }] }), 3.4)!
    expect(JSON.parse(f.unidades!)).toEqual([{ codigo: "a", precio: 100000 }])
  })

  it("sin tipologías se respetan el precio y el «hasta» del aviso", () => {
    expect(normalizarAviso(base({ precio: 150000, precioMax: 220000, moneda: "USD" }), 3.4)).toMatchObject({ precio: 150000, precio_max: 220000, unidades: null })
    expect(normalizarAviso(base({ precio: 150000, precioMax: 100000, moneda: "USD" }), 3.4)).toMatchObject({ precio: 150000, precio_max: null })
  })
})

describe("sin la migración 014 (aún no ejecutada)", () => {
  let ctx: Awaited<ReturnType<typeof crearBase>>
  beforeAll(async () => {
    ctx = await crearBase(TODAS)
  })
  afterAll(async () => {
    await ctx.pg.close()
  })

  it("el proyecto se guarda igual (con su «Desde» y sus rangos) y el catálogo y el detalle siguen funcionando", async () => {
    const r = await guardarAvisos(ctx.db, [avisoDeInfocasas(real(187068547))], 3.4)
    expect(r.guardados).toBe(1)
    const lista = await ctx.get("/api/propiedades?inmueble=Proyecto")
    expect(lista.status).toBe(200)
    expect(lista.body.data[0]).toMatchObject({ id: "infocasas:proyecto-b34", precio: 108700, dormitorios: "1, 2, 3", area: "54 – 66 m2" })
    expect(lista.body.data[0].precio_max).toBeUndefined()
    const detalle = await ctx.get(`/api/propiedades/${encodeURIComponent("infocasas:proyecto-b34")}`)
    expect(detalle.status).toBe(200)
    expect(detalle.body.propiedad.precio).toBe(108700)
    const admin = await ctx.get("/api/admin/propiedades?inmueble=Proyecto")
    expect(admin.status).toBe(200)
    expect(admin.body.data[0]).toMatchObject({ precio: 108700 })
  })
})
