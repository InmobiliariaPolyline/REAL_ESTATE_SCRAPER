import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { beforeAll, describe, expect, it } from "vitest"
import { cloudinaryDe, copiarPortadas, firmar, idPublico, subirPortada } from "./imagenes"
import { guardarAvisos, type Aviso } from "./ingest"

const root = path.resolve(import.meta.dirname, "..")
let pg: PGlite
const db = { query: async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows as never[] }
const env = { CLOUDINARY_URL: "cloudinary://123456:secreto-x@mi-nube" }

const aviso = (codigo: string, imagen: string): Aviso => ({
  portal: "infocasas", codigo, operacion: "VENTA", inmueble: "Casa", titulo: `Casa ${codigo}`, precio: 100000, moneda: "USD", imagen,
})

beforeAll(async () => {
  pg = new PGlite({ extensions: { pgcrypto } })
  for (const f of ["001_schema.sql", "004_price_history.sql", "008_imagenes.sql"]) await pg.exec(fs.readFileSync(path.join(root, "db", f), "utf8"))
})

describe("cloudinary", () => {
  it("lee CLOUDINARY_URL y rechaza lo mal escrito", () => {
    expect(cloudinaryDe(env)).toEqual({ clave: "123456", secreto: "secreto-x", nombre: "mi-nube" })
    expect(cloudinaryDe({})).toBeNull()
    expect(cloudinaryDe({ CLOUDINARY_URL: "https://x.com" })).toBeNull()
  })

  it("firma con los parámetros ordenados y el secreto al final", () => {
    // sha1("public_id=a&timestamp=1" + "s")
    expect(firmar({ timestamp: "1", public_id: "a" }, "s")).toBe("01cef644b4aae010a240228ea0682b4fdb6db393")
  })

  it("el identificador público no lleva caracteres raros", () => {
    expect(idPublico("infocasas:194/5 x")).toBe("propiedades/infocasas_194_5_x")
  })
})

describe("copiarPortadas", () => {
  const falsoCloudinary = (fallar = false) => {
    const llamadas: URLSearchParams[] = []
    const fetchFn = (async (_u: string, init: { body: URLSearchParams }) => {
      llamadas.push(init.body)
      return fallar
        ? new Response(JSON.stringify({ error: { message: "no se pudo" } }), { status: 400 })
        : new Response(JSON.stringify({ secure_url: `https://res.cloudinary.com/mi-nube/image/upload/${init.body.get("public_id")}.jpg` }), { status: 200 })
    }) as unknown as typeof fetch
    return { fetchFn, llamadas }
  }

  it("sin configuración no hace nada", async () => {
    expect(await copiarPortadas(db, {})).toEqual({ configurado: false, intentadas: 0, copiadas: 0, fallidas: 0 })
  })

  it("copia las portadas del portal y no repite las ya copiadas", async () => {
    await guardarAvisos(db, [aviso("c1", "https://cdn.portal.com/a.jpg"), aviso("c2", "https://cdn.portal.com/b.jpg")])
    const { fetchFn, llamadas } = falsoCloudinary()
    const r = await copiarPortadas(db, env, { fetchFn })
    expect(r).toMatchObject({ configurado: true, intentadas: 2, copiadas: 2, fallidas: 0 })
    expect(llamadas[0].get("signature")).toMatch(/^[0-9a-f]{40}$/)
    expect(llamadas[0].get("transformation")).toBe("c_limit,w_720,q_auto:good")
    const filas = await pg.query<{ imagen: string }>("select imagen from public.propiedades where id like 'infocasas:c%'")
    expect(filas.rows.every(f => f.imagen.startsWith("https://res.cloudinary.com/"))).toBe(true)
    expect((await copiarPortadas(db, env, { fetchFn })).intentadas).toBe(0)
  })

  it("una nueva lectura del portal no pisa la portada ya copiada", async () => {
    await guardarAvisos(db, [aviso("c1", "https://cdn.portal.com/otra.jpg")])
    const f = await pg.query<{ imagen: string }>("select imagen from public.propiedades where id = 'infocasas:c1'")
    expect(f.rows[0].imagen).toContain("res.cloudinary.com")
  })

  it("si Cloudinary falla, el aviso conserva la foto del portal", async () => {
    await guardarAvisos(db, [aviso("c3", "https://cdn.portal.com/c.jpg")])
    const r = await copiarPortadas(db, env, { fetchFn: falsoCloudinary(true).fetchFn })
    expect(r).toMatchObject({ copiadas: 0, fallidas: 1, primerError: "no se pudo" })
    const f = await pg.query<{ imagen: string }>("select imagen from public.propiedades where id = 'infocasas:c3'")
    expect(f.rows[0].imagen).toBe("https://cdn.portal.com/c.jpg")
  })

  it("subirPortada informa el error de Cloudinary", async () => {
    await expect(subirPortada({ nombre: "n", clave: "k", secreto: "s" }, "x:1", "https://a/b.jpg", falsoCloudinary(true).fetchFn)).rejects.toThrow("no se pudo")
  })
})
