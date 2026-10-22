import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { beforeAll, describe, expect, it } from "vitest"
import { decodificarEntidades, fotoGrande, guardarAvisos, limpiarDescripcion, normalizarAviso, usdCoherente, type Aviso } from "./ingest"

const root = path.resolve(import.meta.dirname, "..")
let pg: PGlite
const db = { query: async (text: string, params: unknown[] = []) => pg.query(text, params) }

const base: Aviso = {
  portal: "urbania",
  codigo: "A-1",
  operacion: "VENTA",
  inmueble: "Departamento",
  titulo: "Depa en Miraflores",
  precio: 375000,
  moneda: "PEN",
  distrito: "Miraflores",
  url: "https://urbania.pe/aviso/A-1",
  imagen: "javascript:alert(1)",
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { pgcrypto } })
  await pg.exec(fs.readFileSync(path.join(root, "db/001_schema.sql"), "utf8"))
  await pg.exec(fs.readFileSync(path.join(root, "db/004_price_history.sql"), "utf8"))
})

describe("normalizarAviso", () => {
  it("genera un id estable y calcula USD con el tipo de cambio", () => {
    const fila = normalizarAviso(base, 3.75)!
    expect(fila.id).toBe("urbania:A-1")
    expect(fila.precio_usd).toBe(100000)
    expect(fila.moneda).toBe("PEN")
  })

  it("conserva el precio en USD y respeta precioUsd si ya viene", () => {
    expect(normalizarAviso({ ...base, moneda: "USD", precio: 90000 })!.precio_usd).toBe(90000)
    expect(normalizarAviso({ ...base, precioUsd: 99000 })!.precio_usd).toBe(99000)
  })

  it("descarta esquemas peligrosos en url e imagen", () => {
    const fila = normalizarAviso(base)!
    expect(fila.imagen).toBeNull()
    expect(fila.url).toBe("https://urbania.pe/aviso/A-1")
  })

  it("rechaza avisos que no se pueden identificar", () => {
    expect(normalizarAviso({ ...base, codigo: "  " })).toBeNull()
    expect(normalizarAviso({ ...base, portal: "otro" as never })).toBeNull()
    expect(normalizarAviso({ ...base, operacion: "TRUEQUE" as never })).toBeNull()
  })

  it("sin precio queda en 0", () => {
    const fila = normalizarAviso({ ...base, precio: undefined })!
    expect(fila.precio).toBe(0)
    expect(fila.precio_usd).toBe(0)
  })
})

describe("guardarAvisos", () => {
  it("inserta y vuelve a ejecutarse sin duplicar, refrescando ultima_vista_en y respetando creado_en", async () => {
    const r1 = await guardarAvisos(db, [base, { ...base, codigo: "A-2" }, { ...base, codigo: "" }], 3.75)
    expect(r1).toEqual({ guardados: 2, descartados: 1 })

    await pg.query("update propiedades set creado_en = now() - interval '5 days', ultima_vista_en = now() - interval '5 days'")
    const antes = (await pg.query<{ creado_en: Date }>("select creado_en from propiedades where id = 'urbania:A-1'")).rows[0]

    await guardarAvisos(db, [{ ...base, titulo: "Depa renovado", precio: 360000 }], 3.75)

    const { rows } = await pg.query<{ n: number; titulo: string; precio: string; fresco: boolean; antiguo: boolean }>(
      `select (select count(*)::int from propiedades) as n, titulo, precio::text,
              ultima_vista_en > now() - interval '1 minute' as fresco,
              creado_en < now() - interval '4 days' as antiguo
         from propiedades where id = 'urbania:A-1'`
    )
    expect(rows[0].n).toBe(2)
    expect(rows[0].titulo).toBe("Depa renovado")
    expect(Number(rows[0].precio)).toBe(360000)
    expect(rows[0].fresco).toBe(true)
    expect(rows[0].antiguo).toBe(true)
    expect(antes.creado_en).toBeTruthy()
  })

  it("el cambio de precio queda en el historial", async () => {
    const { rows } = await pg.query<{ n: number }>("select count(*)::int as n from propiedades_precios where propiedad_id = 'urbania:A-1'")
    expect(rows[0].n).toBeGreaterThanOrEqual(2)
  })

  it("un aviso repetido en la misma corrida se guarda una vez", async () => {
    const r = await guardarAvisos(db, [{ ...base, codigo: "D-1" }, { ...base, codigo: "D-1", titulo: "último" }])
    expect(r.guardados).toBe(1)
    const { rows } = await pg.query<{ titulo: string }>("select titulo from propiedades where id = 'urbania:D-1'")
    expect(rows[0].titulo).toBe("último")
  })

  it("procesa lotes grandes", async () => {
    const muchos = Array.from({ length: 450 }, (_, i) => ({ ...base, codigo: `L-${i}`, precio: 1000 + i }))
    expect((await guardarAvisos(db, muchos)).guardados).toBe(450)
  })
})

describe("fotos del aviso", () => {
  const base = { portal: "urbania", codigo: "F1", operacion: "VENTA", inmueble: "Casa" } as const

  it("la portada va primero, sin repetir, solo http(s) y hasta 20", () => {
    const fotos = Array.from({ length: 30 }, (_, i) => `https://img/${i}.jpg`)
    const fila = normalizarAviso({ ...base, imagen: "https://img/5.jpg", imagenes: ["javascript:alert(1)", ...fotos] })!
    expect(fila.imagen).toBe("https://img/5.jpg")
    expect(fila.imagenes).toHaveLength(20)
    expect(fila.imagenes[0]).toBe("https://img/5.jpg")
    expect(new Set(fila.imagenes).size).toBe(20)
    expect(fila.imagenes.every(u => u.startsWith("https://"))).toBe(true)
  })

  it("sin lista usa solo la portada; sin nada queda vacío", () => {
    expect(normalizarAviso({ ...base, imagen: "https://img/a.jpg" })!.imagenes).toEqual(["https://img/a.jpg"])
    expect(normalizarAviso(base)).toMatchObject({ imagen: null, imagenes: [] })
  })
})

describe("calidad de los datos al guardar", () => {
  const base = { portal: "adondevivir", codigo: "Q1", operacion: "ALQUILER", inmueble: "Departamento" } as const

  it("decodifica entidades HTML del título", () => {
    expect(decodificarEntidades("Depa de 42 m&sup2; &amp; cochera &#39;full&#39; &#x41;")).toBe("Depa de 42 m² & cochera 'full' A")
    expect(decodificarEntidades("&noexiste; sigue")).toBe("&noexiste; sigue")
    expect(normalizarAviso({ ...base, titulo: "Moderno 40 m&sup2;" })!.titulo).toBe("Moderno 40 m²")
  })

  it("pide la foto grande a los portales Navent y no toca otras", () => {
    expect(fotoGrande("https://img10.naventcdn.com/avisos/111/01/50/56/08/68/360x266/1620828125.jpg?rapc=x")).toBe(
      "https://img10.naventcdn.com/avisos/111/01/50/56/08/68/720x532/1620828125.jpg?rapc=x"
    )
    expect(fotoGrande("https://otro.com/360x266/a.jpg")).toBe("https://otro.com/360x266/a.jpg")
    expect(normalizarAviso({ ...base, imagen: "https://img10.naventcdn.com/a/360x266/1.jpg" })!.imagen).toContain("/720x532/")
  })

  it("descarta un precio en dólares que no cuadra con el publicado y lo recalcula", () => {
    // Caso real: alquiler de S/ 1 199 con price_usd = 357 000.
    const fila = normalizarAviso({ ...base, precio: 1199, moneda: "PEN", precioUsd: 357000 }, 3.75)!
    expect(fila.precio_usd).toBeCloseTo(319.73, 1)
    // Uno coherente se respeta tal cual.
    expect(normalizarAviso({ ...base, precio: 1199, moneda: "PEN", precioUsd: 350 }, 3.75)!.precio_usd).toBe(350)
    expect(usdCoherente(1000, "USD", 1010, 3.75)).toBe(1010)
    expect(usdCoherente(1000, "USD", 5000, 3.75)).toBe(0)
  })
})

describe("datos extra del aviso (db/009)", () => {
  const base = { portal: "urbania", codigo: "D1", operacion: "VENTA", inmueble: "Casa" } as const

  it("limpia la descripción: sin HTML, con entidades decodificadas y espacios normalizados", () => {
    expect(limpiarDescripcion("<p>Casa&nbsp;linda</p><br/>Cerca de <b>todo</b> &amp; m&sup2;")).toBe("Casa linda\nCerca de todo & m²")
    expect(limpiarDescripcion("   ")).toBeNull()
    expect(limpiarDescripcion(undefined)).toBeNull()
    expect(limpiarDescripcion("x".repeat(9000))).toHaveLength(4000)
  })

  it("normaliza dirección, cochera, antigüedad, anunciante, coordenadas y mantenimiento", () => {
    const f = normalizarAviso({
      ...base, descripcion: "Bonita", direccion: "  Av. Perú 123  ", estacionamientos: "2", antiguedad: "5 años", publicador: "Inmobiliaria X",
      latitud: -12.1, longitud: -77.03, mantenimiento: 150,
    })!
    expect(f).toMatchObject({ descripcion: "Bonita", direccion: "Av. Perú 123", estacionamientos: "2", antiguedad: "5 años", publicador: "Inmobiliaria X", latitud: -12.1, longitud: -77.03, mantenimiento: 150 })
  })

  it("descarta coordenadas imposibles y mantenimiento no positivo", () => {
    const f = normalizarAviso({ ...base, latitud: 999, longitud: -500, mantenimiento: -3 })!
    expect(f).toMatchObject({ latitud: null, longitud: null, mantenimiento: null, descripcion: null, direccion: null })
  })

  it("si la base no tiene las columnas nuevas, guarda igual con menos columnas", async () => {
    const consultas: string[] = []
    const db = {
      query: async (text: string) => {
        consultas.push(text)
        if (text.includes("descripcion")) throw new Error('column "descripcion" of relation "propiedades" does not exist')
        if (text.includes("imagenes")) throw new Error('column "imagenes" of relation "propiedades" does not exist')
      },
    }
    const r = await guardarAvisos(db, [{ ...base, codigo: "D2", descripcion: "x", imagenes: ["https://a/1.jpg"] }])
    expect(r.guardados).toBe(1)
    expect(consultas).toHaveLength(3)
    expect(consultas[2]).not.toContain("imagenes")
    expect(consultas[2]).not.toContain("descripcion")
    expect(consultas[2]).toContain("titulo")
  })

  it("un error que no es de columnas faltantes se propaga", async () => {
    const db = { query: async () => { throw new Error("connection reset") } }
    await expect(guardarAvisos(db, [{ ...base, codigo: "D3" }])).rejects.toThrow("connection reset")
  })
})
