import { describe, expect, it } from "vitest"
import { MAX_UNIDADES, limpiarUnidades, resumirUnidades, unirUnidades } from "./proyectos"

const B34 = [
  { codigo: "187065797", dormitorios: 1, banios: 1, area: 54, precio: 108700 },
  { codigo: "187068541", dormitorios: 2, banios: 2, area: 65, precio: 120580 },
  { codigo: "187068547", dormitorios: 3, banios: 2, area: 66, precio: 130600 },
]

describe("resumirUnidades", () => {
  it("B34: desde 108,700 hasta 130,600, de 1 a 3 dormitorios, 54 a 66 m²", () => {
    expect(resumirUnidades(B34)).toEqual({ precio: 108700, precioMax: 130600, dormitorios: "1, 2, 3", banios: "1, 2", area: "54 – 66 m2" })
  })

  it("una sola tipología no tiene «hasta» ni rango", () => {
    expect(resumirUnidades([{ dormitorios: 3, banios: 2, area: 164, precio: 426400 }])).toEqual({ precio: 426400, precioMax: undefined, dormitorios: "3", banios: "2", area: "164 m2" })
  })

  it("tipologías con el mismo precio no inventan un rango, y las cantidades repetidas se muestran una vez", () => {
    const r = resumirUnidades([{ dormitorios: 3, area: 60, precio: 300000 }, { dormitorios: 3, area: 60, precio: 300000 }])
    expect(r).toMatchObject({ precio: 300000, precioMax: undefined, dormitorios: "3", area: "60 m2" })
  })

  it("las que no publican precio no cuentan para el rango; sin ningún precio, no hay precio", () => {
    expect(resumirUnidades([{ dormitorios: 1 }, { dormitorios: 2, precio: 200000 }, { dormitorios: 3, precio: 260000 }])).toMatchObject({ precio: 200000, precioMax: 260000, dormitorios: "1, 2, 3" })
    expect(resumirUnidades([{ dormitorios: 1, area: 37 }])).toMatchObject({ precio: undefined, precioMax: undefined, area: "37 m2" })
  })

  it("sin tipologías no devuelve nada", () => {
    expect(resumirUnidades([])).toEqual({ precio: undefined, precioMax: undefined, dormitorios: undefined, banios: undefined, area: undefined })
  })
})

describe("limpiarUnidades", () => {
  it("solo deja números positivos, sin tipologías vacías ni repetidas", () => {
    const r = limpiarUnidades([{}, { codigo: "a", precio: 100 }, { codigo: "a", precio: 100 }, { dormitorios: -1 }, { dormitorios: "2", area: "55,5", precio: "250000" }, null, "x", 5])
    expect(r).toEqual([{ codigo: "a", precio: 100 }, { dormitorios: 2, area: 55.5, precio: 250000 }])
  })

  it("no acepta algo que no sea una lista y limita la cantidad", () => {
    expect(limpiarUnidades(undefined)).toEqual([])
    expect(limpiarUnidades({ a: 1 })).toEqual([])
    const muchas = Array.from({ length: 200 }, (_, i) => ({ codigo: String(i), precio: 1000 + i }))
    expect(limpiarUnidades(muchas)).toHaveLength(MAX_UNIDADES)
  })

  it("recorta códigos largos y no deja pasar campos desconocidos", () => {
    const r = limpiarUnidades([{ codigo: "x".repeat(100), precio: 5, malicioso: "<script>" }])
    expect(r[0].codigo).toHaveLength(40)
    expect(r[0]).not.toHaveProperty("malicioso")
  })
})

describe("unirUnidades", () => {
  it("une las tipologías de dos avisos del mismo proyecto sin repetir la misma unidad (la más reciente manda)", () => {
    const r = unirUnidades([B34[0], B34[1]], [{ ...B34[1], precio: 125000 }, B34[2]])
    expect(r.map(u => u.codigo)).toEqual(["187065797", "187068541", "187068547"])
    expect(r.find(u => u.codigo === "187068541")?.precio).toBe(125000)
    expect(resumirUnidades(r)).toMatchObject({ precio: 108700, precioMax: 130600 })
  })
})
