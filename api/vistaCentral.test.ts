import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  INTERVALO_MIN_MS,
  MAX_PROPIEDADES_VISTA,
  reiniciarLimitador,
  sincronizarSiConfigurado,
  sincronizarVistaCentral,
} from "./vistaCentral"

const root = path.resolve(import.meta.dirname, "..")

// Mismo contrato que `01_schema.sql` de la vista central (solo las tablas del scraper).
const ESQUEMA_CENTRAL = `
  CREATE SCHEMA central;
  CREATE TABLE central.scraper_propiedades (
    propiedad_id text PRIMARY KEY, portal text NOT NULL, operacion text, inmueble text, titulo text,
    precio numeric(14,2), moneda text, precio_usd numeric(14,2), distrito text, dormitorios text,
    banios text, area text, url text, encontrada_en timestamptz NOT NULL, ultima_vista_en timestamptz);
  CREATE TABLE central.scraper_resumen (
    portal text NOT NULL, operacion text NOT NULL DEFAULT '', total integer NOT NULL,
    ultima_vista timestamptz, PRIMARY KEY (portal, operacion));
  CREATE TABLE central.sync_estado (app text PRIMARY KEY, ultima_sync timestamptz NOT NULL DEFAULT now());
`

let origen: PGlite
let central: PGlite
const dbOrigen = { query: async (t: string, p: unknown[] = []) => origen.query(t, p).then(r => r.rows as never[]) }
const dbCentral = { query: async (t: string, p: unknown[] = []) => central.query(t, p).then(r => r.rows as never[]) }

async function insertar(id: string, portal: string, operacion: string, creado: string) {
  await origen.query(
    `INSERT INTO public.propiedades (id, portal, operacion, inmueble, titulo, precio, precio_usd, moneda, distrito, creado_en)
     VALUES ($1, $2, $3, 'Departamento', $4, 100000, 100000, 'USD', 'Miraflores', $5)`,
    [id, portal, operacion, `Aviso ${id}`, creado],
  )
}

beforeAll(async () => {
  origen = new PGlite({ extensions: { pgcrypto } })
  await origen.exec(fs.readFileSync(path.join(root, "db/001_schema.sql"), "utf8"))
  central = new PGlite()
  await central.exec(ESQUEMA_CENTRAL)
})

beforeEach(async () => {
  reiniciarLimitador()
  await origen.exec("DELETE FROM public.propiedades")
  await central.exec("DELETE FROM central.scraper_propiedades; DELETE FROM central.scraper_resumen; DELETE FROM central.sync_estado")
})

describe("sincronizarVistaCentral", () => {
  it("copia las propiedades, el resumen por portal y marca la hora de sincronización", async () => {
    await insertar("urbania:1", "urbania", "VENTA", "2026-01-01T10:00:00Z")
    await insertar("urbania:2", "urbania", "ALQUILER", "2026-01-02T10:00:00Z")
    await insertar("infocasas:1", "infocasas", "VENTA", "2026-01-03T10:00:00Z")

    const r = await sincronizarVistaCentral(dbOrigen, dbCentral)
    expect(r).toEqual({ propiedades: 3, resumenes: 3 })

    const props = await central.query("SELECT propiedad_id FROM central.scraper_propiedades ORDER BY propiedad_id")
    expect(props.rows.map((x: any) => x.propiedad_id)).toEqual(["infocasas:1", "urbania:1", "urbania:2"])
    const res = await central.query("SELECT portal, operacion, total FROM central.scraper_resumen ORDER BY portal, operacion")
    expect(res.rows).toEqual([
      { portal: "infocasas", operacion: "VENTA", total: 1 },
      { portal: "urbania", operacion: "ALQUILER", total: 1 },
      { portal: "urbania", operacion: "VENTA", total: 1 },
    ])
    const est = await central.query("SELECT app FROM central.sync_estado")
    expect(est.rows).toEqual([{ app: "scraper" }])
  })

  it("es idempotente: repetirla no duplica filas", async () => {
    await insertar("urbania:1", "urbania", "VENTA", "2026-01-01T10:00:00Z")
    await sincronizarVistaCentral(dbOrigen, dbCentral)
    await sincronizarVistaCentral(dbOrigen, dbCentral)
    const n = await central.query("SELECT count(*)::int AS n FROM central.scraper_propiedades")
    expect((n.rows[0] as any).n).toBe(1)
  })

  it("quita de la foto lo que ya no existe y refleja cambios de precio", async () => {
    await insertar("urbania:1", "urbania", "VENTA", "2026-01-01T10:00:00Z")
    await insertar("urbania:2", "urbania", "VENTA", "2026-01-02T10:00:00Z")
    await sincronizarVistaCentral(dbOrigen, dbCentral)

    await origen.query("DELETE FROM public.propiedades WHERE id = 'urbania:1'")
    await origen.query("UPDATE public.propiedades SET precio = 555 WHERE id = 'urbania:2'")
    await sincronizarVistaCentral(dbOrigen, dbCentral)

    const props = await central.query("SELECT propiedad_id, precio FROM central.scraper_propiedades")
    expect(props.rows).toEqual([{ propiedad_id: "urbania:2", precio: "555.00" }])
    const res = await central.query("SELECT total FROM central.scraper_resumen")
    expect(res.rows).toEqual([{ total: 1 }])
  })

  it(`copia como máximo ${MAX_PROPIEDADES_VISTA} propiedades, las más recientes, pero cuenta todas en el resumen`, async () => {
    await origen.query(
      `INSERT INTO public.propiedades (id, portal, operacion, precio, precio_usd, moneda, creado_en)
       SELECT 'p:' || g, 'urbania', 'VENTA', 1, 1, 'USD', now() - (g || ' minutes')::interval
         FROM generate_series(1, ${MAX_PROPIEDADES_VISTA + 25}) g`,
    )
    await sincronizarVistaCentral(dbOrigen, dbCentral)
    const n = await central.query("SELECT count(*)::int AS n FROM central.scraper_propiedades")
    expect((n.rows[0] as any).n).toBe(MAX_PROPIEDADES_VISTA)
    const masNueva = await central.query("SELECT 1 FROM central.scraper_propiedades WHERE propiedad_id = 'p:1'")
    expect(masNueva.rows.length).toBe(1)
    const resumen = await central.query("SELECT total FROM central.scraper_resumen")
    expect((resumen.rows[0] as any).total).toBe(MAX_PROPIEDADES_VISTA + 25)
  })

  it("un precio enorme no rompe toda la sincronización: se acota al máximo de la columna", async () => {
    await insertar("urbania:1", "urbania", "VENTA", "2026-01-01T10:00:00Z")
    await origen.query("UPDATE public.propiedades SET precio = 1e15, precio_usd = -1e15 WHERE id = 'urbania:1'")
    await insertar("urbania:2", "urbania", "VENTA", "2026-01-02T10:00:00Z")
    await expect(sincronizarVistaCentral(dbOrigen, dbCentral)).resolves.toEqual({ propiedades: 2, resumenes: 1 })
    const f = await central.query("SELECT precio::text p, precio_usd::text u FROM central.scraper_propiedades WHERE propiedad_id = 'urbania:1'")
    expect(f.rows[0]).toEqual({ p: "999999999999.99", u: "-999999999999.99" })
    const normal = await central.query("SELECT precio::text p FROM central.scraper_propiedades WHERE propiedad_id = 'urbania:2'")
    expect(normal.rows[0]).toEqual({ p: "100000.00" })
  })

  it("no copia columnas sensibles ni de otras tablas", async () => {
    await insertar("urbania:1", "urbania", "VENTA", "2026-01-01T10:00:00Z")
    await sincronizarVistaCentral(dbOrigen, dbCentral)
    const cols = await central.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'central' AND table_name = 'scraper_propiedades'",
    )
    const nombres = cols.rows.map((c: any) => c.column_name)
    for (const prohibida of ["descripcion", "direccion", "publicador", "latitud", "longitud", "imagenes"]) {
      expect(nombres).not.toContain(prohibida)
    }
  })
})

describe("sincronizarSiConfigurado", () => {
  it("no hace nada sin CENTRAL_DATABASE_URL", async () => {
    await insertar("urbania:1", "urbania", "VENTA", "2026-01-01T10:00:00Z")
    expect(await sincronizarSiConfigurado(dbOrigen, {})).toBe(false)
    const n = await central.query("SELECT count(*)::int AS n FROM central.scraper_propiedades")
    expect((n.rows[0] as any).n).toBe(0)
  })

  it("sincroniza una vez y limita las llamadas seguidas", async () => {
    await insertar("urbania:1", "urbania", "VENTA", "2026-01-01T10:00:00Z")
    let reloj = 1_000_000
    const opciones = { central: dbCentral, ahora: () => reloj }
    expect(await sincronizarSiConfigurado(dbOrigen, {}, opciones)).toBe(true)
    reloj += 1000
    expect(await sincronizarSiConfigurado(dbOrigen, {}, opciones)).toBe(false)
    reloj += INTERVALO_MIN_MS
    expect(await sincronizarSiConfigurado(dbOrigen, {}, opciones)).toBe(true)
  })

  it("si la base central falla, no lanza, no filtra la conexión y permite reintentar", async () => {
    await insertar("urbania:1", "urbania", "VENTA", "2026-01-01T10:00:00Z")
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {})
    const rota = { query: async () => { throw new Error("connection refused postgres://u:secreto@host/db") } }
    await expect(sincronizarSiConfigurado(dbOrigen, {}, { central: rota as never })).resolves.toBe(false)
    expect(aviso).toHaveBeenCalled()
    expect(JSON.stringify(aviso.mock.calls)).not.toContain("secreto")
    // Se reintenta de inmediato en la siguiente llamada (el límite se reinicia tras un fallo).
    expect(await sincronizarSiConfigurado(dbOrigen, {}, { central: dbCentral })).toBe(true)
    aviso.mockRestore()
  })
})
