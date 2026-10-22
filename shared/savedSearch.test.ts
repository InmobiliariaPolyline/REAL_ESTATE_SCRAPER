import { describe, expect, it } from "vitest"
import { parseAreaM2, pricePerM2 } from "./area"
import { DEFAULT_PORTAL_FILTERS, sanitizeFilterState } from "./savedSearch"

describe("parseAreaM2", () => {
  it("lee los formatos habituales de los portales", () => {
    expect(parseAreaM2("80 m²")).toBe(80)
    expect(parseAreaM2("85,5 m2")).toBe(85.5)
    expect(parseAreaM2("85.5 m²")).toBe(85.5)
    expect(parseAreaM2("Área: 120m²")).toBe(120)
  })

  it("distingue separador de miles de decimal", () => {
    expect(parseAreaM2("1.200 m²")).toBe(1200)
    expect(parseAreaM2("1,200 m²")).toBe(1200)
    expect(parseAreaM2("1.200,5 m²")).toBe(1200.5)
  })

  it("devuelve null sin número positivo", () => {
    expect(parseAreaM2(null)).toBeNull()
    expect(parseAreaM2("")).toBeNull()
    expect(parseAreaM2("sin dato")).toBeNull()
    expect(parseAreaM2("0 m²")).toBeNull()
  })
})

describe("pricePerM2", () => {
  it("divide el precio entre el área y tolera datos faltantes", () => {
    expect(pricePerM2(100000, "80 m²")).toBe(1250)
    expect(pricePerM2(0, "80 m²")).toBeNull()
    expect(pricePerM2(100000, "")).toBeNull()
    expect(pricePerM2(null, "80 m²")).toBeNull()
  })
})

describe("sanitizeFilterState", () => {
  it("devuelve los valores por defecto ante basura", () => {
    expect(sanitizeFilterState(null)).toEqual(DEFAULT_PORTAL_FILTERS)
    expect(sanitizeFilterState("texto")).toEqual(DEFAULT_PORTAL_FILTERS)
    expect(sanitizeFilterState([1, 2])).toEqual(DEFAULT_PORTAL_FILTERS)
  })

  it("descarta claves y valores no permitidos y normaliza tipos", () => {
    const r = sanitizeFilterState({
      distrito: "  Lince  ",
      operacion: "VENTA",
      inmueble: "Castillo",
      portales: ["Urbania", " PROPERATI ", 3, ""],
      moneda: "EUR",
      precioMin: "1500",
      precioMax: -1,
      dormitorios: "4+",
      otra: "x",
    })
    expect(r).toEqual({
      distrito: "Lince",
      operacion: "VENTA",
      inmueble: "todos",
      portales: ["urbania", "properati"],
      moneda: "PEN",
      precioMin: 1500,
      precioMax: "",
      dormitorios: "4+",
      banios: "todos",
      areaMin: "",
      areaMax: "",
      publicado: "todos",
      texto: "",
    })
    expect(Object.keys(r)).not.toContain("otra")
  })

  it("limita la cantidad de portales y el largo del distrito", () => {
    const r = sanitizeFilterState({
      distrito: "x".repeat(500),
      portales: Array.from({ length: 30 }, (_, i) => `p${i}`),
    })
    expect(r.distrito).toHaveLength(80)
    expect(r.portales).toHaveLength(10)
  })
})

describe("filtros nuevos de la búsqueda guardada", () => {
  it("acepta baños, área, publicación y texto, y descarta lo inválido", () => {
    expect(sanitizeFilterState({ banios: "3+", areaMin: "60", areaMax: 120, publicado: "semana", texto: "  vista al mar  " })).toMatchObject({
      banios: "3+",
      areaMin: 60,
      areaMax: 120,
      publicado: "semana",
      texto: "vista al mar",
    })
    expect(sanitizeFilterState({ banios: "9", areaMin: -4, areaMax: "x", publicado: "ayer", texto: "y".repeat(300) })).toMatchObject({
      banios: "todos",
      areaMin: "",
      areaMax: "",
      publicado: "todos",
    })
    expect(sanitizeFilterState({ texto: "y".repeat(300) }).texto).toHaveLength(80)
  })
})
