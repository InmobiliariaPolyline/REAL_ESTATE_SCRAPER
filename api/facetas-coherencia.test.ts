import fs from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { combinarFacetas, type FacetasDelCatalogo } from "../client/src/lib/facetas"
import { elegirDepartamento, elegirDistrito, elegirProvincia, opcionesGeograficas, type SeleccionGeo } from "../client/src/lib/geografia"
import { portalParams } from "../client/src/lib/propertiesApi"
import { DEFAULT_FILTERS, type FilterState } from "../client/src/types"
import { buildFacetas, buildPortalCount, parsePortalFilters } from "./propertyQueries"

/**
 * Contrato entre las listas de la ventana de filtros y la búsqueda: cada opción que la ventana ofrece con «N avisos»
 * (con el portal elegido) debe devolver exactamente N al buscarla. Se prueba con los datos desordenados que traen los
 * portales: el Callao guardado dentro de Lima, una provincia puesta como departamento, tildes, mayúsculas…
 */
const root = path.resolve(import.meta.dirname, "..")
const pg = new PGlite({ extensions: { pgcrypto } })
const query = async (text: string, params: unknown[] = []) => (await pg.query(text, params as never[])).rows as any[]

beforeAll(async () => {
  for (const f of ["001_schema", "002_auth", "003_account_ops", "004_price_history", "005_sessions_audit", "006_idle_timeout", "007_carga", "008_imagenes", "009_detalles", "010_fuentes", "011_ubicacion"]) {
    await pg.exec(fs.readFileSync(path.join(root, `db/${f}.sql`), "utf8"))
  }
  await pg.exec(`
    insert into propiedades (id, portal, operacion, inmueble, titulo, precio, precio_usd, moneda, distrito, departamento, provincia) values
      ('i1','infocasas','VENTA','Departamento','Depa Miraflores',300000,80000,'PEN','Miraflores','Lima','Lima'),
      ('i2','infocasas','VENTA','Departamento','Depa Surco',300000,80000,'PEN','Santiago de Surco','Lima','Lima'),
      ('i3','infocasas','VENTA','Casa','Casa Callao',300000,80000,'PEN','Callao','Lima','Lima'),
      ('i4','infocasas','VENTA','Casa','Casa Bellavista',300000,80000,'PEN','Bellavista','Lima','Callao'),
      ('i5','infocasas','VENTA','Casa','Casa Mala',300000,80000,'PEN','Mala','Cañete','Cañete'),
      ('i6','infocasas','VENTA','Casa','Casa Cercado',300000,80000,'PEN','Cercado de Lima','Lima','Lima'),
      ('i7','infocasas','VENTA','Casa','Casa Lince',300000,80000,'PEN','lince','LIMA','lima'),
      ('i8','infocasas','VENTA','Terreno','Terreno sin dato',300000,80000,'PEN','Chorrillos',null,null),
      ('p1','properati','VENTA','Departamento','Depa Lima',300000,80000,'PEN','San Isidro','Lima','Lima'),
      ('p2','properati','VENTA','Departamento','Depa Arequipa',300000,80000,'PEN','Cayma','Arequipa','Arequipa'),
      ('p3','properati','VENTA','Casa','Casa Callao P',300000,80000,'PEN','La Perla','Callao','Callao'),
      ('p4','properati','ALQUILER','Casa','La Victoria de Chiclayo',300000,80000,'PEN','La Victoria','Lambayeque','Chiclayo'),
      ('p5','properati','VENTA','Casa','Pisco como departamento',300000,80000,'PEN','Paracas','Pisco',null),
      ('p6','properati','ALQUILER','Casa','Callao dentro de Lima',300000,80000,'PEN','Ventanilla','Lima','Lima')
  `)
})

afterAll(async () => {
  await pg.close()
})

const filtros = (patch: Partial<FilterState>): FilterState => ({ ...DEFAULT_FILTERS, portales: [], ...patch })
const aParams = (f: FilterState) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(portalParams(f, "relevancia"))) if (v !== "" && v !== null && v !== undefined) q.set(k, String(v))
  return q
}
const contar = async (f: FilterState) => {
  const c = buildPortalCount(parsePortalFilters(aParams(f)), 4)
  return (await query(c.text, c.params))[0].total as number
}
const catalogo = async (f: FilterState) => {
  const consultas = buildFacetas(parsePortalFilters(aParams(f)), 4)
  const [departamentos, provincias, distritos, inmuebles, anunciantes] = await Promise.all(
    [consultas.departamentos, consultas.provincias, consultas.distritos, consultas.inmuebles, consultas.anunciantes].map(q => query(q.text, q.params))
  )
  return { departamentos, provincias, distritos, inmuebles, anunciantes } as FacetasDelCatalogo
}

describe("las opciones de la ventana coinciden con lo que devuelve la búsqueda", () => {
  for (const portal of ["infocasas", "properati", ""]) {
    for (const operacion of ["todos", "ALQUILER"] as const) {
    it(`cada lugar ofrecido con N avisos devuelve N al buscarlo (portal: ${portal || "todos"}, operación: ${operacion})`, async () => {
      const base = filtros({ portales: portal ? [portal] : [], operacion })
      const facetas = combinarFacetas(await catalogo(base))
      const fallos: string[] = []
      const verificar = async (nombre: string, sel: SeleccionGeo, esperado: number) => {
        const real = await contar({ ...base, ...sel })
        if (real !== esperado) fallos.push(`${nombre}: la lista dice ${esperado} y la búsqueda devuelve ${real} (${JSON.stringify(sel)})`)
      }
      const vacio: SeleccionGeo = { departamento: "", provincia: "", distrito: "" }

      for (const d of facetas.departamentos.filter(x => x.n > 0)) {
        const sel = elegirDepartamento(facetas, vacio, d.valor)
        await verificar(`departamento ${d.valor}`, sel, d.n)
        const { provincias, distritos } = opcionesGeograficas(facetas, sel)
        for (const p of provincias.filter(x => x.n > 0)) await verificar(`provincia ${p.valor} (${d.valor})`, elegirProvincia(facetas, sel, p.valor), p.n)
        for (const di of distritos.filter(x => x.n > 0)) await verificar(`distrito ${di.valor} (${d.valor})`, elegirDistrito(facetas, sel, di.valor), di.n)
      }
      for (const p of facetas.provincias.filter(x => x.n > 0)) await verificar(`provincia suelta ${p.valor}`, elegirProvincia(facetas, vacio, p.valor), p.n)
      for (const di of facetas.distritos.filter(x => x.n > 0)) await verificar(`distrito suelto ${di.valor}`, elegirDistrito(facetas, vacio, di.valor), di.n)
      expect(fallos).toEqual([])
      // El Callao aparece una sola vez como departamento, aunque un portal lo publique dentro de «Lima».
      expect(facetas.departamentos.filter(d => d.valor === "Callao")).toHaveLength(1)
    })
    }
  }
})
