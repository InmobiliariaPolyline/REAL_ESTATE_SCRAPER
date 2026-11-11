import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
// @ts-expect-error módulo .mjs sin tipos
import { avisoDeInfocasas, infocasas } from "./lib/portales.mjs"
import { normalizarAviso } from "../api/ingest"
import { resumirUnidades } from "../shared/proyectos"

/**
 * Proyectos de InfoCasas con datos reales (scraper/fixtures/infocasas-proyectos.json: 25 tipologías de 22 proyectos y el
 * proyecto B34 tal como aparece en el listado de departamentos). Un proyecto ofrece varias tipologías con precios,
 * dormitorios y áreas distintos; se guarda un solo aviso por proyecto con el rango completo.
 */
const items: any[] = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/infocasas-proyectos.json"), "utf8"))
const por = (id: number) => items.find(i => i.id === id)
const aviso = (id: number) => avisoDeInfocasas(por(id))

describe("proyecto B34 (el caso que se leía mal)", () => {
  // B34 llega de dos formas: como el proyecto (id 5349, en el listado de departamentos) y como una de sus tipologías
  // (id 187068547, en el listado de proyectos). Antes la segunda se guardaba como un «Departamento» de US$ 130,600.
  const comoProyecto = () => aviso(5349)
  const comoTipologia = () => aviso(187068547)

  it("es un proyecto con precio «desde» y «hasta», y los dormitorios, baños y áreas de todas sus tipologías", () => {
    for (const a of [comoProyecto(), comoTipologia()]) {
      expect(a).toMatchObject({
        portal: "infocasas", codigo: "proyecto-b34", operacion: "VENTA", inmueble: "Proyecto", titulo: "B34",
        precio: 108700, precioMax: 130600, moneda: "USD",
        dormitorios: "1, 2, 3", banios: "1, 2", area: "54 – 66 m2",
        distrito: "Surquillo", departamento: "Lima", publicador: "Jopesa", antiguedad: "En construcción",
        url: "https://www.infocasas.com.pe/proyectos/b34",
      })
      expect(a.unidades).toEqual([
        { codigo: "187065797", dormitorios: 1, banios: 1, area: 54, precio: 108700 },
        { codigo: "187068541", dormitorios: 2, banios: 2, area: 65, precio: 120580 },
        { codigo: "187068547", dormitorios: 3, banios: 2, area: 66, precio: 130600 },
      ])
    }
  })

  it("las dos formas de publicarlo dan exactamente el mismo aviso (no se duplica ni cambia según el listado)", () => {
    const campos = ({ imagen: _i, imagenes: _m, descripcion: _d, ...resto }: any) => resto
    expect(campos(comoTipologia())).toEqual(campos(comoProyecto()))
  })

  it("llega a la base como proyecto: «Desde» US$ 108,700, «Hasta» US$ 130,600 y sus tres tipologías", () => {
    const fila = normalizarAviso(comoTipologia(), 3.4)!
    expect(fila).toMatchObject({
      id: "infocasas:proyecto-b34", inmueble: "Proyecto", precio: 108700, precio_usd: 108700, moneda: "USD",
      precio_max: 130600, precio_max_usd: 130600, dormitorios: "1, 2, 3", banios: "1, 2", area: "54 – 66 m2",
    })
    expect(JSON.parse(fila.unidades!)).toHaveLength(3)
  })
})

describe("todos los proyectos reales", () => {
  const proyectos = items.map(i => ({ item: i, aviso: avisoDeInfocasas(i) }))

  it("ninguno se guarda como un aviso normal: todos son «Proyecto» con la dirección del proyecto", () => {
    for (const { item, aviso: a } of proyectos) {
      expect(a, `${item.id} ${item.title}`).not.toBeNull()
      expect(a.inmueble, item.title).toBe("Proyecto")
      expect(a.codigo, item.title).toMatch(/^proyecto-[a-z0-9-]+$/)
      expect(a.url, item.title).toMatch(/^https:\/\/www\.infocasas\.com\.pe\/proyectos\/[a-z0-9-]+$/)
    }
  })

  it("el precio «desde» es el menor de sus tipologías y el «hasta» el mayor (nunca el de una tipología cualquiera)", () => {
    for (const { item, aviso: a } of proyectos) {
      const precios = a.unidades.map((u: any) => u.precio).filter(Boolean) as number[]
      if (precios.length === 0) {
        expect(a.precio, item.title).toBeUndefined()
        continue
      }
      expect(a.precio, item.title).toBe(Math.min(...precios))
      const max = Math.max(...precios)
      expect(a.precioMax, item.title).toBe(max > a.precio ? max : undefined)
      if (a.precioMax) expect(a.precioMax).toBeGreaterThan(a.precio)
    }
  })

  it("coincide con el «desde» que publica el portal (salvo tipologías con el precio oculto)", () => {
    for (const { item, aviso: a } of proyectos) {
      const minimo = item.project?.minPrice?.amount
      const ocultas = (item.commercial_units ?? []).some((u: any) => u.price?.hidePrice === true)
      if (minimo && !ocultas) expect(a.precio, item.title).toBe(minimo)
    }
  })

  it("los dormitorios, baños y áreas son los de todas sus tipologías, no los de una sola", () => {
    for (const { item, aviso: a } of proyectos) {
      const u = item.commercial_units as any[]
      const dorm = [...new Set(u.map(x => x.bedrooms).filter((n: number) => n > 0))].sort((x: number, y: number) => x - y)
      expect(a.dormitorios, item.title).toBe(dorm.length ? dorm.join(", ") : undefined)
      const areas = u.map(x => x.m2).filter((n: number) => n > 0)
      if (areas.length) {
        const lo = Math.min(...areas)
        const hi = Math.max(...areas)
        expect(a.area, item.title).toBe(hi > lo ? `${lo} – ${hi} m2` : `${lo} m2`)
      }
    }
  })

  it("la moneda es la de los precios del proyecto (soles o dólares)", () => {
    for (const { item, aviso: a } of proyectos) {
      const u = (item.commercial_units as any[]).find(x => x.price?.hidePrice !== true)
      const dolar = /u\$s|usd/i.test(String(u?.price?.currency?.name ?? u?.price?.currency ?? item.price?.currency?.name))
      expect(a.moneda, item.title).toBe(dolar ? "USD" : "PEN")
    }
  })

  it("las tipologías de un mismo proyecto leídas desde listados distintos dan el mismo aviso (La Mar, Ocean Reef, Gran Central Colonial 2)", () => {
    // El pin del mapa cambia unos metros de una tipología a otra; lo demás es idéntico.
    const campos = ({ imagen: _i, imagenes: _m, descripcion: _d, latitud: _a, longitud: _o, ...resto }: any) => resto
    for (const [a, b] of [[190490134, 190449253], [186194969, 185992430], [190490128, 190449245]]) {
      expect(campos(aviso(a))).toEqual(campos(aviso(b)))
      expect(aviso(a).codigo).toBe(aviso(b).codigo)
      expect(Math.abs(aviso(a).latitud - aviso(b).latitud)).toBeLessThan(0.05)
    }
    // Y son proyectos distintos de los que se parecen en el nombre.
    expect(aviso(186060587).codigo).not.toBe(aviso(186060290).codigo) // Monte Umbroso / Monte Umbroso 816
  })

  it("el servidor calcula el mismo resumen que el scraper (precio, rango, dormitorios, baños y área)", () => {
    for (const { item, aviso: a } of proyectos) {
      const r = resumirUnidades(a.unidades)
      expect(r.precio, item.title).toBe(a.precio)
      expect(r.precioMax, item.title).toBe(a.precioMax)
      expect(r.dormitorios, item.title).toBe(a.dormitorios)
      expect(r.banios, item.title).toBe(a.banios)
      expect(r.area, item.title).toBe(a.area)
    }
  })

  it("todos pasan la validación del sistema y quedan con precio coherente en dólares", () => {
    for (const { item, aviso: a } of proyectos) {
      const fila = normalizarAviso(a, 3.4)
      expect(fila, item.title).not.toBeNull()
      expect(fila!.inmueble).toBe("Proyecto")
      if (fila!.precio > 0) {
        expect(fila!.precio_usd, item.title).toBeGreaterThan(0)
        if (fila!.precio_max) expect(fila!.precio_max, item.title).toBeGreaterThan(fila!.precio)
      }
    }
  })
})

describe("casos especiales de proyectos", () => {
  it("un proyecto con todos los precios ocultos se guarda sin precio, como el portal", () => {
    const a = aviso(186232156) // San Marino
    expect(a).toMatchObject({ inmueble: "Proyecto", dormitorios: "1", area: "37 m2" })
    expect(a.precio).toBeUndefined()
    expect(normalizarAviso(a, 3.4)).toMatchObject({ precio: 0, precio_usd: 0, precio_max: null })
  })

  it("una tipología con el precio oculto no cuenta para el rango, pero sigue en la lista", () => {
    const a = aviso(190487500) // Gran Guardia Peruana: una de cuatro tipologías oculta
    expect(a.precio).toBe(199260)
    expect(a.precioMax).toBe(353340)
    expect(a.unidades).toHaveLength(4)
    expect(a.unidades.filter((u: any) => u.precio === undefined)).toHaveLength(1)
  })

  it("un proyecto de un solo precio no inventa un «hasta»", () => {
    const a = aviso(186060587) // Monte Umbroso: una tipología
    expect(a.precio).toBe(426400)
    expect(a.precioMax).toBeUndefined()
    expect(a.area).toBe("164 m2")
  })

  it("un proyecto de terrenos (sin dormitorios) conserva su área y no inventa dormitorios", () => {
    const a = aviso(187263552) // Huanchuy Condominio
    expect(a).toMatchObject({ inmueble: "Proyecto", precio: 35900, moneda: "USD", area: "300 m2" })
    expect(a.dormitorios).toBeUndefined()
  })

  it("sin la lista de tipologías se usa el «desde» del proyecto y la propia tipología", () => {
    const base = { ...por(187068547), commercial_units: [] }
    const a = avisoDeInfocasas(base)
    expect(a).toMatchObject({ inmueble: "Proyecto", codigo: "proyecto-b34", precio: 108700, precioMax: 130600, moneda: "USD", dormitorios: "1, 2, 3", banios: "1, 2", area: "54 – 66 m2" })
    // No se guarda una sola tipología como si fuera todo el proyecto.
    expect(a.unidades).toBeUndefined()
    expect(normalizarAviso(a, 3.4)).toMatchObject({ precio: 108700, precio_max: 130600, unidades: null })
  })

  it("un aviso normal (no proyecto) sigue leyéndose como antes", () => {
    const normal = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "fixtures/infocasas.json"), "utf8")).searchFast.data[0]
    const a = avisoDeInfocasas(normal)
    expect(a.inmueble).not.toBe("Proyecto")
    expect(a.codigo).toBe(String(normal.id))
    expect(a.unidades).toBeUndefined()
    expect(a.precioMax).toBeUndefined()
  })

  it("los listados de proyectos forman parte de las búsquedas normales", () => {
    expect(infocasas.busquedas).toContain("proyectos")
  })
})
