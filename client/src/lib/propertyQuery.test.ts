import { describe, expect, it } from "vitest"
import {
  accentInsensitivePattern,
  bedroomsPattern,
  escapeLike,
  priceRangeOr,
} from "./propertyQuery"
import { DEFAULT_FILTERS, type FilterState } from "@/types"

const filters = (patch: Partial<FilterState>): FilterState => ({
  ...DEFAULT_FILTERS,
  portales: [],
  ...patch,
})

describe("bedroomsPattern", () => {
  it("'2' coincide con 2 pero no con 12", () => {
    const re = new RegExp(bedroomsPattern("2")!, "i")
    expect(re.test("2")).toBe(true)
    expect(re.test("2 dorm.")).toBe(true)
    expect(re.test("12")).toBe(false)
  })

  it("'4+' cubre 4 o más", () => {
    const re = new RegExp(bedroomsPattern("4+")!, "i")
    expect(re.test("4")).toBe(true)
    expect(re.test("5 dorm")).toBe(true)
    expect(re.test("10")).toBe(true)
    expect(re.test("3")).toBe(false)
  })

  it("'todos' no filtra", () => {
    expect(bedroomsPattern("todos")).toBeNull()
  })
})

describe("accentInsensitivePattern", () => {
  it("ignora tildes y mayúsculas", () => {
    const re = new RegExp(accentInsensitivePattern("san martin"), "i")
    expect(re.test("San Martín de Porres")).toBe(true)
  })

  it("escapa metacaracteres de regex", () => {
    const re = new RegExp(accentInsensitivePattern("a.b"), "i")
    expect(re.test("axb")).toBe(false)
    expect(re.test("a.b")).toBe(true)
  })
})

describe("escapeLike", () => {
  it("escapa % y _", () => {
    expect(escapeLike("50%_off")).toBe(String.raw`50\%\_off`)
  })
})

describe("priceRangeOr", () => {
  it("sin límites no genera condición", () => {
    expect(priceRangeOr(filters({}))).toBeNull()
  })

  it("PEN: compara precio y convierte precio_usd cuando precio no existe", () => {
    const or = priceRangeOr(filters({ moneda: "PEN", precioMin: 1000, precioMax: 2000 }))!
    expect(or).toContain("and(precio.gt.0,precio.gte.1000,precio.lte.2000)")
    expect(or).toContain("and(precio.eq.0,precio_usd.gt.0,")
    expect(or).toContain("and(precio.is.null,precio_usd.gt.0,")
  })

  it("USD: compara precio_usd y convierte precio", () => {
    const or = priceRangeOr(filters({ moneda: "USD", precioMax: 100 }))!
    expect(or).toContain("and(precio_usd.gt.0,precio_usd.lte.100)")
    expect(or).toContain("and(precio_usd.eq.0,precio.gt.0,precio.lte.375)")
  })
})
