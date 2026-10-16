import { describe, expect, it } from "vitest"
import {
  accentInsensitivePattern,
  bedroomsPattern,
  escapeLike,
} from "./filters"
import { validateEnlace } from "./validation"

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

describe("validateEnlace", () => {
  it("normaliza y acepta un enlace válido", () => {
    const r = validateEnlace({ titulo: " Ficha ", descripcion: " ", url: "https://e.com/x", tipo: "DOCUMENTACION" })
    expect(r).toEqual({
      ok: true,
      titulo: "Ficha",
      descripcion: null,
      url: "https://e.com/x",
      tipo: "DOCUMENTACION",
    })
  })

  it("rechaza título vacío, URLs peligrosas y tipos desconocidos", () => {
    expect(validateEnlace({ titulo: " ", descripcion: "", url: "https://e.com" }).ok).toBe(false)
    expect(validateEnlace({ titulo: "x", descripcion: "", url: "javascript:alert(1)" }).ok).toBe(false)
    expect(validateEnlace({ titulo: "x", descripcion: "", url: "https://e.com", tipo: "HACK" }).ok).toBe(false)
  })
})
